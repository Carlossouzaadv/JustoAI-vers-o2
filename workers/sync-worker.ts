/**
 * Sync Worker - Sincronização com APIs Externas
 * Worker responsável por sincronizar dados de processos com APIs Judit/Codilo
 * Executa automaticamente a cada 6 horas
 */

import { Job } from 'bull';
import { syncQueue } from '../lib/queues';
import { prisma } from '../lib/prisma';
import { ProcessApiClient, createProcessApiClient } from '../lib/process-apis';
import { redisUtils } from '../src/lib/redis';
import { ICONS } from '../lib/icons';

// === TIPOS E INTERFACES ===

interface SyncJobData {
  workspaceId?: string;
  type: 'full-sync' | 'manual-sync' | 'incremental-sync';
  processIds?: string[];
  forceUpdate?: boolean;
}

interface SyncResult {
  success: boolean;
  processedCount: number;
  updatedCount: number;
  errorCount: number;
  errors: Array<{
    processId: string;
    error: string;
  }>;
  duration: number;
  timestamp: string;
}

// === CONFIGURAÇÕES ===

const SYNC_CONFIG = {
  BATCH_SIZE: 50,                    // Processos por lote
  MAX_CONCURRENT: 5,                 // Máximo de requests simultâneos
  RETRY_DELAY: 30000,               // 30 segundos entre tentativas
  STALE_THRESHOLD: 24 * 60 * 60 * 1000, // 24 horas em ms
  CACHE_TTL: 6 * 60 * 60,           // 6 horas de cache
};

// === WORKER PROCESSOR ===

syncQueue.process('sync-apis', async (job: Job<SyncJobData>) => {
  const startTime = Date.now();
  const { workspaceId, type, processIds, forceUpdate = false } = job.data;

  console.log(`${ICONS.SYNC} Starting ${type} sync job...`);

  try {
    // Atualizar progresso
    await job.progress(10);

    // Buscar processos para sincronizar
    const processes = await getProcessesToSync({
      workspaceId,
      processIds,
      forceUpdate,
      type
    });

    console.log(`${ICONS.INFO} Found ${processes.length} processes to sync`);
    await job.progress(20);

    if (processes.length === 0) {
      return {
        success: true,
        processedCount: 0,
        updatedCount: 0,
        errorCount: 0,
        errors: [],
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    // Processar em lotes
    const result = await processBatches(processes, job);

    // Salvar resultado no cache e banco
    await saveSyncResult(result, workspaceId);

    console.log(`${ICONS.CHECK} Sync completed: ${result.updatedCount}/${result.processedCount} updated`);
    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} Sync job failed:`, error);

    const errorResult: SyncResult = {
      success: false,
      processedCount: 0,
      updatedCount: 0,
      errorCount: 1,
      errors: [{
        processId: 'system',
        error: error instanceof Error ? error.message : 'Unknown error'
      }],
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    await saveSyncResult(errorResult, workspaceId);
    throw error;
  }
});

// === WORKER PROCESSOR - SYNC MANUAL ===

syncQueue.process('manual-sync', async (job: Job<SyncJobData>) => {
  const startTime = Date.now();
  console.log(`${ICONS.SYNC} Starting manual sync process...`);

  try {
    // Usar mesma lógica do sync-apis mas com parâmetros do manual-sync
    const { workspaceId, processIds, forceUpdate = true } = job.data;

    await job.progress(5);

    // Buscar processos para sincronizar
    const processes = await getProcessesToSync({
      workspaceId,
      processIds,
      forceUpdate,
      type: 'manual-sync'
    });

    console.log(`${ICONS.INFO} Found ${processes.length} processes to sync`);
    await job.progress(15);

    // Processar em lotes
    const result = await processBatches(processes, job);

    // Salvar resultado
    await saveSyncResult(result);

    console.log(`${ICONS.CHECK} Manual sync completed: ${result.updatedCount}/${result.processedCount} processes updated`);
    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} Manual sync failed:`, error);
    throw error;
  }
});

// === FUNÇÕES AUXILIARES ===

/**
 * Busca processos que precisam ser sincronizados
 */
