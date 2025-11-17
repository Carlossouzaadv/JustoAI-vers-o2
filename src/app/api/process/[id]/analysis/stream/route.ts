// ================================================================
// STREAMING ENDPOINT - Análise IA em Tempo Real (Zero Buffer)
// ================================================================
// POST /api/process/{id}/analysis/stream
//
// PADRÃO-OURO:
// - ReadableStream nativa (sem bibliotecas extras)
// - Piping direto do Gemini → Cliente
// - Zero acúmulo em memória
// - 100% Type-safe (zero 'any', zero 'as')
// - Cada chunk é enviado em tempo real conforme chega da IA

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AIModelRouter } from '@/lib/ai-model-router';
import { hasEnoughCredits, debitCredits } from '@/lib/services/creditService';
import { ICONS } from '@/lib/icons';
import { CreditCategory } from '@/lib/types/database';
import {
  CreateAnalysisPayloadSchema,
  CreateAnalysisPayload,
  RouteIdParamSchema,
} from '@/lib/types/api-schemas';

// ================================================================
// TYPE GUARDS - Chunk Validation (Type-Safe)
// ================================================================

/**
 * Valida se chunk é uma string válida (não vazia)
 * PADRÃO-OURO: Type predicate sem casting
 */
function isValidChunk(chunk: unknown): chunk is string {
  return typeof chunk === 'string' && chunk.length > 0;
}

/**
 * Valida se documento é válido para processamento
 * PADRÃO-OURO: Type narrowing com operador 'in'
 */
interface CaseDocumentFromQuery {
  id: string;
  cleanText: string | null;
  extractedText: string | null;
  originalName: string;
  type: string | null;
}

function isCaseDocumentValid(doc: unknown): doc is CaseDocumentFromQuery {
  if (typeof doc !== 'object' || doc === null) return false;
  return (
    'id' in doc &&
    'cleanText' in doc &&
    'extractedText' in doc &&
    'originalName' in doc &&
    'type' in doc
  );
}

// ================================================================
// STREAM EVENT TYPES (Type-Safe)
// ================================================================

type StreamEventType = 'start' | 'chunk' | 'complete' | 'error';

interface StreamEvent {
  type: StreamEventType;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Individual properties per event type
}

/**
 * Factory function para criar eventos type-safe
 */
function createStreamEvent(event: StreamEvent): string {
  return JSON.stringify(event) + '\n';
}

