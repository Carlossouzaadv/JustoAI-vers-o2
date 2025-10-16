// ================================================================
// JUDIT STRESS TEST - Queue and Worker Stability Testing
// ================================================================
//
// OBJECTIVES:
// - Validate that the worker processes jobs correctly
// - Ensure the queue empties without errors
// - Monitor CPU and memory consumption
// - Test with 10 fictional jobs over 10 minutes
//
// SAFETY:
// - No real API calls (worker blocks jobs when API key is missing)
// - Safe to run before production deployment
// ================================================================

import { juditOnboardingQueue, getQueueStats } from '../src/lib/queue/juditQueue';
import { checkConfiguration } from '../src/lib/services/juditService';
import { metricsLogger } from '../src/lib/observability/logger';

// ================================================================
// CONFIGURATION
// ================================================================

const STRESS_TEST_CONFIG = {
  TOTAL_JOBS: 10,
  TEST_DURATION_MS: 10 * 60 * 1000, // 10 minutes
  METRICS_INTERVAL_MS: 2000, // Log metrics every 2 seconds
  CNJ_PREFIX: '0000000-0', // Fictional CNJ prefix
} as const;

// ================================================================
// METRICS TRACKING
// ================================================================

interface TestMetrics {
  startTime: number;
  jobsAdded: number;
  jobsCompleted: number;
  jobsFailed: number;
  memorySnapshots: number[];
  peakMemoryMb: number;
  averageMemoryMb: number;
  totalDuration: number;
}

const metrics: TestMetrics = {
  startTime: Date.now(),
  jobsAdded: 0,
  jobsCompleted: 0,
  jobsFailed: 0,
  memorySnapshots: [],
  peakMemoryMb: 0,
  averageMemoryMb: 0,
  totalDuration: 0,
};

// ================================================================
// UTILITIES
// ================================================================

