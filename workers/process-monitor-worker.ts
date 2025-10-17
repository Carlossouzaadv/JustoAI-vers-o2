// ================================================================
// WORKER DE MONITORAMENTO AUTOMÁTICO - Credit-Aware com Judit
// ================================================================

import { Job } from 'bull';
import { prisma } from '../lib/prisma';
import { getJuditApiClient } from '../lib/judit-api-client';
import { ICONS } from '../lib/icons';
import { Queue } from 'bull';
import { getRedis } from '../src/lib/redis';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

interface MonitorJobData {
  type: 'daily-monitor' | 'workspace-monitor' | 'process-monitor';
  workspaceId?: string;
  processIds?: string[];
  forceUpdate?: boolean;
  useTracking?: boolean;
}

interface MonitoringSession {
  id: string;
  workspaceId?: string;
  startedAt: Date;
  totalProcesses: number;
  processed: number;
  successful: number;
  failed: number;
  newMovements: number;
  alertsGenerated: number;
  trackingCreated: number;
  trackingUsed: number;
  pollingUsed: number;
  rateLimitHits: number;
  costIncurred: number;
  errors: Array<{
    processNumber: string;
    error: string;
    timestamp: Date;
  }>;
  duration: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

interface ProcessMonitoringResult {
  processId: string;
  processNumber: string;
  success: boolean;
  method: 'tracking' | 'polling';
  newMovements: number;
  alertsGenerated: number;
  cost: number;
  error?: string;
  responseTime: number;
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

const MONITOR_CONFIG = {
  // Batching
  MONITOR_BATCH_SIZE: 500,
  WORKSPACE_BATCH_SIZE: 50,
  CONCURRENT_WORKSPACES: 3,

  // Timing
  PROCESS_DELAY_MS: 100,
  BATCH_DELAY_MS: 2000,
  WORKSPACE_DELAY_MS: 5000,

  // Tracking vs Polling
  PREFER_TRACKING: true,
  TRACKING_ENABLED_BY_DEFAULT: true,
  POLLING_FALLBACK: true,

  // Recovery
  MAX_RETRIES_PER_PROCESS: 2,
  RECOVERY_DELAY_MS: 30000,

  // Costs (confirmar com Judit)
  COST_PER_TRACKING_MONTH: 0.69,
  COST_PER_POLLING_CHECK: 0.05,
  COST_PER_ATTACHMENT: 0.25,
} as const;

// Criar fila específica para monitoramento usando Redis centralizado
export const processMonitorQueue = new Queue('process-monitor', {
  redis: getRedis(),
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000, // 1 minute
    },
  },
});

// ================================================================
// PROCESSADOR PRINCIPAL
// ================================================================

