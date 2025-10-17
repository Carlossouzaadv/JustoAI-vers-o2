/**
 * Bull Queue Configuration
 * Sistema de filas para processamento assíncrono
 *
 * Uses centralized Redis configuration from src/lib/redis.ts
 * Lazy-loads Redis connections to avoid connection attempts during build
 */

import Queue from 'bull';
import { getRedisConnection } from '../src/lib/redis';

// Lazy initialization - queues are created on first use, not on import
let _syncQueue: Queue.Queue | null = null;
let _reportsQueue: Queue.Queue | null = null;
let _cacheCleanupQueue: Queue.Queue | null = null;
let _documentProcessingQueue: Queue.Queue | null = null;
let _notificationQueue: Queue.Queue | null = null;

// Helper function to get or create queue config
const getQueueConfig = () => ({
  redis: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 100, // Manter últimos 100 jobs completos
    removeOnFail: 50,      // Manter últimos 50 jobs falhados
    attempts: 3,           // 3 tentativas por padrão
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// === FILAS PRINCIPAIS (Lazy Load) ===

/**
 * Fila para sincronização com APIs externas
 * Executa a cada 6 horas
 */
function getSyncQueue() {
  if (!_syncQueue) {
    _syncQueue = new Queue('API Sync', getQueueConfig());
  }
  return _syncQueue;
}

/**
 * Fila para geração de relatórios automáticos
 * Executa domingos às 23h
 */
function getReportsQueue() {
  if (!_reportsQueue) {
    _reportsQueue = new Queue('Automated Reports', getQueueConfig());
  }
  return _reportsQueue;
}

/**
 * Fila para limpeza de cache
 * Executa diariamente
 */
function getCacheCleanupQueue() {
  if (!_cacheCleanupQueue) {
    _cacheCleanupQueue = new Queue('Cache Cleanup', getQueueConfig());
  }
  return _cacheCleanupQueue;
}

/**
 * Fila para processamento de documentos PDF
 * On-demand processing
 */
function getDocumentProcessingQueue() {
  if (!_documentProcessingQueue) {
    _documentProcessingQueue = new Queue('Document Processing', getQueueConfig());
  }
  return _documentProcessingQueue;
}

/**
 * Fila para envio de emails/notificações
 * High priority queue
 */
function getNotificationQueue() {
  if (!_notificationQueue) {
    const config = getQueueConfig();
    _notificationQueue = new Queue('Notifications', {
      ...config,
      defaultJobOptions: {
        ...config.defaultJobOptions,
        priority: 10, // Alta prioridade
        attempts: 5,  // Mais tentativas para notificações
      }
    });
  }
  return _notificationQueue;
}

// Helper to get all queues dynamically
function getAllQueues() {
  return [
    getSyncQueue(),
    getReportsQueue(),
    getCacheCleanupQueue(),
    getDocumentProcessingQueue(),
    getNotificationQueue(),
  ];
}

// Export all queue getters and utility functions
export const syncQueue = getSyncQueue;
export const reportsQueue = getReportsQueue;
export const cacheCleanupQueue = getCacheCleanupQueue;
export const documentProcessingQueue = getDocumentProcessingQueue;
export const notificationQueue = getNotificationQueue;

// === UTILITY FUNCTIONS ===

/**
 * Configura jobs recorrentes (cron jobs)
 */
export async function setupRecurringJobs() {
  console.log('🔄 Setting up recurring jobs...');

  // Sync APIs - a cada 6 horas
  await getSyncQueue().add(
    'sync-apis',
    { type: 'full-sync' },
    {
      repeat: { cron: '0 */6 * * *' }, // A cada 6 horas
      jobId: 'sync-apis-recurring',
    }
  );

  // Relatórios automáticos - domingos às 23h
  await getReportsQueue().add(
    'generate-scheduled-reports',
    { type: 'weekly-reports' },
    {
      repeat: { cron: '0 23 * * 0' }, // Domingo 23h
      jobId: 'weekly-reports-recurring',
    }
  );

  // Limpeza de cache - todo dia às 2h
  await getCacheCleanupQueue().add(
    'cleanup-expired-cache',
    { type: 'daily-cleanup' },
    {
      repeat: { cron: '0 2 * * *' }, // Todo dia às 2h
      jobId: 'cache-cleanup-recurring',
    }
  );

  // Limpeza de cache de IA - todo dia às 3h
  await getCacheCleanupQueue().add(
    'cleanup-ai-cache',
    { type: 'ai-cache-cleanup' },
    {
      repeat: { cron: '0 3 * * *' }, // Todo dia às 3h
      jobId: 'ai-cache-cleanup-recurring',
    }
  );

  console.log('✅ Recurring jobs configured successfully');
}

/**
 * Adiciona job de sincronização manual
 */
export async function addSyncJob(workspaceId: string, options = {}) {
  return await getSyncQueue().add(
    'manual-sync',
    {
      workspaceId,
      type: 'manual-sync',
      ...options
    },
    {
      priority: 5,
      attempts: 2,
    }
  );
}

/**
 * Adiciona job de geração de relatório
 */
export async function addReportJob(scheduleId: string, options = {}) {
  return await getReportsQueue().add(
    'generate-report',
    {
      scheduleId,
      type: 'scheduled-report',
      ...options
    },
    {
      priority: 3,
      attempts: 2,
    }
  );
}

/**
 * Adiciona job de processamento de documento
 */
export async function addDocumentProcessingJob(documentId: string, options = {}) {
  return await getDocumentProcessingQueue().add(
    'process-document',
    {
      documentId,
      type: 'pdf-analysis',
      ...options
    },
    {
      priority: 7,
      attempts: 3,
    }
  );
}

/**
 * Adiciona job de notificação
 */
export async function addNotificationJob(type: string, data: any, options = {}) {
  return await getNotificationQueue().add(
    'send-notification',
    {
      type,
      data,
      ...options
    },
    {
      priority: 10,
      attempts: 5,
    }
  );
}

// === ESTATÍSTICAS E MONITORAMENTO ===

/**
 * Retorna estatísticas de todas as filas
 */
export async function getQueuesStats() {
  const allQueues = getAllQueues();
  const stats = await Promise.all(
    allQueues.map(async (queue) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        name: queue.name,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      };
    })
  );

  return stats;
}

