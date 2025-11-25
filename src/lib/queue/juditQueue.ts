// ================================================================
// JUDIT QUEUE - Background Job Queue
// Sistema de filas para processamento assíncrono de onboarding
// ================================================================

import { Queue, Job, JobState } from 'bullmq';
import { getRedisConnection } from '../redis';
import { queueLogger } from '../observability/logger';
import { log, logError } from '@/lib/services/logger';

// ================================================================
// TYPE GUARDS & VALIDATORS
// ================================================================

/**
 * Literal type for queue events we actually use
 */
type KnownQueueEvent = 'error' | 'active' | 'completed' | 'failed';

/**
 * Set of known queue event names for validation
 */
const KNOWN_QUEUE_EVENTS = new Set<string>(['error', 'active', 'completed', 'failed']);

/**
 * Type guard to validate event name is one we support
 * After this passes, TypeScript narrows string to KnownQueueEvent literal
 */
function isKnownQueueEvent(event: string): event is KnownQueueEvent {
  return KNOWN_QUEUE_EVENTS.has(event);
}

/**
 * Type guard for CircuitBreakerService
 */
function isCircuitBreakerService(data: unknown): data is {
  isQueuePaused: () => boolean;
  getStatus: () => {
    config: {
      autoRetryInterval: number;
      errorMessage: string;
    };
  };
} {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return (
    typeof obj.isQueuePaused === 'function' &&
    typeof obj.getStatus === 'function'
  );
}

/**
 * Type guard for valid job states (kept for future validation needs)
 */
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
function isValidJobState(state: unknown): state is 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown' {
  const validStates = ['waiting', 'active', 'completed', 'failed', 'delayed', 'unknown'];
  return typeof state === 'string' && validStates.includes(state);
}

/**
 * Safe type converter from JobState to our status type
 */
function normalizeJobState(state: JobState | 'unknown'): 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown' {
  // Map JobState enum values to our normalized status type
  switch (state) {
    case 'waiting':
      return 'waiting';
    case 'active':
      return 'active';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'delayed':
      return 'delayed';
    case 'unknown':
      return 'unknown';
    default:
      // Handle any other state values (paused, repeat, etc) by treating as waiting
      return 'waiting';
  }
}

// ================================================================
// CIRCUIT BREAKER SETUP
// ================================================================

// Circuit breaker import - lazy loaded to avoid circular dependency
let circuitBreakerService: unknown = null;

const getCircuitBreaker = () => {
  if (!circuitBreakerService) {
    try {
      import('../services/circuitBreakerService')
        .then((module) => {
          circuitBreakerService = module.circuitBreakerService;
        })
        .catch(() => {
          // Fallback if circuit breaker not available
          return null;
        });
    } catch {
      return null;
    }
  }

  // Safely validate and return only if it passes type guard
  return isCircuitBreakerService(circuitBreakerService) ? circuitBreakerService : null;
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
  workspaceId?: string;
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
    log.warn({ msg: "[JUDIT QUEUE] ⚠️  Running in MOCK mode (Redis disabled)" });
    log.warn({ msg: "[JUDIT QUEUE] ⚠️  Queue operations will be simulated only!" });
  }

  async add() {
    log.info({ msg: "[JUDIT QUEUE] MOCK: Job added (not really processed)" });
    return { id: 'mock-' + Date.now(), data: {} } as Record<string, unknown>;
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

  /**
   * Type-safe event listener registration
   * Only accepts KnownQueueEvent types
   */
  on(_event: KnownQueueEvent, _handler: (..._args: unknown[]) => void): this {
    return this;
  }
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
      _juditOnboardingQueue = new MockQueue(QUEUE_CONFIG.name) as Queue<JuditOnboardingJobData, JuditOnboardingJobResult> | MockQueue;
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

/**
 * Create a proxy object that delegates to actual queue on first access
 * Returns a proxy that lazily initializes the queue
 */
function createQueueProxy(): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get: (_target, prop: string | symbol) => {
        const queue = getJuditQueue();
        if (queue && typeof prop === 'string') {
          const queueAsObject = (queue as unknown) as Record<string, unknown>;
          return queueAsObject[prop];
        }
        return undefined;
      },
    }
  );
}