processMonitorQueue.process(
  'daily-monitor',
  MONITOR_CONFIG.CONCURRENT_WORKSPACES,
  async (job: Job<MonitorJobData>) => {
    const session: MonitoringSession = {
      id: `monitor_${Date.now()}`,
      workspaceId: job.data.workspaceId,
      startedAt: new Date(),
      totalProcesses: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      newMovements: 0,
      alertsGenerated: 0,
      trackingCreated: 0,
      trackingUsed: 0,
      pollingUsed: 0,
      rateLimitHits: 0,
      costIncurred: 0,
      errors: [],
      duration: 0,
      status: 'RUNNING'
    };

    console.log(`${ICONS.PROCESS} Starting daily monitoring session: ${session.id}`);

    try {
      await job.progress(5);

      // Buscar workspaces para monitorar
      const workspaces = await getWorkspacesForMonitoring(job.data.workspaceId);
      console.log(`${ICONS.INFO} Found ${workspaces.length} workspaces to monitor`);

      await job.progress(10);

      // Processar cada workspace
      for (let i = 0; i < workspaces.length; i++) {
        const workspace = workspaces[i];
        console.log(`${ICONS.PROCESS} Processing workspace ${i + 1}/${workspaces.length}: ${workspace.name}`);

        try {
          const workspaceResult = await processWorkspace(workspace, session, job);

          // Acumular resultados
          session.totalProcesses += workspaceResult.totalProcesses;
          session.processed += workspaceResult.processed;
          session.successful += workspaceResult.successful;
          session.failed += workspaceResult.failed;
          session.newMovements += workspaceResult.newMovements;
          session.alertsGenerated += workspaceResult.alertsGenerated;
          session.trackingCreated += workspaceResult.trackingCreated;
          session.trackingUsed += workspaceResult.trackingUsed;
          session.pollingUsed += workspaceResult.pollingUsed;
          session.costIncurred += workspaceResult.costIncurred;
          session.errors.push(...workspaceResult.errors);

          // Atualizar progresso
          const progress = 10 + Math.round((i + 1) / workspaces.length * 80);
          await job.progress(progress);

          // Delay entre workspaces
          if (i < workspaces.length - 1) {
            await sleep(MONITOR_CONFIG.WORKSPACE_DELAY_MS);
          }

        } catch (error) {
          console.error(`${ICONS.ERROR} Failed to process workspace ${workspace.name}:`, error);
          session.errors.push({
            processNumber: `workspace_${workspace.id}`,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          });
          session.failed++;
        }
      }

      // Finalizar sessão
      session.duration = Date.now() - session.startedAt.getTime();
      session.status = 'COMPLETED';

      await saveMonitoringSession(session);

      console.log(`${ICONS.SUCCESS} Daily monitoring completed:`, {
        processed: session.processed,
        successful: session.successful,
        failed: session.failed,
        newMovements: session.newMovements,
        cost: session.costIncurred.toFixed(2),
        duration: `${Math.round(session.duration / 1000)}s`
      });

      return session;

    } catch (error) {
      console.error(`${ICONS.ERROR} Daily monitoring failed:`, error);

      session.duration = Date.now() - session.startedAt.getTime();
      session.status = 'FAILED';
      session.errors.push({
        processNumber: 'system',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });

      await saveMonitoringSession(session);
      throw error;
    }
  }
);

// ================================================================
// PROCESSAMENTO POR WORKSPACE
// ================================================================

async function processWorkspace(
  workspace: any,
  globalSession: MonitoringSession,
  job: Job<MonitorJobData>
): Promise<MonitoringSession> {
  const juditClient = getJuditApiClient();

  const workspaceSession: MonitoringSession = {
    id: `workspace_${workspace.id}_${Date.now()}`,
    workspaceId: workspace.id,
    startedAt: new Date(),
    totalProcesses: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    newMovements: 0,
    alertsGenerated: 0,
    trackingCreated: 0,
    trackingUsed: 0,
    pollingUsed: 0,
    rateLimitHits: 0,
    costIncurred: 0,
    errors: [],
    duration: 0,
    status: 'RUNNING'
  };

  try {
    // Buscar processos que precisam ser monitorados
    const processesToMonitor = await getProcessesForMonitoring(workspace.id);
    workspaceSession.totalProcesses = processesToMonitor.length;

    console.log(`${ICONS.INFO} Workspace ${workspace.name}: ${processesToMonitor.length} processes to monitor`);

    if (processesToMonitor.length === 0) {
      workspaceSession.status = 'COMPLETED';
      return workspaceSession;
    }

    // Separar por método: tracking vs polling
    const { trackingProcesses, pollingProcesses } = await categorizeProcesses(processesToMonitor);

    console.log(`${ICONS.INFO} Processing: ${trackingProcesses.length} tracking, ${pollingProcesses.length} polling`);

    // Processar tracking primeiro (mais eficiente)
    if (trackingProcesses.length > 0) {
      const trackingResults = await processTrackingProcesses(
        trackingProcesses,
        workspace.id,
        juditClient
      );

      accumulateResults(workspaceSession, trackingResults);
    }

    // Processar polling em lotes
    if (pollingProcesses.length > 0) {
      const pollingResults = await processPollingProcesses(
        pollingProcesses,
        workspace.id,
        juditClient
      );

      accumulateResults(workspaceSession, pollingResults);
    }

    workspaceSession.duration = Date.now() - workspaceSession.startedAt.getTime();
    workspaceSession.status = 'COMPLETED';

    return workspaceSession;

  } catch (error) {
    console.error(`${ICONS.ERROR} Workspace processing failed:`, error);

    workspaceSession.duration = Date.now() - workspaceSession.startedAt.getTime();
    workspaceSession.status = 'FAILED';
    workspaceSession.errors.push({
      processNumber: `workspace_${workspace.id}`,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });

    throw error;
  }
}

