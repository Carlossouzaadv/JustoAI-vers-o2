// ================================================================
// JUDIT QUEUE - Background Job Queue
// Sistema de filas para processamento assíncrono de onboarding
// ================================================================

import { Queue, Job } from 'bullmq';
import { getRedisConnection } from '../redis';
import { queueLogger } from '../observability/logger';

// Circuit breaker import - lazy loaded to avoid circular dependency
let circuitBreakerService: any = null;
const getCircuitBreaker = () => {
  if (!circuitBreakerService) {
    try {
      circuitBreakerService = require('../services/circuitBreakerService').circuitBreakerService;
    } catch (e) {
      return null;
    }
  }
  return circuitBreakerService;
};

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export interface JuditOnboardingJobData {
  cnj: string;
  caseId?: string; // Novo: case ID explícito para webhook usar
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

// Lazy evaluation - don't check Redis during module load
let _connection: ReturnType<typeof getRedisConnection> | undefined = undefined;
let _redisDisabled: boolean | undefined = undefined;

function isRedisDisabled(): boolean {
  if (_redisDisabled === undefined) {
    _connection = getRedisConnection();
    _redisDisabled = _connection === null;
  }
  return _redisDisabled;
}

function getConnection() {
  if (_connection === undefined) {
    _connection = getRedisConnection();
  }
  return _connection;
}

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

let _juditOnboardingQueue: Queue<JuditOnboardingJobData, JuditOnboardingJobResult> | MockQueue | null = null;

function getJuditQueue() {
  if (_juditOnboardingQueue === null) {
    if (isRedisDisabled()) {
      _juditOnboardingQueue = new MockQueue(QUEUE_CONFIG.name) as any;
    } else {
      _juditOnboardingQueue = new Queue<JuditOnboardingJobData, JuditOnboardingJobResult>(
        QUEUE_CONFIG.name,
        {
          connection: getConnection()!,
          defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
        }
      );
    }
  }
  return _juditOnboardingQueue;
}

// Export both getter and lazy property
export const juditOnboardingQueue = new Proxy({} as any, {
  get: (target, prop) => {
    const queue = getJuditQueue();
    return (queue as any)[prop];
  },
});

// ================================================================
// QUEUE OPERATIONS
// ================================================================

/**
 * Adiciona um processo à fila de onboarding
 */
export async function addOnboardingJob(
  cnj: string,
  options?: {
    caseId?: string; // Novo: case ID explícito
    workspaceId?: string;
    userId?: string;
    priority?: number;
  }
): Promise<{ jobId: string }> {
  ensureListeners();

  // Check if queue is paused due to circuit breaker
  const cb = getCircuitBreaker();
  if (cb && cb.isQueuePaused && cb.isQueuePaused()) {
    const status = cb.getStatus();
    throw new Error(
      `Queue is paused due to Upstash quota limit. Auto-retry: ${status.config.autoRetryInterval}. ` +
      `Error: ${status.config.errorMessage}`
    );
  }

  const queue = getJuditQueue();
  const job = await queue.add(
    'onboard-process',
    {
      cnj,
      caseId: options?.caseId, // NOVO: Passar case ID explícito
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
  const queue = getJuditQueue();
  const job = await queue.getJob(jobId);

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
  const queue = getJuditQueue();
  return await queue.getActive();
}

/**
 * Lista jobs aguardando na fila
 */
export async function getWaitingJobs(): Promise<Job[]> {
  const queue = getJuditQueue();
  return await queue.getWaiting();
}

/**
 * Estatísticas da fila
 */
export async function getQueueStats() {
  const queue = getJuditQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
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
  const queue = getJuditQueue();
  const grace = options?.grace || 24 * 60 * 60 * 1000; // 24h padrão

  if (!options?.status || options.status === 'completed') {
    await queue.clean(grace, 1000, 'completed');
  }

  if (!options?.status || options.status === 'failed') {
    await queue.clean(grace, 1000, 'failed');
  }
}

// ================================================================
// EVENTOS DA FILA (para logging/monitoring)
// ================================================================

// Setup event listeners lazily when queue is first used
function setupEventListeners() {
  if (isRedisDisabled()) {
    return;
  }

  const queue = getJuditQueue();

  queue.on('error', (error) => {
    queueLogger.error({
      action: 'queue_error',
      error: error.message,
      error_stack: error.stack,
    });
  });

  queue.on('waiting', (jobId) => {
    queueLogger.debug({
      action: 'job_waiting',
      job_id: jobId,
    });
  });

  queue.on('active', (job) => {
    queueLogger.info({
      action: 'job_active',
      job_id: job.id,
      cnj: job.data.cnj,
      workspace_id: job.data.workspaceId,
    });
  });

  queue.on('completed', (job, result) => {
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

  queue.on('failed', (job, error) => {
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

// Setup listeners on first use
let _listenersSetup = false;
function ensureListeners() {
  if (!_listenersSetup) {
    setupEventListeners();
    _listenersSetup = true;
  }
}

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================

async function gracefulShutdown() {
  if (isRedisDisabled()) {
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
    const queue = getJuditQueue();
    await queue.close();
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
