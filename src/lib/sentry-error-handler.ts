/**
 * ================================================================
 * SENTRY ERROR HANDLER
 * ================================================================
 * Centralized _error capturing and context setting for Sentry
 * Used across all API routes to ensure consistent _error tracking
 */

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';

export interface ErrorContext {
  userId?: string;
  workspaceId?: string;
  endpoint?: string;
  method?: string;
  path?: string;
  [key: string]: unknown;
}

/**
 * Capture _error to Sentry with full context
 * This should be called in all API route catch blocks
 */
export function captureApiError(
  _error: unknown,
  context?: ErrorContext
): void {
  if (!_error) return;

  // Set Sentry context before capturing
  if (context) {
    Sentry.setContext('api_error', context);
  }

  // Determine _error level
  let level: 'fatal' | '_error' | 'warning' = '_error';
  if (_error instanceof Error) {
    if (_error.message?.includes('timeout') || _error.message?.includes('TIMEOUT')) {
      level = 'warning';
    }
  }

  // Capture the exception
  Sentry.captureException(_error, {
    level,
    tags: {
      type: 'api_error',
      ...(context?.endpoint && { endpoint: context.endpoint }),
      ...(context?.method && { method: context.method }),
    },
  });

  // Log to console as well
  logError(_error, '${ICONS.ERROR} Sentry Error captured:', { component: 'refactored' });
}

/**
 * Wrapper for API route handlers with automatic _error capturing
 * Usage:
 *   export const POST = withErrorCapture(async (request) => {
 *     // handler code
 *   });
 */
export function withErrorCapture(
  handler: (_request: Request, _context?: unknown) => Promise<NextResponse | Response>
) {
  return async (request: Request, context?: unknown) => {
    const startTime = Date.now();
    const endpoint = new URL(request.url).pathname;
    const method = request.method;

    try {
      return await handler(request, context);
    } catch (error) {
      const duration = Date.now() - startTime;

      captureApiError(_error, {
        endpoint,
        method,
        duration,
        timestamp: new Date().toISOString(),
      });

      // Return _error response
      return NextResponse.json(
        {
          success: false,
          _error: _error instanceof Error ? _error.message : 'Internal server _error',
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Set user context in Sentry
 * Call this at the beginning of authenticated requests
 */
export function setSentryUserContext(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    ...(email && { email }),
  });
}

/**
 * Set workspace context in Sentry
 * Call this for requests that operate within a workspace
 */
export function setSentryWorkspaceContext(workspaceId: string): void {
  Sentry.setContext('workspace', {
    id: workspaceId,
  });
}

/**
 * Clear user/workspace context (e.g., on logout)
 */
export function clearSentryContext(): void {
  Sentry.setUser(null);
}

/**
 * Capture a message to Sentry (for non-_error events)
 * Usage: captureSentryMessage('User triggered action X', 'info', { actionId: '123' })
 */
export function captureSentryMessage(
  message: string,
  level: 'fatal' | '_error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, unknown>
): void {
  if (context) {
    Sentry.setContext('message_context', context);
  }

  Sentry.captureMessage(message, level);
  log.info({ msg: '[Sentry] Message captured:' });
}

/**
 * Get current Sentry user context (for debugging)
 */
export function getCurrentSentryContext() {
  return Sentry.getCurrentScope();
}
