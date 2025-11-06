// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const ENV = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: 'https://2fabb795d6dcae8dc219145e9968a7a4@o4510178719039488.ingest.us.sentry.io/4510303093587968',

  environment: ENV,

  // Performance Monitoring - Lower sample rate in production
  tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,

  // Release tracking
  release: process.env.SENTRY_RELEASE || '1.0.0',

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Capture console logs
  integrations: [
    Sentry.httpIntegration(),
    Sentry.consoleIntegration({ levels: ['log', 'warn', 'error'] }),
  ],

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Capture breadcrumbs
  maxBreadcrumbs: 50,

  // Filter sensitive errors before sending
  beforeSend(event, hint) {
    if (hint.originalException instanceof Error) {
      const message = hint.originalException.message;

      // Ignore transient network errors
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

// Export Sentry utilities
export const initSentryServer = () => {
  // Sentry is already initialized above
  return Sentry;
};

export const captureException = (
  error: Error,
  context?: Record<string, unknown>
) => {
  if (context) {
    Sentry.captureException(error, { extra: context });
  } else {
    Sentry.captureException(error);
  }
};

export const captureMessage = (message: string, level?: 'info' | 'warning' | 'error') => {
  Sentry.captureMessage(message, level || 'info');
};

export const addSentryContext = (key: string, value: unknown) => {
  Sentry.setContext(key, value as Record<string, unknown>);
};

export const setSentryUser = (userId: string | null, email?: string) => {
  if (userId) {
    Sentry.setUser({ id: userId, email });
  } else {
    Sentry.setUser(null);
  }
};
