// ================================================================
// API ERROR HANDLER WITH SENTRY INTEGRATION
// ================================================================
// Use this to wrap your API route handlers for automatic error tracking

import { NextRequest, NextResponse } from 'next/server';
import { captureException, addSentryContext, setSentryUser } from './sentry.server.config';

interface ErrorResponse {
  success: false;
  error: string;
  errorId?: string;
  timestamp: string;
}

interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Wraps API route handlers with automatic error handling and Sentry integration
 *
 * Usage:
 * ```typescript
 * export const POST = withErrorHandler(async (req) => {
 *   return { success: true, data: result };
 * });
 * ```
 */
export function withErrorHandler<T = unknown>(
  handler: (req: NextRequest) => Promise<ApiResponse<T> | NextResponse>,
  options?: {
    logErrors?: boolean;
    captureUserId?: (req: NextRequest) => string | undefined;
  }
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    const errorId = crypto.randomUUID();

    try {
      // Try to extract and set user context
      if (options?.captureUserId) {
        const userId = options.captureUserId(req);
        if (userId) {
          setSentryUser(userId);
        }
      }

      // Add request context to Sentry
      addSentryContext('http_request', {
        method: req.method,
        url: req.url,
        headers: {
          'user-agent': req.headers.get('user-agent'),
          'content-type': req.headers.get('content-type'),
        },
      });

      // Call the actual handler
      const response = await handler(req);

      // Log if it's already a NextResponse
      if (response instanceof NextResponse) {
        return response;
      }

      // Return with timestamp
      const result: ApiResponse<T> = {
        ...response,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(result);
    } catch (error) {
      const duration = Date.now() - startTime;

      if (options?.logErrors !== false) {
        console.error(`[${errorId}] API Error (${duration}ms):`, error);
      }

      // Capture to Sentry
      captureException(error, {
        error_id: errorId,
        endpoint: req.url,
        method: req.method,
        duration_ms: duration,
      });

      // Return error response
      const errorResponse: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        errorId,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(errorResponse, { status: 500 });
    }
  };
}

/**
 * Utility to throw a user-friendly error with HTTP status
 */
export class ApiError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Handle ApiError with appropriate HTTP status
 */
export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  const errorId = crypto.randomUUID();

  if (error instanceof ApiError) {
    console.warn(`[${errorId}] API Client Error (${error.statusCode}):`, error.message);

    captureException(error, {
      type: 'client_error',
      error_id: errorId,
      status_code: error.statusCode,
      ...error.context,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        errorId,
        timestamp: new Date().toISOString(),
      },
      { status: error.statusCode }
    );
  }

  // Handle unexpected errors
  console.error(`[${errorId}] Unexpected Error:`, error);

  captureException(error, {
    error_id: errorId,
    type: 'unexpected_error',
  });

  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error',
      errorId,
      timestamp: new Date().toISOString(),
    },
    { status: 500 }
  );
}
