/**
 * Bull Board Configuration
 * Dashboard para monitoramento de filas Bull Queue
 */

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import { notificationQueue as getNotificationQueue } from './queues';
import { validateBullBoardAccess } from './bull-board-auth';

// Call the getter function to get the actual queue instance
// Note: Other queues (sync, reports, cache cleanup, document processing) have been disabled for cost optimization
const notificationQueue = getNotificationQueue();

// Augment Express namespace for compatibility
declare global {
  namespace Express {
    interface Request extends ExpressRequest {}
    interface Response extends ExpressResponse {}
    interface NextFunction extends ExpressNextFunction {}
  }
}

// === CONFIGURAÇÃO DO BULL BOARD ===

/**
 * Adapter Express para Bull Board
 */
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

/**
 * Configuração do Bull Board com todas as filas ativas
 * Note: Only notification queue is active (others disabled for cost optimization)
 */
const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    new BullAdapter(notificationQueue),
  ],
  serverAdapter: serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'JustoAI - Queue Dashboard',
      boardLogo: {
        path: '/logo.png',
        width: '100px',
        height: 'auto',
      },
      miscLinks: [
        {
          text: 'Dashboard Principal',
          url: '/dashboard',
        },
        {
          text: 'Documentação API',
          url: '/api/docs',
        },
      ],
      favIcon: {
        default: '/favicon.ico',
        alternative: '/favicon.ico',
      },
    },
  },
});

// === MIDDLEWARE DE AUTENTICAÇÃO ===

/**
 * Middleware para proteger o Bull Board
 * Allows: Internal admins (@justoai.com.br) OR workspace admins
 */
export async function bullBoardAuthMiddleware(
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction
) {
  try {
    // Em desenvolvimento, permitir com token simples (para testes rápidos)
    if (process.env.NODE_ENV === 'development') {
      const devToken = req.headers.authorization?.substring(7);
      if (devToken === process.env.BULL_BOARD_ACCESS_TOKEN) {
        return next();
      }
      // Se não houver token válido, permitir sem autenticação em dev (para debugging)
      // mas log de warning
      console.warn('⚠️ Bull Board accessed without proper token in development');
      return next();
    }

    // Em produção, validação rigorosa com dois níveis de acesso
    const validation = await validateBullBoardAccess(req);

    if (!validation.authorized) {
      console.warn(
        `🔒 Bull Board access denied: ${validation.reason} (User: ${validation.userId}, Email: ${validation.email})`
      );
      return res.status(403).json({
        error: 'Admin access required',
        reason: validation.reason,
        email: validation.email
      });
    }

    // Attach user info to request for logging and filtering
    (req as unknown).bullBoardUser = {
      userId: validation.userId,
      email: validation.email,
      workspaceId: validation.workspaceId,
      isInternal: validation.isInternal,
      role: validation.role
    };

    console.log(
      `✅ Bull Board access granted for user ${validation.userId} (${validation.email}) - Role: ${validation.role}`
    );

    next();
  } catch (error) {
    console.error('🔴 Error validating Bull Board access:', error);
    return res.status(500).json({
      error: 'Internal server error validating access',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// === ESTATÍSTICAS CUSTOMIZADAS ===

/**
 * Coleta estatísticas detalhadas das filas
 */
export async function getBullBoardStats() {
  try {
    // Only notification queue is active (others disabled for cost optimization)
    const queues = [
      { name: 'Notifications', queue: notificationQueue },
    ];

    const stats = await Promise.all(
      queues.map(async ({ name, queue }) => {
        try {
          const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed(),
            queue.getDelayed(),
            queue.isPaused(),
          ]);

          // Calcular throughput (jobs/hora) baseado nos últimos jobs
          let throughput = 0;
          if (completed.length > 0) {
            const recentJobs = completed.slice(0, 10);
            if (recentJobs.length >= 2) {
              const timeSpan = (recentJobs[0].finishedOn || 0) - (recentJobs[recentJobs.length - 1].finishedOn || 0);
              if (timeSpan > 0) {
                throughput = Math.round((recentJobs.length * 3600 * 1000) / timeSpan);
              }
            }
          }

          // Job mais recente
          const lastJob = completed[0] || active[0] || waiting[0];
          const lastActivity = lastJob ? new Date(lastJob.timestamp || lastJob.processedOn || Date.now()) : null;

          return {
            name,
            status: paused ? 'paused' : (active.length > 0 ? 'active' : 'idle'),
            counts: {
              waiting: waiting.length,
              active: active.length,
              completed: completed.length,
              failed: failed.length,
              delayed: delayed.length,
              total: waiting.length + active.length + completed.length + failed.length + delayed.length,
            },
            performance: {
              throughput: throughput, // jobs/hora
              failureRate: completed.length + failed.length > 0 ?
                Math.round((failed.length / (completed.length + failed.length)) * 100) : 0,
            },
            health: {
              status: failed.length > active.length + waiting.length ? 'unhealthy' : 'healthy',
              lastActivity: lastActivity?.toISOString() || null,
            }
          };
        } catch (error) {
          console.error(`Error getting stats for queue ${name}:`, error);
          return {
            name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 },
            performance: { throughput: 0, failureRate: 100 },
            health: { status: 'unhealthy', lastActivity: null }
          };
        }
      })
    );

    return {
      timestamp: new Date().toISOString(),
      queues: stats,
      summary: {
        totalQueues: stats.length,
        activeQueues: stats.filter(q => q.status === 'active').length,
        healthyQueues: stats.filter(q => q.health.status === 'healthy').length,
        totalJobs: stats.reduce((sum, q) => sum + (q.counts?.total || 0), 0),
        totalWaiting: stats.reduce((sum, q) => sum + (q.counts?.waiting || 0), 0),
        totalActive: stats.reduce((sum, q) => sum + (q.counts?.active || 0), 0),
        totalFailed: stats.reduce((sum, q) => sum + (q.counts?.failed || 0), 0),
      }
    };
  } catch (error) {
    console.error('Error collecting Bull Board stats:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      queues: [],
      summary: {
        totalQueues: 0,
        activeQueues: 0,
        healthyQueues: 0,
        totalJobs: 0,
        totalWaiting: 0,
        totalActive: 0,
        totalFailed: 0,
      }
    };
  }
}

// === CONTROLE DE FILAS ===

/**
 * Pausa todas as filas ativas
 */
export async function pauseAllQueues() {
  const queues = [notificationQueue];

  await Promise.all(queues.map(async (queue) => {
    try {
      await queue.pause();
      console.log(`✅ Queue ${queue.name} paused`);
    } catch (error) {
      console.error(`❌ Failed to pause queue ${queue.name}:`, error);
    }
  }));
}

/**
 * Resume todas as filas ativas
 */
export async function resumeAllQueues() {
  const queues = [notificationQueue];

  await Promise.all(queues.map(async (queue) => {
    try {
      await queue.resume();
      console.log(`✅ Queue ${queue.name} resumed`);
    } catch (error) {
      console.error(`❌ Failed to resume queue ${queue.name}:`, error);
    }
  }));
}

/**
 * Limpa jobs completados e falhados (desenvolvimento)
 */
export async function cleanAllQueues() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clean queues in production');
  }

  const queues = [notificationQueue];

  await Promise.all(queues.map(async (queue) => {
    try {
      await queue.clean(0, 'completed');
      await queue.clean(0, 'failed');
      console.log(`✅ Queue ${queue.name} cleaned`);
    } catch (error) {
      console.error(`❌ Failed to clean queue ${queue.name}:`, error);
    }
  }));
}