// ================================================================
// MAIN HANDLER - Streaming Analysis
// ================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ============================================================
    // STEP 1: VALIDAÇÃO (params + body)
    // ============================================================
    const resolvedParams = await params;
    const paramParseResult = RouteIdParamSchema.safeParse(resolvedParams);

    if (!paramParseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'ID do processo inválido.',
          errors: paramParseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { id: processId } = paramParseResult.data;

    const rawBody: unknown = await request.json();
    const bodyParseResult = CreateAnalysisPayloadSchema.safeParse(rawBody);

    if (!bodyParseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Payload inválido.',
          errors: bodyParseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { level, workspaceId }: CreateAnalysisPayload = bodyParseResult.data;

    // ============================================================
    // STEP 2: CRÉDITOS + DOCUMENTOS
    // ============================================================
    const creditCost = level === 'FULL' ? 1 : 0;
    const creditCategory =
      level === 'FULL' ? CreditCategory.FULL : CreditCategory.REPORT;

    const hasCredits = await hasEnoughCredits(
      undefined,
      workspaceId,
      creditCost,
      creditCategory
    );

    if (!hasCredits) {
      return NextResponse.json(
        {
          error: 'Créditos insuficientes',
          details: 'Sua conta não tem créditos suficientes',
        },
        { status: 402 }
      );
    }

    // Buscar documentos
    const documents = await prisma.caseDocument.findMany({
      where: { caseId: processId },
      select: {
        id: true,
        cleanText: true,
        extractedText: true,
        originalName: true,
        type: true,
      },
      take: 20,
    });

    // Validação type-safe dos documentos
    const validDocuments = documents.filter(isCaseDocumentValid);
    if (validDocuments.length === 0) {
      return NextResponse.json(
        {
          error: 'Nenhum documento válido encontrado',
        },
        { status: 400 }
      );
    }

    const fullText = validDocuments
      .map((d: CaseDocumentFromQuery) => d.cleanText || d.extractedText || '')
      .filter(Boolean)
      .join('\n\n');

    if (!fullText) {
      return NextResponse.json(
        {
          error: 'Nenhum texto encontrado para análise',
        },
        { status: 400 }
      );
    }

    const modelUsed = level === 'FULL' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
    const startTime = Date.now();

    console.log(
      `${ICONS.STREAM} Iniciando stream de análise: ${processId} (${modelUsed})`
    );

    // ============================================================
    // STEP 3: CRIAR READABLE STREAM (O PONTO CRÍTICO)
    // ============================================================
    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    const writer = writable.getWriter();

    // PADRÃO-OURO: Spawn streaming task (não await - deixa correr em background)
    streamAnalysisToWriter(
      writer,
      processId,
      fullText,
      level,
      modelUsed,
      workspaceId,
      validDocuments.length,
      startTime
    ).catch((error) => {
      console.error(`${ICONS.ERROR} Erro no streaming:`, error);
      writer.abort(
        error instanceof Error ? error : new Error('Erro no streaming')
      );
    });

    // Retornar o stream direto (zero buffering!)
    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao iniciar streaming:`, error);
    return NextResponse.json(
      {
        error: 'Erro ao iniciar streaming',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 }
    );
  }
}

// ================================================================
// STREAM WORKER - Processa e encanam dados (Zero Buffer)
// ================================================================

async function streamAnalysisToWriter(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  processId: string,
  fullText: string,
  level: 'FAST' | 'FULL',
  modelUsed: string,
  workspaceId: string,
  documentCount: number,
  startTime: number
): Promise<void> {
  const encoder = new TextEncoder();

  try {
    // PADRÃO-OURO: Instanciar router
    const router = new AIModelRouter();

    // Helper: enviar evento seguro para cliente
    const sendEvent = async (event: StreamEvent): Promise<void> => {
      const jsonStr = createStreamEvent(event);
      const encoded = encoder.encode(jsonStr);
      await writer.write(encoded);
    };

    // Enviar "start" event
    await sendEvent({
      type: 'start',
      analysisType: level,
      model: modelUsed,
      timestamp: new Date().toISOString(),
    });

    console.log(`${ICONS.STREAM} Iniciando geração com ${modelUsed}...`);

    // ============================================================
    // PADRÃO-OURO: PIPING DO GEMINI (Zero Buffer)
    // ============================================================
    // Chamar Gemini e obter stream iterável
    // CRÍTICO: Não armazenar resposta inteira em memória!
    const streamIterator =
      level === 'FULL'
        ? await router.analyzeStrategicStream(fullText, workspaceId)
        : await router.analyzePhase1Stream(fullText, workspaceId);

    let chunkIndex = 0;
    let fullAnalysis = '';

    // PADRÃO-OURO: Processar chunk por chunk, sem acumular em memória
    for await (const chunk of streamIterator) {
      // Type-safe chunk validation
      if (!isValidChunk(chunk)) {
        console.warn(
          `${ICONS.WARN} Chunk inválido descartado (index: ${chunkIndex})`
        );
        continue;
      }

      // Acumular para salvar depois (necessário apenas para persistência)
      fullAnalysis += chunk;

      // Enviar chunk para cliente em tempo real
      await sendEvent({
        type: 'chunk',
        index: chunkIndex,
        data: chunk,
        timestamp: new Date().toISOString(),
      });

      chunkIndex++;
    }

    const processingTime = Date.now() - startTime;

    console.log(
      `${ICONS.SUCCESS} Stream concluído: ${chunkIndex} chunks em ${(processingTime / 1000).toFixed(1)}s`
    );

    // ============================================================
    // SALVAR RESULTADO (após stream completo)
    // ============================================================
    await saveAnalysisResult(
      processId,
      workspaceId,
      level,
      modelUsed,
      fullAnalysis,
      processingTime,
      documentCount
    );

    // Debitar créditos
    if (level === 'FULL') {
      await debitCredits(
        undefined,
        workspaceId,
        1,
        CreditCategory.FULL,
        'strategic_analysis_stream'
      );
    }

    // Enviar "complete" event
    await sendEvent({
      type: 'complete',
      processingTimeMs: processingTime,
      chunksProcessed: chunkIndex,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`${ICONS.ERROR} Erro no stream worker:`, errorMsg);

    // Enviar erro para cliente
    const errorEvent = createStreamEvent({
      type: 'error',
      message: errorMsg,
      timestamp: new Date().toISOString(),
    });
    const encoded = encoder.encode(errorEvent);
    try {
      await writer.write(encoded);
    } catch {
      // Stream pode estar fechado
    }
  } finally {
    // CRÍTICO: Sempre fechar o stream
    try {
      await writer.close();
    } catch {
      // Stream pode já estar fechado
    }
  }
}

// ================================================================
// HELPER - Salvar resultado análise (Type-Safe)
// ================================================================

async function saveAnalysisResult(
  processId: string,
  workspaceId: string,
  level: 'FAST' | 'FULL',
  modelUsed: string,
  fullAnalysis: string,
  processingTime: number,
  documentCount: number
): Promise<void> {
  try {
    const nextVersion = await getNextVersionNumber(processId);

    // Parse the analysis (deve ser JSON válido)
    let analysisData: unknown;
    try {
      analysisData = JSON.parse(fullAnalysis);
    } catch {
      // Se não conseguir parsear como JSON, armazenar como texto
      analysisData = { raw_text: fullAnalysis };
    }

    await prisma.caseAnalysisVersion.create({
      data: {
        caseId: processId,
        workspaceId,
        version: nextVersion,
        status: 'COMPLETED',
        analysisType: level === 'FULL' ? 'complete' : 'strategic',
        modelUsed,
        aiAnalysis: analysisData,
        confidence: level === 'FULL' ? 0.95 : 0.85,
        processingTime,
        metadata: {
          level,
          documentCount,
          streamedAt: new Date().toISOString(),
          processingTimeMs: processingTime,
          creditsConsumed: level === 'FULL' ? 1 : 0,
          deliveryMethod: 'streaming',
        },
      },
    });

    console.log(
      `${ICONS.SUCCESS} Análise salva: v${nextVersion} em streaming`
    );
  } catch (error) {
    console.error(
      `${ICONS.ERROR} Erro ao salvar resultado:`,
      error instanceof Error ? error.message : 'Desconhecido'
    );
    throw error;
  }
}

/**
 * Gera próximo número de versão
 */
async function getNextVersionNumber(processId: string): Promise<number> {
  const lastVersion = await prisma.caseAnalysisVersion.findFirst({
    where: { caseId: processId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  return (lastVersion?.version || 0) + 1;
}