// ================================================================
// PROCESSAMENTO POR TRACKING
// ================================================================

async function processTrackingProcesses(
  processes: any[],
  workspaceId: string,
  juditClient: any
): Promise<ProcessMonitoringResult[]> {
  console.log(`${ICONS.PROCESS} Processing ${processes.length} processes via tracking`);

  const results: ProcessMonitoringResult[] = [];

  // Verificar trackings existentes
  const existingTrackings = await getExistingTrackings(workspaceId);
  const trackingMap = new Map(existingTrackings.map(t => [t.processNumber, t.trackingId]));

  for (const process of processes) {
    const startTime = Date.now();
    let result: ProcessMonitoringResult = {
      processId: process.id,
      processNumber: process.processNumber,
      success: false,
      method: 'tracking',
      newMovements: 0,
      alertsGenerated: 0,
      cost: 0,
      responseTime: 0
    };

    try {
      let trackingId = trackingMap.get(process.processNumber);

      // Criar tracking se não existir
      if (!trackingId) {
        const callbackUrl = `${process.env.NEXT_PUBLIC_URL}/api/webhooks/judit/tracking`;
        const tracking = await juditClient.createTracking(process.processNumber, callbackUrl);
        trackingId = tracking.tracking_id;

        // Salvar tracking no banco
        await saveProcessTracking(process.id, trackingId);

        result.cost += MONITOR_CONFIG.COST_PER_TRACKING_MONTH;
        console.log(`${ICONS.SUCCESS} Created tracking for ${process.processNumber}: ${trackingId}`);
      }

      // Verificar se há webhooks pendentes para este processo
      const pendingWebhooks = await getPendingWebhooks(process.id);

      if (pendingWebhooks.length > 0) {
        // Processar webhooks pendentes
        const webhookResult = await processWebhooks(process, pendingWebhooks);
        result.newMovements = webhookResult.newMovements;
        result.alertsGenerated = webhookResult.alertsGenerated;
      }

      result.success = true;
      result.responseTime = Date.now() - startTime;

      // Atualizar última verificação
      await updateLastMonitorCheck(process.id);

    } catch (error) {
      console.error(`${ICONS.ERROR} Tracking failed for ${process.processNumber}:`, error);
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.responseTime = Date.now() - startTime;
    }

    results.push(result);

    // Delay entre processos
    await sleep(MONITOR_CONFIG.PROCESS_DELAY_MS);
  }

  return results;
}

// ================================================================
// PROCESSAMENTO POR POLLING
// ================================================================

async function processPollingProcesses(
  processes: any[],
  workspaceId: string,
  juditClient: any
): Promise<ProcessMonitoringResult[]> {
  console.log(`${ICONS.PROCESS} Processing ${processes.length} processes via polling`);

  const results: ProcessMonitoringResult[] = [];

  // Quebrar em lotes para eficiência
  const batches = chunkArray(processes, MONITOR_CONFIG.WORKSPACE_BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`${ICONS.INFO} Processing polling batch ${i + 1}/${batches.length} (${batch.length} processes)`);

    try {
      // Criar requests para o lote
      const processNumbers = batch.map(p => p.processNumber);
      const batchId = `batch_${workspaceId}_${Date.now()}`;

      const requests = await juditClient.searchProcessesBatch(
        processNumbers,
        workspaceId,
        batchId,
        false // Sem attachments na verificação inicial
      );

      console.log(`${ICONS.SUCCESS} Created ${requests.length} requests for batch`);

      // Fazer polling para cada request
      for (const request of requests) {
        const process = batch.find(p => p.processNumber === request.processNumber);
        if (!process) continue;

        const startTime = Date.now();
        let result: ProcessMonitoringResult = {
          processId: process.id,
          processNumber: process.processNumber,
          success: false,
          method: 'polling',
          newMovements: 0,
          alertsGenerated: 0,
          cost: MONITOR_CONFIG.COST_PER_POLLING_CHECK,
          responseTime: 0
        };

        try {
          const response = await juditClient.pollForResult(
            request.requestId,
            request.processNumber,
            workspaceId,
            batchId
          );

          // Processar resposta
          if (response.data) {
            const updateResult = await updateProcessFromJuditData(process, response.data);
            result.newMovements = updateResult.newMovements;
            result.alertsGenerated = updateResult.alertsGenerated;

            // Se há anexos importantes e workspace permite, fazer request com attachments
            if (updateResult.hasImportantAttachments && await canDownloadAttachments(workspaceId)) {
              const attachmentResponse = await juditClient.searchWithAttachments(
                process.processNumber,
                workspaceId
              );

              if (attachmentResponse.attachments?.length > 0) {
                await processAttachments(process.id, attachmentResponse.attachments);
                result.cost += attachmentResponse.attachments.length * MONITOR_CONFIG.COST_PER_ATTACHMENT;
              }
            }
          }

          result.success = true;
          result.responseTime = Date.now() - startTime;

          // Atualizar última verificação
          await updateLastMonitorCheck(process.id);

        } catch (error) {
          console.error(`${ICONS.ERROR} Polling failed for ${process.processNumber}:`, error);
          result.error = error instanceof Error ? error.message : 'Unknown error';
          result.responseTime = Date.now() - startTime;
        }

        results.push(result);
      }

    } catch (error) {
      console.error(`${ICONS.ERROR} Batch polling failed:`, error);

      // Marcar todos os processos do lote como falha
      for (const process of batch) {
        results.push({
          processId: process.id,
          processNumber: process.processNumber,
          success: false,
          method: 'polling',
          newMovements: 0,
          alertsGenerated: 0,
          cost: MONITOR_CONFIG.COST_PER_POLLING_CHECK,
          error: error instanceof Error ? error.message : 'Batch failed',
          responseTime: 0
        });
      }
    }

    // Delay entre lotes
    if (i < batches.length - 1) {
      await sleep(MONITOR_CONFIG.BATCH_DELAY_MS);
    }
  }

  return results;
}

