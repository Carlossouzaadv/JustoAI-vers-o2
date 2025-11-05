// ================================================================
// SENTRY GLOBAL INITIALIZATION
// ================================================================
// Call this once at application startup to enable global error tracking

import { initSentryServer, captureException } from './sentry.server.config';

/**
 * Initialize Sentry and setup global error handlers
 * Call this in your Next.js API routes or worker startup
 */
export function setupSentryGlobal() {
  // Initialize Sentry SDK
  initSentryServer();

  // Setup uncaught exception handler
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 Uncaught Exception:', error);
    captureException(error, {
      type: 'uncaughtException',
      fatal: true,
    });
    // In production, you might want to exit gracefully
    // process.exit(1);
  });

  // Setup unhandled promise rejection handler
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('💥 Unhandled Rejection:', reason);
    const error = reason instanceof Error ? reason : new Error(String(reason));
    captureException(error, {
      type: 'unhandledRejection',
      fatal: true,
      reason: String(reason),
    });
  });

  console.log('✅ Sentry global error handlers configured');
}

export default setupSentryGlobal;
