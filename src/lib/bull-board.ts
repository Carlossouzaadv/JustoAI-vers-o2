/**
 * Bull Board Configuration
 * Dashboard para monitoramento de filas Bull Queue
 */

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { notificationQueue as getNotificationQueue } from './queues';
import { validateBullBoardAccess } from './bull-board-auth';
import getRedisClient from './redis';

// Keep as function reference to enable lazy loading at runtime (not at build time)
// Note: Other queues (sync, reports, cache cleanup, document processing) have been disabled for cost optimization
// DO NOT call getNotificationQueue() here - it will cause build failures if Redis is unavailable

/**
 * Type guard to check if data is a valid Express Request
 */
function isExpressRequest(data: unknown): data is ExpressRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    'headers' in data &&
    'url' in data &&
    'method' in data
  );
}

/**
 * Type guard to check if data is a valid Express Response
 */
function isExpressResponse(data: unknown): data is ExpressResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    'json' in data &&
    'send' in data &&
    typeof (data as Record<string, unknown>).status === 'function' &&
    typeof (data as Record<string, unknown>).json === 'function' &&
    typeof (data as Record<string, unknown>).send === 'function'
  );
}

/**
 * Type definition for Bull Board user attached to request
 */
interface BullBoardUserContext {
  userId: string;
  email: string;
  workspaceId?: string;
  isInternal: boolean;
  role: string;
}

