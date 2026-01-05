// Services imported below are used in the juditService module

// ================================================================
// JUDIT SERVICE - Base HTTP Client
// ================================================================
// Simple and direct HTTP client for JUDIT API
//
// RESPONSIBILITIES:
// - Direct HTTP requests to JUDIT API endpoints
// - Basic _error handling and logging
// - Configuration validation
// - Document processing interface
//
// ARCHITECTURE:
// This service provides a lightweight HTTP client for JUDIT API.
// For production use with rate limiting, circuit breaker, and retry
// logic, consider using the full JuditApiClient from lib/judit-api-client.ts
// or the higher-level services:
//   - juditOnboardingService.ts (for complete onboarding workflows)
//   - juditMonitoringService.ts (for tracking and monitoring)
//
// CONFIGURATION:
// Set the following environment variables in your .env file:
//
//   JUDIT_API_BASE_URL=https://api.judit.ai/v1
//   JUDIT_API_KEY=your-api-key-here
//   LOG_LEVEL=debug
//
// TESTING WITHOUT MOCKS:
// To test with real API calls:
//   1. Ensure JUDIT_API_KEY is set in .env
//   2. Use a valid CNJ number
//   3. Check logs for request/response details
//   4. Monitor costs in JUDIT dashboard
//
// COST AWARENESS:
// - Each onboarding request costs ~R$0.69/process
// - Attachment fetching adds ~R$0.25/document
// - Monitor your usage to control costs
//
// ================================================================

// ================================================================
// LOGGER TYPES AND INTERFACES
// ================================================================

interface LogMessage {
  [key: string]: string | number | boolean | object | undefined;
}

interface Logger {
  info: (_msgOrData: string | LogMessage, _data?: LogMessage) => void;
  error: (_msgOrData: string | LogMessage, _data?: LogMessage) => void;
  warn: (_msgOrData: string | LogMessage, _data?: LogMessage) => void;
  debug: (_msgOrData: string | LogMessage, _data?: LogMessage) => void;
}

interface OperationTracker {
  finish: (_status: string, _details?: LogMessage) => number;
}

// Helper function to normalize logger arguments
function normalizeLogArgs(msgOrData: string | LogMessage, data?: LogMessage): [string, LogMessage] {
  if (typeof msgOrData === 'string') {
    return [msgOrData, data || {}];
  }
  // msgOrData is an object, extract action as message if available
  const action = typeof msgOrData.action === 'string' ? msgOrData.action : 'unknown';
  const message = typeof msgOrData.message === 'string' ? msgOrData.message : action;
  return [message, msgOrData as LogMessage];
}

// Simple inline logger to avoid external dependencies
const juditLogger: Logger = {
  info: (msgOrData: string | LogMessage, data?: LogMessage) => {
    const [msg, logData] = normalizeLogArgs(msgOrData, data);
    console.log(`[JUDIT]`, msg, logData || '');
  },
  error: (msgOrData: string | LogMessage, data?: LogMessage) => {
    const [msg, logData] = normalizeLogArgs(msgOrData, data);
    console.error(`[JUDIT-ERROR]`, msg, logData || '');
  },
  warn: (msgOrData: string | LogMessage, data?: LogMessage) => {
    const [msg, logData] = normalizeLogArgs(msgOrData, data);
    console.warn(`[JUDIT-WARN]`, msg, logData || '');
  },
  debug: (msgOrData: string | LogMessage, data?: LogMessage) => {
    const [msg, logData] = normalizeLogArgs(msgOrData, data);
    console.debug(`[JUDIT-DEBUG]`, msg, logData || '');
  },
};

const logOperationStart = (logger: Logger, name: string, data?: LogMessage): OperationTracker => {
  const startTime = Date.now();
  logger.debug?.(`[OPERATION] Starting ${name}`, data || {});

  return {
    finish: (_status: string, _details?: LogMessage) => {
      const duration = Date.now() - startTime;
      logger.info?.(`[OPERATION] ${name} finished: ${_status}`, { duration_ms: duration, ..._details });
      return duration;
    }
  };
};

// ================================================================
// TYPES AND INTERFACES
// ================================================================

/**
 * Configuration for JUDIT API
 */
export interface JuditConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

/**
 * Generic request options
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

/**
 * Standard API response wrapper
 */
export interface JuditApiResponse<T = Record<string, unknown>> {
  success: boolean;
  data?: T;
  _error?: string;
  statusCode?: number;
}

/**
 * Onboarding request payload
 */
export interface OnboardingPayload {
  search: {
    search_type: 'lawsuit_cnj';
    search_key: string;
    on_demand: boolean;
  };
  with_attachments: boolean;
}

/**
 * Onboarding response from JUDIT
 */
