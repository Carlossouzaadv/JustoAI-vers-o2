// ================================================================
// JUDIT SERVICE - Base HTTP Client
// ================================================================
// Simple and direct HTTP client for JUDIT API
//
// RESPONSIBILITIES:
// - Direct HTTP requests to JUDIT API endpoints
// - Basic error handling and logging
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

// Simple inline logger to avoid external dependencies
const juditLogger = {
  info: (msg: any, data?: any) => console.log(`[JUDIT]`, msg, data || ''),
  error: (msg: any, data?: any) => console.error(`[JUDIT-ERROR]`, msg, data || ''),
  warn: (msg: any, data?: any) => console.warn(`[JUDIT-WARN]`, msg, data || ''),
  debug: (msg: any, data?: any) => console.debug(`[JUDIT-DEBUG]`, msg, data || ''),
};
const logOperationStart = (name: any, data?: any) => console.log(`[OPERATION] Starting`, name, data || '');

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
export interface JuditApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
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
  [key: string]: any;
}

/**
 * Status check response
 */
export interface StatusResponse {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  [key: string]: any;
}

// ================================================================
// CONFIGURATION AND VALIDATION
// ================================================================

/**
 * Get JUDIT API configuration with inline validation
 *
 * VALIDATION RULES:
 * - JUDIT_API_KEY: warn if missing (don't throw error)
 * - JUDIT_API_BASE_URL: use fallback if missing
 */
function getJuditConfig(): JuditConfig {
  // Get base URL with fallback
  const baseUrl = process.env.JUDIT_API_BASE_URL || 'https://api.judit.ai/v1';

  // Warn if using fallback
  if (!process.env.JUDIT_API_BASE_URL) {
    juditLogger.warn({
      action: 'config_warning',
      message: 'JUDIT_API_BASE_URL not set, using fallback',
      fallback: baseUrl,
    });
  }

  // Get API key
  const apiKey = process.env.JUDIT_API_KEY || '';

  // Warn if API key is missing (but don't throw)
  if (!apiKey) {
    juditLogger.warn({
      action: 'config_warning',
      message: 'JUDIT_API_KEY not set - API calls will fail',
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
export async function sendRequest<T = any>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  options?: RequestOptions
): Promise<JuditApiResponse<T>> {
  const config = getJuditConfig();

  // Validate API key is present
  if (!config.apiKey) {
    juditLogger.error({
      action: 'send_request_failed',
      endpoint,
      method,
      error: 'JUDIT_API_KEY not configured',
    });

    return {
      success: false,
      error: 'JUDIT_API_KEY not configured. Set JUDIT_API_KEY environment variable.',
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
    juditLogger.debug({
      action: 'send_request_start',
      method,
      endpoint,
      url,
      has_body: !!body,
    });

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
      juditLogger.warn({
        action: 'non_json_response',
        endpoint,
        status: response.status,
        content_type: contentType,
        response_preview: text.substring(0, 200),
      });
    }

    // Check if request was successful
    if (!response.ok) {
      const duration = operation.finish('failure', {
        status_code: response.status,
        status_text: response.statusText,
      });

      juditLogger.error({
        action: 'send_request_error',
        endpoint,
        method,
        status_code: response.status,
        status_text: response.statusText,
        duration_ms: duration,
      });

      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        data,
      };
    }

    // Success
    const duration = operation.finish('success');

    juditLogger.info({
      action: 'send_request_success',
      endpoint,
      method,
      status_code: response.status,
      duration_ms: duration,
    });

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
        error: 'Request timeout',
        timeout_ms: timeout,
      });

      juditLogger.error({
        action: 'send_request_timeout',
        endpoint,
        method,
        timeout_ms: timeout,
        duration_ms: duration,
      });

      return {
        success: false,
        error: `Request timeout after ${timeout}ms`,
        statusCode: 0,
      };
    }

    // Handle other errors
    const duration = operation.finish('failure', {
      error: error instanceof Error ? error.message : String(error),
    });

    juditLogger.error({
      action: 'send_request_error',
      endpoint,
      method,
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
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
  juditLogger.info({
    action: 'create_onboarding_start',
    cnj,
    with_attachments: withAttachments,
  });

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
    payload
  );

  if (response.success && response.data) {
    juditLogger.info({
      action: 'create_onboarding_success',
      cnj,
      request_id: response.data.request_id,
      status: response.data.status,
    });
  } else {
    juditLogger.error({
      action: 'create_onboarding_failed',
      cnj,
      error: response.error,
    });
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
  juditLogger.debug({
    action: 'get_onboarding_status',
    request_id: requestId,
  });

  const response = await sendRequest<StatusResponse>(
    `/requests/${requestId}`,
    'GET'
  );

  if (response.success && response.data) {
    juditLogger.debug({
      action: 'get_onboarding_status_success',
      request_id: requestId,
      status: response.data.status,
    });
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
): Promise<JuditApiResponse<any>> {
  juditLogger.info({
    action: 'process_document_start',
    document_type: typeof document,
  });

  // TODO: Implement document processing
  // This could involve:
  // - Extracting CNJ from document
  // - Uploading document to JUDIT
  // - Analyzing document content
  // - Extracting structured data

  juditLogger.warn({
    action: 'process_document_not_implemented',
    message: 'Document processing not yet implemented',
  });

  return {
    success: false,
    error: 'Document processing not yet implemented',
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
  error?: string;
}> {
  const configStatus = checkConfiguration();

  if (!configStatus.configured) {
    return {
      success: false,
      configured: false,
      reachable: false,
      error: 'JUDIT API not configured. Set JUDIT_API_KEY and JUDIT_API_BASE_URL.',
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
    error: response.error,
  };
}

// ================================================================
// EXPORTS
// ================================================================

export default {
  sendRequest,
  createOnboarding,
  getOnboardingStatus,
  processDocument,
  checkConfiguration,
  testConnection,
};