async function getProcessesToSync({
  workspaceId,
  processIds,
  forceUpdate,
  type
}: {
  workspaceId?: string;
  processIds?: string[];
  forceUpdate: boolean;
  type: string;
}) {
  const whereClause: any = {};

  // Filtrar por workspace se especificado
  if (workspaceId) {
    whereClause.workspaceId = workspaceId;
  }

  // Filtrar por IDs específicos se especificado
  if (processIds && processIds.length > 0) {
    whereClause.id = { in: processIds };
  }

  // Se não forçar update, buscar apenas processos "antigos"
  if (!forceUpdate && type === 'incremental-sync') {
    const staleDate = new Date(Date.now() - SYNC_CONFIG.STALE_THRESHOLD);
    whereClause.OR = [
      { lastSyncAt: { lt: staleDate } },
      { lastSyncAt: null }
    ];
  }

  return await prisma.monitoredProcess.findMany({
    where: whereClause,
    select: {
      id: true,
      processNumber: true,
      court: true,
      workspaceId: true,
      lastSync: true,
    },
    orderBy: {
      lastSync: 'asc' // Processos mais antigos primeiro
    },
    take: type === 'full-sync' ? undefined : 500 // Limitar incremental
  });
}

/**
 * Processa processos em lotes
 */
async function processBatches(processes: any[], job: Job<SyncJobData>): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: true,
    processedCount: 0,
    updatedCount: 0,
    errorCount: 0,
    errors: [],
    duration: 0,
    timestamp: new Date().toISOString(),
  };

  const batches = chunkArray(processes, SYNC_CONFIG.BATCH_SIZE);
  const totalBatches = batches.length;

  for (let i = 0; i < totalBatches; i++) {
    const batch = batches[i];

    console.log(`${ICONS.SYNC} Processing batch ${i + 1}/${totalBatches} (${batch.length} processes)`);

    // Processar lote atual
    const batchResult = await processBatch(batch);

    // Acumular resultados
    result.processedCount += batchResult.processedCount;
    result.updatedCount += batchResult.updatedCount;
    result.errorCount += batchResult.errorCount;
    result.errors.push(...batchResult.errors);

    // Atualizar progresso (20% inicial + 70% processamento + 10% finalização)
    const progress = 20 + Math.round((i + 1) / totalBatches * 70);
    await job.progress(progress);

    // Delay entre lotes para não sobrecarregar APIs
    if (i < totalBatches - 1) {
      await sleep(1000);
    }
  }

  result.duration = Date.now() - startTime;
  result.success = result.errorCount === 0;

  return result;
}

/**
 * Processa um lote de processos
 */
async function processBatch(processes: any[]): Promise<Omit<SyncResult, 'duration' | 'timestamp'>> {
  const result = {
    success: true,
    processedCount: 0,
    updatedCount: 0,
    errorCount: 0,
    errors: [] as Array<{ processId: string; error: string }>,
  };

  // Processar até MAX_CONCURRENT processos simultaneamente
  const chunks = chunkArray(processes, SYNC_CONFIG.MAX_CONCURRENT);

  for (const chunk of chunks) {
    const promises = chunk.map(process => syncSingleProcess(process));
    const results = await Promise.allSettled(promises);

    results.forEach((promiseResult, index) => {
      const process = chunk[index];
      result.processedCount++;

      if (promiseResult.status === 'fulfilled') {
        if (promiseResult.value.updated) {
          result.updatedCount++;
        }
      } else {
        result.errorCount++;
        result.errors.push({
          processId: process.id,
          error: promiseResult.reason?.message || 'Unknown error'
        });
      }
    });
  }

  return result;
}

/**
 * Sincroniza um único processo
 */
async function syncSingleProcess(process: any): Promise<{ updated: boolean; data?: any }> {
  const cacheKey = `sync:${process.id}:${process.processNumber}`;

  try {
    // Verificar cache primeiro
    const cached = await redisUtils.get(cacheKey);
    if (cached && !shouldForceSync(process)) {
      return { updated: false, data: cached };
    }

    // Buscar dados das APIs
    const apiClient = createProcessApiClient();
    const apiResult = await apiClient.searchProcess({
      processNumber: process.processNumber,
      court: process.court
    });

    if (!apiResult.success || !apiResult.data) {
      throw new Error(`API sync failed: ${apiResult.error}`);
    }

    // Verificar se há mudanças
    const hasChanges = await checkForChanges(process.id, apiResult.data);

    if (!hasChanges) {
      // Atualizar timestamp mesmo sem mudanças
      await prisma.monitoredProcess.update({
        where: { id: process.id },
        data: { lastSync: new Date() }
      });

      // Cache resultado
      await redisUtils.setWithTTL(cacheKey, apiResult.data, SYNC_CONFIG.CACHE_TTL);

      return { updated: false, data: apiResult.data };
    }

    // Atualizar processo com novos dados
    await updateProcessWithApiData(process.id, apiResult.data);

    // Cache resultado
    await redisUtils.setWithTTL(cacheKey, apiResult.data, SYNC_CONFIG.CACHE_TTL);

    return { updated: true, data: apiResult.data };

  } catch (error) {
    console.error(`${ICONS.ERROR} Failed to sync process ${process.processNumber}:`, error);
    throw error;
  }
}

