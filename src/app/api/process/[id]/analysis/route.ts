// ================================================================
// API ENDPOINT - Análise IA (GET análises / POST criar nova)
// ================================================================
// GET  /api/process/{id}/analysis - Recuperar análises salvas
// POST /api/process/{id}/analysis - Gerar nova análise (com dupla validação)
//
// Padrão de Validação Zod:
// - URL params: RouteIdParamSchema (valida que [id] é UUID válido)
// - Request body: CreateAnalysisPayloadSchema (valida level, workspaceId, etc)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AIModelRouter } from '@/lib/ai-model-router';
import { hasEnoughCredits, debitCredits } from '@/lib/services/creditService';
import { ICONS } from '@/lib/icons';
import { juditAPI, JuditOperationType } from '@/lib/judit-api-wrapper';
import { CreditCategory } from '@/lib/types/database';
import {
  CreateAnalysisPayloadSchema,
  CreateAnalysisPayload,
  RouteIdParamSchema,
  GetAnalysisQuerySchema,
  GetAnalysisQuery,
} from '@/lib/types/api-schemas';
import { isAIAnalysisData } from '@/lib/types/type-guards';
import type { AIAnalysisData } from '@/lib/types/json-fields';

// ================================================================
// INTERFACES - Query Results (Type-Safe Prisma Selects)
// ================================================================

/**
 * Interface para resultado da query de análises (linha 121)
 * Baseada no select de prisma.caseAnalysisVersion.findMany()
 */
interface AnalysisVersionFromQuery {
  id: string;
  version: number;
  status: string;
  analysisType: string;
  modelUsed: string | null;
  aiAnalysis: unknown;
  confidence: number | null;
  processingTime: number | null;
  createdAt: Date;
  metadata: unknown;
}

/**
 * Interface para resultado da query de documentos (linha 284)
 * Baseada no select de prisma.caseDocument.findMany()
 */
interface CaseDocumentFromQuery {
  id: string;
  cleanText: string | null;
  extractedText: string | null;
  originalName: string;
  type: string | null;
}

/**
 * Type Guard: Valida se valor é um JSON válido (exclui null e undefined)
 * PADRÃO-OURO: Type predicate sem casting
 */
function isValidJson(data: unknown): data is Record<string, unknown> | string | number | boolean {
  // Excluir null e undefined para compatibilidade com Prisma InputJsonValue
  if (data === undefined || data === null) return false;
  if (typeof data === 'boolean' || typeof data === 'number' || typeof data === 'string') {
    return true;
  }
  if (typeof data === 'object') {
    return true; // object ou array
  }
  return false;
}

/**
 * Type Guard: Valida estrutura da resposta de análise
 * PADRÃO-OURO: Safe narrowing sem casting (operador 'in' após verificação de objeto)
 */
function isAnalysisResult(data: unknown): data is { result: unknown; modelUsed?: string } {
  // Verificar se é um objeto válido
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  // Agora é seguro verificar a propriedade 'result'
  if (!('result' in data)) {
    return false;
  }

  return true;
}

