// ================================================================
// WORKER DE AGREGAÇÃO DE USO - Consolidação Diária de Telemetria
// ================================================================

// @ts-ignore - esModuleInterop handles default import correctly at runtime
import Queue from 'bull';
import { prisma } from '../lib/prisma';
import { usageTracker } from '../lib/telemetry/usage-tracker';
import { ICONS } from '../lib/icons';
import { getRedisClient } from '../src/lib/redis';
import { Decimal } from '@prisma/client/runtime/library';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface AggregatorJobData {
  type: 'daily_aggregation' | 'workspace_aggregation' | 'billing_calculation';
  workspaceId?: string;
  date?: string;
  force?: boolean;
}

interface DailyAggregationResult {
  workspaceId: string;
  date: string;
  eventsProcessed: number;
  processingTime: number;
}

interface BillingCalculation {
  juditCosts: number;
  iaCosts: number;
  reportCosts: number;
  totalEstimated: number;
  breakdown: Record<string, number>;
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

const AGGREGATOR_CONFIG = {
  BATCH_SIZE: 1000,
  MAX_DAYS_HISTORY: 90,
  BILLING_RECALCULATION_INTERVAL_HOURS: 6,
  CONCURRENT_WORKSPACES: 5,
  RETRY_ATTEMPTS: 3,
  CLEANUP_OLD_EVENTS_DAYS: 30,
} as const;

// Criar fila específica para agregação usando Redis centralizado
let usageAggregatorQueueInstance: Queue.Queue<AggregatorJobData>;

function getUsageAggregatorQueue(): Queue.Queue<AggregatorJobData> {
  if (!usageAggregatorQueueInstance) {
    usageAggregatorQueueInstance = new Queue('usage-aggregator', {
      redis: getRedisClient(),
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: AGGREGATOR_CONFIG.RETRY_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: 30000, // 30 segundos
        },
      },
    });
  }
  return usageAggregatorQueueInstance;
}

export { getUsageAggregatorQueue as usageAggregatorQueue };

// ================================================================
// PROCESSADOR PRINCIPAL
// ================================================================

getUsageAggregatorQueue().process(
  'daily_aggregation',
  AGGREGATOR_CONFIG.CONCURRENT_WORKSPACES,
  async (job: Queue.Job<AggregatorJobData>) => {
    const { workspaceId, date, force } = job.data;
    const targetDate = date || new Date().toISOString().split('T')[0];

    console.log(`${ICONS.INFO} Starting daily aggregation:`, {
      workspace: workspaceId || 'all',
      date: targetDate,
      force
    });

    try {
      await job.progress(5);

      const results: DailyAggregationResult[] = [];

      if (workspaceId) {
        // Agregar workspace específico
        const result = await aggregateWorkspaceDay(workspaceId, targetDate, force);
        if (result) results.push(result);
      } else {
        // Agregar todos os workspaces
        const workspaces = await getWorkspacesForAggregation();
        console.log(`${ICONS.INFO} Found ${workspaces.length} workspaces to aggregate`);

        await job.progress(10);

        for (let i = 0; i < workspaces.length; i++) {
          const workspace = workspaces[i];

          try {
            const result = await aggregateWorkspaceDay(workspace.id, targetDate, force);
            if (result) results.push(result);

            const progress = 10 + Math.round((i + 1) / workspaces.length * 80);
            await job.progress(progress);

          } catch (error) {
            console.error(`${ICONS.ERROR} Failed to aggregate workspace ${workspace.id}:`, error);
            // Continuar com outros workspaces
          }
        }
      }

      await job.progress(95);

      // Limpar eventos antigos se necessário
      if (!workspaceId) {
        await cleanupOldEvents();
      }

      await job.progress(100);

      console.log(`${ICONS.SUCCESS} Daily aggregation completed:`, {
        workspacesProcessed: results.length,
        totalEvents: results.reduce((sum, r) => sum + r.eventsProcessed, 0)
      });

      return {
        success: true,
        workspacesProcessed: results.length,
        results,
        date: targetDate
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Daily aggregation failed:`, error);
      throw error;
    }
  }
);

// Processador para cálculo de billing
getUsageAggregatorQueue().process(
  'billing_calculation',
  AGGREGATOR_CONFIG.CONCURRENT_WORKSPACES,
  async (job: Queue.Job<AggregatorJobData>) => {
    const { workspaceId } = job.data;

    console.log(`${ICONS.WARNING} Starting billing calculation:`, {
      workspace: workspaceId || 'all'
    });

    try {
      await job.progress(10);

      const results = [];

      if (workspaceId) {
        const result = await recalculateBilling(workspaceId);
        results.push(result);
      } else {
        const workspaces = await getWorkspacesForAggregation();

        for (let i = 0; i < workspaces.length; i++) {
          const workspace = workspaces[i];

          try {
            const result = await recalculateBilling(workspace.id);
            results.push(result);

            const progress = 10 + Math.round((i + 1) / workspaces.length * 80);
            await job.progress(progress);

          } catch (error) {
            console.error(`${ICONS.ERROR} Failed to calculate billing for ${workspace.id}:`, error);
          }
        }
      }

      await job.progress(100);

      console.log(`${ICONS.SUCCESS} Billing calculation completed:`, {
        workspacesProcessed: results.length
      });

      return {
        success: true,
        workspacesProcessed: results.length,
        results
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Billing calculation failed:`, error);
      throw error;
    }
  }
);

