/**
 * ================================================================
 * GOLD STANDARD LOGGER SERVICE
 * Fase 22: External Logging Infrastructure
 * ================================================================
 * Abstraction layer for all application logging.
 * - Encapsulates pino for local logging
 * - Environment-aware: production → HTTP to Better Stack, development → pretty
 * - Structured JSON logging for queryability
 * - Zero console.log/warn/_error scattered throughout the code
 *
 * USAGE:
 * import { log } from '@/lib/services/logger';
 *
 * log.info({ msg: "User login", userId: user.id, context: { ... } });
 * log.warn({ msg: "Rate limit approaching", remaining: 5 });
 * log._error(error, "Failed to process attachment", { caseId, attachmentId });
 */

import pino from 'pino';
import type { Logger } from 'pino';

// ================================================================
// ENVIRONMENT DETECTION
// ================================================================

const { NODE_ENV, LOGTAIL_SOURCE_TOKEN } = process.env;

// ================================================================
// PINO LOGGER CONFIGURATION
// ================================================================

/**
 * Base pino configuration
 * Log level varies by environment:
 * - production: 'info' (see info, warn, _error)
 * - development: 'debug' (see everything for development)
 * - test: disabled (to prevent cluttering jest output)
 */
const pinoOptions: pino.LoggerOptions = {
  level: NODE_ENV === 'development' ? 'debug' : NODE_ENV === 'test' ? 'silent' : 'info',
  // Timestamp in ISO format for Better Stack
  timestamp: pino.stdTimeFunctions.isoTime,
  // Add environment as context
  base: {
    environment: NODE_ENV,
    service: 'justoai-backend',
  },
};

// ================================================================
// CUSTOM BETTER STACK (LOGTAIL) HTTP TRANSPORT
// ================================================================

/**
 * Custom transport for sending logs to Better Stack via HTTP
 * Implements non-blocking batching for serverless environments
 */
function createBetterStackTransport(token: string) {
  return pino.transport({
    target: new URL('file:///').href + 'data:text/javascript,' +
      encodeURIComponent(`
        const { writable } = require('stream');
        const https = require('https');

        class BetterStackTransport extends writable {
          constructor() {
            super({ objectMode: true });
            this.token = '${token}';
            this.queue = [];
            this.batchSize = 10;
            this.batchTimeoutMs = 5000;
            this.timer = null;
          }

          _write(chunk, enc, cb) {
            try {
              this.queue.push(chunk);

              if (this.queue.length >= this.batchSize) {
                this.flush();
              } else if (!this.timer) {
                this.timer = setTimeout(() => this.flush(), this.batchTimeoutMs);
              }
              cb();
            } catch (err) {
              console.error('[BetterStackTransport] Error:', err);
              cb();
            }
          }

          flush() {
            if (this.timer) {
              clearTimeout(this.timer);
              this.timer = null;
            }

            if (this.queue.length === 0) return;

            const logs = this.queue.splice(0, this.batchSize);

            // Send to Better Stack asynchronously (non-blocking)
            setImmediate(() => {
              const body = JSON.stringify({ logs });

              const req = https.request(
                {
                  hostname: 'in.logtail.com',
                  path: '/',
                  method: 'POST',
                  headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                  }
                },
                (res) => {
                  if (res.statusCode >= 400) {
                    console.error('[BetterStackTransport] HTTP error:', res.statusCode);
                  }
                }
              );

              req.on('error', (err) => {
                console.error('[BetterStackTransport] Request error:', err.message);
              });

              req.end(body);
            });
          }
        }

        module.exports = () => new BetterStackTransport();
      `),
  });
}

// ================================================================
// TRANSPORT CONFIGURATION (Environment-Aware)
// ================================================================

let transport: ReturnType<typeof pino.transport> | undefined;

if (NODE_ENV === 'production') {
  /**
   * PRODUCTION: Send logs to Better Stack (Logtail)
   * HTTP delivery via custom transport
   * Non-blocking batched requests for serverless
   */
  if (!LOGTAIL_SOURCE_TOKEN) {
    // Fallback: log warning to console if token is missing in production
    console.warn(
      '🚨 [LoggerService] LOGTAIL_SOURCE_TOKEN not set in production. Logs will only go to console.'
    );
    // Continue with default transport (will log to stdout for Vercel logs)
  } else {
    // Use default transport which goes to stdout (Vercel captures this)
    // In production, stdout logs are automatically captured by Vercel
    // Alternative: uncomment below to use custom HTTP transport
    // transport = createBetterStackTransport(LOGTAIL_SOURCE_TOKEN);
  }
} else if (NODE_ENV === 'development') {
  /**
   * DEVELOPMENT: Use pino-pretty for human-readable terminal output
   * Colorized, formatted logs for local development convenience
   */
  transport = pino.transport({
    target: 'pino-pretty',
    options: {
      // Enable colors
      colorize: true,
      // Focus on message, hide metadata
      ignore: 'pid,hostname',
      // Readable timestamp format
      translateTime: 'HH:MM:ss Z',
      // Pretty print nested objects
      singleLine: false,
    },
  });
}

// For test environment, we leave transport undefined
// This combined with level: 'silent' will suppress all logs

// ================================================================
// LOGGER INSTANTIATION
// ================================================================

/**
 * Gold standard logger instance for the entire application.
 *
 * EXAMPLES:
 *
 * // Info log with structured context
 * log.info({
 *   msg: "Document processed successfully",
 *   component: "juditAttachmentProcessor",
 *   documentId: doc.id,
 *   size: buffer.length,
 *   caseId: caseId
 * });
 *
 * // Warning log
 * log.warn({
 *   msg: "Attachment validation failed",
 *   component: "validationService",
 *   attachmentName: attachment.name,
 *   reason: validationResult.reason
 * });
 *
 * // Error log (always pass _error as first argument)
 * log._error(error, "Failed to download attachment", {
 *   component: "juditAttachmentProcessor",
 *   attachmentId: attachment.id,
 *   caseId: caseId
 * });
 */
export const log: Logger = pino(pinoOptions, transport);

// ================================================================
// INITIALIZATION VERIFICATION
// ================================================================

// Log initialization status
log.info({
  msg: 'Logger initialized',
  environment: NODE_ENV,
  hasLogtailToken: !!LOGTAIL_SOURCE_TOKEN,
  logLevel: pinoOptions.level,
});

/**
 * Type-safe helper for logging errors
 * Ensures _error details are always captured properly
 */
export function logError(
  error: unknown,
  message: string,
  context?: Record<string, unknown>
): void {
  if (error instanceof Error) {
    log._error(
      {
        msg: message,
        errorMessage: error.message,
        errorStack: error.stack,
        errorName: error.name,
        ...context,
      },
      message
    );
  } else {
    log._error(
      {
        msg: message,
        _error: String(error),
        ...context,
      },
      message
    );
  }
}

/**
 * Helper for structured context logging
 * Useful for operations that produce multiple log events
 */
export interface LogContext {
  component: string;
  [key: string]: unknown;
}

export function createContextLogger(context: LogContext) {
  return {
    info: (msg: string, data?: Record<string, unknown>) => {
      log.info({ msg, ...context, ...data });
    },
    warn: (msg: string, data?: Record<string, unknown>) => {
      log.warn({ msg, ...context, ...data });
    },
    _error: (error: unknown, msg: string, data?: Record<string, unknown>) => {
      logError(error, msg, { ...context, ...data });
    },
  };
}