/**
 * GET - Recuperar análises salvas do processo
 * Dupla validação: params (route ID) + query (filtros opcionais)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ============================================================
    // STEP 1: VALIDAÇÃO DE PARÂMETROS DA ROTA (params)
    // ============================================================
    const resolvedParams = await params;
    const paramParseResult = RouteIdParamSchema.safeParse(resolvedParams);

    if (!paramParseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'ID do processo inválido na URL.',
          errors: paramParseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { id: processId } = paramParseResult.data;

    // ============================================================
    // STEP 2: VALIDAÇÃO DE QUERY PARAMETERS (searchParams)
    // ============================================================
    const rawQuery = Object.fromEntries(request.nextUrl.searchParams.entries());
    const queryParseResult = GetAnalysisQuerySchema.safeParse(rawQuery);

    if (!queryParseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Parâmetros de query inválidos.',
          errors: queryParseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const query: GetAnalysisQuery = queryParseResult.data;

    console.log(
      `${ICONS.SEARCH} Buscando análises para processo: ${processId}${
        query.level ? ` (level: ${query.level})` : ''
      }`
    );

    // ============================================================
    // STEP 3: LÓGICA DO SERVIÇO (Validação Concluída)
    // ============================================================

    // Buscar todas as análises do processo, ordenadas por versão (mais recentes primeiro)
    // Filtrar por nível se especificado
    const analyses = await prisma.caseAnalysisVersion.findMany({
      where: {
        caseId: processId,
        ...(query.level && { analysisType: query.level === 'FULL' ? 'complete' : 'strategic' }),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        status: true,
        analysisType: true,
        modelUsed: true,
        aiAnalysis: true,
        confidence: true,
        processingTime: true,
        createdAt: true,
        metadata: true,
      },
    });

    console.log(`${ICONS.SUCCESS} Encontradas ${analyses.length} análise(s)`);

    return NextResponse.json({
      success: true,
      analyses: analyses.map((a: AnalysisVersionFromQuery) => {
        // --- VALIDAÇÃO DO OUTPUT (JSON) ---
        // Validar o campo 'aiAnalysis' usando type-guard
        if (!isAIAnalysisData(a.aiAnalysis)) {
          // Se os dados no DB estiverem corrompidos ou em formato antigo,
          // retorne um objeto seguro e logue o erro.
          console.warn(`Dados de análise corrompidos para o ID: ${a.id}`);
          return {
            id: a.id,
            version: a.version,
            createdAt: a.createdAt,
            status: a.status,
            analysisType: a.analysisType,
            model: a.modelUsed,
            confidence: a.confidence,
            processingTime: a.processingTime,
            summary: 'Erro: Dados de análise inválidos.',
            keyPoints: [],
            legalAssessment: undefined,
            riskAssessment: undefined,
            timelineAnalysis: undefined,
            data: null,
          };
        }

        // A partir daqui, 'a.aiAnalysis' é 100% type-safe
        const analysisData: AIAnalysisData = a.aiAnalysis;

        // --- CONSTRUÇÃO DA RESPOSTA SEGURA ---
        return {
          id: a.id,
          version: a.version,
          createdAt: a.createdAt,
          status: a.status,
          analysisType: a.analysisType,
          model: a.modelUsed,
          confidence: a.confidence,
          processingTime: a.processingTime,
          // Acesso 100% type-safe ao objeto validado (sem casting)
          // analysisData é 100% provado pelo isAIAnalysisData
          summary:
            analysisData.analise_estrategica?.summary ||
            analysisData.analise_estrategica?.resumo_executivo,
          keyPoints:
            analysisData.analise_estrategica?.keyPoints ||
            analysisData.analise_estrategica?.pontos_principais,
          legalAssessment:
            analysisData.analise_estrategica?.legalAssessment ||
            analysisData.analise_estrategica?.avaliacao_juridica,
          riskAssessment:
            analysisData.analise_estrategica?.riskAssessment ||
            analysisData.analise_estrategica?.analise_risco,
          timelineAnalysis:
            analysisData.situacao_processual?.timelineAnalysis ||
            analysisData.situacao_processual?.analise_cronograma,
          // Envia o objeto completo e validado
          data: analysisData,
        };
      }),
    });
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar análises:`, error);
    return NextResponse.json(
      { error: 'Erro ao buscar análises' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ============================================================
    // STEP 1: VALIDAÇÃO DE PARÂMETROS DA ROTA (params)
    // ============================================================
    const resolvedParams = await params;
    const paramParseResult = RouteIdParamSchema.safeParse(resolvedParams);

    if (!paramParseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'ID do processo inválido na URL.',
          errors: paramParseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { id: processId } = paramParseResult.data;
    console.log(`${ICONS.PROCESS} Iniciando análise para processo: ${processId}`);

    // ============================================================
    // STEP 2: VALIDAÇÃO DO BODY DA REQUISIÇÃO (JSON)
    // ============================================================
    const rawBody: unknown = await request.json();
    const bodyParseResult = CreateAnalysisPayloadSchema.safeParse(rawBody);

    if (!bodyParseResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Payload de análise inválido.',
          errors: bodyParseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { level, workspaceId }: CreateAnalysisPayload =
      bodyParseResult.data;

    // ============================================================
    // STEP 3: LÓGICA DO SERVIÇO (Validação Concluída)
    // ============================================================

    // Verificar créditos
    const creditCost = level === 'FULL' ? 1 : 0;
    const creditCategory = level === 'FULL' ? CreditCategory.FULL : CreditCategory.REPORT;
    const hasCredits = await hasEnoughCredits(
      undefined,
      workspaceId,
      creditCost,
      creditCategory
    );

    if (!hasCredits) {
      console.error(`${ICONS.ERROR} Créditos insuficientes para análise ${level}`);
      return NextResponse.json(
        { error: 'Créditos insuficientes', details: 'Sua conta não tem créditos suficientes para esta análise' },
        { status: 402 }
      );
    }

    console.log(`${ICONS.SUCCESS} Créditos verificados - prosseguindo com análise`);

    // Buscar documentos do caso
    const documents = await prisma.caseDocument.findMany({
      where: { caseId: processId },
      select: {
        id: true,
        cleanText: true,
        extractedText: true,
        originalName: true,
        type: true
      },
      take: 20 // Limitar para performance
    });

    console.log(`${ICONS.SEARCH} Encontrados ${documents.length} documento(s) para ${level}`);

    // Concatenar texto dos documentos
    const fullText = documents
      .map((d: CaseDocumentFromQuery) => d.cleanText || d.extractedText || '')
      .filter(Boolean)
      .join('\n\n');

    if (!fullText) {
      return NextResponse.json(
        {
          error: 'Nenhum texto encontrado para análise',
          suggestion: 'Faça upload de documentos ou use a opção FULL'
        },
        { status: 400 }
      );
    }

    // Selecionar modelo baseado no nível
    const modelUsed = level === 'FULL' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

    console.log(`${ICONS.INFO} Usando modelo: ${modelUsed} para análise ${level}`);

    // Criar versão em andamento
    const nextVersion = await getNextVersionNumber(processId);
    const startTime = Date.now();

    const analysisVersion = await prisma.caseAnalysisVersion.create({
      data: {
        caseId: processId,
        workspaceId,
        version: nextVersion,
        status: 'PROCESSING',
        analysisType: level === 'FULL' ? 'complete' : 'strategic',
        modelUsed,
        confidence: 0,
        metadata: {
          level,
          documentCount: documents.length,
          startedAt: new Date().toISOString()
        }
      }
    });

    console.log(`${ICONS.SUCCESS} Versão ${nextVersion} criada - ID: ${analysisVersion.id}`);

    // Track analysis request telemetry
    const analysisRequestTime = Date.now() - startTime;
    await juditAPI.trackCall({
      workspaceId,
      operationType: JuditOperationType.ANALYSIS,
      durationMs: analysisRequestTime,
      success: true,
      requestId: analysisVersion.id,
      metadata: {
        eventType: 'analysis.requested',
        level,
        model: modelUsed,
        documentCount: documents.length,
        textLength: fullText.length,
        analysisType: level === 'FULL' ? 'complete' : 'strategic',
      },
    });

    // Processar em background
    processAnalysisInBackground(
      analysisVersion.id,
      processId,
      fullText,
      level,
      modelUsed,
      workspaceId,
      documents.length
    ).catch(error => {
      console.error(`${ICONS.ERROR} Erro no processamento:`, error);
    });

    return NextResponse.json({
      success: true,
      analysisId: analysisVersion.id,
      version: nextVersion,
      level,
      model: modelUsed,
      estimatedTime: level === 'FULL' ? '20-30 segundos' : '10-15 segundos'
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao gerar análise:`, error);
    return NextResponse.json(
      { error: 'Erro ao gerar análise', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 }
    );
  }
}

/**
 * Processa análise em background usando Gemini
 */
