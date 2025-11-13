// ================================================================
// WORKER DE RELATÓRIOS INDIVIDUAIS - Agendamento e Processamento
// ================================================================

import { Job } from 'bull';
import { prisma } from '@/lib/prisma';
import { getCreditManager } from '@/lib/credit-system';
import { ReportGenerator } from '@/lib/report-generator';
import { ICONS } from '@/lib/icons';
import { getRedisClient } from '@/lib/redis';
import { createHash } from 'crypto';

// Imports do Prisma
import { ExecutionStatus } from '@/lib/types/database';

// Interfaces para o worker
interface IndividualReportJobData {
  type: 'scheduled-individual-report';
  reportExecutionId: string;
  workspaceId: string;
  processIds: string[];
  reportType: 'JURIDICO' | 'EXECUTIVO';
  format: ('PDF' | 'DOCX')[];
  creditHoldId?: string;
  forceNewAnalysis?: boolean;
}

interface ReportJobResult {
  success: boolean;
  reportId: string;
  fileUrls: Record<string, string>;
  processingTime: number;
  creditConsumed: number;
  cacheHit: boolean;
  error?: string;
}

// Configurações do worker
const INDIVIDUAL_REPORTS_CONFIG = {
  MAX_CONCURRENT: 2,           // Máximo de relatórios individuais simultâneos
  REPORT_TIMEOUT: 600000,      // 10 minutos timeout por relatório
  RETRY_ATTEMPTS: 2,           // Tentativas de retry
  RETRY_DELAY: 120000,         // 2 minutos entre tentativas
  NIGHT_WINDOW_START: 23,      // Início da janela noturna (23h)
  NIGHT_WINDOW_END: 4,         // Fim da janela noturna (4h)
};

// Criar fila específica para relatórios individuais
import Queue from 'bull';

// Initialization function that returns a properly typed Queue instance
// This avoids type mismatch issues between Redis client versions
function createIndividualReportsQueue(): Queue.Queue<IndividualReportJobData> {
  const redisClient = getRedisClient();

  // Validate Redis client initialization with type guard
  if (
    typeof redisClient !== 'object' ||
    redisClient === null ||
    !('ping' in redisClient)
  ) {
    throw new Error('Redis client is not properly initialized');
  }

  // Use string-based initialization to avoid type mismatch
  // Bull will connect using Redis URL from environment or default
  const queueOptions = {
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: INDIVIDUAL_REPORTS_CONFIG.RETRY_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: INDIVIDUAL_REPORTS_CONFIG.RETRY_DELAY,
      },
    },
  };

  // Create queue with string-based connection to avoid Redis client type incompatibility
  return new Queue<IndividualReportJobData>(
    'individual-reports',
    process.env.REDIS_URL || 'redis://localhost:6379',
    queueOptions
  );
}

// Export the queue instance
export const individualReportsQueue = createIndividualReportsQueue();

// ================================================================
// PROCESSADOR PRINCIPAL
// ================================================================