/**
 * Verifica se deve forçar sincronização
 */
function shouldForceSync(process: any): boolean {
  if (!process.lastSyncAt) return true;

  const hoursSinceLastSync = (Date.now() - new Date(process.lastSyncAt).getTime()) / (1000 * 60 * 60);
  return hoursSinceLastSync > 6; // Força sync se > 6 horas
}

/**
 * Verifica se há mudanças nos dados
 */
async function checkForChanges(processId: string, apiData: any): Promise<boolean> {
  const currentMovements = await prisma.processMovement.findMany({
    where: { monitoredProcessId: processId },
    orderBy: { date: 'desc' },
    take: 10,
    select: {
      date: true,
      description: true,
      type: true,
    }
  });

  const apiMovements = apiData.movimentacoes?.slice(0, 10) || [];

  // Comparar as 10 movimentações mais recentes
  if (apiMovements.length !== currentMovements.length) {
    return true;
  }

  for (let i = 0; i < apiMovements.length; i++) {
    const apiMovement = apiMovements[i];
    const currentMovement = currentMovements[i];

    if (
      new Date(apiMovement.data).getTime() !== new Date(currentMovement.date).getTime() ||
      apiMovement.descricao !== currentMovement.description
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Atualiza processo com dados da API
 */
async function updateProcessWithApiData(processId: string, apiData: any) {
  const { movimentacoes = [], ...processData } = apiData;

  await prisma.$transaction(async (tx) => {
    // Atualizar dados do processo
    await tx.monitoredProcess.update({
      where: { id: processId },
      data: {
        ...processData,
        lastSyncAt: new Date(),
      }
    });

    // Processar novas movimentações
    for (const movement of movimentacoes) {
      // Verificar se a movimentação já existe
      const existingMovement = await tx.processMovement.findFirst({
        where: {
          monitoredProcessId: processId,
          date: new Date(movement.data),
          description: movement.descricao
        }
      });

      if (!existingMovement) {
        await tx.processMovement.create({
          data: {
            monitoredProcessId: processId,
            date: new Date(movement.data),
            description: movement.descricao,
            type: movement.tipo || 'UNKNOWN'
          }
        });
      }
    }

    // Log da sincronização
    await tx.processSyncLog.create({
      data: {
        monitoredProcessId: processId,
        syncType: 'FULL',
        status: 'SUCCESS',
        newMovements: movimentacoes.length,
        startedAt: new Date(),
        finishedAt: new Date()
      }
    });
  });
}

/**
 * Salva resultado da sincronização
 */
async function saveSyncResult(result: SyncResult, workspaceId?: string) {
  const cacheKey = `sync:result:${workspaceId || 'global'}:${new Date().toISOString().split('T')[0]}`;

  // Cache resultado para dashboard
  await redisUtils.setWithTTL(cacheKey, result, 24 * 60 * 60); // 24 horas

  // TODO: Salvar estatísticas no banco (quando tivermos um processo global)
  // Comentado temporariamente pois ProcessSyncLog requer um monitoredProcessId válido
  console.log(`${ICONS.CHART} Sync stats:`, {
    processedCount: result.processedCount,
    updatedCount: result.updatedCount,
    errorCount: result.errorCount,
    duration: result.duration
  });
}

// === UTILITY FUNCTIONS ===

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

// === HEALTH CHECK ===

/**
 * Health check do worker
 */
export async function syncWorkerHealthCheck() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      syncQueue.getWaiting(),
      syncQueue.getActive(),
      syncQueue.getCompleted(),
      syncQueue.getFailed(),
    ]);

    return {
      status: 'healthy',
      queue: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
      lastRun: completed[0]?.finishedOn ? new Date(completed[0].finishedOn) : null,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

console.log(`${ICONS.WORKER} Sync Worker initialized successfully`);

export default syncQueue;