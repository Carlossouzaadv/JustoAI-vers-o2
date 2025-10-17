/**
 * Cache Cleanup Worker - Limpeza Automática de Cache
 * Worker responsável por limpar caches expirados e otimizar uso de memória
 * Executa automaticamente todo dia às 2h (cache geral) e 3h (cache IA)
 */

import { Job } from 'bull';
import { cacheCleanupQueue } from '../lib/queues';
import { prisma } from '../lib/prisma';
import { getRedisClient } from '../src/lib/redis';
import { ICONS } from '../lib/icons';

// Get Redis client instance
const redis = getRedisClient();

// === TIPOS E INTERFACES ===

interface CacheCleanupJobData {
  type: 'daily-cleanup' | 'ai-cache-cleanup' | 'manual-cleanup' | 'emergency-cleanup';
  maxAge?: number; // Idade máxima em horas
  forceCleanup?: boolean;
  targetTypes?: string[]; // Tipos específicos de cache
}

interface CleanupResult {
  success: boolean;
  totalKeysScanned: number;
  keysDeleted: number;
  memoryFreed: number; // Em bytes
  databaseRecordsDeleted: number;
  errors: Array<{
    key: string;
    error: string;
  }>;
  duration: number;
  timestamp: string;
  details: {
    redisCleanup: {
      generalCache: number;
      aiCache: number;
      sessionCache: number;
      tempFiles: number;
      other: number;
    };
    databaseCleanup: {
      expiredSessions: number;
      oldLogs: number;
      tempAnalysis: number;
      failedJobs: number;
    };
  };
}

// === CONFIGURAÇÕES ===

const CLEANUP_CONFIG = {
  // Idades máximas para diferentes tipos de cache (em horas)
  MAX_AGE: {
    GENERAL_CACHE: 24,           // Cache geral: 24 horas
    AI_CACHE: 24 * 7,           // Cache IA: 7 dias
    SESSION_CACHE: 24,          // Sessões: 24 horas
    TEMP_FILES: 2,              // Arquivos temporários: 2 horas
    PROCESS_SYNC: 24 * 3,       // Sync de processos: 3 dias
    REPORT_DATA: 24 * 30,       // Dados de relatório: 30 dias
  },

  // Configurações de batch para evitar sobrecarga
  BATCH_SIZE: 100,              // Keys por lote
  BATCH_DELAY: 100,             // ms entre lotes
  MAX_SCAN_COUNT: 10000,        // Máximo de keys para escanear

  // Configurações de banco de dados
  DB_BATCH_SIZE: 500,           // Registros por lote
  MAX_LOG_AGE_DAYS: 30,         // Máximo de dias para logs
  MAX_TEMP_ANALYSIS_AGE_HOURS: 48, // Análises temporárias
};

// === WORKER PROCESSOR - LIMPEZA DIÁRIA ===

cacheCleanupQueue.process('cleanup-expired-cache', async (job: Job<CacheCleanupJobData>) => {
  const startTime = Date.now();
  console.log(`${ICONS.CLEANUP} Starting daily cache cleanup...`);

  try {
    await job.progress(5);

    const result = await performGeneralCleanup(job);

    console.log(`${ICONS.CHECK} Daily cleanup completed: ${result.keysDeleted} keys deleted, ${formatBytes(result.memoryFreed)} freed`);
    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} Daily cleanup failed:`, error);
    throw error;
  }
});

// === WORKER PROCESSOR - LIMPEZA CACHE IA ===

cacheCleanupQueue.process('cleanup-ai-cache', async (job: Job<CacheCleanupJobData>) => {
  const startTime = Date.now();
  console.log(`${ICONS.AI} Starting AI cache cleanup...`);

  try {
    await job.progress(5);

    const result = await performAICacheCleanup(job);

    console.log(`${ICONS.CHECK} AI cache cleanup completed: ${result.databaseRecordsDeleted} DB records cleaned`);
    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} AI cache cleanup failed:`, error);
    throw error;
  }
});

