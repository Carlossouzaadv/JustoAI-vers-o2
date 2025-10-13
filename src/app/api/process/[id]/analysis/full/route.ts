// ================================================================
// API ENDPOINT - Análise FULL
// ================================================================
// POST /process/{id}/analysis/full
// Análise completa com upload de PDFs e consumo de FULL credits

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, errorResponse, validateBody, requireAuth, withErrorHandler } from '@/lib/api-utils';
import { DeepAnalysisService } from '@/lib/deep-analysis-service';
import { getCreditManager } from '@/lib/credit-system';
import { ICONS } from '@/lib/icons';

// Schema de validação
const fullAnalysisSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID é obrigatório'),
  useExistingFiles: z.boolean().optional().default(false),
  existingFileIds: z.array(z.string()).optional().default([]),
  forceReprocessing: z.boolean().optional().default(false),
  userId: z.string().optional()
});

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: processId } = await params;

  // Auth check
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  console.log(`${ICONS.PROCESS} Iniciando análise FULL para processo: ${processId}`);

  try {
    const analysisService = new DeepAnalysisService();
    const creditSystem = getCreditManager();

    // Parse multipart form data
    const formData = await request.formData();
    const workspaceId = formData.get('workspaceId') as string;
    const useExistingFiles = formData.get('useExistingFiles') === 'true';
    const existingFileIds = formData.get('existingFileIds')
      ? JSON.parse(formData.get('existingFileIds') as string)
      : [];
    const forceReprocessing = formData.get('forceReprocessing') === 'true';
    const userId = formData.get('userId') as string;

    if (!workspaceId) {
      return errorResponse('workspaceId é obrigatório', 400);
    }

    // Verificar se o processo existe e pertence ao workspace
    const processExists = await analysisService.validateProcessAccess(processId, workspaceId);
    if (!processExists) {
      return errorResponse('Processo não encontrado ou acesso negado', 404);
    }

    let filesToProcess = [];

    if (useExistingFiles && existingFileIds.length > 0) {
      // Usar arquivos já anexados específicos
      filesToProcess = await analysisService.getProcessDocumentsByIds(processId, existingFileIds);
    } else {
      // Processar uploads de novos arquivos
      const uploadedFiles = [];

      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file_') && value instanceof File) {
          uploadedFiles.push(value);
        }
      }

      if (uploadedFiles.length === 0) {
        return errorResponse(
          'Pelo menos um arquivo PDF deve ser enviado ou arquivos existentes selecionados',
          400
        );
      }

      // Validar arquivos
      for (const file of uploadedFiles) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          return errorResponse(`Arquivo ${file.name} não é um PDF válido`, 400);
        }

        if (file.size > 50 * 1024 * 1024) { // 50MB limit
          return errorResponse(`Arquivo ${file.name} excede o limite de 50MB`, 400);
        }
      }

      // Processar e salvar arquivos
      filesToProcess = await analysisService.processUploadedFiles(
        uploadedFiles,
        processId,
        workspaceId,
        userId || user.id
      );
    }

    if (filesToProcess.length === 0) {
      return errorResponse('Nenhum arquivo válido para processar', 400);
    }

    // Calcular créditos necessários baseado na regra configurada
    const fullCreditsNeeded = await analysisService.calculateFullCreditsNeeded(filesToProcess);

    console.log(`${ICONS.INFO} FULL credits necessários: ${fullCreditsNeeded}`);

    // Gerar chave de análise
    const analysisKey = await analysisService.generateAnalysisKey({
      processId,
      documentHashes: filesToProcess.map(file => file.textSha),
      analysisType: 'FULL',
      modelVersion: 'gemini-1.5-pro'
    });

    // Verificar cache se não for reprocessamento forçado
    if (!forceReprocessing) {
      const cachedResult = await analysisService.getCachedAnalysis(analysisKey, processId);

      if (cachedResult) {
        console.log(`${ICONS.SUCCESS} Cache HIT - Oferecendo opção de usar cache`);

        return successResponse({
          cacheAvailable: true,
          cachedAnalysis: {
            id: cachedResult.id,
            versionNumber: cachedResult.versionNumber,
            summary: cachedResult.summaryJson,
            confidence: cachedResult.confidenceScore,
            createdAt: cachedResult.createdAt,
            creditsUsed: cachedResult.fullCreditsUsed
          },
          options: {
            useCache: {
              message: 'Usar resultado cacheado (sem consumir créditos)',
              creditsUsed: 0
            },
            forceReprocess: {
              message: `Forçar reprocessamento (consome ${fullCreditsNeeded} FULL credits)`,
              creditsUsed: fullCreditsNeeded
            }
          },
          filesProcessed: filesToProcess.length
        });
      }
    }

    // Verificar saldo de FULL credits
    const creditBalance = await creditSystem.getWorkspaceCredits(workspaceId);
    if (!creditBalance.success) {
      return errorResponse('Erro ao verificar saldo de créditos', 500);
    }

    if (creditBalance.credits!.fullCreditsBalance < fullCreditsNeeded) {
      const shortage = fullCreditsNeeded - creditBalance.credits!.fullCreditsBalance;

      return errorResponse(
        'FULL credits insuficientes',
        402, // Payment Required
        {
          required: fullCreditsNeeded,
          available: creditBalance.credits!.fullCreditsBalance,
          shortage,
          options: {
            buyPack: {
              message: 'Comprar pack de FULL credits',
              recommendedPack: shortage <= 5 ? 'FULL_5' : shortage <= 15 ? 'FULL_15' : 'FULL_35'
            },
            schedule: {
              message: 'Agendar análise para quando houver créditos disponíveis'
            },
            useFast: {
              message: 'Executar análise FAST como alternativa (sem consumir FULL credits)'
            }
          }
        }
      );
    }

    // Verificar se já existe job em andamento
    const existingJob = await analysisService.getActiveJob(analysisKey);
    if (existingJob) {
      return successResponse({
        analysisId: existingJob.id,
        source: 'processing',
        status: existingJob.status,
        progress: existingJob.progress,
        estimatedTime: '2-3 minutos',
        creditsUsed: fullCreditsNeeded,
        message: 'Análise FULL já está em andamento'
      });
    }

    // Adquirir lock Redis
    const lockResult = await analysisService.acquireAnalysisLock(analysisKey, 600); // 10 minutos
    if (!lockResult.acquired) {
      return errorResponse(
        'Análise já está sendo processada por outro worker',
        429,
        { retryAfter: lockResult.ttl }
      );
    }

    try {
      // Debitar FULL credits atomicamente (FIFO)
      const debitResult = await creditSystem.debitCredits(
        workspaceId,
        0, // report credits
        fullCreditsNeeded, // full credits
        `Análise FULL - Processo ${processId}`,
        {
          processId,
          analysisType: 'FULL',
          filesCount: filesToProcess.length,
          analysisKey,
          userId: userId || user.id
        }
      );

      if (!debitResult.success) {
        // Liberar lock
        await analysisService.releaseAnalysisLock(lockResult.token);
        return errorResponse(
          `Erro ao debitar créditos: ${debitResult.error}`,
          500
        );
      }

      console.log(`${ICONS.SUCCESS} FULL credits debitados: ${fullCreditsNeeded}`);

      // Criar próxima versão de análise
      const nextVersion = await analysisService.getNextVersionNumber(processId);

      // Criar registro de versão (status PENDING)
      const analysisVersion = await analysisService.createAnalysisVersion({
        processId,
        workspaceId,
        versionNumber: nextVersion,
        analysisType: 'FULL',
        modelUsed: 'gemini-1.5-pro',
        fullCreditsUsed: fullCreditsNeeded,
        analysisKey,
        sourceFilesMetadata: filesToProcess.map(file => ({
          id: file.id,
          name: file.name,
          textSha: file.textSha,
          size: file.size,
          pages: file.pages || 0
        })),
        createdBy: userId || user.id
      });

      // Criar job de análise
      const analysisJob = await analysisService.createAnalysisJob({
        processId,
        workspaceId,
        analysisKey,
        analysisType: 'FULL',
        modelHint: 'gemini-1.5-pro',
        filesMetadata: filesToProcess,
        resultVersionId: analysisVersion.id,
        lockToken: lockResult.token,
        metadata: {
          creditsDebited: fullCreditsNeeded,
          allocationsUsed: debitResult.allocationsUsed
        }
      });

      // Registrar evento de uso
      await creditSystem.logUsageEvent({
        workspaceId,
        eventType: 'full_analysis_started',
        resourceType: 'full_analysis',
        resourceId: processId,
        reportCreditsCost: 0,
        fullCreditsCost: fullCreditsNeeded,
        status: 'completed',
        metadata: {
          analysisVersionId: analysisVersion.id,
          jobId: analysisJob.id,
          filesCount: filesToProcess.length,
          allocationsUsed: debitResult.allocationsUsed
        }
      });

      // Disparar processamento em background
      setImmediate(() => {
        analysisService.processAnalysisInBackground(analysisJob.id)
          .catch(error => {
            console.error(`${ICONS.ERROR} Erro no processamento FULL background:`, error);
          });
      });

      console.log(`${ICONS.SUCCESS} Análise FULL iniciada - versão ${nextVersion}`);

      return successResponse({
        analysisId: analysisVersion.id,
        jobId: analysisJob.id,
        versionNumber: nextVersion,
        source: 'processing',
        analysisType: 'FULL',
        model: 'gemini-1.5-pro',
        status: 'PROCESSING',
        creditsUsed: fullCreditsNeeded,
        filesProcessed: filesToProcess.length,
        estimatedTime: '2-3 minutos',
        message: `Análise FULL iniciada usando ${filesToProcess.length} arquivo(s). ${fullCreditsNeeded} FULL credits consumidos.`
      });

    } catch (error) {
      // Liberar lock em caso de erro
      await analysisService.releaseAnalysisLock(lockResult.token);
      throw error;
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na análise FULL:`, error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro interno do servidor',
      500
    );
  }
});