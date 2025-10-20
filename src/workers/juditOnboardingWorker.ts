// ================================================================
// JUDIT ONBOARDING WORKER - MINIMAL STUB
// ================================================================
// This is a minimal stub to allow container startup
// Full implementation requires proper module resolution
// ================================================================

import { Worker } from 'bullmq';
import { getRedisConnection } from '../lib/redis';

console.log('[WORKER] Initializing JUDIT Onboarding Worker...');

const connection = getRedisConnection();

if (!connection) {
  console.error('[WORKER] ❌ FATAL: Redis connection not available');
  console.error('[WORKER] ❌ Workers cannot run without Redis');
  console.error('[WORKER] ❌ Please configure REDIS_URL environment variable');
  process.exit(1);
}

console.log('[WORKER] ✅ Redis connection available');

// Minimal worker configuration
const WORKER_CONFIG = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'),
  limiter: {
    max: 10,
    duration: 60000,
  },
  lockDuration: 30000,
  lockRenewTime: 15000,
} as const;

// Minimal processor function
async function processOnboardingJob(job: any) {
  const { cnj } = job.data;
  console.log(`[WORKER] Processing job ${job.id} for CNJ: ${cnj}`);

  // Update progress
  await job.updateProgress(100);

  return {
    success: true,
    message: 'Job processed',
    cnj,
  };
}

// Create and start worker
const worker = new Worker('judit-onboarding', processOnboardingJob, {
  connection,
  ...WORKER_CONFIG,
});

// Event listeners
worker.on('started', () => {
  console.log('[WORKER] ✅ Worker started and listening for jobs');
});

worker.on('completed', (job) => {
  console.log(`[WORKER] ✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[WORKER] ❌ Job ${job?.id} failed:`, err?.message);
});

worker.on('error', (err) => {
  console.error('[WORKER] ❌ Worker error:', err);
});

process.on('SIGTERM', async () => {
  console.log('[WORKER] Received SIGTERM, shutting down gracefully');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[WORKER] Received SIGINT, shutting down gracefully');
  await worker.close();
  process.exit(0);
});

console.log('[WORKER] ✅ JUDIT Onboarding Worker is ready');