// ================================================================
// FUNÇÕES AUXILIARES
// ================================================================

async function getWorkspacesForMonitoring(workspaceId?: string) {
  const whereClause = workspaceId ? { id: workspaceId } : {};

  return await prisma.workspace.findMany({
    where: {
      ...whereClause,
      status: 'ACTIVE'
    },
    select: {
      id: true,
      name: true,
      plan: true
    }
  });
}

async function getProcessesForMonitoring(workspaceId: string) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return await prisma.monitoredProcess.findMany({
    where: {
      workspaceId,
      monitoringStatus: 'ACTIVE',
      OR: [
        { lastSync: null },
        { lastSync: { lt: dayAgo } }
      ]
    },
    orderBy: [
      { lastSync: 'asc' },
      { createdAt: 'asc' }
    ],
    take: MONITOR_CONFIG.MONITOR_BATCH_SIZE
  });
}

async function categorizeProcesses(processes: any[]) {
  // Buscar configurações de tracking existentes
  const trackingConfigs = await prisma.monitoredProcess.findMany({
    where: {
      id: { in: processes.map(p => p.id) }
    },
    select: {
      id: true,
      processNumber: true,
      remoteTrackingId: true
    }
  });

  const trackingMap = new Map(trackingConfigs.map(c => [c.id, c.remoteTrackingId]));

  const trackingProcesses = processes.filter(p =>
    MONITOR_CONFIG.PREFER_TRACKING && (trackingMap.get(p.id) || MONITOR_CONFIG.TRACKING_ENABLED_BY_DEFAULT)
  );

  const pollingProcesses = processes.filter(p =>
    !trackingProcesses.includes(p)
  );

  return { trackingProcesses, pollingProcesses };
}

async function getExistingTrackings(workspaceId: string) {
  return await prisma.monitoredProcess.findMany({
    where: {
      workspaceId,
      remoteTrackingId: { not: null }
    },
    select: {
      processNumber: true,
      remoteTrackingId: true
    }
  }).then(results => results.map(r => ({
    processNumber: r.processNumber,
    trackingId: r.remoteTrackingId!
  })));
}

async function saveProcessTracking(processId: string, trackingId: string) {
  await prisma.monitoredProcess.update({
    where: { id: processId },
    data: { remoteTrackingId: trackingId }
  });
}

async function getPendingWebhooks(processId: string) {
  // TODO: Implementar busca de webhooks pendentes
  // Por enquanto retornar array vazio
  return [];
}

async function processWebhooks(process: any, webhooks: any[]) {
  // TODO: Implementar processamento de webhooks
  return { newMovements: 0, alertsGenerated: 0 };
}