// Export lazy property that initializes queue on first use
// The proxy will behave like a Queue when accessed
export const juditOnboardingQueue = createQueueProxy() as unknown as Queue<JuditOnboardingJobData, JuditOnboardingJobResult> | MockQueue;

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
  // Use type guard to safely access circuit breaker methods
  const cb = getCircuitBreaker();
  if (cb && cb.isQueuePaused()) {
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

  const jobState = await job.getState();
  // Safely normalize JobState to our status type
  const status = normalizeJobState(jobState);

  const progress = typeof job.progress === 'number' ? job.progress : undefined;

  let result: JuditOnboardingJobResult | undefined;
  let error: string | undefined;

  if (status === 'completed') {
    result = job.returnvalue;
  } else if (status === 'failed') {
    error = job.failedReason;
  }

  return {
    status,
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

/**
 * Type guard to validate job data structure
 */
function isJobData(data: unknown): data is JuditOnboardingJobData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.cnj === 'string';
}

/**
 * Type guard to validate job result structure
 */
function isJobResult(result: unknown): result is JuditOnboardingJobResult {
  if (typeof result !== 'object' || result === null) {
    return false;
  }
  const obj = result as Record<string, unknown>;
  return (
    typeof obj.success === 'boolean' &&
    typeof obj.processoId === 'string' &&
    typeof obj.requestId === 'string' &&
    typeof obj.duration === 'number'
  );
}

/**
 * Type guard to check if value is a valid job object
 */
function isJob(data: unknown): data is Job<JuditOnboardingJobData, JuditOnboardingJobResult> {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return typeof obj.id === 'string' && typeof obj.data === 'object';
}

/**
 * Type guard to check if value has an 'on' method with known queue events
 * After this passes, TypeScript narrows queue to this specific interface
 */
function isEventEmitter(obj: unknown): obj is {
  on: (_event: KnownQueueEvent, _handler: (..._args: unknown[]) => void) => unknown
} {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const casted = obj as Record<string, unknown>;
  return typeof casted.on === 'function';
}

/**
 * Type-safe error handler for queue errors
 * Explicitly typed to avoid implicit any
 */
const handleQueueError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  queueLogger.error({
    action: 'queue_error',
    error: message,
    error_stack: stack,
  });
};

/**
 * Type-safe active job handler
 * Explicitly typed to avoid implicit any
 */
const handleActiveJob = (job: unknown): void => {
  if (isJob(job) && isJobData(job.data)) {
    queueLogger.info({
      action: 'job_active',
      job_id: job.id,
      cnj: job.data.cnj,
      workspace_id: job.data.workspaceId,
    });
  }
};

/**
 * Type-safe completed job handler
 * Explicitly typed to avoid implicit any
 */
const handleCompletedJob = (job: unknown, result: unknown): void => {
  if (isJob(job) && isJobData(job.data) && isJobResult(result)) {
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
  }
};

/**
 * Type-safe failed job handler
 * Explicitly typed to avoid implicit any
 */
const handleFailedJob = (job: unknown, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const jobId = isJob(job) && isJobData(job.data) ? job.id : undefined;
  const cnj = isJob(job) && isJobData(job.data) ? job.data.cnj : undefined;
  const attempts = isJob(job) ? job.attemptsMade : undefined;
  const maxAttempts = isJob(job) && job.opts?.attempts ? job.opts.attempts : 3;

  queueLogger.error({
    action: 'job_failed',
    job_id: jobId,
    cnj,
    error: message,
    error_stack: stack,
    attempts_made: attempts,
    max_attempts: maxAttempts,
  });
};

/**
 * Type-safe helper to attach event listeners to queue
 * Uses type narrowing to ensure eventName is a known queue event
 *
 * ZERO casting - 100% type-safe narrowing via isKnownQueueEvent
 */
function attachQueueListener(
  queue: { on: (_event: KnownQueueEvent, _handler: (..._args: unknown[]) => void) => unknown },
  eventName: string,
  handler: (..._args: unknown[]) => void
): void {
  // Type guard narrows eventName from string to KnownQueueEvent
  if (isKnownQueueEvent(eventName)) {
    // After the guard, TypeScript knows eventName is one of: 'error' | 'active' | 'completed' | 'failed'
    // Safe to pass to queue.on() which expects KnownQueueEvent
    queue.on(eventName, handler);
  }
}

/**
 * Setup event listeners lazily when queue is first used
 * Uses type narrowing (via isEventEmitter and isKnownQueueEvent)
 *
 * ZERO casting - 100% narrowing via type guards
 */
function setupEventListeners() {
  if (isRedisDisabled()) {
    return;
  }

  const queue = getJuditQueue();

  // Type guard #1: Validates queue has .on() method with KnownQueueEvent signature
  if (!isEventEmitter(queue)) {
    return;
  }

  // At this point, TypeScript knows:
  // - queue has a .on() method
  // - The .on() method accepts (event: KnownQueueEvent, handler: (...args: unknown[]) => void)
  // This is 100% type-safe, no casting needed

  // Attach handlers with type-safe helper that uses type guard #2 (isKnownQueueEvent)
  attachQueueListener(queue, 'error', handleQueueError);
  attachQueueListener(queue, 'active', handleActiveJob);
  attachQueueListener(queue, 'completed', handleCompletedJob);
  attachQueueListener(queue, 'failed', handleFailedJob);
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
  } catch (_error) {
    queueLogger.error({
      action: 'graceful_shutdown_error',
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
