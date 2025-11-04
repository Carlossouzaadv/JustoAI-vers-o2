/**
 * ================================================================
 * SENTRY ERROR HANDLER
 * ================================================================
 * Centralized error capturing and context setting for Sentry
 * Used across all API routes to ensure consistent error tracking
 */

import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { ICONS } from './icons';

export interface ErrorContext {
  userId?: string;
  workspaceId?: string;
  endpoint?: string;
  method?: string;
  path?: string;
  [key: string]: any;
}

/**
 * Capture error to Sentry with full context
 * This should be called in all API route catch blocks
 */
export function captureApiError(
  error: unknown,
  context?: ErrorContext
): void {
  if (!error) return;

  // Set Sentry context before capturing
  if (context) {
    Sentry.setContext('api_error', context);
  }

  // Determine error level
  let level: 'fatal' | 'error' | 'warning' = 'error';
  if (error instanceof Error) {
    if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
      level = 'warning';
    }
  }

  // Capture the exception
  Sentry.captureException(error, {
    level,
    tags: {
      type: 'api_error',
      ...(context?.endpoint && { endpoint: context.endpoint }),
      ...(context?.method && { method: context.method }),
    },
  });

  // Log to console as well
  console.error(`${ICONS.ERROR} [Sentry] Error captured:`, error);
}

/**
 * Wrapper for API route handlers with automatic error capturing
 * Usage:
 *   export const POST = withErrorCapture(async (request) => {
 *     // handler code
 *   });
 */
export function withErrorCapture(
  handler: (request: Request, context?: any) => Promise<NextResponse | Response>
) {
  return async (request: Request, context?: any) => {
    const startTime = Date.now();
    const endpoint = new URL(request.url).pathname;
    const method = request.method;

    try {
      return await handler(request, context);
    } catch (error) {
      const duration = Date.now() - startTime;

      captureApiError(error, {
        endpoint,
        method,
        duration,
        timestamp: new Date().toISOString(),
      });

      // Return error response
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
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
 * Capture a message to Sentry (for non-error events)
 * Usage: captureSentryMessage('User triggered action X', 'info', { actionId: '123' })
 */
export function captureSentryMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
): void {
  if (context) {
    Sentry.setContext('message_context', context);
  }

  Sentry.captureMessage(message, level);
  console.log(`${ICONS.INFO} [Sentry] Message captured: ${message}`);
}

/**
 * Get current Sentry user context (for debugging)
 */
export function getCurrentSentryContext() {
  return Sentry.getCurrentScope();
}
