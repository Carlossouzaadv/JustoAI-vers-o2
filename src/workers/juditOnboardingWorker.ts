// ================================================================
// JUDIT ONBOARDING WORKER
// Worker de background para processar onboarding de processos
// ================================================================

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { performFullProcessRequest } from '@/lib/services/juditOnboardingService';
import type {
  JuditOnboardingJobData,
  JuditOnboardingJobResult,
} from '@/lib/queue/juditQueue';

// ================================================================
// CONFIGURAÇÃO REDIS
// ================================================================

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const connection = new IORedis(redisConfig);

// ================================================================
// WORKER CONFIGURATION
// ================================================================

const WORKER_CONFIG = {
  concurrency: 3, // Processar até 3 jobs simultaneamente
  limiter: {
    max: 10, // Máximo 10 jobs
    duration: 60000, // Por minuto (respeitando rate limit da JUDIT)
  },
} as const;

// ================================================================
// LOGS
// ================================================================

const log = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JUDIT WORKER] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [JUDIT WORKER ERROR] ${message}`, error || '');
  },
  success: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JUDIT WORKER ✓] ${message}`, data || '');
  },
};

// ================================================================
// PROCESSOR FUNCTION
// ================================================================

async function processOnboardingJob(
  job: Job<JuditOnboardingJobData>
): Promise<JuditOnboardingJobResult> {
  const { cnj, workspaceId, userId } = job.data;

  log.info(`Iniciando processamento`, {
    jobId: job.id,
    cnj,
    workspaceId,
    userId,
  });

  try {
    // Atualizar progresso: 10%
    await job.updateProgress(10);

    // Executar onboarding completo
    const startTime = Date.now();

    // Atualizar progresso: 20% (iniciando requisição)
    await job.updateProgress(20);

    const result = await performFullProcessRequest(cnj, 'ONBOARDING');

    const duration = Date.now() - startTime;

    // Atualizar progresso: 100%
    await job.updateProgress(100);

    if (result.success) {
      log.success(`Onboarding concluído`, {
        jobId: job.id,
        cnj,
        processoId: result.processoId,
        requestId: result.requestId,
        duration: `${(duration / 1000).toFixed(2)}s`,
      });

      return {
        success: true,
        processoId: result.processoId,
        requestId: result.requestId,
        numeroCnj: cnj,
        duration,
      };
    } else {
      log.error(`Onboarding falhou`, {
        jobId: job.id,
        cnj,
        error: result.error,
      });

      throw new Error(result.error || 'Onboarding falhou');
    }
  } catch (error) {
    log.error(`Erro no processamento`, {
      jobId: job.id,
      cnj,
      error: error instanceof Error ? error.message : String(error),
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
  log.success('Worker pronto para processar jobs');
});

juditOnboardingWorker.on('active', (job) => {
  log.info(`Job ativo`, {
    jobId: job.id,
    cnj: job.data.cnj,
  });
});

juditOnboardingWorker.on('completed', (job, result) => {
  log.success(`Job completado`, {
    jobId: job.id,
    cnj: job.data.cnj,
    processoId: result.processoId,
    duration: `${(result.duration / 1000).toFixed(2)}s`,
  });
});

juditOnboardingWorker.on('failed', (job, error) => {
  log.error(`Job falhou`, {
    jobId: job?.id,
    cnj: job?.data.cnj,
    attempt: job?.attemptsMade,
    error: error.message,
  });
});

juditOnboardingWorker.on('error', (error) => {
  log.error('Erro no worker', error);
});

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================

async function gracefulShutdown() {
  log.info('Encerrando worker...');

  await juditOnboardingWorker.close();
  await connection.quit();

  log.success('Worker encerrado com sucesso');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ================================================================
// START WORKER (se executado diretamente)
// ================================================================

if (require.main === module) {
  log.info('========================================');
  log.info('INICIANDO JUDIT ONBOARDING WORKER');
  log.info('========================================');
  log.info('Configuração:', {
    concurrency: WORKER_CONFIG.concurrency,
    rateLimitPerMinute: WORKER_CONFIG.limiter.max,
    redisHost: redisConfig.host,
    redisPort: redisConfig.port,
  });
  log.info('Aguardando jobs...');
}