/**
 * Pausa todas as filas
 */
export async function pauseAllQueues() {
  const allQueues = getAllQueues();
  await Promise.all(allQueues.map(queue => queue.pause()));
  console.log('⏸️ All queues paused');
}

/**
 * Resume todas as filas
 */
export async function resumeAllQueues() {
  const allQueues = getAllQueues();
  await Promise.all(allQueues.map(queue => queue.resume()));
  console.log('▶️ All queues resumed');
}

/**
 * Limpa todas as filas (desenvolvimento)
 */
export async function clearAllQueues() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clear queues in production');
  }

  const allQueues = getAllQueues();
  await Promise.all(allQueues.map(queue => queue.clean(0, 'completed')));
  await Promise.all(allQueues.map(queue => queue.clean(0, 'failed')));

  console.log('🧹 All queues cleared');
}

/**
 * Fecha todas as conexões gracefully
 */
export async function closeAllQueues() {
  console.log('🔄 Closing all queues...');

  const allQueues = getAllQueues();
  await Promise.all(allQueues.map(queue => queue.close()));

  const bullRedis = getRedisConnection();
  if (bullRedis) {
    await bullRedis.disconnect();
  }

  console.log('✅ All queues closed successfully');
}

// Process exit handlers
process.on('SIGINT', closeAllQueues);
process.on('SIGTERM', closeAllQueues);

export default {
  syncQueue: getSyncQueue,
  reportsQueue: getReportsQueue,
  cacheCleanupQueue: getCacheCleanupQueue,
  documentProcessingQueue: getDocumentProcessingQueue,
  notificationQueue: getNotificationQueue,
  getAllQueues,
  setupRecurringJobs,
  getQueuesStats,
  pauseAllQueues,
  resumeAllQueues,
  clearAllQueues,
  closeAllQueues,
};