export interface OnboardingResponse {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  [key: string]: unknown;
}

/**
 * Status check response
 */
export interface StatusResponse {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  [key: string]: unknown;
}

// ================================================================
// CONFIGURATION AND VALIDATION
// ================================================================

/**
 * Get JUDIT API configuration with inline validation
 *
 * VALIDATION RULES:
 * - JUDIT_API_KEY: warn if missing (don't throw _error)
 * - JUDIT_API_BASE_URL: use fallback if missing
 */
function getJuditConfig(): JuditConfig {
  // Get base URL with fallback
  const baseUrl = process.env.JUDIT_API_BASE_URL || 'https://api.judit.ai/v1';

  // Warn if using fallback
  if (!process.env.JUDIT_API_BASE_URL) {
    juditLogger.warn('JUDIT_API_BASE_URL not set, using fallback', {
      action: 'config_warning',
      fallback: baseUrl,
    });
  }

  // Get API key
  const apiKey = process.env.JUDIT_API_KEY || '';

  // Warn if API key is missing (but don't throw)
  if (!apiKey) {
    juditLogger.warn('JUDIT_API_KEY not set - API calls will fail', {
      action: 'config_warning',
      hint: 'Set JUDIT_API_KEY environment variable to enable JUDIT integration',
    });
  }

  // Default timeout
  const timeout = parseInt(process.env.JUDIT_TIMEOUT || '30000', 10);

  return {
    baseUrl,
    apiKey,
    timeout,
  };
}

// ================================================================
// CORE HTTP FUNCTIONS
// ================================================================

/**
 * Send HTTP request to JUDIT API
 *
 * @param endpoint - API endpoint (e.g., "/requests", "/tracking")
 * @param method - HTTP method (GET, POST, DELETE, etc.)
 * @param body - Request body (for POST/PUT)
 * @param options - Additional request options
 * @returns Response data
 */
export async function sendRequest<T = Record<string, unknown>>(
  endpoint: string,
  method: string = 'GET',
  body?: Record<string, unknown>,
  options?: RequestOptions
): Promise<JuditApiResponse<T>> {
  const config = getJuditConfig();

  // Validate API key is present
  if (!config.apiKey) {
    juditLogger.error(JSON.stringify({
      action: 'send_request_failed',
      endpoint,
      method,
      _error: 'JUDIT_API_KEY not configured',
    }));

    return {
      success: false,
      _error: 'JUDIT_API_KEY not configured. Set JUDIT_API_KEY environment variable.',
      statusCode: 0,
    };
  }

  // Build full URL
  const url = `${config.baseUrl}${endpoint}`;

  // Start operation timer
  const operation = logOperationStart(juditLogger, 'send_request', {
    endpoint,
    method,
    url,
  });

  // Build request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'api-key': config.apiKey,
    'User-Agent': 'JustoAI/2.0',
    ...options?.headers,
  };

  // Setup timeout
  const timeout = options?.timeout || config.timeout;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    juditLogger.debug(JSON.stringify({
      action: 'send_request_start',
      method,
      endpoint,
      url,
      has_body: !!body,
    }));

    // Make request
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    let data: T | undefined;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Non-JSON response
      const text = await response.text();
      juditLogger.warn(JSON.stringify({
        action: 'non_json_response',
        endpoint,
        status: response.status,
        content_type: contentType ?? 'unknown',
        response_preview: text.substring(0, 200),
      }));
    }

    // Check if request was successful
    if (!response.ok) {
      const duration = operation.finish('failure', {
        status_code: response.status,
        status_text: response.statusText,
      });

      juditLogger.error(JSON.stringify({
        action: 'send_request_error',
        endpoint,
        method,
        status_code: response.status,
        status_text: response.statusText,
        duration_ms: duration,
      }));

      return {
        success: false,
        _error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        data,
      };
    }

    // Success
    const duration = operation.finish('success');

    juditLogger.info(JSON.stringify({
      action: 'send_request_success',
      endpoint,
      method,
      status_code: response.status,
      duration_ms: duration,
    }));

    return {
      success: true,
      data,
      statusCode: response.status,
    };

  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      const duration = operation.finish('failure', {
        _error: 'Request timeout',
        timeout_ms: timeout,
      });

      juditLogger.error(JSON.stringify({
        action: 'send_request_timeout',
        endpoint,
        method,
        timeout_ms: timeout,
        duration_ms: duration,
      }));

      return {
        success: false,
        _error: `Request timeout after ${timeout}ms`,
        statusCode: 0,
      };
    }

    // Handle other errors
    const duration = operation.finish('failure', {
      _error: error instanceof Error ? error.message : String(error),
    });

    juditLogger.error(JSON.stringify({
      action: 'send_request_error',
      endpoint,
      method,
      _error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
    }));

    return {
      success: false,
      _error: error instanceof Error ? error.message : 'Unknown error occurred',
      statusCode: 0,
    };
  }
}