/**
 * Type guard to check if data is a valid Bull Board user context
 * Currently unused but kept for future type validation needs
 */
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
function isBullBoardUserContext(data: unknown): data is BullBoardUserContext {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const record = data as Record<string, unknown>;
  return (
    typeof record.userId === 'string' &&
    typeof record.email === 'string' &&
    typeof record.isInternal === 'boolean' &&
    typeof record.role === 'string'
  );
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
 * Queues are initialized lazily at runtime, not during module load
 */
let addQueue: ReturnType<typeof createBullBoard>['addQueue'];
let removeQueue: ReturnType<typeof createBullBoard>['removeQueue'];
let setQueues: ReturnType<typeof createBullBoard>['setQueues'];
let replaceQueues: ReturnType<typeof createBullBoard>['replaceQueues'];

// Initialize Bull Board adapters lazily only when needed
function initializeBullBoard() {
  const { addQueue: add, removeQueue: remove, setQueues: set, replaceQueues: replace } = createBullBoard({
    queues: [
      new BullAdapter(getNotificationQueue()),
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

  addQueue = add;
  removeQueue = remove;
  setQueues = set;
  replaceQueues = replace;
}

// Safe getter that initializes on first use
function ensureBullBoardInitialized() {
  if (!addQueue) {
    try {
      initializeBullBoard();
    } catch (_error) {
      console.warn('[BULL-BOARD] Warning: Bull Board could not be initialized (Redis may not be available)');
      console.warn('[BULL-BOARD] This is expected during build phase. Queues will be available at runtime.');
      // Provide no-op functions so code doesn't crash
      addQueue = () => {};
      removeQueue = () => {};
      setQueues = () => {};
      replaceQueues = () => {};
    }
  }
}

// === MIDDLEWARE DE AUTENTICAÇÃO ===

/**
 * Middleware para proteger o Bull Board
 * Allows: Internal admins (@justoai.com.br) OR workspace admins
 */
export async function bullBoardAuthMiddleware(
  req: unknown,
  res: unknown,
  next: unknown
): Promise<void> {
  try {
    // Type guard to ensure we have valid Express Request/Response
    if (!isExpressRequest(req) || !isExpressResponse(res)) {
      console.error('Invalid request or response object');
      if (isExpressResponse(res)) {
        void res.status(500).json({ error: 'Invalid request context' });
      }
      return;
    }

    // Type guard for next function
    if (typeof next !== 'function') {
      console.error('Invalid next function');
      void res.status(500).json({ error: 'Invalid middleware chain' });
      return;
    }

    // Em desenvolvimento, permitir com token simples (para testes rápidos)
    if (process.env.NODE_ENV === 'development') {
      const authHeader = req.headers.authorization;
      const devToken = typeof authHeader === 'string' ? authHeader.substring(7) : undefined;
      if (devToken === process.env.BULL_BOARD_ACCESS_TOKEN) {
        next();
        return;
      }
      // Se não houver token válido, permitir sem autenticação em dev (para debugging)
      // mas log de warning
      console.warn('⚠️ Bull Board accessed without proper token in development');
      next();
      return;
    }

    // Em produção, validação rigorosa com dois níveis de acesso
    const validation = await validateBullBoardAccess(req);

    if (!validation.authorized) {
      console.warn(
        `🔒 Bull Board access denied: ${validation.reason} (User: ${validation.userId}, Email: ${validation.email})`
      );
      void res.status(403).json({
        error: 'Admin access required',
        reason: validation.reason,
        email: validation.email
      });
      return;
    }

    // Create typed user context and attach to request
    const bullBoardUser: BullBoardUserContext = {
      userId: validation.userId || '',
      email: validation.email || '',
      workspaceId: validation.workspaceId,
      isInternal: validation.isInternal || false,
      role: validation.role || 'UNKNOWN'
    };

    // After type guard passed, req is an ExpressRequest which is also a Record
    // Use intersection type for safe assignment
    (req as ExpressRequest & Record<string, unknown>).bullBoardUser = bullBoardUser;

    console.log(
      `✅ Bull Board access granted for user ${validation.userId} (${validation.email}) - Role: ${validation.role}`
    );

    next();
    return;
  } catch (error) {
    console.error('🔴 Error validating Bull Board access:', error);

    // Type guard for error response
    if (isExpressResponse(res)) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      void res.status(500).json({
        error: 'Internal server error validating access',
        message: errorMessage
      });
    }
  }
}

// === ESTATÍSTICAS CUSTOMIZADAS ===

/**
 * Coleta estatísticas detalhadas das filas
 */
export async function getBullBoardStats() {
  ensureBullBoardInitialized();
  try {
    // Only notification queue is active (others disabled for cost optimization)
    const queues = [
      { name: 'Notifications', queue: getNotificationQueue() },
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
  ensureBullBoardInitialized();
  const queues = [getNotificationQueue()];

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
  ensureBullBoardInitialized();
  const queues = [getNotificationQueue()];

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
  ensureBullBoardInitialized();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clean queues in production');
  }

  const queues = [getNotificationQueue()];

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
  ensureBullBoardInitialized();
  const queueMap = { notificationQueue: getNotificationQueue() };
  const queues = queueName && queueName in queueMap ?
    [queueMap[queueName as keyof typeof queueMap]] :
    [getNotificationQueue()];

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
  ensureBullBoardInitialized();
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

/**
 * Type guard to verify if object is a valid Redis instance
 */
function isRedisClient(data: unknown): data is { ping(): Promise<string>; info(_section?: string): Promise<string> } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'ping' in data &&
    'info' in data &&
    typeof (data as Record<string, unknown>).ping === 'function' &&
    typeof (data as Record<string, unknown>).info === 'function'
  );
}

async function checkRedisHealth() {
  try {
    // Get Redis client instance
    const redisClient = getRedisClient();

    // Type guard to ensure we have a valid Redis client
    if (!isRedisClient(redisClient)) {
      return {
        connected: false,
        status: 'unhealthy',
        error: 'Redis client is not properly initialized'
      };
    }

    const pong = await redisClient.ping();
    const info = await redisClient.info('memory');
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

// Create safe wrappers that ensure initialization before use
export function getAddQueue() {
  ensureBullBoardInitialized();
  return addQueue;
}

export function getRemoveQueue() {
  ensureBullBoardInitialized();
  return removeQueue;
}

export function getSetQueues() {
  ensureBullBoardInitialized();
  return setQueues;
}

export function getReplaceQueues() {
  ensureBullBoardInitialized();
  return replaceQueues;
}

export {
  serverAdapter,
};

const exported = {
  serverAdapter,
  bullBoardAuthMiddleware,
  getBullBoardStats,
  pauseAllQueues,
  resumeAllQueues,
  cleanAllQueues,
  retryFailedJobs,
  systemHealthCheck,
};

export default exported;