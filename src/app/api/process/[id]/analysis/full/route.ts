import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { ICONS } from '@/lib/icons';
import { getGeminiClient } from '@/lib/gemini-client';
import { ModelTier } from '@/lib/ai-model-types';
import { getCredits, debitCredits } from '@/lib/services/creditService';
import { isInternalDivinityAdmin } from '@/lib/permission-validator';
import { captureApiError, setSentryUserContext, setSentryWorkspaceContext } from '@/lib/sentry-error-handler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const startTime = Date.now();
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse('Não autenticado');
    }
    const userId = user.id;
    const caseId = id;

    // Set Sentry context for error tracking
    setSentryUserContext(userId);

    console.log(`${ICONS.ROBOT} [Full Analysis] Iniciando para case ${caseId}`);

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

    const lastVersion = await prisma.caseAnalysisVersion.findFirst({
      where: { caseId },
      orderBy: { version: 'desc' }
    });

    const nextVersion = (lastVersion?.version || 0) + 1;
    const prompt = buildFullAnalysisPrompt({
      caseData,
      timeline: caseData.timelineEntries,
      documents: caseData.documents,
      juditData: caseData.processo?.dadosCompletos
    });

    console.log(`${ICONS.INFO} [Full Analysis] Prompt construído: ${prompt.length} chars`);

    // Check credits before expensive operation
    const isDivinity = isInternalDivinityAdmin(user.email);
    if (!isDivinity) {
      const credits = await getCredits(user.email, caseData.workspaceId);
      if (credits.fullCredits < 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Créditos insuficientes para análise completa',
            required: 1,
            available: credits.fullCredits,
            message: 'Você precisa de 1 crédito FULL para realizar uma análise completa. Entre em contato com o suporte para adquirir mais créditos.'
          },
          { status: 402 } // Payment Required
        );
      }
    }

    console.log(`${ICONS.ROBOT} [Full Analysis] Chamando Gemini Pro...`);

    const gemini = getGeminiClient();
    const analysisStartTime = Date.now();

    const analysis = await gemini.generateJsonContent(prompt, {
      model: ModelTier.PRO,
      maxTokens: 8000,
      temperature: 0.2,
      timeout: 120000
    });

    const analysisDuration = Date.now() - analysisStartTime;
    console.log(`${ICONS.SUCCESS} [Full Analysis] Análise gerada em ${analysisDuration}ms`);

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
        aiAnalysis: analysis,
        analysisType: 'FULL',
        confidence: analysis.confidence || 0.85,
        modelUsed: 'gemini-2.5-pro',
        processingTime: analysisDuration,
        costEstimate: 1.0,
        metadata: {
          userId,
          requestedAt: new Date().toISOString(),
          tokensUsed: analysis.usage?.totalTokens || 0
        }
      }
    });

    console.log(`${ICONS.SUCCESS} [Full Analysis] Versão salva: ${version.id} (v${nextVersion})`);

    // Debit credits if not a divinity admin
    if (!isDivinity) {
      const debitResult = await debitCredits(
        user.email,
        caseData.workspaceId,
        1,
        'FULL',
        `Full analysis for case ${caseId} - v${nextVersion}`
      );
      if (!debitResult.success) {
        console.warn(`${ICONS.WARNING} Failed to debit credits: ${debitResult.reason}`);
        // Log but don't fail the request - the analysis was already completed
      } else {
        console.log(`${ICONS.SUCCESS} Credits debited: 1 FULL credit (new balance: ${debitResult.newBalance.fullCredits})`);
      }
    }

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
      analysis: analysis,
      creditsUsed: 1.0,
      timing: {
        total: totalDuration,
        analysis: analysisDuration
      },
      message: 'Análise completa gerada com sucesso'
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    // Capture error to Sentry with context
    captureApiError(error, {
      userId,
      caseId: id,
      endpoint: '/api/process/[id]/analysis/full',
      method: 'POST',
      duration,
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

function buildFullAnalysisPrompt(data: {
  caseData: any;
  timeline: any[];
  documents: any[];
  juditData?: any;
}): string {
  const { caseData, timeline, documents, juditData } = data;

  const timelineText = timeline
    .map((m: any) => `[${m.eventDate.toISOString().split('T')[0]}] ${m.eventType}: ${m.description}`)
    .join('\n');

  const documentsText = documents
    .filter((d: any) => d.extractedText)
    .map((d: any) => `Documento "${d.name}":\n${d.extractedText?.substring(0, 2000)}...`)
    .join('\n\n');

  const juditSummary = juditData
    ? JSON.stringify(juditData).substring(0, 5000)
    : 'Dados JUDIT não disponíveis';

  return `Você é um advogado especialista em análise estratégica de processos jurídicos.
Analise profundamente o processo abaixo e forneça uma análise estratégica completa.

# DADOS DO PROCESSO
**Número**: ${caseData.number}
**Título**: ${caseData.title}
**Status**: ${caseData.status}
**Tipo**: ${caseData.type}

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