// ================================================================
// HIGH-LEVEL API FUNCTIONS
// ================================================================

/**
 * Create onboarding request for a process
 *
 * COST: ~R$0.69 per process + R$0.25 per document if with_attachments=true
 *
 * @param cnj - CNJ number of the process
 * @param withAttachments - Whether to fetch attachments (additional cost)
 * @returns Onboarding response with request_id
 */
export async function createOnboarding(
  cnj: string,
  withAttachments: boolean = false
): Promise<JuditApiResponse<OnboardingResponse>> {
  juditLogger.info(JSON.stringify({
    action: 'create_onboarding_start',
    cnj,
    with_attachments: withAttachments,
  }));

  // Build payload
  const payload: OnboardingPayload = {
    search: {
      search_type: 'lawsuit_cnj',
      search_key: cnj,
      on_demand: true,
    },
    with_attachments: withAttachments,
  };

  // Send request
  const response = await sendRequest<OnboardingResponse>(
    '/requests',
    'POST',
    payload as unknown as Record<string, unknown>
  );

  if (response.success && response.data) {
    juditLogger.info(JSON.stringify({
      action: 'create_onboarding_success',
      cnj,
      request_id: response.data.request_id,
      status: response.data.status,
    }));
  } else {
    juditLogger.error(JSON.stringify({
      action: 'create_onboarding_failed',
      cnj,
      _error: response._error,
    }));
  }

  return response;
}

/**
 * Get status of an onboarding request
 *
 * @param requestId - Request ID returned from createOnboarding
 * @returns Status response
 */
export async function getOnboardingStatus(
  requestId: string
): Promise<JuditApiResponse<StatusResponse>> {
  juditLogger.debug(JSON.stringify({
    action: 'get_onboarding_status',
    request_id: requestId,
  }));

  const response = await sendRequest<StatusResponse>(
    `/requests/${requestId}`,
    'GET'
  );

  if (response.success && response.data) {
    juditLogger.debug(JSON.stringify({
      action: 'get_onboarding_status_success',
      request_id: requestId,
      status: response.data.status,
    }));
  }

  return response;
}

/**
 * Process a document (PDF or Excel)
 *
 * This is a placeholder for document processing functionality.
 * Implement based on your specific document processing needs.
 *
 * @param document - Document to process (File, Buffer, or path string)
 * @returns Processing result
 */
export async function processDocument(
  document: File | Buffer | string
): Promise<JuditApiResponse<Record<string, unknown>>> {
  juditLogger.info(JSON.stringify({
    action: 'process_document_start',
    document_type: typeof document,
  }));

  // DEFERRED: Document processing implementation
  // This could involve:
  // - Extracting CNJ from document
  // - Uploading document to JUDIT
  // - Analyzing document content
  // - Extracting structured data

  juditLogger.warn(JSON.stringify({
    action: 'process_document_not_implemented',
    message: 'Document processing not yet implemented',
  }));

  return {
    success: false,
    _error: 'Document processing not yet implemented',
  };
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

/**
 * Check if JUDIT API is configured and ready
 *
 * @returns Configuration status
 */
export function checkConfiguration(): {
  configured: boolean;
  hasApiKey: boolean;
  hasBaseUrl: boolean;
  baseUrl: string;
} {
  const config = getJuditConfig();

  return {
    configured: !!config.apiKey && !!config.baseUrl,
    hasApiKey: !!config.apiKey,
    hasBaseUrl: !!process.env.JUDIT_API_BASE_URL,
    baseUrl: config.baseUrl,
  };
}

/**
 * Test JUDIT API connection
 *
 * @returns Connection test result
 */
export async function testConnection(): Promise<{
  success: boolean;
  configured: boolean;
  reachable: boolean;
  _error?: string;
}> {
  const configStatus = checkConfiguration();

  if (!configStatus.configured) {
    return {
      success: false,
      configured: false,
      reachable: false,
      _error: 'JUDIT API not configured. Set JUDIT_API_KEY and JUDIT_API_BASE_URL.',
    };
  }

  // Try to make a simple request (checking if API is reachable)
  // Note: This assumes there's a health check endpoint
  // Adjust based on actual JUDIT API endpoints
  const response = await sendRequest('/health', 'GET');

  return {
    success: response.success,
    configured: true,
    reachable: response.success,
    _error: response._error,
  };
}

// ================================================================
// EXPORTS
// ================================================================

export const juditServiceExports = {
  sendRequest,
  createOnboarding,
  getOnboardingStatus,
  processDocument,
  checkConfiguration,
  testConnection,
};

export default juditServiceExports;
