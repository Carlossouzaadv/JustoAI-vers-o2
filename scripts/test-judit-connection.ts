// ================================================================
// JUDIT CONNECTION TEST
// ================================================================
//
// OBJECTIVES:
// - Validate JUDIT API connection and configuration
// - Test endpoint connectivity
// - Check API response format
// - Verify authentication
//
// SAFETY:
// - Only runs if JUDIT_API_KEY is configured
// - Does not make destructive API calls
// - Tests read-only endpoints
// ================================================================

import { juditService, checkConfiguration } from '../src/lib/services/juditService';
import { metricsLogger } from '../src/lib/observability/logger';

// ================================================================
// MAIN TEST FUNCTION
// ================================================================

async function testJuditConnection() {
  const logger = metricsLogger.child({ component: 'judit-connection-test' });

  logger.info({
    action: 'connection_test_start',
    message: '🔌 JUDIT Connection Test Starting',
    timestamp: new Date().toISOString(),
  });

  // Check configuration
  const config = checkConfiguration();

  logger.info({
    action: 'check_configuration',
    configured: config.configured,
    has_api_key: config.hasApiKey,
    has_base_url: config.hasBaseUrl,
    base_url: config.baseUrl,
  });

  // ============================================================
  // SAFETY CHECK - Only proceed if API key is configured
  // ============================================================

  if (!config.hasApiKey) {
    logger.warn({
      action: 'api_key_not_configured',
      message: '⚠️  JUDIT_API_KEY is not configured',
      status: 'SKIPPED',
      hint: 'Connection test requires JUDIT_API_KEY to be set',
    });

    logger.info({
      action: 'test_complete',
      message: '✅ Test completed (skipped - no API key)',
      status: 'SKIPPED',
    });

    process.exit(0);
  }

  logger.info({
    action: 'api_key_configured',
    message: '✅ JUDIT_API_KEY is configured',
    status: 'PROCEEDING',
  });

  // ============================================================
  // TEST CONNECTION
  // ============================================================

  logger.info({
    action: 'test_start',
    message: '🚀 Testing JUDIT API connection...',
  });

  try {
    const result = await juditService.testConnection();

    logger.info({
      action: 'connection_test_success',
      message: '✅ JUDIT API Connection Test Successful',
      result,
      status: 'SUCCESS',
    });

    logger.info({
      action: 'test_complete',
      message: '✅ All tests passed!',
      status: 'PASSED',
      details: {
        api_accessible: true,
        configuration_valid: true,
        authentication_success: true,
      },
    });

    process.exit(0);
  } catch (error) {
    logger.error({
      action: 'connection_test_failed',
      message: '❌ JUDIT API Connection Test Failed',
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      status: 'FAILED',
    });

    logger.error({
      action: 'test_complete',
      message: '❌ Test failed - see error details above',
      status: 'FAILED',
      troubleshooting: [
        '1. Verify JUDIT_API_KEY is correct',
        '2. Verify JUDIT_API_BASE_URL is accessible',
        '3. Check network connectivity',
        '4. Verify API credentials have not expired',
        '5. Check JUDIT API status page for outages',
      ],
    });

    process.exit(1);
  }
}

// ================================================================
// SIGNAL HANDLERS
// ================================================================

process.on('SIGINT', () => {
  const logger = metricsLogger.child({ component: 'judit-connection-test' });
  logger.warn({
    action: 'test_interrupted',
    message: '⚠️  Test interrupted by user',
  });
  process.exit(130);
});

// ================================================================
// RUN TEST
// ================================================================

testJuditConnection().catch(async (error) => {
  const logger = metricsLogger.child({ component: 'judit-connection-test' });
  logger.error({
    action: 'test_fatal_error',
    message: '💥 Fatal error during test',
    error: error instanceof Error ? error.message : String(error),
    error_stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
