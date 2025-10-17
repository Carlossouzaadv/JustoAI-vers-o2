// ================================================================
// WORKER DE AGREGAÇÃO DE USO - Consolidação Diária de Telemetria
// ================================================================

import { Job, Queue } from 'bull';
import { prisma } from '../lib/prisma';
import { usageTracker } from '../lib/telemetry/usage-tracker';
import { ICONS } from '../lib/icons';
import { getRedis } from '../lib/redis';

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
  metrics: {
    juditCallsTotal: number;
    juditDocsRetrieved: number;
    iaCallsFast: number;
    iaCallsMid: number;
    iaCallsFull: number;
    reportsScheduledGenerated: number;
    reportsOnDemandGenerated: number;
    fullCreditsConsumedMonth: number;
  };
  billingEstimatedCost: number;
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
export const usageAggregatorQueue = new Queue('usage-aggregator', {
  redis: getRedis(),
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

// ================================================================
// PROCESSADOR PRINCIPAL
// ================================================================

usageAggregatorQueue.process(
  'daily_aggregation',
  AGGREGATOR_CONFIG.CONCURRENT_WORKSPACES,
  async (job: Job<AggregatorJobData>) => {
    const { workspaceId, date, force } = job.data;
    const targetDate = date || new Date().toISOString().split('T')[0];

    console.log(`${ICONS.AGGREGATOR} Starting daily aggregation:`, {
      workspace: workspaceId || 'all',
      date: targetDate,
      force
    });

    try {
      await job.progress(5);

      let results: DailyAggregationResult[] = [];

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
        totalEvents: results.reduce((sum, r) => sum + r.eventsProcessed, 0),
        totalCost: results.reduce((sum, r) => sum + r.billingEstimatedCost, 0).toFixed(2)
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
usageAggregatorQueue.process(
  'billing_calculation',
  AGGREGATOR_CONFIG.CONCURRENT_WORKSPACES,
  async (job: Job<AggregatorJobData>) => {
    const { workspaceId } = job.data;

    console.log(`${ICONS.BILLING} Starting billing calculation:`, {
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
    // Verificar se já foi agregado (a menos que force = true)
    if (!force) {
      const existing = await prisma.workspaceUsageDaily.findUnique({
        where: {
          workspaceId_date: {
            workspaceId,
            date: new Date(date)
          }
        }
      });

      if (existing) {
        console.log(`${ICONS.INFO} Aggregation already exists for ${workspaceId} on ${date}`);
        return null;
      }
    }

    // Buscar eventos do dia
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const events = await prisma.usageEvents.findMany({
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

    // Inicializar contadores
    const metrics = {
      juditCallsTotal: 0,
      juditDocsRetrieved: 0,
      iaCallsFast: 0,
      iaCallsMid: 0,
      iaCallsFull: 0,
      reportsScheduledGenerated: 0,
      reportsOnDemandGenerated: 0,
      fullCreditsConsumedMonth: 0
    };

    // Processar eventos
    for (const event of events) {
      try {
        await processEvent(event, metrics);
      } catch (error) {
        console.error(`${ICONS.ERROR} Failed to process event ${event.id}:`, error);
      }
    }

    // Calcular snapshot mensal de relatórios
    const monthlyReportsTotal = await calculateMonthlyReportsSnapshot(workspaceId, date);

    // Calcular custo estimado
    const billingCalculation = usageTracker.calculateBillingEstimate(metrics);

    // Salvar agregação
    const aggregatedData = await prisma.workspaceUsageDaily.upsert({
      where: {
        workspaceId_date: {
          workspaceId,
          date: new Date(date)
        }
      },
      update: {
        juditCallsTotal: metrics.juditCallsTotal,
        juditDocsRetrieved: metrics.juditDocsRetrieved,
        iaCallsFast: metrics.iaCallsFast,
        iaCallsMid: metrics.iaCallsMid,
        iaCallsFull: metrics.iaCallsFull,
        reportsScheduledGenerated: metrics.reportsScheduledGenerated,
        reportsOnDemandGenerated: metrics.reportsOnDemandGenerated,
        reportsTotalMonthSnapshot: monthlyReportsTotal,
        fullCreditsConsumedMonth: metrics.fullCreditsConsumedMonth,
        billingEstimatedCost: billingCalculation.totalEstimated
      },
      create: {
        workspaceId,
        date: new Date(date),
        juditCallsTotal: metrics.juditCallsTotal,
        juditDocsRetrieved: metrics.juditDocsRetrieved,
        iaCallsFast: metrics.iaCallsFast,
        iaCallsMid: metrics.iaCallsMid,
        iaCallsFull: metrics.iaCallsFull,
        reportsScheduledGenerated: metrics.reportsScheduledGenerated,
        reportsOnDemandGenerated: metrics.reportsOnDemandGenerated,
        reportsTotalMonthSnapshot: monthlyReportsTotal,
        fullCreditsConsumedMonth: metrics.fullCreditsConsumedMonth,
        billingEstimatedCost: billingCalculation.totalEstimated
      }
    });

    const processingTime = Date.now() - startTime;

    console.log(`${ICONS.SUCCESS} Aggregated ${workspaceId} for ${date}:`, {
      events: events.length,
      reports: metrics.reportsScheduledGenerated + metrics.reportsOnDemandGenerated,
      cost: billingCalculation.totalEstimated.toFixed(2),
      time: `${processingTime}ms`
    });

    return {
      workspaceId,
      date,
      eventsProcessed: events.length,
      metrics,
      billingEstimatedCost: billingCalculation.totalEstimated,
      processingTime
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to aggregate ${workspaceId} for ${date}:`, error);
    throw error;
  }
}

async function processEvent(event: any, metrics: any): Promise<void> {
  const { eventType, payload } = event;

  switch (eventType) {
    case 'judit_call':
      metrics.juditCallsTotal++;
      if (payload.docsRetrieved) {
        metrics.juditDocsRetrieved += payload.docsRetrieved;
      }
      break;

    case 'ia_call':
      switch (payload.model) {
        case 'fast':
          metrics.iaCallsFast++;
          break;
        case 'mid':
          metrics.iaCallsMid++;
          break;
        case 'full':
          metrics.iaCallsFull++;
          break;
      }
      break;

    case 'report_generation':
      if (payload.success) {
        if (payload.type === 'scheduled') {
          metrics.reportsScheduledGenerated++;
        } else if (payload.type === 'on_demand') {
          metrics.reportsOnDemandGenerated++;
        }
      }
      break;

    case 'credit_consumption':
      metrics.fullCreditsConsumedMonth += payload.amount || 0;
      break;

    default:
      // Ignorar eventos desconhecidos
      break;
  }
}

async function calculateMonthlyReportsSnapshot(workspaceId: string, date: string): Promise<number> {
  const targetDate = new Date(date);
  const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

  const monthlyTotal = await prisma.workspaceUsageDaily.aggregate({
    where: {
      workspaceId,
      date: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    },
    _sum: {
      reportsScheduledGenerated: true,
      reportsOnDemandGenerated: true
    }
  });

  return (monthlyTotal._sum.reportsScheduledGenerated || 0) +
         (monthlyTotal._sum.reportsOnDemandGenerated || 0);
}

async function recalculateBilling(workspaceId: string): Promise<any> {
  try {
    // Recalcular últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageRecords = await prisma.workspaceUsageDaily.findMany({
      where: {
        workspaceId,
        date: {
          gte: thirtyDaysAgo
        }
      }
    });

    let updatedRecords = 0;

    for (const record of usageRecords) {
      const metrics = {
        juditCallsTotal: record.juditCallsTotal,
        juditDocsRetrieved: record.juditDocsRetrieved,
        iaCallsFast: record.iaCallsFast,
        iaCallsMid: record.iaCallsMid,
        iaCallsFull: record.iaCallsFull,
        reportsScheduledGenerated: record.reportsScheduledGenerated,
        reportsOnDemandGenerated: record.reportsOnDemandGenerated,
        fullCreditsConsumedMonth: record.fullCreditsConsumedMonth
      };

      const billingCalculation = usageTracker.calculateBillingEstimate(metrics);

      await prisma.workspaceUsageDaily.update({
        where: { id: record.id },
        data: {
          billingEstimatedCost: billingCalculation.totalEstimated
        }
      });

      updatedRecords++;
    }

    console.log(`${ICONS.SUCCESS} Recalculated billing for ${workspaceId}: ${updatedRecords} records updated`);

    return {
      workspaceId,
      recordsUpdated: updatedRecords
    };

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to recalculate billing for ${workspaceId}:`, error);
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
    const deleted = await prisma.usageEvents.deleteMany({
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
): Promise<Job<AggregatorJobData>> {
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

  return usageAggregatorQueue.add(type, jobData, jobOptions);
}

export async function runDailyAggregation(workspaceId?: string, date?: string): Promise<any> {
  console.log(`${ICONS.AGGREGATOR} Running daily aggregation:`, { workspaceId, date });

  const job = await scheduleAggregation('daily_aggregation', {
    workspaceId,
    date,
    force: true
  });

  return await job.finished();
}

export async function getAggregationStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    usageAggregatorQueue.getWaiting(),
    usageAggregatorQueue.getActive(),
    usageAggregatorQueue.getCompleted(),
    usageAggregatorQueue.getFailed(),
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
  // Agendar agregação diária para às 02:00 (após monitoramento às 01:00)
  const cronExpression = '0 2 * * *'; // Todo dia às 02:00

  await usageAggregatorQueue.add('daily_aggregation', {
    type: 'daily_aggregation'
  }, {
    repeat: { cron: cronExpression },
    jobId: 'daily-aggregation-recurring',
  });

  // Agendar recálculo de billing a cada 6 horas
  const billingCronExpression = '0 */6 * * *'; // A cada 6 horas

  await usageAggregatorQueue.add('billing_calculation', {
    type: 'billing_calculation'
  }, {
    repeat: { cron: billingCronExpression },
    jobId: 'billing-calculation-recurring',
  });

  console.log(`${ICONS.SUCCESS} Usage aggregation scheduled (02:00 daily, billing every 6h)`);
}

console.log(`${ICONS.WORKER} Usage Aggregator Worker initialized successfully`);

export default usageAggregatorQueue;