// ================================================================
// API ENDPOINT - Análise FAST
// ================================================================
// POST /process/{id}/analysis/fast
// Análise rápida usando documentos já anexados ao processo

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse, validateBody, requireAuth, withErrorHandler } from '@/lib/api-utils';
import { DeepAnalysisService } from '@/lib/deep-analysis-service';
import { CreditSystem } from '@/lib/credit-system';
import { ICONS } from '@/lib/icons';

// Schema de validação
const fastAnalysisSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID é obrigatório'),
  forceReprocessing: z.boolean().optional().default(false),
  userId: z.string().optional()
});

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const processId = params.id;

  // Auth check
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  // Validate request body
  const { data, error: validationError } = await validateBody(request, fastAnalysisSchema);
  if (validationError) return validationError;

  const { workspaceId, forceReprocessing, userId } = data;

  console.log(`${ICONS.PROCESS} Iniciando análise FAST para processo: ${processId}`);

  try {
    const analysisService = new DeepAnalysisService();
    const creditSystem = new CreditSystem();

    // Verificar se o processo existe e pertence ao workspace
    const processExists = await analysisService.validateProcessAccess(processId, workspaceId);
    if (!processExists) {
      return errorResponse('Processo não encontrado ou acesso negado', 404);
    }

    // Buscar documentos já anexados ao processo
    const attachedDocs = await analysisService.getProcessDocuments(processId);
    if (attachedDocs.length === 0) {
      return errorResponse(
        'Nenhum documento encontrado. Anexe documentos ao processo ou use a análise FULL com upload.',
        400
      );
    }

    // Gerar chave de análise baseada nos documentos existentes
    const analysisKey = await analysisService.generateAnalysisKey({
      processId,
      documentHashes: attachedDocs.map(doc => doc.textSha),
      analysisType: 'FAST',
      modelVersion: 'gemini-1.5-flash'
    });

    console.log(`${ICONS.INFO} Analysis key gerada: ${analysisKey}`);

    // Verificar cache se não for reprocessamento forçado
    if (!forceReprocessing) {
      const cachedResult = await analysisService.getCachedAnalysis(analysisKey, processId);

      if (cachedResult) {
        console.log(`${ICONS.SUCCESS} Cache HIT - Retornando análise FAST cacheada`);

        // Incrementar contador de acesso ao cache
        await analysisService.incrementCacheAccess(analysisKey);

        return successResponse({
          analysisId: cachedResult.id,
          versionNumber: cachedResult.versionNumber,
          source: 'cache',
          analysisType: 'FAST',
          model: cachedResult.modelUsed,
          summary: cachedResult.summaryJson,
          insights: cachedResult.insightsJson,
          confidence: cachedResult.confidenceScore,
          reportUrl: cachedResult.reportUrl,
          creditsUsed: 0, // Cache não consome créditos
          createdAt: cachedResult.createdAt,
          processingTime: 50 // Cache é rápido
        });
      }
    }

    // Verificar se já existe job em andamento
    const existingJob = await analysisService.getActiveJob(analysisKey);
    if (existingJob) {
      return successResponse({
        analysisId: existingJob.id,
        source: 'processing',
        status: existingJob.status,
        progress: existingJob.progress,
        estimatedTime: '30-60 segundos',
        message: 'Análise FAST já está em andamento'
      });
    }

    // Adquirir lock Redis para evitar processamento duplo
    const lockResult = await analysisService.acquireAnalysisLock(analysisKey, 300); // 5 minutos
    if (!lockResult.acquired) {
      return errorResponse(
        'Análise já está sendo processada por outro worker',
        429,
        { retryAfter: lockResult.ttl }
      );
    }

    try {
      // Criar próxima versão de análise
      const nextVersion = await analysisService.getNextVersionNumber(processId);

      // Criar registro de versão (status PENDING)
      const analysisVersion = await analysisService.createAnalysisVersion({
        processId,
        workspaceId,
        versionNumber: nextVersion,
        analysisType: 'FAST',
        modelUsed: 'gemini-1.5-flash',
        analysisKey,
        sourceFilesMetadata: attachedDocs.map(doc => ({
          id: doc.id,
          name: doc.name,
          textSha: doc.textSha,
          size: doc.size
        })),
        createdBy: userId || user.id
      });

      // Criar job de análise
      const analysisJob = await analysisService.createAnalysisJob({
        processId,
        workspaceId,
        analysisKey,
        analysisType: 'FAST',
        modelHint: 'gemini-1.5-flash',
        filesMetadata: attachedDocs,
        resultVersionId: analysisVersion.id,
        lockToken: lockResult.token
      });

      // Disparar processamento em background
      setImmediate(() => {
        analysisService.processAnalysisInBackground(analysisJob.id)
          .catch(error => {
            console.error(`${ICONS.ERROR} Erro no processamento FAST background:`, error);
          });
      });

      console.log(`${ICONS.SUCCESS} Análise FAST iniciada - versão ${nextVersion}`);

      return successResponse({
        analysisId: analysisVersion.id,
        jobId: analysisJob.id,
        versionNumber: nextVersion,
        source: 'processing',
        analysisType: 'FAST',
        model: 'gemini-1.5-flash',
        status: 'PROCESSING',
        documentsUsed: attachedDocs.length,
        estimatedTime: '30-60 segundos',
        message: `Análise FAST iniciada usando ${attachedDocs.length} documento(s) anexado(s)`
      });

    } catch (error) {
      // Liberar lock em caso de erro
      await analysisService.releaseAnalysisLock(lockResult.token);
      throw error;
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na análise FAST:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno do servidor',
      500
    );
  }
});

// GET endpoint para verificar status da análise
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const processId = params.id;
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return errorResponse('workspaceId é obrigatório', 400);
  }

  // Auth check
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const analysisService = new DeepAnalysisService();

    // Buscar última análise FAST
    const lastAnalysis = await analysisService.getLastAnalysis(processId, 'FAST');

    if (!lastAnalysis) {
      return successResponse({
        hasAnalysis: false,
        message: 'Nenhuma análise FAST encontrada para este processo'
      });
    }

    // Buscar job ativo se análise estiver em processamento
    let activeJob = null;
    if (lastAnalysis.status === 'PROCESSING') {
      activeJob = await analysisService.getActiveJobByVersion(lastAnalysis.id);
    }

    return successResponse({
      hasAnalysis: true,
      analysis: {
        id: lastAnalysis.id,
        versionNumber: lastAnalysis.versionNumber,
        status: lastAnalysis.status,
        analysisType: lastAnalysis.analysisType,
        model: lastAnalysis.modelUsed,
        summary: lastAnalysis.summaryJson,
        insights: lastAnalysis.insightsJson,
        confidence: lastAnalysis.confidenceScore,
        reportUrl: lastAnalysis.reportUrl,
        creditsUsed: lastAnalysis.fastCreditsUsed,
        processingTime: lastAnalysis.processingTimeMs,
        createdAt: lastAnalysis.createdAt,
        errorMessage: lastAnalysis.errorMessage
      },
      activeJob: activeJob ? {
        id: activeJob.id,
        status: activeJob.status,
        progress: activeJob.progress,
        startedAt: activeJob.startedAt
      } : null
    });

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao buscar status da análise FAST:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno do servidor',
      500
    );
  }
});