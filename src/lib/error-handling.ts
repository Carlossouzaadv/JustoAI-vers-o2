import { log, logError } from '@/lib/services/logger';

/**
 * Error Handling Utilities
 * Provides type-safe error handling and message extraction
 */

/**
 * Extracts a meaningful error message from an unknown type
 * Safe to use with any caught exception or error object
 */
export function getErrorMessage(error: unknown): string {
  // Handle null/undefined
  if (error === null || error === undefined) {
    return 'An unknown error occurred';
  }

  // Handle Error instances
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle objects with message property
  if (typeof error === 'object' && 'message' in error) {
    const msg = (error as Record<string, unknown>).message;
    if (typeof msg === 'string') {
      return msg;
    }
  }

  // Handle objects with error property
  if (typeof error === 'object' && 'error' in error) {
    const err = (error as Record<string, unknown>).error;
    if (typeof err === 'string') {
      return err;
    }
    if (err instanceof Error) {
      return err.message;
    }
  }

  // Handle axios/fetch errors
  if (typeof error === 'object' && 'response' in error) {
    const response = (error as Record<string, unknown>).response;
    if (typeof response === 'object' && response !== null) {
      if ('data' in response) {
        const data = (response as Record<string, unknown>).data;
        if (typeof data === 'object' && data !== null && 'message' in data) {
          const msg = (data as Record<string, unknown>).message;
          if (typeof msg === 'string') {
            return msg;
          }
        }
      }
      if ('statusText' in response) {
        const statusText = (response as Record<string, unknown>).statusText;
        if (typeof statusText === 'string') {
          return statusText;
        }
      }
    }
  }

  // Fallback: try to stringify the error
  try {
    return JSON.stringify(error);
  } catch {
    return `An error occurred: ${Object.prototype.toString.call(error)}`;
  }
}

/**
 * Type guard to check if something is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if something is an object with message property
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Safely logs errors while handling unknown types
 */
export function logError(context: string, error: unknown): void {
  console.error(`${context}:`, {
    message: getErrorMessage(error),
    type: typeof error,
    isError: isError(error),
    stack: isError(error) ? error.stack : undefined,
    raw: error
  });
}

/**
 * Safely wraps a function that might throw, returning result or error message
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context = 'Operation'
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (_error) {
    const errorMessage = getErrorMessage(error);
    logError(context, error);
    return { success: false, error: errorMessage };
  }
}
