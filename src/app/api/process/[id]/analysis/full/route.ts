import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { ICONS } from '@/lib/icons';
import { getGeminiClient } from '@/lib/gemini-client';
import { ModelTier } from '@/lib/ai-model-types';
import { getCredits } from '@/lib/services/creditService';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import { captureApiError, setSentryUserContext } from '@/lib/sentry-error-handler';
import { getCreditManager } from '@/lib/credit-system';
import { log, logError } from '@/lib/services/logger';

// Type Guards - Narrowing Seguro (Mandato Inegociável)
function isAnalysisResult(data: unknown): data is Record<PropertyKey, unknown> {
  return typeof data === 'object' && data !== null;
}

function isTokenUsageObject(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && 'totalTokens' in data;
}

function isMovement(data: unknown): data is { eventDate: Date; eventType: string; description: string } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const m = data as Record<PropertyKey, unknown>;
  return (
    'eventDate' in m &&
    m.eventDate instanceof Date &&
    'eventType' in m &&
    typeof m.eventType === 'string' &&
    'description' in m &&
    typeof m.description === 'string'
  );
}

function isDocumentEntry(data: unknown): data is { name: string; extractedText?: string } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const d = data as Record<PropertyKey, unknown>;
  return (
    'name' in d &&
    typeof d.name === 'string' &&
    ((!('extractedText' in d)) || typeof d.extractedText === 'string')
  );
}