/**
 * Retry jobs falhados
 */
export async function retryFailedJobs(queueName?: string) {
  const queueMap = { notificationQueue };
  const queues = queueName && queueName in queueMap ?
    [queueMap[queueName as keyof typeof queueMap]] :
    [notificationQueue];

  const results = await Promise.allSettled(
    (Array.isArray(queues) ? queues : [queues]).map(async (queue) => {
      if (!queue) return { queueName: 'unknown', retriedCount: 0 };

      try {
        const failed = await queue.getFailed();
        let retriedCount = 0;

        for (const job of failed) {
          try {
            await job.retry();
            retriedCount++;
          } catch (error) {
            console.error(`Failed to retry job ${job.id}:`, error);
          }
        }

        return { queueName: queue.name, retriedCount };
      } catch (error) {
        console.error(`Error retrying jobs for queue ${queue.name}:`, error);
        return { queueName: queue.name, retriedCount: 0, error };
      }
    })
  );

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        queueName: 'unknown',
        retriedCount: 0,
        error: result.reason
      };
    }
  });
}

// === HEALTH CHECK SISTEMA ===

/**
 * Health check completo do sistema de filas
 */
export async function systemHealthCheck() {
  try {
    const stats = await getBullBoardStats();
    const redisHealth = await checkRedisHealth();

    const overallHealth = stats.summary.healthyQueues === stats.summary.totalQueues && redisHealth.connected;

    return {
      status: overallHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      components: {
        queues: {
          status: stats.summary.healthyQueues === stats.summary.totalQueues ? 'healthy' : 'unhealthy',
          healthy: stats.summary.healthyQueues,
          total: stats.summary.totalQueues,
          details: stats.queues.map(q => ({
            name: q.name,
            status: q.health.status,
            active: q.counts.active,
            failed: q.counts.failed,
            waiting: q.counts.waiting,
          }))
        },
        redis: redisHealth,
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkRedisHealth() {
  try {
    const { redis } = await import('./redis');
    const pong = await redis.ping();
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);

    return {
      connected: pong === 'PONG',
      memoryUsage: memoryMatch ? memoryMatch[1].trim() : 'unknown',
      status: 'healthy'
    };
  } catch (error) {
    return {
      connected: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Redis connection failed'
    };
  }
}

// === EXPORTS ===

export {
  serverAdapter,
  addQueue,
  removeQueue,
  setQueues,
  replaceQueues,
};

export default {
  serverAdapter,
  bullBoardAuthMiddleware,
  getBullBoardStats,
  pauseAllQueues,
  resumeAllQueues,
  cleanAllQueues,
  retryFailedJobs,
  systemHealthCheck,
};