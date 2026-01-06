// ================================================================
// API ERROR HANDLER - Standardized Error Handling for API Routes
// ================================================================
// Provides consistent error handling, logging, and response formatting
// for all API routes in the application

import { NextRequest, NextResponse } from 'next/server';
import { log, logError } from '@/lib/services/logger';

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
    error: string;
    code?: string;
    details?: string;
    requestId?: string;
}

/**
 * API Handler function type
 */
export type ApiHandler<T = unknown> = (
    request: NextRequest,
    context?: { params: Record<string, string> }
) => Promise<NextResponse<T | ApiErrorResponse>>;

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
    /** Custom error messages by status code */
    errorMessages?: Record<number, string>;
    /** Whether to include stack traces in development */
    includeStackInDev?: boolean;
    /** Custom logging function */
    customLogger?: (error: unknown, context: Record<string, unknown>) => void;
}

/**
 * Creates a wrapped API handler with standardized error handling
 * 
 * @example
 * ```ts
 * // In your API route
 * export const GET = withErrorHandler(async (request) => {
 *   const data = await fetchData();
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withErrorHandler<T = unknown>(
    handler: ApiHandler<T>,
    options: ErrorHandlerOptions = {}
): ApiHandler<T> {
    return async (request: NextRequest, context?: { params: Record<string, string> }) => {
        const startTime = Date.now();
        const requestId = crypto.randomUUID().substring(0, 8);

        try {
            // Log request start
            log.debug({
                msg: 'API request started',
                component: 'api',
                requestId,
                method: request.method,
                url: request.url,
            });

            // Execute the actual handler
            const response = await handler(request, context);

            // Log successful completion
            log.debug({
                msg: 'API request completed',
                component: 'api',
                requestId,
                method: request.method,
                url: request.url,
                duration_ms: Date.now() - startTime,
                status: response.status,
            });

            return response;

        } catch (error) {
            // Determine error details
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;

            // Log the error
            logError(error, 'API route error', {
                component: 'api',
                requestId,
                method: request.method,
                url: request.url,
                duration_ms: Date.now() - startTime,
            });

            // Use custom logger if provided
            if (options.customLogger) {
                options.customLogger(error, {
                    requestId,
                    method: request.method,
                    url: request.url,
                });
            }

            // Determine appropriate status code
            let statusCode = 500;
            if (error instanceof Error) {
                if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
                    statusCode = 401;
                } else if (error.message.includes('forbidden') || error.message.includes('Forbidden')) {
                    statusCode = 403;
                } else if (error.message.includes('not found') || error.message.includes('Not found')) {
                    statusCode = 404;
                } else if (error.message.includes('validation') || error.message.includes('invalid')) {
                    statusCode = 400;
                } else if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
                    statusCode = 429;
                }
            }

            // Build error response
            const errorResponse: ApiErrorResponse = {
                error: options.errorMessages?.[statusCode] || getDefaultErrorMessage(statusCode),
                requestId,
            };

            // Include details in development
            if (process.env.NODE_ENV === 'development') {
                errorResponse.details = errorMessage;
                if (options.includeStackInDev && errorStack) {
                    errorResponse.code = 'DEV_STACK_TRACE';
                }
            }

            return NextResponse.json(errorResponse, { status: statusCode });
        }
    };
}

/**
 * Gets default error message for status code
 */
function getDefaultErrorMessage(statusCode: number): string {
    const messages: Record<number, string> = {
        400: 'Requisição inválida',
        401: 'Não autorizado',
        403: 'Acesso negado',
        404: 'Recurso não encontrado',
        429: 'Muitas requisições. Tente novamente mais tarde.',
        500: 'Erro interno do servidor',
        502: 'Serviço temporariamente indisponível',
        503: 'Serviço em manutenção',
    };

    return messages[statusCode] || 'Erro desconhecido';
}

/**
 * Wrapper for async operations with retry logic
 * Useful for external API calls that may fail transiently
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: {
        maxRetries?: number;
        delayMs?: number;
        backoffMultiplier?: number;
        shouldRetry?: (error: unknown) => boolean;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        delayMs = 1000,
        backoffMultiplier = 2,
        shouldRetry = () => true,
    } = options;

    let lastError: unknown;
    let delay = delayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }

            log.warn({
                msg: `Operation failed, retrying (attempt ${attempt}/${maxRetries})`,
                component: 'api',
                error: error instanceof Error ? error.message : 'Unknown error',
                nextRetryDelayMs: delay,
            });

            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= backoffMultiplier;
        }
    }

    throw lastError;
}

/**
 * Creates a standardized success response
 */
export function successResponse<T>(data: T, status = 200): NextResponse<T> {
    return NextResponse.json(data, { status });
}

/**
 * Creates a standardized error response
 */
export function errorResponse(
    message: string,
    status = 500,
    code?: string
): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
        {
            error: message,
            code,
        },
        { status }
    );
}
