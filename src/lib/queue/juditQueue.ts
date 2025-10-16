// ================================================================
// JUDIT QUEUE - Background Job Queue
// Sistema de filas para processamento assíncrono de onboarding
// ================================================================

import { Queue, Job } from 'bullmq';
import { getRedisConnection } from '../redis';
import { queueLogger } from '../observability/logger';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export interface JuditOnboardingJobData {
  cnj: string;
  workspaceId?: string;
  userId?: string;
  priority?: number;
}

export interface JuditOnboardingJobResult {
  success: boolean;
  processoId: string;
  requestId: string;
  numeroCnj: string;
  duration: number;
  error?: string;
}

// ================================================================
// CONFIGURAÇÃO REDIS
// ================================================================

// Get Redis connection from centralized client
const connection = getRedisConnection();
const REDIS_DISABLED = connection === null;

// Mock Queue class for when Redis is disabled (development only)
class MockQueue {
  name: string;

  constructor(name: string) {
    this.name = name;
    console.warn(`[JUDIT QUEUE] ⚠️  Running in MOCK mode (Redis disabled)`);
    console.warn(`[JUDIT QUEUE] ⚠️  Queue operations will be simulated only!`);
  }

  async add() {
    console.log('[JUDIT QUEUE] MOCK: Job added (not really processed)');
    return { id: 'mock-' + Date.now(), data: {} } as any;
  }
  async getJob() { return null; }
  async getActive() { return []; }
  async getWaiting() { return []; }
  async getWaitingCount() { return 0; }
  async getActiveCount() { return 0; }
  async getCompletedCount() { return 0; }
  async getFailedCount() { return 0; }
  async getDelayedCount() { return 0; }
  async clean() { return []; }
  async close() { return; }
  on() { return this; }
}

// ================================================================
// QUEUE CONFIGURATION
// ================================================================

const QUEUE_CONFIG = {
  name: 'judit-onboarding',
  defaultJobOptions: {
    attempts: 3, // Tentar até 3 vezes em caso de falha
    backoff: {
      type: 'exponential',
      delay: 30000, // 30s, 60s, 120s (increased for better resilience)
    },
    removeOnComplete: {
      age: 24 * 3600, // Manter jobs completos por 24h
      count: 1000, // Manter últimos 1000 jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Manter jobs com erro por 7 dias
    },
  },
} as const;

// ================================================================
// QUEUE INSTANCE
// ================================================================

export const juditOnboardingQueue = REDIS_DISABLED
  ? (new MockQueue(QUEUE_CONFIG.name) as any)
  : new Queue<JuditOnboardingJobData, JuditOnboardingJobResult>(
      QUEUE_CONFIG.name,
      {
        connection: connection!,
        defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
      }
    );

// ================================================================
// QUEUE OPERATIONS
// ================================================================

/**
 * Adiciona um processo à fila de onboarding
 */
export async function addOnboardingJob(
  cnj: string,
  options?: {
    workspaceId?: string;
    userId?: string;
    priority?: number;
  }
): Promise<{ jobId: string }> {
  const job = await juditOnboardingQueue.add(
    'onboard-process',
    {
      cnj,
      workspaceId: options?.workspaceId,
      userId: options?.userId,
      priority: options?.priority || 1,
    },
    {
      priority: options?.priority,
      jobId: `onboard-${cnj}-${Date.now()}`, // ID único
    }
  );

  return { jobId: job.id as string };
}

/**
 * Verifica o status de um job
 */
export async function getJobStatus(jobId: string): Promise<{
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress?: number;
  result?: JuditOnboardingJobResult;
  error?: string;
}> {
  const job = await juditOnboardingQueue.getJob(jobId);

  if (!job) {
    return { status: 'unknown' };
  }

  const state = await job.getState();
  const progress = job.progress as number | undefined;

  let result: JuditOnboardingJobResult | undefined;
  let error: string | undefined;

  if (state === 'completed') {
    result = job.returnvalue;
  } else if (state === 'failed') {
    error = job.failedReason;
  }

  return {
    status: state,
    progress,
    result,
    error,
  };
}

/**
 * Lista jobs ativos (processando agora)
 */
export async function getActiveJobs(): Promise<Job[]> {
  return await juditOnboardingQueue.getActive();
}

/**
 * Lista jobs aguardando na fila
 */
export async function getWaitingJobs(): Promise<Job[]> {
  return await juditOnboardingQueue.getWaiting();
}

/**
 * Estatísticas da fila
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    juditOnboardingQueue.getWaitingCount(),
    juditOnboardingQueue.getActiveCount(),
    juditOnboardingQueue.getCompletedCount(),
    juditOnboardingQueue.getFailedCount(),
    juditOnboardingQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Limpa jobs antigos
 */
export async function cleanQueue(options?: {
  grace?: number; // Tempo em ms para considerar job antigo
  status?: 'completed' | 'failed';
}) {
  const grace = options?.grace || 24 * 60 * 60 * 1000; // 24h padrão

  if (!options?.status || options.status === 'completed') {
    await juditOnboardingQueue.clean(grace, 1000, 'completed');
  }

  if (!options?.status || options.status === 'failed') {
    await juditOnboardingQueue.clean(grace, 1000, 'failed');
  }
}

// ================================================================
// EVENTOS DA FILA (para logging/monitoring)
// ================================================================

if (!REDIS_DISABLED) {
  juditOnboardingQueue.on('error', (error) => {
    queueLogger.error({
      action: 'queue_error',
      error: error.message,
      error_stack: error.stack,
    });
  });

  juditOnboardingQueue.on('waiting', (jobId) => {
    queueLogger.debug({
      action: 'job_waiting',
      job_id: jobId,
    });
  });

  juditOnboardingQueue.on('active', (job) => {
    queueLogger.info({
      action: 'job_active',
      job_id: job.id,
      cnj: job.data.cnj,
      workspace_id: job.data.workspaceId,
    });
  });

  juditOnboardingQueue.on('completed', (job, result) => {
    queueLogger.info({
      action: 'job_completed',
      job_id: job.id,
      cnj: job.data.cnj,
      success: result.success,
      processo_id: result.processoId,
      request_id: result.requestId,
      duration_ms: result.duration,
      duration_seconds: (result.duration / 1000).toFixed(2),
    });
  });

  juditOnboardingQueue.on('failed', (job, error) => {
    queueLogger.error({
      action: 'job_failed',
      job_id: job?.id,
      cnj: job?.data.cnj,
      error: error.message,
      error_stack: error.stack,
      attempts_made: job?.attemptsMade,
      max_attempts: job?.opts?.attempts || 3,
    });
  });
}

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================

async function gracefulShutdown() {
  if (REDIS_DISABLED) {
    queueLogger.warn({
      action: 'graceful_shutdown',
      message: 'Mock mode - nothing to shutdown',
    });
    return;
  }

  queueLogger.info({
    action: 'graceful_shutdown_start',
    message: 'Encerrando fila...',
  });

  try {
    await juditOnboardingQueue.close();
    queueLogger.info({
      action: 'graceful_shutdown_success',
      message: 'Fila encerrada com sucesso',
    });

    // Note: Redis connection is managed centrally by src/lib/redis.ts
    // It will handle its own shutdown via SIGTERM/SIGINT handlers
  } catch (error) {
    queueLogger.error({
      action: 'graceful_shutdown_error',
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
