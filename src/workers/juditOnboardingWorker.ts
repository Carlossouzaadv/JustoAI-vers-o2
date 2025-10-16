// ================================================================
// JUDIT ONBOARDING WORKER
// Worker de background para processar onboarding de processos
// ================================================================
// Cost-optimized worker with idle-friendly configuration
// ================================================================

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../lib/redis';
import { performFullProcessRequest } from '../lib/services/juditOnboardingService';
import { checkConfiguration } from '../lib/services/juditService';
import { queueLogger, logOperationStart } from '../lib/observability/logger';
import type {
  JuditOnboardingJobData,
  JuditOnboardingJobResult,
} from '../lib/queue/juditQueue';

// ================================================================
// CONFIGURAÇÃO REDIS
// ================================================================

const connection = getRedisConnection();

// Prevent worker from starting if Redis is not available
if (!connection) {
  console.error('[JUDIT WORKER] ❌ FATAL: Redis connection not available');
  console.error('[JUDIT WORKER] ❌ Workers cannot run without Redis');
  console.error('[JUDIT WORKER] ❌ Please configure REDIS_URL environment variable');
  process.exit(1);
}

// ================================================================
// WORKER CONFIGURATION (Cost-Optimized)
// ================================================================

const WORKER_CONFIG = {
  // Concurrency: Process multiple jobs in parallel
  // Lower = less CPU when active, higher = faster throughput
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),

  // Rate Limiter: Respect JUDIT API limits and reduce costs
  // JUDIT limit: ~60 requests/minute (1 per second safe)
  limiter: {
    max: 10, // Max 10 jobs
    duration: 60000, // Per minute (60s)
  },

  // Idle behavior: Worker will consume minimal resources when no jobs
  // BullMQ automatically sleeps when queue is empty
  lockDuration: 30000, // 30s lock (default 30s)
  lockRenewTime: 15000, // Renew lock every 15s
} as const;

// ================================================================
// LOGGER (using structured logging)
// ================================================================

// Using queueLogger with worker context
const workerLogger = queueLogger.child({ component: 'worker' });

// ================================================================
// PROCESSOR FUNCTION
// ================================================================

async function processOnboardingJob(
  job: Job<JuditOnboardingJobData>
): Promise<JuditOnboardingJobResult> {
  const { cnj, workspaceId, userId } = job.data;

  // Check if JUDIT is properly configured before processing
  const config = checkConfiguration();
  if (!config.configured) {
    workerLogger.error({
      action: 'job_blocked_no_config',
      job_id: job.id,
      cnj,
      error: 'JUDIT API not configured',
      has_api_key: config.hasApiKey,
      has_base_url: config.hasBaseUrl,
    });

    throw new Error('JUDIT_API_KEY not configured. Cannot process job.');
  }

  // Start operation timer
  const operation = logOperationStart(workerLogger, 'process_onboarding_job', {
    job_id: job.id,
    cnj,
    workspace_id: workspaceId,
    user_id: userId,
    attempt: job.attemptsMade + 1,
    max_attempts: job.opts.attempts || 3,
  });

  workerLogger.info({
    action: 'job_start',
    job_id: job.id,
    cnj,
    workspace_id: workspaceId,
    user_id: userId,
    attempt: job.attemptsMade + 1,
    max_attempts: job.opts.attempts || 3,
  });

  try {
    // Atualizar progresso: 10%
    await job.updateProgress(10);

    // Executar onboarding completo
    const startTime = Date.now();

    // Atualizar progresso: 20% (iniciando requisição)
    await job.updateProgress(20);

    workerLogger.debug({
      action: 'calling_judit_service',
      job_id: job.id,
      cnj,
    });

    const result = await performFullProcessRequest(cnj, 'ONBOARDING');

    const duration = Date.now() - startTime;

    // Atualizar progresso: 100%
    await job.updateProgress(100);

    if (result.success) {
      operation.finish('success', {
        processo_id: result.processoId,
        request_id: result.requestId,
      });

      workerLogger.info({
        action: 'job_success',
        job_id: job.id,
        cnj,
        processo_id: result.processoId,
        request_id: result.requestId,
        duration_ms: duration,
        duration_seconds: (duration / 1000).toFixed(2),
        attempt: job.attemptsMade + 1,
      });

      return {
        success: true,
        processoId: result.processoId,
        requestId: result.requestId,
        numeroCnj: cnj,
        duration,
      };
    } else {
      operation.finish('failure', {
        error: result.error,
      });

      workerLogger.error({
        action: 'job_failed',
        job_id: job.id,
        cnj,
        error: result.error,
        attempt: job.attemptsMade + 1,
        max_attempts: job.opts.attempts || 3,
      });

      throw new Error(result.error || 'Onboarding falhou');
    }
  } catch (error) {
    operation.finish('failure', {
      error: error instanceof Error ? error.message : String(error),
    });

    workerLogger.error({
      action: 'job_error',
      job_id: job.id,
      cnj,
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      attempt: job.attemptsMade + 1,
      max_attempts: job.opts.attempts || 3,
      will_retry: (job.attemptsMade + 1) < (job.opts.attempts || 3),
    });

    // Re-throw para que o BullMQ possa fazer retry
    throw error;
  }
}

