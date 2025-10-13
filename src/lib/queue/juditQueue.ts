// ================================================================
// JUDIT QUEUE - Background Job Queue
// Sistema de filas para processamento assíncrono de onboarding
// ================================================================

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

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

// Check if Redis should be disabled (for Railway without Redis)
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_HOST;

// Mock Queue class for when Redis is disabled
class MockQueue {
  name: string;

  constructor(name: string) {
    this.name = name;
    if (REDIS_DISABLED) {
      console.log(`[JUDIT QUEUE] Running in MOCK mode (Redis disabled)`);
    }
  }

  async add() { return { id: 'mock-' + Date.now(), data: {} } as any; }
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

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Necessário para BullMQ
  enableReadyCheck: false,
};

// Criar conexão Redis apenas se não estiver desabilitado
const connection = REDIS_DISABLED ? null : new IORedis(redisConfig);

// ================================================================
// QUEUE CONFIGURATION
// ================================================================

const QUEUE_CONFIG = {
  name: 'judit-onboarding',
  defaultJobOptions: {
    attempts: 3, // Tentar até 3 vezes em caso de falha
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
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
    console.error('[JUDIT QUEUE] Erro na fila:', error);
  });

  juditOnboardingQueue.on('waiting', (jobId) => {
    console.log(`[JUDIT QUEUE] Job ${jobId} aguardando processamento`);
  });

  juditOnboardingQueue.on('active', (job) => {
    console.log(`[JUDIT QUEUE] Job ${job.id} iniciado - CNJ: ${job.data.cnj}`);
  });

  juditOnboardingQueue.on('completed', (job, result) => {
    console.log(`[JUDIT QUEUE] Job ${job.id} concluído - CNJ: ${job.data.cnj}`, {
      success: result.success,
      duration: `${(result.duration / 1000).toFixed(2)}s`,
    });
  });

  juditOnboardingQueue.on('failed', (job, error) => {
    console.error(`[JUDIT QUEUE] Job ${job?.id} falhou - CNJ: ${job?.data.cnj}`, error.message);
  });
}

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================

async function gracefulShutdown() {
  if (REDIS_DISABLED) {
    console.log('[JUDIT QUEUE] Mock mode - nothing to shutdown');
    return;
  }

  console.log('[JUDIT QUEUE] Encerrando fila...');
  await juditOnboardingQueue.close();
  await connection?.quit();
  console.log('[JUDIT QUEUE] Fila encerrada com sucesso');
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
