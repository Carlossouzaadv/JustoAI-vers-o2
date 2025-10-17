/**
 * Bull Queue Configuration
 * Sistema de filas para processamento assíncrono
 *
 * Uses centralized Redis configuration from src/lib/redis.ts
 */

import Queue from 'bull';
import { getRedisConnection } from '../src/lib/redis';

// Configuração base das filas
const queueConfig = {
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
};

// === FILAS PRINCIPAIS ===

/**
 * Fila para sincronização com APIs externas
 * Executa a cada 6 horas
 */
export const syncQueue = new Queue('API Sync', queueConfig);

/**
 * Fila para geração de relatórios automáticos
 * Executa domingos às 23h
 */
export const reportsQueue = new Queue('Automated Reports', queueConfig);

/**
 * Fila para limpeza de cache
 * Executa diariamente
 */
export const cacheCleanupQueue = new Queue('Cache Cleanup', queueConfig);

/**
 * Fila para processamento de documentos PDF
 * On-demand processing
 */
export const documentProcessingQueue = new Queue('Document Processing', queueConfig);

/**
 * Fila para envio de emails/notificações
 * High priority queue
 */
export const notificationQueue = new Queue('Notifications', {
  ...queueConfig,
  defaultJobOptions: {
    ...queueConfig.defaultJobOptions,
    priority: 10, // Alta prioridade
    attempts: 5,  // Mais tentativas para notificações
  }
});

// === CONFIGURAÇÃO DOS WORKERS ===

// Array com todas as filas para facilitar gerenciamento
export const allQueues = [
  syncQueue,
  reportsQueue,
  cacheCleanupQueue,
  documentProcessingQueue,
  notificationQueue,
];

// === JOBS RECORRENTES ===

/**
 * Configura jobs recorrentes (cron jobs)
 */
export async function setupRecurringJobs() {
  console.log('🔄 Setting up recurring jobs...');

  // Sync APIs - a cada 6 horas
  await syncQueue.add(
    'sync-apis',
    { type: 'full-sync' },
    {
      repeat: { cron: '0 */6 * * *' }, // A cada 6 horas
      jobId: 'sync-apis-recurring',
    }
  );

  // Relatórios automáticos - domingos às 23h
  await reportsQueue.add(
    'generate-scheduled-reports',
    { type: 'weekly-reports' },
    {
      repeat: { cron: '0 23 * * 0' }, // Domingo 23h
      jobId: 'weekly-reports-recurring',
    }
  );

  // Limpeza de cache - todo dia às 2h
  await cacheCleanupQueue.add(
    'cleanup-expired-cache',
    { type: 'daily-cleanup' },
    {
      repeat: { cron: '0 2 * * *' }, // Todo dia às 2h
      jobId: 'cache-cleanup-recurring',
    }
  );

  // Limpeza de cache de IA - todo dia às 3h
  await cacheCleanupQueue.add(
    'cleanup-ai-cache',
    { type: 'ai-cache-cleanup' },
    {
      repeat: { cron: '0 3 * * *' }, // Todo dia às 3h
      jobId: 'ai-cache-cleanup-recurring',
    }
  );

  console.log('✅ Recurring jobs configured successfully');
}

// === UTILITY FUNCTIONS ===

/**
 * Adiciona job de sincronização manual
 */
export async function addSyncJob(workspaceId: string, options = {}) {
  return await syncQueue.add(
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
  return await reportsQueue.add(
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
  return await documentProcessingQueue.add(
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
  return await notificationQueue.add(
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
  await Promise.all(allQueues.map(queue => queue.pause()));
  console.log('⏸️ All queues paused');
}

/**
 * Resume todas as filas
 */
export async function resumeAllQueues() {
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

  await Promise.all(allQueues.map(queue => queue.clean(0, 'completed')));
  await Promise.all(allQueues.map(queue => queue.clean(0, 'failed')));

  console.log('🧹 All queues cleared');
}

// === GRACEFUL SHUTDOWN ===

/**
 * Fecha todas as conexões gracefully
 */
export async function closeAllQueues() {
  console.log('🔄 Closing all queues...');

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
  syncQueue,
  reportsQueue,
  cacheCleanupQueue,
  documentProcessingQueue,
  notificationQueue,
  allQueues,
  setupRecurringJobs,
  getQueuesStats,
  pauseAllQueues,
  resumeAllQueues,
  clearAllQueues,
  closeAllQueues,
};