// Note: individualReportsQueue is already instantiated above, not a factory function
// We call .process() on the Queue instance directly
individualReportsQueue.process(
  'scheduled-individual-report',
  INDIVIDUAL_REPORTS_CONFIG.MAX_CONCURRENT,
  async (job: Job<IndividualReportJobData>) => {
    const startTime = Date.now();
    const { reportExecutionId, workspaceId, processIds, reportType, format, creditHoldId } = job.data;

    console.log(`${ICONS.REPORT} Iniciando processamento de relatório individual: ${reportExecutionId}`);

    let creditManager: any = null;
    let reportCreditCost = 0;

    try {
      await job.progress(5);

      // 1. Verificar se ainda está na janela noturna
      if (!isInNightWindow()) {
        throw new Error('Fora da janela de execução noturna (23h-04h)');
      }

      // 2. Buscar execução no banco
      const reportExecution = await prisma.reportExecution.findUnique({
        where: { id: reportExecutionId },
        include: {
          workspace: true
        }
      });

      if (!reportExecution) {
        throw new Error(`Execução não encontrada: ${reportExecutionId}`);
      }

      if (reportExecution.status !== ExecutionStatus.AGENDADO) {
        throw new Error(`Status inválido para execução: ${reportExecution.status}`);
      }

      await job.progress(10);

      // 3. Atualizar status para RUNNING
      await prisma.reportExecution.update({
        where: { id: reportExecutionId },
        data: {
          status: ExecutionStatus.RUNNING,
          startedAt: new Date()
        }
      });

      // 4. Inicializar gerenciador de créditos
      creditManager = getCreditManager(prisma);
      reportCreditCost = creditManager.calculateReportCreditCost(processIds.length);

      console.log(`${ICONS.INFO} Custo do relatório: ${reportCreditCost} report credits`);

      // 5. Liberar hold e debitar créditos atomicamente
      if (creditHoldId) {
        console.log(`${ICONS.PROCESS} Liberando hold e debitando créditos...`);

        const debitResult = await creditManager.debitCredits(
          workspaceId,
          reportCreditCost,
          0,
          `Relatório individual agendado ${reportType}`,
          {
            reportExecutionId,
            processIds,
            type: reportType,
            format,
            timestamp: new Date().toISOString()
          }
        );

        if (!debitResult.success) {
          throw new Error(`Falha ao debitar créditos: ${debitResult.error}`);
        }

        // Liberar hold após débito bem-sucedido
        await creditManager.releaseReservation(creditHoldId);
        console.log(`${ICONS.SUCCESS} Hold liberado e créditos debitados`);
      }

      await job.progress(25);

      // 6. Verificar cache antes de gerar
      const cacheResult = await checkReportCache(workspaceId, processIds, reportType, format);

      if (cacheResult.hit && !job.data.forceNewAnalysis) {
        console.log(`${ICONS.SUCCESS} Cache hit encontrado - usando versão armazenada`);

        // Marcar como concluído com cache hit
        await prisma.reportExecution.update({
          where: { id: reportExecutionId },
          data: {
            status: ExecutionStatus.COMPLETED,
            completedAt: new Date(),
            duration: Date.now() - startTime,
            fileUrls: cacheResult.fileUrls,
            cacheHit: true,
            result: { cacheHit: true, message: 'Resultado obtido do cache' }
          }
        });

        // Retornar créditos já que usou cache
        await creditManager.creditCredits(
          workspaceId,
          reportCreditCost,
          0,
          'PACK',
          'Reembolso - relatório gerado via cache'
        );

        return {
          success: true,
          reportId: reportExecutionId,
          fileUrls: cacheResult.fileUrls,
          processingTime: Date.now() - startTime,
          creditConsumed: 0,
          cacheHit: true
        } as ReportJobResult;
      }

      await job.progress(40);

      // 7. Gerar relatório
      console.log(`${ICONS.PROCESS} Gerando novo relatório...`);

      const generator = new ReportGenerator();
      const reportResult = await generator.generateScheduledReport({
        workspaceId,
        reportType: reportType === 'JURIDICO' ? 'COMPLETO' : 'NOVIDADES',
        processIds,
        audienceType: reportType === 'JURIDICO' ? 'USO_INTERNO' : 'CLIENTE',
        outputFormats: format.map(f => f as 'PDF' | 'DOCX'),
        deltaDataOnly: reportType === 'EXECUTIVO'
      });

      if (!reportResult.success) {
        throw new Error(reportResult.error || 'Erro na geração do relatório');
      }

      await job.progress(80);

      // 8. Atualizar execução como concluída
      // Type-safe: serialize reportResult.summary to JSON since Prisma JSON field requires serializable data
      const serializedSummary = reportResult.summary
        ? JSON.parse(JSON.stringify(reportResult.summary))
        : null;

      await prisma.reportExecution.update({
        where: { id: reportExecutionId },
        data: {
          status: ExecutionStatus.COMPLETED,
          completedAt: new Date(),
          duration: Date.now() - startTime,
          fileUrls: reportResult.fileUrls,
          result: serializedSummary,
          tokensUsed: reportResult.tokensUsed,
          cacheHit: reportResult.cacheHit
        }
      });

      await job.progress(95);

      // 9. Enviar notificação de conclusão (opcional)
      await sendCompletionNotification(reportExecution.id, reportResult);

      await job.progress(100);

      console.log(`${ICONS.SUCCESS} Relatório individual processado com sucesso em ${Date.now() - startTime}ms`);

      return {
        success: true,
        reportId: reportExecutionId,
        fileUrls: reportResult.fileUrls,
        processingTime: Date.now() - startTime,
        creditConsumed: reportCreditCost,
        cacheHit: reportResult.cacheHit
      } as ReportJobResult;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro no processamento do relatório individual:`, error);

      // Rollback: retornar créditos em caso de erro
      if (creditManager && reportCreditCost > 0) {
        try {
          await creditManager.creditCredits(
            workspaceId,
            reportCreditCost,
            0,
            'PACK',
            'Rollback - erro no processamento de relatório agendado'
          );
          console.log(`${ICONS.SUCCESS} Rollback de créditos executado: ${reportCreditCost} credits`);
        } catch (rollbackError) {
          console.error(`${ICONS.ERROR} Erro no rollback de créditos:`, rollbackError);
        }
      }

      // Liberar hold se ainda existir
      if (creditHoldId && creditManager) {
        try {
          await creditManager.releaseReservation(creditHoldId);
        } catch (holdError) {
          console.error(`${ICONS.ERROR} Erro ao liberar hold:`, holdError);
        }
      }

      // Marcar execução como falhou
      await prisma.reportExecution.update({
        where: { id: reportExecutionId },
        data: {
          status: ExecutionStatus.FAILED,
          completedAt: new Date(),
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }
      });

      throw error;
    }
  }
);

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

/**
 * Verifica se está na janela noturna de execução
 */
function isInNightWindow(): boolean {
  const now = new Date();
  const hour = now.getHours();

  return hour >= INDIVIDUAL_REPORTS_CONFIG.NIGHT_WINDOW_START ||
         hour <= INDIVIDUAL_REPORTS_CONFIG.NIGHT_WINDOW_END;
}

/**
 * Verifica cache do relatório
 */
async function checkReportCache(
  workspaceId: string,
  processIds: string[],
  type: string,
  format: string[]
): Promise<{
  hit: boolean;
  fileUrls?: Record<string, string>;
}> {
  try {
    const cacheKey = generateCacheKey(workspaceId, processIds, type, format);

    const cached = await prisma.reportCache.findUnique({
      where: { cacheKey }
    });

    if (!cached || cached.expiresAt < new Date()) {
      return { hit: false };
    }

    // Verificar movimentações recentes
    const latestMovement = await prisma.processMovement.findFirst({
      where: {
        monitoredProcess: {
          id: { in: processIds }
        }
      },
      orderBy: { date: 'desc' }
    });

    if (latestMovement && latestMovement.date > cached.lastMovementTimestamp) {
      await prisma.reportCache.delete({ where: { cacheKey } });
      return { hit: false };
    }

    return {
      hit: true,
      fileUrls: cached.fileUrls as Record<string, string>
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao verificar cache:`, error);
    return { hit: false };
  }
}