function getMemoryUsageMb(): number {
  const memoryUsage = process.memoryUsage();
  return Math.round(memoryUsage.rss / 1024 / 1024);
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// ================================================================
// MAIN STRESS TEST FUNCTION
// ================================================================

async function runStressTest() {
  const logger = metricsLogger.child({ component: 'stress-test' });

  // ============================================================
  // PRE-FLIGHT CHECKS
  // ============================================================

  logger.info({
    action: 'stress_test_start',
    message: '🚀 INICIANDO STRESS TEST DO JUDIT QUEUE',
    config: {
      total_jobs: STRESS_TEST_CONFIG.TOTAL_JOBS,
      test_duration_minutes: STRESS_TEST_CONFIG.TEST_DURATION_MS / 60000,
      metrics_interval_seconds: STRESS_TEST_CONFIG.METRICS_INTERVAL_MS / 1000,
    },
  });

  // Check JUDIT configuration
  const juditConfig = checkConfiguration();
  logger.info({
    action: 'check_configuration',
    judit_configured: juditConfig.configured,
    has_api_key: juditConfig.hasApiKey,
    has_base_url: juditConfig.hasBaseUrl,
    message: juditConfig.configured
      ? '⚠️  JUDIT API KEY CONFIGURED - Jobs will make real API calls!'
      : '✅ JUDIT API KEY NOT CONFIGURED - Safe test mode (jobs will be blocked)',
  });

  if (juditConfig.configured) {
    logger.warn({
      action: 'warning_api_configured',
      message: '⚠️  WARNING: JUDIT_API_KEY is configured!',
      hint: 'Jobs will attempt real API calls. Unset JUDIT_API_KEY for safe testing.',
    });
  }

  // Initial memory baseline
  const initialMemoryMb = getMemoryUsageMb();
  logger.info({
    action: 'initial_memory',
    memory_mb: initialMemoryMb,
    message: `📊 Initial memory usage: ${initialMemoryMb} MB`,
  });

  // ============================================================
  // PHASE 1: ADD JOBS TO QUEUE
  // ============================================================

  logger.info({
    action: 'phase_1_start',
    message: `📝 Adding ${STRESS_TEST_CONFIG.TOTAL_JOBS} jobs to queue...`,
  });

  const jobIds: string[] = [];

  for (let i = 0; i < STRESS_TEST_CONFIG.TOTAL_JOBS; i++) {
    const cnj = `${STRESS_TEST_CONFIG.CNJ_PREFIX}${i}.2023.8.09.0000`;

    try {
      const job = await juditOnboardingQueue.add(
        'stress-test',
        {
          cnj,
          priority: 1,
        },
        {
          jobId: `stress-test-${i}-${Date.now()}`,
        }
      );

      jobIds.push(job.id as string);
      metrics.jobsAdded++;

      logger.debug({
        action: 'job_added',
        job_id: job.id,
        cnj,
        progress: `${i + 1}/${STRESS_TEST_CONFIG.TOTAL_JOBS}`,
      });
    } catch (error) {
      logger.error({
        action: 'job_add_failed',
        cnj,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info({
    action: 'phase_1_complete',
    message: `✅ Successfully added ${metrics.jobsAdded} jobs to queue`,
    jobs_added: metrics.jobsAdded,
  });

  // ============================================================
  // PHASE 2: MONITOR QUEUE AND METRICS
  // ============================================================

  logger.info({
    action: 'phase_2_start',
    message: '⏳ Monitoring queue for 10 minutes...',
    hint: 'Press Ctrl+C to stop early',
  });

  const metricsIntervalId = setInterval(async () => {
    try {
      // Get queue stats
      const queueStats = await getQueueStats();

      // Get memory usage
      const currentMemoryMb = getMemoryUsageMb();
      metrics.memorySnapshots.push(currentMemoryMb);

      // Update peak memory
      if (currentMemoryMb > metrics.peakMemoryMb) {
        metrics.peakMemoryMb = currentMemoryMb;
      }

      // Calculate elapsed time
      const elapsedMs = Date.now() - metrics.startTime;
      const remainingMs = STRESS_TEST_CONFIG.TEST_DURATION_MS - elapsedMs;

      // Log current metrics
      logger.info({
        action: 'metrics_snapshot',
        elapsed: formatDuration(elapsedMs),
        remaining: formatDuration(remainingMs),
        queue: {
          waiting: queueStats.waiting,
          active: queueStats.active,
          completed: queueStats.completed,
          failed: queueStats.failed,
          delayed: queueStats.delayed,
        },
        memory: {
          current_mb: currentMemoryMb,
          peak_mb: metrics.peakMemoryMb,
          initial_mb: initialMemoryMb,
          increase_mb: currentMemoryMb - initialMemoryMb,
        },
      });

      // Update completion metrics
      metrics.jobsCompleted = queueStats.completed;
      metrics.jobsFailed = queueStats.failed;

      // Check if all jobs are done (early exit condition)
      if (
        queueStats.waiting === 0 &&
        queueStats.active === 0 &&
        queueStats.delayed === 0 &&
        queueStats.completed + queueStats.failed >= metrics.jobsAdded
      ) {
        logger.info({
          action: 'all_jobs_processed',
          message: '✅ All jobs processed! Stopping test early.',
          elapsed: formatDuration(elapsedMs),
        });

        clearInterval(metricsIntervalId);
        await printFinalSummary();
        await cleanup();
      }
    } catch (error) {
      logger.error({
        action: 'metrics_snapshot_error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, STRESS_TEST_CONFIG.METRICS_INTERVAL_MS);

  // ============================================================
  // PHASE 3: WAIT FOR TEST DURATION
  // ============================================================

  await new Promise((resolve) => {
    setTimeout(() => {
      clearInterval(metricsIntervalId);
      resolve(null);
    }, STRESS_TEST_CONFIG.TEST_DURATION_MS);
  });

  // ============================================================
  // PHASE 4: FINAL SUMMARY
  // ============================================================

  await printFinalSummary();
  await cleanup();
}

// ================================================================
// FINAL SUMMARY
// ================================================================

async function printFinalSummary() {
  const logger = metricsLogger.child({ component: 'stress-test-summary' });

  metrics.totalDuration = Date.now() - metrics.startTime;

  // Calculate average memory
  if (metrics.memorySnapshots.length > 0) {
    const sum = metrics.memorySnapshots.reduce((a, b) => a + b, 0);
    metrics.averageMemoryMb = Math.round(sum / metrics.memorySnapshots.length);
  }

  // Get final queue stats
  const finalStats = await getQueueStats();

  logger.info({
    action: 'stress_test_complete',
    message: '🏁 STRESS TEST COMPLETE',
  });

  logger.info({
    action: 'final_summary',
    message: '📊 FINAL SUMMARY',
    test_duration: formatDuration(metrics.totalDuration),
    jobs: {
      added: metrics.jobsAdded,
      completed: finalStats.completed,
      failed: finalStats.failed,
      success_rate: metrics.jobsAdded > 0
        ? `${Math.round((finalStats.completed / metrics.jobsAdded) * 100)}%`
        : '0%',
    },
    memory: {
      average_mb: metrics.averageMemoryMb,
      peak_mb: metrics.peakMemoryMb,
      samples: metrics.memorySnapshots.length,
    },
    queue_state: {
      waiting: finalStats.waiting,
      active: finalStats.active,
      completed: finalStats.completed,
      failed: finalStats.failed,
      delayed: finalStats.delayed,
    },
  });

  // ============================================================
  // DIAGNOSTICS
  // ============================================================

  logger.info({
    action: 'diagnostics',
    message: '🔍 DIAGNOSTICS',
  });

  // Check if memory is stable
  const memoryStable = metrics.peakMemoryMb < 150;
  logger.info({
    action: 'diagnostic_memory',
    status: memoryStable ? 'PASS' : 'WARNING',
    message: memoryStable
      ? '✅ Memory usage is stable (< 150 MB)'
      : '⚠️  Memory usage exceeded 150 MB - investigate potential leaks',
    peak_mb: metrics.peakMemoryMb,
    threshold_mb: 150,
  });

  // Check if queue emptied
  const queueEmpty = finalStats.waiting === 0 && finalStats.active === 0;
  logger.info({
    action: 'diagnostic_queue',
    status: queueEmpty ? 'PASS' : 'WARNING',
    message: queueEmpty
      ? '✅ Queue emptied successfully'
      : '⚠️  Queue still has pending jobs',
    waiting: finalStats.waiting,
    active: finalStats.active,
  });

  // Check success rate
  const allJobsProcessed = finalStats.completed + finalStats.failed >= metrics.jobsAdded;
  logger.info({
    action: 'diagnostic_completion',
    status: allJobsProcessed ? 'PASS' : 'WARNING',
    message: allJobsProcessed
      ? '✅ All jobs were processed'
      : '⚠️  Some jobs were not processed',
    expected: metrics.jobsAdded,
    processed: finalStats.completed + finalStats.failed,
  });

  // Final verdict
  const allPassed = memoryStable && queueEmpty && allJobsProcessed;
  logger.info({
    action: 'final_verdict',
    status: allPassed ? 'SUCCESS' : 'NEEDS_ATTENTION',
    message: allPassed
      ? '🎉 All checks passed! System is stable and ready.'
      : '⚠️  Some checks failed. Review diagnostics above.',
  });
}

// ================================================================
// CLEANUP
// ================================================================

async function cleanup() {
  const logger = metricsLogger.child({ component: 'stress-test-cleanup' });

  logger.info({
    action: 'cleanup_start',
    message: '🧹 Cleaning up...',
  });

  try {
    // Close queue connection
    await juditOnboardingQueue.close();

    logger.info({
      action: 'cleanup_success',
      message: '✅ Cleanup complete',
    });

    // Exit process
    process.exit(0);
  } catch (error) {
    logger.error({
      action: 'cleanup_error',
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// ================================================================
// SIGNAL HANDLERS
// ================================================================

process.on('SIGINT', async () => {
  const logger = metricsLogger.child({ component: 'stress-test' });
  logger.warn({
    action: 'interrupted',
    message: '⚠️  Test interrupted by user',
  });
  await printFinalSummary();
  await cleanup();
});

process.on('SIGTERM', async () => {
  const logger = metricsLogger.child({ component: 'stress-test' });
  logger.warn({
    action: 'terminated',
    message: '⚠️  Test terminated',
  });
  await printFinalSummary();
  await cleanup();
});

// ================================================================
// RUN TEST
// ================================================================

runStressTest().catch(async (error) => {
  const logger = metricsLogger.child({ component: 'stress-test' });
  logger.error({
    action: 'stress_test_failed',
    error: error instanceof Error ? error.message : String(error),
    error_stack: error instanceof Error ? error.stack : undefined,
  });
  await cleanup();
});
