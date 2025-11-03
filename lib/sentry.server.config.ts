// ================================================================
// SENTRY SERVER-SIDE CONFIGURATION
// ================================================================
// This file configures Sentry for server-side error tracking
// on both Next.js API routes and background workers

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENV = process.env.NODE_ENV || 'development';

/**
 * Initialize Sentry for server-side error tracking
 * Should be called once at application startup
 */
export function initSentryServer() {
  if (!SENTRY_DSN) {
    console.warn('⚠️  SENTRY_DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    integrations: [
      // HTTP client integration for outbound request tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Node.js integration for server-side tracing
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
    // Performance Monitoring
    tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,
    // Release tracking
    release: process.env.SENTRY_RELEASE || '1.0.0',
    // Capture breadcrumbs
    maxBreadcrumbs: 50,
    // Before sending to Sentry (filter sensitive data)
    beforeSend(event, hint) {
      // Filter out certain error types we don't care about
      if (hint.originalException instanceof Error) {
        const message = hint.originalException.message;

        // Ignore specific errors
        if (
          message?.includes('ECONNREFUSED') ||
          message?.includes('network timeout') ||
          message?.includes('Client request aborted')
        ) {
          return null;
        }
      }

      return event;
    },
  });

  console.log('✅ Sentry initialized for server-side error tracking');
}

/**
 * Capture an exception to Sentry
 */
export function captureException(error: Error | unknown, context?: Record<string, any>) {
  if (!SENTRY_DSN) return;

  const scope = Sentry.getCurrentScope();

  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
  }

  Sentry.captureException(error);
}

/**
 * Capture a message to Sentry
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
) {
  if (!SENTRY_DSN) return;

  const scope = Sentry.getCurrentScope();

  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
  }

  Sentry.captureMessage(message, level);
}

/**
 * Add context information to Sentry scope
 */
export function addSentryContext(key: string, context: Record<string, any>) {
  if (!SENTRY_DSN) return;
  Sentry.getCurrentScope().setContext(key, context);
}

/**
 * Set user information in Sentry scope
 */
export function setSentryUser(userId: string, email?: string, metadata?: Record<string, any>) {
  if (!SENTRY_DSN) return;

  Sentry.getCurrentScope().setUser({
    id: userId,
    email,
    ...metadata,
  });
}

/**
 * Clear user information from Sentry scope
 */
export function clearSentryUser() {
  if (!SENTRY_DSN) return;
  Sentry.getCurrentScope().setUser(null);
}

export default Sentry;
