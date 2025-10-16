#!/usr/bin/env tsx
// ================================================================
// JUDIT QUEUE TEST SCRIPT
// Manual testing script for JUDIT onboarding queue
// ================================================================
//
// USAGE:
//   npx tsx scripts/test-judit-queue.ts [CNJ_NUMBER]
//
// EXAMPLES:
//   npx tsx scripts/test-judit-queue.ts 0000000-00.2023.8.09.0000
//   npx tsx scripts/test-judit-queue.ts
//
// WHAT IT DOES:
//   1. Checks JUDIT configuration
//   2. Tests Redis connection
//   3. Adds a test job to the queue
//   4. Monitors job progress
//   5. Shows final result
//
// REQUIREMENTS:
//   - Redis must be running (REDIS_URL configured)
//   - JUDIT_API_KEY must be set (or will warn)
//   - Worker must be running to process jobs
//
// ================================================================

import { addOnboardingJob, getJobStatus, getQueueStats } from '@/lib/queue/juditQueue';
import { checkConfiguration, testConnection } from '@/lib/services/juditService';
import { testRedisConnection } from '@/lib/redis';
import { queueLogger } from '@/lib/observability/logger';

// ================================================================
// CONFIGURATION
// ================================================================

const DEFAULT_TEST_CNJ = '0000000-00.2023.8.09.0000';
const POLL_INTERVAL_MS = 2000; // Check job status every 2 seconds
const MAX_POLL_ATTEMPTS = 60; // Max 2 minutes of polling (60 * 2s = 120s)

// ================================================================
// HELPER FUNCTIONS
// ================================================================

function log(message: string, data?: any) {
  console.log(`\n${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ================================================================
// TEST STEPS
// ================================================================

/**
 * Step 1: Check JUDIT Configuration
 */
async function checkJuditConfig() {
  logSection('STEP 1: Checking JUDIT Configuration');

  const config = checkConfiguration();

  log('Configuration Status:', {
    configured: config.configured,
    hasApiKey: config.hasApiKey,
    hasBaseUrl: config.hasBaseUrl,
    baseUrl: config.baseUrl,
  });

  if (!config.configured) {
    log('⚠️  WARNING: JUDIT API not fully configured!');
    log('Jobs will fail until JUDIT_API_KEY is set in .env file');
    return false;
  }

  log('✅ JUDIT Configuration OK');
  return true;
}

/**
 * Step 2: Test Redis Connection
 */
async function checkRedisConnection() {
  logSection('STEP 2: Checking Redis Connection');

  try {
    const isConnected = await testRedisConnection();

    if (!isConnected) {
      log('❌ Redis connection failed');
      return false;
    }

    log('✅ Redis Connection OK');
    return true;
  } catch (error) {
    log('❌ Redis connection error:', error);
    return false;
  }
}

/**
 * Step 3: Show Queue Statistics
 */
async function showQueueStats() {
  logSection('STEP 3: Current Queue Statistics');

  try {
    const stats = await getQueueStats();
    log('Queue Stats:', stats);
  } catch (error) {
    log('⚠️  Could not fetch queue stats:', error);
  }
}

/**
 * Step 4: Add Test Job to Queue
 */
async function addTestJob(cnj: string): Promise<string | null> {
  logSection('STEP 4: Adding Test Job to Queue');

  try {
    log(`Adding onboarding job for CNJ: ${cnj}`);

    const { jobId } = await addOnboardingJob(cnj, {
      priority: 1,
    });

    log('✅ Job added successfully!', { jobId });
    return jobId;
  } catch (error) {
    log('❌ Failed to add job:', error);
    return null;
  }
}

/**
 * Step 5: Monitor Job Progress
 */
async function monitorJobProgress(jobId: string): Promise<void> {
  logSection('STEP 5: Monitoring Job Progress');

  log(`Monitoring job: ${jobId}`);
  log(`Polling every ${POLL_INTERVAL_MS / 1000}s (max ${MAX_POLL_ATTEMPTS} attempts)`);

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const status = await getJobStatus(jobId);

      log(`\nAttempt ${attempt}/${MAX_POLL_ATTEMPTS} - Status: ${status.status}`, {
        progress: status.progress,
      });

      // Job completed successfully
      if (status.status === 'completed') {
        log('\n🎉 Job completed successfully!');
        log('Result:', status.result);
        return;
      }

      // Job failed
      if (status.status === 'failed') {
        log('\n❌ Job failed!');
        log('Error:', status.error);
        return;
      }

      // Job not found
      if (status.status === 'unknown') {
        log('\n⚠️  Job not found. It may have been cleaned up or never existed.');
        return;
      }

      // Still processing, wait and try again
      if (status.status === 'waiting' || status.status === 'active' || status.status === 'delayed') {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      // Unknown status
      log(`\n⚠️  Unexpected status: ${status.status}`);
      return;

    } catch (error) {
      log(`\n❌ Error checking job status:`, error);
      return;
    }
  }

  log(`\n⏰ Timeout: Job did not complete within ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
  log('💡 The job may still be processing. Check logs or Bull Board UI.');
}

// ================================================================
// MAIN
// ================================================================

async function main() {
  console.log('🚀 JUDIT QUEUE TEST SCRIPT');
  console.log('Starting test sequence...\n');

  // Get CNJ from command line or use default
  const cnj = process.argv[2] || DEFAULT_TEST_CNJ;

  if (cnj === DEFAULT_TEST_CNJ) {
    log('⚠️  Using default test CNJ (will likely fail with JUDIT API)');
    log('💡 Provide a real CNJ: npx tsx scripts/test-judit-queue.ts 0000000-00.2023.8.09.0000');
  }

  // Step 1: Check JUDIT configuration
  const juditOk = await checkJuditConfig();

  // Step 2: Check Redis connection
  const redisOk = await checkRedisConnection();

  if (!redisOk) {
    log('\n❌ Cannot continue without Redis. Please configure REDIS_URL in .env');
    process.exit(1);
  }

  // Step 3: Show queue stats
  await showQueueStats();

  // Step 4: Add test job
  const jobId = await addTestJob(cnj);

  if (!jobId) {
    log('\n❌ Failed to add job. Exiting.');
    process.exit(1);
  }

  // Step 5: Monitor job progress
  log('\n💡 Make sure the worker is running: npx tsx src/workers/juditOnboardingWorker.ts');
  await monitorJobProgress(jobId);

  // Show final queue stats
  await showQueueStats();

  log('\n✅ Test complete!');
  log('💡 Check logs above for detailed information');

  process.exit(0);
}

// Run main function
main().catch((error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