// ================================================================
// FUNÇÕES DE AGREGAÇÃO
// ================================================================

async function aggregateWorkspaceDay(
  workspaceId: string,
  date: string,
  force = false
): Promise<DailyAggregationResult | null> {
  const startTime = Date.now();

  try {
    // Buscar eventos do dia
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const events = await prisma.usageEvent.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`${ICONS.INFO} Aggregating ${events.length} events for ${workspaceId} on ${date}`);

    // Calcular totais de créditos consumidos
    let totalReportCreditsCost = new Decimal(0);
    let totalFullCreditsCost = new Decimal(0);

    for (const event of events) {
      totalReportCreditsCost = totalReportCreditsCost.add(event.reportCreditsCost || 0);
      totalFullCreditsCost = totalFullCreditsCost.add(event.fullCreditsCost || 0);
    }

    // Registrar agregação como log
    console.log(`${ICONS.SUCCESS} Aggregated ${workspaceId} for ${date}:`, {
      events: events.length,
      reportCredits: totalReportCreditsCost.toString(),
      fullCredits: totalFullCreditsCost.toString(),
      time: `${Date.now() - startTime}ms`
    });

    const processingTime = Date.now() - startTime;

    return {
      workspaceId,
      date,
      eventsProcessed: events.length,
      processingTime
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to aggregate ${workspaceId} for ${date}:`, error);
    throw error;
  }
}


async function recalculateBilling(workspaceId: string): Promise<any> {
  try {
    // Recalcular últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageRecords = await prisma.usageEvent.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    // Agora que UsageEvent já tem os créditos calculados,
    // apenas registramos a agregação
    console.log(`${ICONS.SUCCESS} Reviewed billing for ${workspaceId}: ${usageRecords.length} records reviewed`);

    return {
      workspaceId,
      recordsReviewed: usageRecords.length
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to review billing for ${workspaceId}:`, error);
    throw error;
  }
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

async function getWorkspacesForAggregation() {
  return await prisma.workspace.findMany({
    where: {
      status: 'ACTIVE'
    },
    select: {
      id: true,
      name: true
    }
  });
}

async function cleanupOldEvents(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AGGREGATOR_CONFIG.CLEANUP_OLD_EVENTS_DAYS);

  try {
    const deleted = await prisma.usageEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`${ICONS.CLEANUP} Cleaned up ${deleted.count} old usage events`);

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to cleanup old events:`, error);
  }
}

// ================================================================
// API PÚBLICA
// ================================================================

export async function scheduleAggregation(
  type: 'daily_aggregation' | 'billing_calculation',
  options: {
    workspaceId?: string;
    date?: string;
    force?: boolean;
    delay?: number;
  } = {}
): Promise<Queue.Job<AggregatorJobData>> {
  const queue = getUsageAggregatorQueue();
  const jobData: AggregatorJobData = {
    type,
    workspaceId: options.workspaceId,
    date: options.date,
    force: options.force
  };

  const jobOptions: any = {
    removeOnComplete: 10,
    removeOnFail: 5
  };

  if (options.delay) {
    jobOptions.delay = options.delay;
  }

  return queue.add(type, jobData, jobOptions);
}

export async function runDailyAggregation(workspaceId?: string, date?: string): Promise<any> {
  console.log(`${ICONS.INFO} Running daily aggregation:`, { workspaceId, date });

  const job = await scheduleAggregation('daily_aggregation', {
    workspaceId,
    date,
    force: true
  });

  return await job.finished();
}

export async function getAggregationStats() {
  const queue = getUsageAggregatorQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed(),
  ]);

  return {
    queue: {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    },
    lastRun: completed[0]?.finishedOn ? new Date(completed[0].finishedOn) : null,
  };
}

export async function setupDailyAggregation() {
  const queue = getUsageAggregatorQueue();

  // Agendar agregação diária para às 02:00 (após monitoramento às 01:00)
  const cronExpression = '0 2 * * *'; // Todo dia às 02:00

  await queue.add('daily_aggregation', {
    type: 'daily_aggregation'
  }, {
    repeat: { cron: cronExpression },
    jobId: 'daily-aggregation-recurring',
  });

  // Agendar recálculo de billing a cada 6 horas
  const billingCronExpression = '0 */6 * * *'; // A cada 6 horas

  await queue.add('billing_calculation', {
    type: 'billing_calculation'
  }, {
    repeat: { cron: billingCronExpression },
    jobId: 'billing-calculation-recurring',
  });

  console.log(`${ICONS.SUCCESS} Usage aggregation scheduled (02:00 daily, billing every 6h)`);
}

console.log(`${ICONS.WORKER} Usage Aggregator Worker initialized successfully`);

export default getUsageAggregatorQueue;