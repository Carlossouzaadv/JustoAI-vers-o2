// ================================================================
// NEXT.JS INSTRUMENTATION - Global Server Initialization
// ================================================================
// This file is automatically called by Next.js 15+ on server startup
// Reference: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

/**
 * Called when the server starts up (before any requests)
 * Used to initialize global services like Sentry
 */
export async function register() {
  // Only initialize on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { setupSentryGlobal } = await import('./lib/sentry-init');
    setupSentryGlobal();
  }
}
