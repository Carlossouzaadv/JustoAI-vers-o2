/**
 * Bull Queue Configuration
 * Sistema de filas para processamento assíncrono
 *
 * Uses centralized Redis configuration from src/lib/redis.ts
 * Lazy-loads Redis connections to avoid connection attempts during build
 *
 * ===== QUEUES STATUS (2025-10-25) =====
 * ✅ Notifications - ACTIVE (usado em relatórios individuais)
 * ⚠️  API Sync - DISABLED (não está sendo usado)
 * ⚠️  Automated Reports - DISABLED (executa domingo, mas sem jobs)
 * ⚠️  Cache Cleanup - DISABLED (roda via Vercel cron, não queue)
 * ⚠️  Document Processing - DISABLED (não implementado)
 *
 * OPTIMIZATION: Removidas filas não-usadas para reduzir custo Redis
 */

import Queue from 'bull';
import { getRedisConnection } from './redis';

// Lazy initialization - queues are created on first use, not on import
// ONLY keep notification queue - others removed for cost optimization
let _notificationQueue: Queue.Queue | null = null;

// Helper function to get or create queue config
const getQueueConfig = () => {
  return {
    createClient: (type: 'client' | 'subscriber' | 'bclient') => {
      const redisConnection = getRedisConnection();
      if (!redisConnection) {
        throw new Error(`Redis connection is not available for ${type}`);
      }
      return redisConnection;
    },
    defaultJobOptions: {
      removeOnComplete: 100, // Manter últimos 100 jobs completos
      removeOnFail: 50,      // Manter últimos 50 jobs falhados
      attempts: 3,           // 3 tentativas por padrão
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  };
};

// === FILAS PRINCIPAIS (Lazy Load) ===

/**
 * Fila para envio de emails/notificações
 * High priority queue
 * ONLY ACTIVE QUEUE - others removed for cost optimization
 */
function getNotificationQueue() {
  if (!_notificationQueue) {
    const config = getQueueConfig();
    _notificationQueue = new Queue('Notifications', {
      createClient: config.createClient,
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
    getNotificationQueue(),
  ];
}

// Export only active queue getter
export const notificationQueue = getNotificationQueue;

// === UTILITY FUNCTIONS ===

/**
 * Configura jobs recorrentes (cron jobs)
 * NOTE: Cron jobs removidos - usar Vercel cron ou schedule direto na API
 */
export async function setupRecurringJobs() {
  console.log('🔄 Recurring jobs setup skipped - using Vercel cron jobs instead');
  // All recurring jobs moved to vercel.json crons or direct API scheduling
}

// REMOVED: addSyncJob, addReportJob, addDocumentProcessingJob
// These queues are no longer active for cost optimization
// If needed in future, re-enable by restoring these functions

/**
 * Adiciona job de notificação
 */
export async function addNotificationJob(type: string, data: Record<string, unknown>, options: Record<string, unknown> = {}) {
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

const queuesExport = {
  notificationQueue: getNotificationQueue,
  getAllQueues,
  setupRecurringJobs,
  getQueuesStats,
  pauseAllQueues,
  resumeAllQueues,
  clearAllQueues,
  closeAllQueues,
};

export default queuesExport;