function isCaseDataValid(data: unknown): data is { number?: string | number; title?: string; status?: string; type?: string } {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const caseData = data as Record<PropertyKey, unknown>;
  return (
    (!('number' in caseData) || typeof caseData.number === 'string' || typeof caseData.number === 'number') &&
    (!('title' in caseData) || typeof caseData.title === 'string') &&
    (!('status' in caseData) || typeof caseData.status === 'string') &&
    (!('type' in caseData) || typeof caseData.type === 'string')
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const startTime = Date.now();
  let userId = '';
  let debitTransactionIds: string[] = [];

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }
    userId = user.id;
    const caseId = id;

    // Set Sentry context for error tracking
    setSentryUserContext(userId);

    console.log(`${ICONS.ROBOT} [Full Analysis] Iniciando para case ${caseId}`);

    // ========================================================================
    // PARTE 1: Validação básica (sem custos)
    // ========================================================================

    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        documents: true,
        processo: true,
        timelineEntries: {
          orderBy: { eventDate: 'desc' },
          take: 100
        },
        workspace: true
      }
    });

    if (!caseData) {
      return NextResponse.json(
        { success: false, error: 'Case não encontrado' },
        { status: 404 }
      );
    }

    if (caseData.onboardingStatus !== 'enriched' && caseData.onboardingStatus !== 'analyzed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Case ainda não foi enriquecido. Aguarde a conclusão do processamento JUDIT.',
          currentStatus: caseData.onboardingStatus
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // PARTE 2: 🚪 PORTÃO DE FERRO (ANTES DE TUDO)
    // ========================================================================
    // Cobrar o usuário ANTES de consumir recursos caros (Gemini API)

    const isDivinity = isInternalDivinityAdmin(user.email);

    if (!isDivinity) {
      console.log(`${ICONS.INFO} [Full Analysis] Iniciando débito de créditos (portão de ferro)...`);

      const creditManager = getCreditManager(prisma);
      const debitResult = await creditManager.debitCredits(
        caseData.workspaceId,
        0, // 0 report credits
        1, // 1 full credit
        `Full analysis for case ${caseId}`,
        { userId, caseId, timestamp: new Date().toISOString() }
      );

      // ✅ Se débito falha, REJEITA IMEDIATAMENTE (erro 402)
      if (!debitResult.success) {
        console.warn(`${ICONS.WARNING} [Full Analysis] Créditos insuficientes - portão fechado`);
        return NextResponse.json(
          {
            success: false,
            error: debitResult.error || 'Créditos insuficientes para análise completa',
            required: 1,
            available: (await getCredits(user.email, caseData.workspaceId)).fullCredits,
            code: 'INSUFFICIENT_CREDITS'
          },
          { status: 402 } // Payment Required
        );
      }

      // ✅ Débito passou - guardar IDs para reembolso em caso de erro
      debitTransactionIds = debitResult.transactionIds || [];
      console.log(`${ICONS.SUCCESS} [Full Analysis] Débito autorizado - ${debitTransactionIds.length} transações criadas`);
    }

    const lastVersion = await prisma.caseAnalysisVersion.findFirst({
      where: { caseId },
      orderBy: { version: 'desc' }
    });

    const nextVersion = (lastVersion?.version || 0) + 1;
    const prompt = buildFullAnalysisPrompt({
      caseData: {
        number: String(caseData.number || ''),
        title: String(caseData.title || ''),
        status: String(caseData.status || ''),
        type: String(caseData.type || '')
      },
      timeline: (caseData.timelineEntries || []) as TimelineEntry[],
      documents: (caseData.documents || []) as DocumentEntry[],
      juditData: caseData.processo?.dadosCompletos
    });

    console.log(`${ICONS.INFO} [Full Analysis] Prompt construído: ${prompt.length} chars`);

    // ========================================================================
    // PARTE 3: Operação Cara (só executa se débito passou ou é divinity)
    // ========================================================================

    console.log(`${ICONS.ROBOT} [Full Analysis] Chamando Gemini Pro...`);

    const gemini = getGeminiClient();
    const analysisStartTime = Date.now();

    // ========================================================================
    // PARTE 4: Try-Catch da operação cara (com reembolso em caso de erro)
    // ========================================================================

    let analysisRaw: unknown;
    try {
      analysisRaw = await gemini.generateJsonContent(prompt, {
        model: ModelTier.PRO,
        maxTokens: 8000,
        temperature: 0.2
      });
    } catch (geminiError) {
      // ❌ Gemini API falhou após débito
      console.error(`${ICONS.ERROR} [Full Analysis] Gemini API falhou:`, geminiError);

      // Reembolsar créditos (rollback)
      if (!isDivinity && debitTransactionIds.length > 0) {
        console.log(`${ICONS.PROCESS} [Full Analysis] Iniciando reembolso após erro da API...`);

        const creditManager = getCreditManager(prisma);
        const refundResult = await creditManager.refundCredits(
          debitTransactionIds,
          `Análise falhou: Erro na API Gemini`,
          { originalCaseId: caseId, error: String(geminiError) }
        );

        if (refundResult.success) {
          console.log(`${ICONS.SUCCESS} [Full Analysis] Reembolso bem-sucedido`);
        } else {
          console.error(`${ICONS.ERROR} [Full Analysis] Reembolso falhou:`, refundResult.error);
          // Log em alta prioridade (reembolso falhou = problema sério)
          await logError(
            `CRÍTICO: Reembolso de créditos falhou para case ${caseId}`,
            "error",
            { caseId, refundResult, debitTransactionIds, component: "creditSystem" }
          );
        }
      }

      // Retornar erro 500
      captureApiError(geminiError, {
        userId,
        caseId: id,
        endpoint: '/api/process/[id]/analysis/full',
        severity: 'HIGH'
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Erro ao gerar análise completa. Créditos foram reembolsados.',
          code: 'ANALYSIS_FAILED'
        },
        { status: 500 }
      );
    }

    // ✅ Gemini API sucedeu - prosseguir com a análise
    // Validar analysis com type guard
    const analysis = analysisRaw ?? {};
    if (!isAnalysisResult(analysis)) {
      throw new Error('Invalid analysis result format');
    }

    // Extract typed values from analysis com narrowing seguro
    const confidence = typeof analysis.confidence === 'number' ? analysis.confidence : 0.85;

    // Validar usage com type guard
    const rawUsage = analysis.usage;
    let tokensUsed = 0;
    if (isTokenUsageObject(rawUsage)) {
      tokensUsed = typeof rawUsage.totalTokens === 'number' ? rawUsage.totalTokens : 0;
    }

    const analysisDuration = Date.now() - analysisStartTime;
    console.log(`${ICONS.SUCCESS} [Full Analysis] Análise gerada em ${analysisDuration}ms`);

    // Converter para JSON seguro para Prisma (JSON.parse/stringify garante serialização segura)
    const analysisForDb = JSON.parse(JSON.stringify(analysis));

    // ========================================================================
    // PARTE 5: Salvar resultado (créditos já foram debitados)
    // ========================================================================

    const version = await prisma.caseAnalysisVersion.create({
      data: {
        case: {
          connect: { id: caseId }
        },
        workspace: {
          connect: { id: caseData.workspaceId }
        },
        version: nextVersion,
        status: 'COMPLETED',
        aiAnalysis: analysisForDb,
        analysisType: 'FULL',
        confidence,
        modelUsed: 'gemini-2.5-pro',
        processingTime: analysisDuration,
        costEstimate: 1.0,
        metadata: {
          userId,
          requestedAt: new Date().toISOString(),
          tokensUsed,
          creditTransactionIds: debitTransactionIds // Auditoria
        }
      }
    });

    console.log(`${ICONS.SUCCESS} [Full Analysis] Versão salva: ${version.id} (v${nextVersion})`);

    await prisma.case.update({
      where: { id: caseId },
      data: {
        onboardingStatus: 'analyzed'
      }
    });

    const totalDuration = Date.now() - startTime;
    console.log(`${ICONS.SUCCESS} [Full Analysis] Completo em ${totalDuration}ms`);

    return NextResponse.json({
      success: true,
      analysisId: version.id,
      version: nextVersion,
      analysis: analysisForDb,
      creditsUsed: 1.0,
      creditsDebitedAt: 'BEFORE_ANALYSIS', // ✅ Deixar claro
      timing: {
        total: totalDuration,
        analysis: analysisDuration
      },
      message: 'Análise completa gerada com sucesso'
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    // Se chegou aqui com debitTransactionIds, é um erro CRÍTICO (débito mas análise falhou)
    if (debitTransactionIds.length > 0) {
      console.error(
        `${ICONS.ERROR} [CRÍTICO] Débito foi autorizado mas análise falhou de forma inesperada:`,
        error
      );

      // Tentar reembolsar (esforço máximo)
      try {
        const creditManager = getCreditManager(prisma);
        const refundResult = await creditManager.refundCredits(
          debitTransactionIds,
          `Erro inesperado durante análise`,
          { error: String(error) }
        );

        if (!refundResult.success) {
          console.error(`${ICONS.FATAL} [FATAL] Reembolso de emergência falhou:`, refundResult.error);
          // Alertar ops (este é um bug crítico que afeta receita)
          await logError(
            `[FATAL] Reembolso de emergência falhou - créditos perdidos`,
            "error",
            { debitTransactionIds, error: String(error), component: "creditSystem" }
          );
        } else {
          console.log(`${ICONS.SUCCESS} [Full Analysis] Reembolso de emergência bem-sucedido`);
        }
      } catch (refundError) {
        console.error(`${ICONS.FATAL} [FATAL] Reembolso de emergência falhou com erro:`, refundError);
      }
    }

    captureApiError(error, {
      userId,
      caseId: id,
      endpoint: '/api/process/[id]/analysis/full',
      method: 'POST',
      duration,
      debitTransactionIds: debitTransactionIds.length > 0 ? debitTransactionIds : undefined
    });

    console.error(`${ICONS.ERROR} [Full Analysis] Erro:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao gerar análise completa'
      },
      { status: 500 }
    );
  }
}

// Type definitions for buildFullAnalysisPrompt
interface TimelineEntry {
  eventDate: Date;
  eventType: string;
  description: string;
}

interface DocumentEntry {
  name: string;
  extractedText?: string;
}

interface CaseDataForPrompt {
  number: string;
  title: string;
  status: string;
  type: string;
}

function buildFullAnalysisPrompt(data: {
  caseData: CaseDataForPrompt;
  timeline: TimelineEntry[];
  documents: DocumentEntry[];
  juditData?: unknown;
}): string {
  const { caseData, timeline, documents, juditData } = data;

  // Validar timeline entries com type guard
  const timelineText = timeline
    .filter(isMovement)
    .map((m) => `[${m.eventDate.toISOString().split('T')[0]}] ${m.eventType}: ${m.description}`)
    .join('\n');

  // Validar document entries com type guard
  const documentsText = documents
    .filter(isDocumentEntry)
    .filter((d) => d.extractedText)
    .map((d) => `Documento "${d.name}":\n${d.extractedText?.substring(0, 2000)}...`)
    .join('\n\n');

  const juditSummary = juditData
    ? JSON.stringify(juditData).substring(0, 5000)
    : 'Dados JUDIT não disponíveis';

  // Validar caseData com type guard
  if (!isCaseDataValid(caseData)) {
    throw new Error('Invalid case data format');
  }

  return `Você é um advogado especialista em análise estratégica de processos jurídicos.
Analise profundamente o processo abaixo e forneça uma análise estratégica completa.

# DADOS DO PROCESSO
**Número**: ${caseData.number || 'Não informado'}
**Título**: ${caseData.title || 'Não informado'}
**Status**: ${caseData.status || 'Não informado'}
**Tipo**: ${caseData.type || 'Não informado'}

# TIMELINE DE PRINCIPAIS MOVIMENTAÇÕES
${timelineText}

# DOCUMENTOS IMPORTANTES
${documentsText}

# DADOS OFICIAIS
${juditSummary}

# INSTRUÇÕES
Forneça uma análise estratégica COMPLETA contendo:
1. **executive_summary**: Resumo executivo do caso (3-5 parágrafos)
2. **legal_analysis**: Análise jurídica detalhada dos fundamentos e argumentos
3. **risk_assessment**: Avaliação de riscos e probabilidades de êxito
4. **key_events**: Eventos chave que mudaram o rumo do processo
5. **next_steps**: Próximos passos recomendados e estratégia sugerida
6. **deadlines**: Prazos importantes e urgentes
7. **strengths**: Pontos fortes da posição atual
8. **weaknesses**: Pontos fracos e vulnerabilidades
9. **recommendations**: Recomendações estratégicas específicas
10. **confidence**: Sua confiança nesta análise (0.0 a 1.0)

**FORMATO**: Retorne APENAS JSON válido com a estrutura acima.
**RESPOSTA (JSON)**:`;
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Método não permitido. Use POST.' },
    { status: 405 }
  );
}