// ================================================================
// WORKER INSTANCE
// ================================================================

export const juditOnboardingWorker = new Worker<
  JuditOnboardingJobData,
  JuditOnboardingJobResult
>(
  'judit-onboarding',
  processOnboardingJob,
  {
    connection,
    concurrency: WORKER_CONFIG.concurrency,
    limiter: WORKER_CONFIG.limiter,
  }
);

// ================================================================
// EVENT HANDLERS
// ================================================================

juditOnboardingWorker.on('ready', () => {
  workerLogger.info({
    action: 'worker_ready',
    message: 'Worker pronto para processar jobs',
  });
});

juditOnboardingWorker.on('active', (job) => {
  workerLogger.info({
    action: 'job_active',
    job_id: job.id,
    cnj: job.data.cnj,
    workspace_id: job.data.workspaceId,
    attempt: job.attemptsMade + 1,
  });
});

juditOnboardingWorker.on('completed', (job, result) => {
  workerLogger.info({
    action: 'job_completed',
    job_id: job.id,
    cnj: job.data.cnj,
    processo_id: result.processoId,
    request_id: result.requestId,
    duration_ms: result.duration,
    duration_seconds: (result.duration / 1000).toFixed(2),
    attempts_made: job.attemptsMade,
  });
});

juditOnboardingWorker.on('failed', (job, error) => {
  const isLastAttempt = job?.attemptsMade === (job?.opts?.attempts || 3);

  workerLogger.error({
    action: 'job_failed',
    job_id: job?.id,
    cnj: job?.data.cnj,
    attempts_made: job?.attemptsMade,
    max_attempts: job?.opts?.attempts || 3,
    is_last_attempt: isLastAttempt,
    error: error.message,
    error_stack: error.stack,
  });

  if (isLastAttempt) {
    workerLogger.error({
      action: 'job_permanently_failed',
      job_id: job?.id,
      cnj: job?.data.cnj,
      message: 'Job falhou após todas as tentativas',
    });
  }
});

juditOnboardingWorker.on('error', (error) => {
  workerLogger.error({
    action: 'worker_error',
    error: error.message,
    error_stack: error.stack,
  });
});

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================

async function gracefulShutdown() {
  workerLogger.info({
    action: 'graceful_shutdown_start',
    message: 'Encerrando worker...',
  });

  try {
    // Close worker (stops accepting new jobs, waits for active jobs)
    await juditOnboardingWorker.close();

    workerLogger.info({
      action: 'graceful_shutdown_success',
      message: 'Worker encerrado com sucesso',
    });

    // Note: Redis connection is managed centrally by src/lib/redis.ts
    // It will handle its own shutdown via SIGTERM/SIGINT handlers

    process.exit(0);
  } catch (error) {
    workerLogger.error({
      action: 'graceful_shutdown_error',
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ================================================================
// START WORKER (se executado diretamente)
// ================================================================

if (require.main === module) {
  // Check configuration on startup
  const config = checkConfiguration();

  workerLogger.info({
    action: 'worker_startup',
    message: '🚀 INICIANDO JUDIT ONBOARDING WORKER',
    configuration: {
      concurrency: WORKER_CONFIG.concurrency,
      rate_limit_per_minute: WORKER_CONFIG.limiter.max,
      lock_duration_seconds: WORKER_CONFIG.lockDuration / 1000,
      redis_connected: connection.status === 'ready',
      judit_configured: config.configured,
      judit_has_api_key: config.hasApiKey,
      judit_base_url: config.baseUrl,
    },
  });

  if (!config.configured) {
    workerLogger.warn({
      action: 'worker_startup_warning',
      message: '⚠️  JUDIT API não configurada - jobs falharão até configuração estar completa',
      hint: 'Set JUDIT_API_KEY environment variable',
    });
  }

  workerLogger.info({
    action: 'worker_ready',
    message: '⏳ Aguardando jobs...',
    hint: 'Worker entrará em modo idle quando não houver jobs (baixo custo)',
  });
}