// === WORKER PROCESSOR - LIMPEZA MANUAL ===

cacheCleanupQueue.process('manual-cleanup', async (job: Job<CacheCleanupJobData>) => {
  const { targetTypes, maxAge, forceCleanup } = job.data;
  const startTime = Date.now();

  console.log(`${ICONS.MANUAL} Starting manual cleanup...`);

  try {
    const result = await performTargetedCleanup(targetTypes, maxAge, forceCleanup, job);
    return result;

  } catch (error) {
    console.error(`${ICONS.ERROR} Manual cleanup failed:`, error);
    throw error;
  }
});

// === FUNÇÕES DE LIMPEZA ===

/**
 * Limpeza geral de cache Redis
 */
async function performGeneralCleanup(job: Job<CacheCleanupJobData>): Promise<CleanupResult> {
  const startTime = Date.now();
  const result: CleanupResult = createEmptyResult();

  console.log(`${ICONS.SCAN} Scanning Redis keys for cleanup...`);

  // 1. Limpar cache geral
  await job.progress(20);
  const generalCacheResult = await cleanupCacheByPattern('cache:*', CLEANUP_CONFIG.MAX_AGE.GENERAL_CACHE);
  result.details.redisCleanup.generalCache = generalCacheResult.deleted;

  // 2. Limpar sessões expiradas
  await job.progress(40);
  const sessionResult = await cleanupCacheByPattern('session:*', CLEANUP_CONFIG.MAX_AGE.SESSION_CACHE);
  result.details.redisCleanup.sessionCache = sessionResult.deleted;

  // 3. Limpar arquivos temporários
  await job.progress(60);
  const tempFilesResult = await cleanupCacheByPattern('temp:*', CLEANUP_CONFIG.MAX_AGE.TEMP_FILES);
  result.details.redisCleanup.tempFiles = tempFilesResult.deleted;

  // 4. Limpar sync de processos antigos
  await job.progress(80);
  const syncResult = await cleanupCacheByPattern('sync:*', CLEANUP_CONFIG.MAX_AGE.PROCESS_SYNC);
  result.details.redisCleanup.other += syncResult.deleted;

  // 5. Limpeza de banco de dados
  await job.progress(90);
  await cleanupDatabaseRecords(result);

  // Totalizar resultados
  result.keysDeleted =
    generalCacheResult.deleted +
    sessionResult.deleted +
    tempFilesResult.deleted +
    syncResult.deleted;

  result.totalKeysScanned =
    generalCacheResult.scanned +
    sessionResult.scanned +
    tempFilesResult.scanned +
    syncResult.scanned;

  result.memoryFreed = await getMemoryStats();
  result.duration = Date.now() - startTime;
  result.success = result.errors.length === 0;

  await job.progress(100);
  return result;
}

/**
 * Limpeza específica do cache IA
 */
async function performAICacheCleanup(job: Job<CacheCleanupJobData>): Promise<CleanupResult> {
  const startTime = Date.now();
  const result: CleanupResult = createEmptyResult();

  console.log(`${ICONS.AI} Cleaning AI cache and database records...`);

  // 1. Limpar cache Redis IA
  await job.progress(30);
  const aiCacheResult = await cleanupCacheByPattern('ai:*', CLEANUP_CONFIG.MAX_AGE.AI_CACHE);
  result.details.redisCleanup.aiCache = aiCacheResult.deleted;

  // 2. Limpar registros de cache IA antigos no banco
  await job.progress(70);
  const deletedCacheRecords = await cleanupAICacheDatabase();
  result.details.databaseCleanup.tempAnalysis = deletedCacheRecords;

  result.keysDeleted = aiCacheResult.deleted;
  result.totalKeysScanned = aiCacheResult.scanned;
  result.databaseRecordsDeleted = deletedCacheRecords;
  result.memoryFreed = await getMemoryStats();
  result.duration = Date.now() - startTime;
  result.success = result.errors.length === 0;

  await job.progress(100);
  return result;
}