async function updateProcessFromJuditData(process: any, juditData: any) {
  // TODO: Implementar atualização do processo com dados da Judit
  // Similar ao sync-worker existente

  const newMovements = juditData.movimentacoes?.length || 0;
  const hasImportantAttachments = juditData.attachments?.some((att: any) => att.important) || false;

  // Simular processamento por enquanto
  return {
    newMovements: Math.min(newMovements, 3), // Máximo 3 movimentos novos por check
    alertsGenerated: newMovements > 0 ? 1 : 0,
    hasImportantAttachments
  };
}

async function canDownloadAttachments(workspaceId: string): Promise<boolean> {
  // TODO: Verificar política do workspace para download de anexos
  // Por enquanto sempre permitir
  return true;
}

async function processAttachments(processId: string, attachments: any[]) {
  // TODO: Implementar processamento de anexos
  console.log(`${ICONS.INFO} Processing ${attachments.length} attachments for process ${processId}`);
}

async function updateLastMonitorCheck(processId: string) {
  await prisma.monitoredProcess.update({
    where: { id: processId },
    data: { lastSync: new Date() }
  });
}

function accumulateResults(session: MonitoringSession, results: ProcessMonitoringResult[]) {
  for (const result of results) {
    session.processed++;

    if (result.success) {
      session.successful++;
      session.newMovements += result.newMovements;
      session.alertsGenerated += result.alertsGenerated;

      if (result.method === 'tracking') {
        session.trackingUsed++;
      } else {
        session.pollingUsed++;
      }
    } else {
      session.failed++;
      session.errors.push({
        processNumber: result.processNumber,
        error: result.error || 'Unknown error',
        timestamp: new Date()
      });
    }

    session.costIncurred += result.cost;
  }
}

async function saveMonitoringSession(session: MonitoringSession) {
  // TODO: Salvar sessão no banco para histórico/auditoria
  console.log(`${ICONS.CHART} Monitoring session completed:`, {
    id: session.id,
    workspaceId: session.workspaceId,
    processed: session.processed,
    successful: session.successful,
    failed: session.failed,
    newMovements: session.newMovements,
    cost: session.costIncurred.toFixed(2),
    duration: `${Math.round(session.duration / 1000)}s`
  });
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ================================================================
// API PÚBLICA
// ================================================================

export async function addMonitoringJob(
  type: 'daily-monitor' | 'workspace-monitor' | 'process-monitor',
  data: Partial<MonitorJobData> = {},
  scheduleFor?: Date
): Promise<Job<MonitorJobData>> {
  const delay = scheduleFor ? scheduleFor.getTime() - Date.now() : 0;

  return processMonitorQueue.add(type, {
    type,
    ...data
  }, {
    delay: Math.max(0, delay),
    jobId: `${type}-${data.workspaceId || 'global'}-${Date.now()}`,
    removeOnComplete: 10,
    removeOnFail: 5
  });
}

export async function getMonitoringStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    processMonitorQueue.getWaiting(),
    processMonitorQueue.getActive(),
    processMonitorQueue.getCompleted(),
    processMonitorQueue.getFailed(),
  ]);

  const juditClient = getJuditApiClient();
  const juditStats = juditClient.getStats();
  const rateLimiterStatus = juditClient.getRateLimiterStatus();
  const circuitBreakerStats = juditClient.getCircuitBreakerStats();

  return {
    queue: {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    },
    juditApi: {
      ...juditStats,
      rateLimiter: rateLimiterStatus,
      circuitBreaker: circuitBreakerStats
    },
    lastRun: completed[0]?.finishedOn ? new Date(completed[0].finishedOn) : null,
  };
}

export async function setupDailyMonitoring() {
  // Agendar job diário para às 01:00
  const cronExpression = '0 1 * * *'; // Todo dia às 01:00

  await processMonitorQueue.add('daily-monitor', {
    type: 'daily-monitor'
  }, {
    repeat: { cron: cronExpression },
    jobId: 'daily-monitor-recurring',
  });

  console.log(`${ICONS.SUCCESS} Daily monitoring scheduled (01:00 daily)`);
}

console.log(`${ICONS.WORKER} Process Monitor Worker initialized successfully`);

export default processMonitorQueue;