/**
 * Gera chave de cache
 */
function generateCacheKey(
  workspaceId: string,
  processIds: string[],
  type: string,
  format: string[]
): string {
  const keyData = [
    workspaceId,
    type,
    processIds.sort().join('|'),
    format.sort().join('|')
  ].join('||');

  return createHash('sha256').update(keyData).digest('hex');
}

/**
 * Envia notificação de conclusão
 */
async function sendCompletionNotification(reportId: string, result: any): Promise<void> {
  try {
    // TODO: Implementar notificação por email/SMS
    console.log(`${ICONS.MAIL} Notificação de conclusão enviada para relatório ${reportId}`);
  } catch (error) {
    console.error(`${ICONS.ERROR} Erro ao enviar notificação:`, error);
    // Não falhar o job por erro de notificação
  }
}

// ================================================================
// FUNÇÕES DE UTILIDADE E MONITORAMENTO
// ================================================================

/**
 * Adiciona job de relatório individual à fila
 */
export async function addIndividualReportJob(
  reportData: IndividualReportJobData,
  scheduleFor?: Date,
  priority: number = 5
): Promise<Job<IndividualReportJobData>> {
  const delay = scheduleFor ? scheduleFor.getTime() - Date.now() : 0;

  return individualReportsQueue.add('scheduled-individual-report', reportData, {
    delay: Math.max(0, delay),
    priority,
    jobId: `individual-report-${reportData.reportExecutionId}`,
    removeOnComplete: 10,
    removeOnFail: 5
  });
}

/**
 * Health check do worker
 */
export async function individualReportsWorkerHealthCheck() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      individualReportsQueue.getWaiting(),
      individualReportsQueue.getActive(),
      individualReportsQueue.getCompleted(),
      individualReportsQueue.getFailed(),
    ]);

    const pendingExecutions = await prisma.reportExecution.count({
      where: {
        status: ExecutionStatus.AGENDADO,
        scheduledFor: {
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Próximas 24h
        }
      }
    });

    return {
      status: 'healthy',
      queue: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
      upcomingJobs: pendingExecutions,
      nightWindow: isInNightWindow(),
      lastCompleted: completed[0]?.finishedOn ? new Date(completed[0].finishedOn) : null,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Limpa jobs antigos e órfãos
 */
export async function cleanupIndividualReportsQueue(): Promise<{
  cleanedJobs: number;
  cleanedExecutions: number;
}> {
  try {
    console.log(`${ICONS.PROCESS} Iniciando limpeza da fila de relatórios individuais...`);

    // Limpar jobs completados antigos (> 7 dias)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await individualReportsQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
    await individualReportsQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');

    // Limpar execuções órfãs (agendadas há mais de 48h sem job correspondente)
    const orphanedExecutions = await prisma.reportExecution.findMany({
      where: {
        status: ExecutionStatus.AGENDADO,
        scheduledFor: {
          lt: new Date(Date.now() - 48 * 60 * 60 * 1000)
        }
      }
    });

    if (orphanedExecutions.length > 0) {
      await prisma.reportExecution.updateMany({
        where: {
          id: { in: orphanedExecutions.map((e: { id: string }) => e.id) }
        },
        data: {
          status: ExecutionStatus.CANCELLED,
          completedAt: new Date(),
          error: 'Cancelado automaticamente - timeout de agendamento'
        }
      });
    }

    console.log(`${ICONS.SUCCESS} Limpeza concluída: ${orphanedExecutions.length} execuções órfãs removidas`);

    return {
      cleanedJobs: 0, // Bull Queue não retorna esse número
      cleanedExecutions: orphanedExecutions.length
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Erro na limpeza:`, error);
    throw error;
  }
}

console.log(`${ICONS.WORKER} Individual Reports Worker initialized successfully`);

export default individualReportsQueue;