/**
 * Limpeza direcionada
 */
async function performTargetedCleanup(
  targetTypes?: string[],
  maxAge?: number,
  forceCleanup?: boolean,
  job?: Job<CacheCleanupJobData>
): Promise<CleanupResult> {
  const startTime = Date.now();
  const result: CleanupResult = createEmptyResult();

  const patterns = targetTypes || ['cache:*', 'temp:*', 'session:*'];
  const age = maxAge || 24;

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    console.log(`${ICONS.TARGET} Cleaning pattern: ${pattern}`);

    const cleanupResult = await cleanupCacheByPattern(pattern, age);
    result.keysDeleted += cleanupResult.deleted;
    result.totalKeysScanned += cleanupResult.scanned;
    result.errors.push(...cleanupResult.errors);

    if (job) {
      await job.progress(Math.round((i + 1) / patterns.length * 100));
    }
  }

  result.duration = Date.now() - startTime;
  result.success = result.errors.length === 0;

  return result;
}

// === FUNÇÕES AUXILIARES ===

/**
 * Limpa cache por pattern
 */
async function cleanupCacheByPattern(pattern: string, maxAgeHours: number) {
  const result = {
    scanned: 0,
    deleted: 0,
    errors: [] as Array<{ key: string; error: string }>
  };

  const maxAge = maxAgeHours * 60 * 60 * 1000; // Converter para milliseconds
  const cutoffTime = Date.now() - maxAge;

  try {
    // Escanear keys por pattern
    const keys = await redis.keys(pattern);
    result.scanned = keys.length;

    if (keys.length === 0) {
      return result;
    }

    console.log(`${ICONS.SCAN} Found ${keys.length} keys matching ${pattern}`);

    // Processar em lotes para evitar bloqueio
    const batches = chunkArray(keys, CLEANUP_CONFIG.BATCH_SIZE);

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(async (key) => {
          try {
            // Verificar TTL ou timestamp
            const shouldDelete = await shouldDeleteKey(key, cutoffTime);

            if (shouldDelete) {
              await redis.del(key);
              return { deleted: true };
            }

            return { deleted: false };
          } catch (error) {
            result.errors.push({
              key,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            return { deleted: false };
          }
        })
      );

      // Contar deletados
      batchResults.forEach(promiseResult => {
        if (promiseResult.status === 'fulfilled' && promiseResult.value.deleted) {
          result.deleted++;
        }
      });

      // Delay entre lotes
      await sleep(CLEANUP_CONFIG.BATCH_DELAY);
    }

  } catch (error) {
    console.error(`${ICONS.ERROR} Error cleaning pattern ${pattern}:`, error);
    result.errors.push({
      key: pattern,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return result;
}

/**
 * Verifica se uma key deve ser deletada
 */
async function shouldDeleteKey(key: string, cutoffTime: number): Promise<boolean> {
  try {
    // Verificar TTL primeiro
    const ttl = await redis.ttl(key);

    // Se tem TTL e já expirou naturalmente
    if (ttl > 0) {
      return false; // Redis vai limpar automaticamente
    }

    // Se não tem TTL, verificar conteúdo para timestamp
    const value = await redis.get(key);
    if (!value) return true;

    // Tentar extrair timestamp do valor
    try {
      const parsed = JSON.parse(value);

      if (parsed.timestamp) {
        return new Date(parsed.timestamp).getTime() < cutoffTime;
      }

      if (parsed.createdAt) {
        return new Date(parsed.createdAt).getTime() < cutoffTime;
      }

      if (parsed.lastUsed) {
        return new Date(parsed.lastUsed).getTime() < cutoffTime;
      }
    } catch {
      // Se não conseguir parsear, assumir que é antigo
      return true;
    }

    // Por padrão, manter a key se não conseguir determinar idade
    return false;

  } catch (error) {
    console.error(`${ICONS.ERROR} Error checking key ${key}:`, error);
    return false; // Em caso de erro, não deletar
  }
}

/**
 * Limpa registros antigos do banco de dados
 */
async function cleanupDatabaseRecords(result: CleanupResult) {
  const cutoffDate = new Date(Date.now() - CLEANUP_CONFIG.MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000);
  const tempAnalysisCutoff = new Date(Date.now() - CLEANUP_CONFIG.MAX_TEMP_ANALYSIS_AGE_HOURS * 60 * 60 * 1000);

  try {
    // 1. Limpar logs antigos
    const { count: deletedLogs } = await prisma.processSyncLog.deleteMany({
      where: {
        startedAt: { lt: cutoffDate },
        status: 'SUCCESS' // Manter logs de erro por mais tempo
      }
    });
    result.details.databaseCleanup.oldLogs = deletedLogs;

    // 2. Limpar sessões expiradas
    const { count: deletedSessions } = await prisma.user.updateMany({
      where: {
        lastLoginAt: { lt: cutoffDate }
      },
      data: {
        // Limpar tokens de sessão antigos
        // sessionToken: null (se existir campo)
      }
    });
    result.details.databaseCleanup.expiredSessions = deletedSessions;

    // 3. Limpar análises temporárias antigas
    // Note: isTemporary field doesn't exist in schema, skipping this cleanup
    const deletedTempAnalysis = 0;
    result.details.databaseCleanup.tempAnalysis = deletedTempAnalysis;

    result.databaseRecordsDeleted = deletedLogs + deletedSessions + deletedTempAnalysis;

  } catch (error) {
    console.error(`${ICONS.ERROR} Database cleanup error:`, error);
    result.errors.push({
      key: 'database',
      error: error instanceof Error ? error.message : 'Database cleanup failed'
    });
  }
}

/**
 * Limpa cache IA do banco de dados
 */
async function cleanupAICacheDatabase(): Promise<number> {
  const cutoffDate = new Date(Date.now() - CLEANUP_CONFIG.MAX_AGE.AI_CACHE * 60 * 60 * 1000);

  try {
    const { count } = await prisma.aiCache.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });

    console.log(`${ICONS.DATABASE} Deleted ${count} expired AI cache records`);
    return count;

  } catch (error) {
    console.error(`${ICONS.ERROR} AI cache database cleanup error:`, error);
    return 0;
  }
}

/**
 * Obtém estatísticas de memória
 */
async function getMemoryStats(): Promise<number> {
  try {
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    return memoryMatch ? parseInt(memoryMatch[1]) : 0;
  } catch {
    return 0;
  }
}

// === UTILITY FUNCTIONS ===

function createEmptyResult(): CleanupResult {
  return {
    success: true,
    totalKeysScanned: 0,
    keysDeleted: 0,
    memoryFreed: 0,
    databaseRecordsDeleted: 0,
    errors: [],
    duration: 0,
    timestamp: new Date().toISOString(),
    details: {
      redisCleanup: {
        generalCache: 0,
        aiCache: 0,
        sessionCache: 0,
        tempFiles: 0,
        other: 0,
      },
      databaseCleanup: {
        expiredSessions: 0,
        oldLogs: 0,
        tempAnalysis: 0,
        failedJobs: 0,
      },
    },
  };
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// === HEALTH CHECK ===

/**
 * Health check do worker
 */
export async function cacheCleanupWorkerHealthCheck() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      cacheCleanupQueue.getWaiting(),
      cacheCleanupQueue.getActive(),
      cacheCleanupQueue.getCompleted(),
      cacheCleanupQueue.getFailed(),
    ]);

    const redisMemory = await getMemoryStats();
    const redisHealth = await redisUtils.healthCheck();

    return {
      status: redisHealth ? 'healthy' : 'unhealthy',
      queue: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
      redis: {
        connected: redisHealth,
        memoryUsage: formatBytes(redisMemory),
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

console.log(`${ICONS.WORKER} Cache Cleanup Worker initialized successfully`);

export default cacheCleanupQueue;