async function processAnalysisInBackground(
  analysisVersionId: string,
  processId: string,
  fullText: string,
  level: 'FAST' | 'FULL',
  modelUsed: string,
  workspaceId: string,
  documentCount: number
) {
  try {
    console.log(`${ICONS.PROCESS} Iniciando processamento background para análise ${analysisVersionId}`);

    const startTime = Date.now();

    // Chamar Gemini para análise real
    let analysisResult;

    // PADRÃO-OURO: Instanciar AIModelRouter corretamente
    const router = new AIModelRouter();

    if (level === 'FULL') {
      // FULL: Análise estratégica completa com Gemini Pro
      console.log(`${ICONS.STAR} Executando análise FULL com Gemini Pro...`);
      analysisResult = await router.analyzeStrategic(
        fullText,
        Math.ceil(fullText.length / 1024 / 1024), // Estimar MB
        workspaceId
      );
    } else {
      // FAST: Análise rápida com Gemini Flash
      console.log(`${ICONS.ROCKET} Executando análise FAST com Gemini Flash...`);
      analysisResult = await router.analyzePhase1(
        fullText,
        Math.ceil(fullText.length / 1024 / 1024), // Estimar MB
        workspaceId
      );
    }

    const processingTime = Date.now() - startTime;

    // PADRÃO-OURO: Type-safe narrowing do resultado de análise
    if (!isAnalysisResult(analysisResult)) {
      throw new Error('Resultado de análise em formato inválido');
    }

    // A partir daqui, 'analysisResult' é 100% type-safe com .result
    const analysisDataRaw = analysisResult.result;
    const modelUsedFinal = analysisResult.modelUsed || modelUsed;

    // PADRÃO-OURO: Validar em runtime (throw if invalid)
    if (!isValidJson(analysisDataRaw)) {
      throw new Error('Dados de análise em formato inválido - não é um JSON válido');
    }

    // Devido a tipos restritivos do Prisma, fazer bypass tipo-seguro
    // Dados foram validados em runtime acima com isValidJson()
    // aiAnalysis é String, não Json - serializar com JSON.stringify()
    const updateData: Record<string, unknown> = {
      status: 'COMPLETED',
      aiAnalysis: JSON.stringify(analysisDataRaw),
      modelUsed: modelUsedFinal,
      confidence: level === 'FULL' ? 0.95 : 0.85,
      processingTime,
      metadata: {
        level,
        documentCount,
        completedAt: new Date().toISOString(),
        processingTimeMs: processingTime,
        creditsConsumed: level === 'FULL' ? 1 : 0
      }
    };

    // Salvar resultado (dados validados em runtime acima)
    await prisma.caseAnalysisVersion.update({
      where: { id: analysisVersionId },
      data: updateData,
    });

    // Debitar crédito
    if (level === 'FULL') {
      await debitCredits(
        undefined,
        workspaceId,
        1,
        CreditCategory.FULL,
        'strategic_analysis'
      );
    }

    console.log(
      `${ICONS.SUCCESS} Análise ${analysisVersionId} concluída em ${(processingTime / 1000).toFixed(1)}s`
    );

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao processar análise:`, error);

    // Marcar como erro no banco
    await prisma.caseAnalysisVersion.update({
      where: { id: analysisVersionId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        metadata: {
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          failedAt: new Date().toISOString()
        }
      }
    });

    console.error(`${ICONS.ERROR} Falha na análise ${analysisVersionId}:`, error instanceof Error ? error.message : 'Desconhecido');
  }
}

/**
 * Gera próximo número de versão
 */
async function getNextVersionNumber(processId: string): Promise<number> {
  const lastVersion = await prisma.caseAnalysisVersion.findFirst({
    where: { caseId: processId },
    orderBy: { version: 'desc' },
    select: { version: true }
  });

  return (lastVersion?.version || 0) + 1;
}

