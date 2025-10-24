// ================================================================
// CLIENTE API JUDIT - Rate Limiting e Circuit Breaker
// ================================================================

import { ICONS } from './icons';
import { prisma } from './prisma';

// ================================================================
// TIPOS E INTERFACES
// ================================================================

export interface JuditRequest {
  search: {
    search_type: 'lawsuit_cnj';
    search_key: string;
  };
  options?: {
    with_attachments?: boolean;
    page_size?: number;
    page?: number;
  };
}

export interface JuditResponse {
  request_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: any;
  error?: string;
  attachments?: any[];
  pages?: number;
  total_results?: number;
}

export interface JuditTracking {
  tracking_id: string;
  process_cnj: string;
  recurrence: string;
  callback_url: string;
  status: 'active' | 'paused' | 'cancelled';
}

export interface JuditTelemetryData {
  workspaceId: string;
  batchId?: string;
  processNumber: string;
  tribunal: string;
  success: boolean;
  responseTimeMs?: number;
  docsRetrieved: number;
  movementsCount: number;
  partiesCount: number;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  rateLimitHit: boolean;
}

export interface JuditApiStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rateLimitHits: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  lastError?: string;
  averageResponseTime: number;
}

// ================================================================
// CONFIGURAÇÕES
// ================================================================

const JUDIT_CONFIG = {
  // URLs de Serviço
  REQUESTS_SERVICE_URL: process.env.JUDIT_REQUESTS_URL || 'https://requests.prod.judit.io',
  TRACKING_SERVICE_URL: process.env.JUDIT_TRACKING_URL || 'https://tracking.prod.judit.io',
  API_KEY: process.env.JUDIT_API_KEY || '',

  // Rate Limiting (180 requests/minute global)
  RATE_LIMIT_PER_MINUTE: 180,
  RATE_LIMIT_WINDOW_MS: 60 * 1000,

  // Batching
  MONITOR_BATCH_SIZE: 500,
  REQUEST_SUBBATCH: 50,
  MAX_CONCURRENT_REQUESTS: 4,

  // Retry & Backoff
  MAX_RETRY_ATTEMPTS: 5,
  BASE_RETRY_DELAY_MS: 1000,
  MAX_RETRY_DELAY_MS: 30000,
  JITTER_FACTOR: 0.1,
  EXPONENTIAL_BASE: 2,

  // Circuit Breaker
  CIRCUIT_BREAKER_THRESHOLD: 10, // % error rate
  CIRCUIT_BREAKER_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  CIRCUIT_BREAKER_OPEN_MS: 10 * 60 * 1000, // 10 minutes
  CIRCUIT_BREAKER_MIN_REQUESTS: 10,
  CIRCUIT_BREAKER_HALF_OPEN_MAX_REQUESTS: 3,

  // Advanced Retry Logic
  RETRY_ON_STATUS_CODES: [429, 500, 502, 503, 504],
  NO_RETRY_STATUS_CODES: [400, 401, 403, 404],
  TIMEOUT_MS: 30000,

  // Polling
  POLLING_INTERVAL_MS: 5000,
  MAX_POLLING_ATTEMPTS: 60, // 5min total

  // Timeouts
  REQUEST_TIMEOUT_MS: 30000,
  POLLING_TIMEOUT_MS: 300000, // 5 minutes

  // Costs (estimados - confirmar com Judit)
  COST_PER_SEARCH: 0.69, // R$ por processo/mês
  COST_PER_ATTACHMENT: 0.25, // R$ por documento
  COST_ONBOARDING_MONTHLY: 3.50, // R$ taxa mensal
} as const;

// ================================================================
// RATE LIMITER
// ================================================================

class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;

  constructor(capacity: number, refillPerMinute: number) {
    this.capacity = capacity;
    this.refillRate = refillPerMinute / 60; // tokens per second
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(tokensNeeded: number = 1): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return true;
    }

    return false;
  }

  async waitForTokens(tokensNeeded: number = 1): Promise<void> {
    while (!(await this.acquire(tokensNeeded))) {
      const timeToWait = Math.ceil(tokensNeeded / this.refillRate * 1000);
      await this.sleep(Math.min(timeToWait, 1000)); // Wait max 1s at a time
    }
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = Math.floor(timePassed * this.refillRate);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

// ================================================================
// CIRCUIT BREAKER
// ================================================================

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private requests: { timestamp: number; success: boolean }[] = [];

  constructor(
    private threshold: number,
    private windowMs: number,
    private openTimeMs: number,
    private minRequests: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.openTimeMs) {
        this.state = 'half-open';
        console.log(`${ICONS.INFO} Circuit breaker moving to half-open state`);
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    this.recordRequest(true);

    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failureCount = 0;
      console.log(`${ICONS.SUCCESS} Circuit breaker closed`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.recordRequest(false);

    const errorRate = this.getErrorRate();
    const totalRequests = this.getRecentRequestCount();

    if (totalRequests >= this.minRequests && errorRate >= this.threshold) {
      this.state = 'open';
      console.error(`${ICONS.ERROR} Circuit breaker opened (error rate: ${errorRate.toFixed(1)}%)`);
    }
  }

  private recordRequest(success: boolean): void {
    const now = Date.now();
    this.requests.push({ timestamp: now, success });

    // Remove old requests outside window
    this.requests = this.requests.filter(req => now - req.timestamp < this.windowMs);
  }

  private getErrorRate(): number {
    const recentRequests = this.requests.filter(req =>
      Date.now() - req.timestamp < this.windowMs
    );

    if (recentRequests.length === 0) return 0;

    const failures = recentRequests.filter(req => !req.success).length;
    return (failures / recentRequests.length) * 100;
  }

  private getRecentRequestCount(): number {
    return this.requests.filter(req =>
      Date.now() - req.timestamp < this.windowMs
    ).length;
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  getStats(): { state: string; errorRate: number; requestCount: number } {
    return {
      state: this.state,
      errorRate: this.getErrorRate(),
      requestCount: this.getRecentRequestCount()
    };
  }
}

// ================================================================
// CLIENTE PRINCIPAL JUDIT API
// ================================================================

export class JuditApiClient {
  private rateLimiter: TokenBucketLimiter;
  private circuitBreaker: CircuitBreaker;
  private stats: JuditApiStats;

  constructor() {
    this.rateLimiter = new TokenBucketLimiter(
      JUDIT_CONFIG.RATE_LIMIT_PER_MINUTE,
      JUDIT_CONFIG.RATE_LIMIT_PER_MINUTE
    );

    this.circuitBreaker = new CircuitBreaker(
      JUDIT_CONFIG.CIRCUIT_BREAKER_THRESHOLD,
      JUDIT_CONFIG.CIRCUIT_BREAKER_WINDOW_MS,
      JUDIT_CONFIG.CIRCUIT_BREAKER_OPEN_MS,
      JUDIT_CONFIG.CIRCUIT_BREAKER_MIN_REQUESTS
    );

    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rateLimitHits: 0,
      circuitBreakerState: 'closed',
      averageResponseTime: 0
    };
  }

  // ================================================================
  // TRACKING API (PREFERENCIAL)
  // ================================================================

  /**
   * Cria tracking para processo (webhook automático)
   */
  async createTracking(processNumber: string, callbackUrl: string): Promise<JuditTracking> {
    console.log(`${ICONS.PROCESS} Creating Judit tracking for process ${processNumber}`);

    return await this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForTokens(1);

      const startTime = Date.now();
      const response = await this.makeRequest('POST', 'tracking', '/tracking', {
        process_cnj: processNumber,
        recurrence: '1 day',
        callback_url: callbackUrl,
        options: {
          include_movements: true,
          include_parties: true
        }
      });

      this.updateStats(true, Date.now() - startTime);

      return {
        tracking_id: response.tracking_id,
        process_cnj: processNumber,
        recurrence: '1 day',
        callback_url: callbackUrl,
        status: 'active'
      };
    });
  }

  /**
   * Lista trackings ativos
   */
  async listTrackings(): Promise<JuditTracking[]> {
    return await this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForTokens(1);

      const startTime = Date.now();
      const response = await this.makeRequest('GET', 'tracking', '/tracking');

      this.updateStats(true, Date.now() - startTime);

      return response.trackings || [];
    });
  }

  /**
   * Remove tracking
   */
  async removeTracking(trackingId: string): Promise<void> {
    return await this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForTokens(1);

      const startTime = Date.now();
      await this.makeRequest('DELETE', 'tracking', `/tracking/${trackingId}`);

      this.updateStats(true, Date.now() - startTime);
    });
  }

  // ================================================================
  // REQUESTS API (POLLING)
  // ================================================================

  /**
   * Busca processos em lote (fallback quando tracking não disponível)
   */
  async searchProcessesBatch(
    processNumbers: string[],
    workspaceId: string,
    batchId?: string,
    withAttachments = false
  ): Promise<{ requestId: string; processNumber: string }[]> {
    console.log(`${ICONS.PROCESS} Searching ${processNumbers.length} processes in batch`);

    const requests: { requestId: string; processNumber: string }[] = [];

    // Quebrar em subbatches para respeitar rate limit
    const subbatches = this.chunkArray(processNumbers, JUDIT_CONFIG.REQUEST_SUBBATCH);

    for (let i = 0; i < subbatches.length; i++) {
      const subbatch = subbatches[i];
      console.log(`${ICONS.INFO} Processing subbatch ${i + 1}/${subbatches.length} (${subbatch.length} processes)`);

      // Processar subbatch com concorrência limitada
      const subbatchPromises = subbatch.map(processNumber =>
        this.createSearchRequest(processNumber, withAttachments, workspaceId, batchId)
      );

      const subbatchResults = await Promise.allSettled(subbatchPromises);

      subbatchResults.forEach((result, index) => {
        const processNumber = subbatch[index];
        if (result.status === 'fulfilled') {
          requests.push({ requestId: result.value, processNumber });
        } else {
          console.error(`${ICONS.ERROR} Failed to create request for ${processNumber}:`, result.reason);
          // Registrar telemetria de erro
          this.recordTelemetry({
            workspaceId,
            batchId,
            processNumber,
            tribunal: 'unknown',
            success: false,
            docsRetrieved: 0,
            movementsCount: 0,
            partiesCount: 0,
            errorMessage: result.reason?.message || 'Request creation failed',
            retryCount: 0,
            rateLimitHit: false
          });
        }
      });

      // Pausa entre subbatches para distribuir carga
      if (i < subbatches.length - 1) {
        await this.sleep(2000);
      }
    }

    return requests;
  }

  /**
   * Cria request individual para processo
   */
  private async createSearchRequest(
    processNumber: string,
    withAttachments: boolean,
    workspaceId: string,
    batchId?: string
  ): Promise<string> {
    return await this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForTokens(1);

      const startTime = Date.now();
      const requestData: JuditRequest = {
        search: {
          search_type: 'lawsuit_cnj',
          search_key: processNumber
        },
        options: {
          with_attachments: withAttachments,
          page_size: 100
        }
      };

      const response = await this.makeRequest('POST', 'requests', '/requests', requestData);
      const responseTime = Date.now() - startTime;

      this.updateStats(true, responseTime);

      // Registrar telemetria de sucesso na criação
      this.recordTelemetry({
        workspaceId,
        batchId,
        processNumber,
        tribunal: this.extractTribunal(processNumber),
        success: true,
        responseTimeMs: responseTime,
        docsRetrieved: 0, // Será atualizado no polling
        movementsCount: 0, // Será atualizado no polling
        partiesCount: 0, // Será atualizado no polling
        retryCount: 0,
        rateLimitHit: false
      });

      return response.request_id;
    });
  }

  /**
   * Faz polling para obter resultado de request
   */
  async pollForResult(
    requestId: string,
    processNumber: string,
    workspaceId: string,
    batchId?: string
  ): Promise<JuditResponse> {
    console.log(`${ICONS.PROCESS} Polling for result: ${requestId}`);

    let attempts = 0;
    const maxAttempts = JUDIT_CONFIG.MAX_POLLING_ATTEMPTS;

    while (attempts < maxAttempts) {
      try {
        await this.rateLimiter.waitForTokens(1);

        const startTime = Date.now();
        const response = await this.makeRequest('GET', 'requests', `/responses?request_id=${requestId}&page_size=100`);
        const responseTime = Date.now() - startTime;

        this.updateStats(true, responseTime);

        if (response.status === 'completed') {
          console.log(`${ICONS.SUCCESS} Request completed: ${requestId}`);

          // Registrar telemetria de conclusão
          this.recordTelemetry({
            workspaceId,
            batchId,
            processNumber,
            tribunal: this.extractTribunal(processNumber),
            success: true,
            responseTimeMs: responseTime,
            docsRetrieved: response.attachments?.length || 0,
            movementsCount: response.data?.movimentacoes?.length || 0,
            partiesCount: response.data?.partes?.length || 0,
            retryCount: attempts,
            rateLimitHit: false
          });

          return response;
        }

        if (response.status === 'failed') {
          throw new Error(`Request failed: ${response.error}`);
        }

        // Request ainda processando, aguardar
        attempts++;
        if (attempts < maxAttempts) {
          await this.sleep(JUDIT_CONFIG.POLLING_INTERVAL_MS);
        }

      } catch (error) {
        console.error(`${ICONS.ERROR} Polling attempt ${attempts + 1} failed:`, error);

        // Registrar telemetria de erro
        this.recordTelemetry({
          workspaceId,
          batchId,
          processNumber,
          tribunal: this.extractTribunal(processNumber),
          success: false,
          docsRetrieved: 0,
          movementsCount: 0,
          partiesCount: 0,
          errorMessage: error instanceof Error ? error.message : 'Polling failed',
          retryCount: attempts,
          rateLimitHit: false
        });

        attempts++;
        if (attempts < maxAttempts) {
          const delay = this.calculateBackoffDelay(attempts);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Polling timeout after ${maxAttempts} attempts for request ${requestId}`);
  }

  /**
   * Busca com attachments (custo adicional)
   */
  async searchWithAttachments(
    processNumber: string,
    workspaceId: string
  ): Promise<JuditResponse> {
    console.log(`${ICONS.WARNING} Searching with attachments (additional cost): ${processNumber}`);

    // Confirmar se workspace tem permissão/créditos para attachments
    const hasPermission = await this.checkAttachmentPermission(workspaceId);
    if (!hasPermission) {
      throw new Error('Workspace não tem permissão para baixar anexos');
    }

    const requestId = await this.createSearchRequest(processNumber, true, workspaceId);
    return await this.pollForResult(requestId, processNumber, workspaceId);
  }

  // ================================================================
  // UTILIDADES PRIVADAS
  // ================================================================

  /**
   * Método genérico POST
   */
  async post<T = any>(serviceUrl: 'requests' | 'tracking', endpoint: string, data: any): Promise<T> {
    return await this.makeRequest('POST', serviceUrl, endpoint, data);
  }

  /**
   * Método genérico GET
   */
  async get<T = any>(serviceUrl: 'requests' | 'tracking', endpoint: string): Promise<T> {
    return await this.makeRequest('GET', serviceUrl, endpoint);
  }

  /**
   * Método genérico DELETE
   */
  async delete<T = any>(serviceUrl: 'requests' | 'tracking', endpoint: string): Promise<T> {
    return await this.makeRequest('DELETE', serviceUrl, endpoint);
  }

  // ================================================================
  // MÉTODOS PRIVADOS DE REQUISIÇÃO
  // ================================================================

  /**
   * Headers padrão para requisições JUDIT
   */
  private getDefaultHeaders(attempt: number = 1): Record<string, string> {
    if (!JUDIT_CONFIG.API_KEY) {
      throw new Error('JUDIT_API_KEY não configurada. Configure a variável de ambiente JUDIT_API_KEY.');
    }

    return {
      'Content-Type': 'application/json',
      'api-key': JUDIT_CONFIG.API_KEY,
      'User-Agent': 'JustoAI/2.0',
      'X-Request-Attempt': attempt.toString()
    };
  }

  private async makeRequest(
    method: string,
    serviceUrl: 'requests' | 'tracking',
    endpoint: string,
    data?: any
  ): Promise<any> {
    return await this.executeWithRetry(async (attempt: number) => {
      const baseUrl = serviceUrl === 'tracking'
        ? JUDIT_CONFIG.TRACKING_SERVICE_URL
        : JUDIT_CONFIG.REQUESTS_SERVICE_URL;

      const url = `${baseUrl}${endpoint}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), JUDIT_CONFIG.TIMEOUT_MS);

      try {
        const options: RequestInit = {
          method,
          headers: this.getDefaultHeaders(attempt),
          signal: controller.signal
        };

        if (data && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        clearTimeout(timeoutId);

        // Handle rate limiting
        if (response.status === 429) {
          this.stats.rateLimitHits++;
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.calculateBackoffDelay(attempt);

          console.warn(`${ICONS.WARNING} Rate limit hit, retrying after ${delay}ms (attempt ${attempt})`);

          const error = new Error('Rate limit exceeded');
          (error as any).retryable = true;
          (error as any).retryAfter = delay;
          throw error;
        }

        // ============================================================
        // IMPORTANTE: Ler o response body UMA VEZ
        // Fetch API não permite consumir o stream múltiplas vezes
        // ============================================================
        let responseBody: any;
        let responseText: string = '';

        try {
          // Primeiro, tentar parsear como JSON
          responseBody = await response.json();
          responseText = JSON.stringify(responseBody);
        } catch (parseError) {
          // Se JSON falhar, ler como texto
          // Neste ponto, o stream pode estar parcialmente consumido
          // Então fazemos um fallback para texto bruto
          responseText = `[JSON Parse Error: ${parseError instanceof Error ? parseError.message : 'Unknown'}]`;
        }

        // Handle server errors that should be retried
        if (JUDIT_CONFIG.RETRY_ON_STATUS_CODES.includes(response.status as any)) {
          const error = new Error(`HTTP ${response.status}: ${responseText}`);
          (error as any).retryable = true;
          (error as any).statusCode = response.status;
          throw error;
        }

        // Handle client errors that should NOT be retried
        if (JUDIT_CONFIG.NO_RETRY_STATUS_CODES.includes(response.status as any)) {
          const error = new Error(`HTTP ${response.status}: ${responseText}`);
          (error as any).retryable = false;
          (error as any).statusCode = response.status;
          throw error;
        }

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${responseText}`);
          (error as any).retryable = response.status >= 500; // Retry server errors
          (error as any).statusCode = response.status;
          throw error;
        }

        // Se chegou aqui, response.ok é true e temos o body parseado
        return responseBody;

      } catch (error) {
        clearTimeout(timeoutId);

        // Handle timeout
        if (error instanceof Error && error.name === 'AbortError') {
          const timeoutError = new Error('Request timeout');
          (timeoutError as any).retryable = true;
          (timeoutError as any).isTimeout = true;
          throw timeoutError;
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const networkError = new Error('Network error');
          (networkError as any).retryable = true;
          (networkError as any).isNetworkError = true;
          throw networkError;
        }

        throw error;
      }
    });
  }

  private async executeWithRetry<T>(operation: (attempt: number) => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= JUDIT_CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        const isRetryable = (error as any).retryable !== false;
        const isLastAttempt = attempt === JUDIT_CONFIG.MAX_RETRY_ATTEMPTS;

        if (!isRetryable || isLastAttempt) {
          console.error(`${ICONS.ERROR} Non-retryable error or max attempts reached:`, error);
          throw error;
        }

        // Calculate delay
        let delay: number;
        if ((error as any).retryAfter) {
          delay = (error as any).retryAfter;
        } else {
          delay = this.calculateAdvancedBackoffDelay(attempt, error as any);
        }

        console.warn(`${ICONS.WARNING} Attempt ${attempt} failed, retrying in ${delay}ms:`, {
          error: error instanceof Error ? error.message : String(error),
          attempt,
          maxAttempts: JUDIT_CONFIG.MAX_RETRY_ATTEMPTS,
          delay
        });

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = JUDIT_CONFIG.BASE_RETRY_DELAY_MS;
    const maxDelay = JUDIT_CONFIG.MAX_RETRY_DELAY_MS;
    const jitter = JUDIT_CONFIG.JITTER_FACTOR;

    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitterAmount = exponentialDelay * jitter * Math.random();

    return Math.floor(exponentialDelay + jitterAmount);
  }

  private calculateAdvancedBackoffDelay(attempt: number, error: any): number {
    let baseDelay = JUDIT_CONFIG.BASE_RETRY_DELAY_MS;

    // Adjust base delay based on error type
    if (error.isTimeout) {
      // Longer delays for timeouts
      baseDelay *= 2;
    } else if (error.isNetworkError) {
      // Moderate delays for network errors
      baseDelay *= 1.5;
    } else if (error.statusCode === 503) {
      // Service unavailable - longer delays
      baseDelay *= 3;
    } else if (error.statusCode === 502 || error.statusCode === 504) {
      // Gateway errors - moderate delays
      baseDelay *= 2;
    }

    // Apply exponential backoff with configurable base
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(JUDIT_CONFIG.EXPONENTIAL_BASE, attempt - 1),
      JUDIT_CONFIG.MAX_RETRY_DELAY_MS
    );

    // Add jitter to prevent thundering herd
    const jitterAmount = exponentialDelay * JUDIT_CONFIG.JITTER_FACTOR * (Math.random() - 0.5);

    return Math.max(100, Math.floor(exponentialDelay + jitterAmount));
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateStats(success: boolean, responseTime: number): void {
    this.stats.totalCalls++;
    this.stats.circuitBreakerState = this.circuitBreaker.getState();

    if (success) {
      this.stats.successfulCalls++;
    } else {
      this.stats.failedCalls++;
    }

    // Update average response time (running average)
    const totalSuccessful = this.stats.successfulCalls;
    this.stats.averageResponseTime = (
      (this.stats.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful
    );
  }

  private async recordTelemetry(data: JuditTelemetryData): Promise<void> {
    try {
      await prisma.juditTelemetry.create({
        data: {
          workspaceId: data.workspaceId,
          batchId: data.batchId,
          processNumber: data.processNumber,
          tribunal: data.tribunal,
          success: data.success,
          responseTimeMs: data.responseTimeMs,
          docsRetrieved: data.docsRetrieved,
          movementsCount: data.movementsCount,
          partiesCount: data.partiesCount,
          errorCode: data.errorCode,
          errorMessage: data.errorMessage,
          retryCount: data.retryCount,
          rateLimitHit: data.rateLimitHit
        }
      });
    } catch (error) {
      console.error(`${ICONS.ERROR} Failed to record telemetry:`, error);
    }
  }

  private extractTribunal(processNumber: string): string {
    // Extrair tribunal do número CNJ (exemplo: 1234567-12.2023.8.09.0001)
    const matches = processNumber.match(/\.(\d{1,2})\./);
    return matches ? `TR${matches[1]}` : 'UNKNOWN';
  }

  private async checkAttachmentPermission(workspaceId: string): Promise<boolean> {
    // TODO: Implementar verificação de permissão/créditos para attachments
    // Por enquanto, sempre permitir
    return true;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // ================================================================
  // API PÚBLICA DE ESTATÍSTICAS
  // ================================================================

  getStats(): JuditApiStats {
    return {
      ...this.stats,
      circuitBreakerState: this.circuitBreaker.getState()
    };
  }

  getRateLimiterStatus(): { availableTokens: number; capacity: number } {
    return {
      availableTokens: this.rateLimiter.getAvailableTokens(),
      capacity: JUDIT_CONFIG.RATE_LIMIT_PER_MINUTE
    };
  }

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Estimativa de custos
   */
  calculateCosts(processCount: number, withAttachments = false): {
    searchCost: number;
    attachmentCost: number;
    totalCost: number;
  } {
    const searchCost = processCount * JUDIT_CONFIG.COST_PER_SEARCH;
    const attachmentCost = withAttachments ? processCount * JUDIT_CONFIG.COST_PER_ATTACHMENT : 0;

    return {
      searchCost,
      attachmentCost,
      totalCost: searchCost + attachmentCost
    };
  }
}

// ================================================================
// SINGLETON GLOBAL
// ================================================================

let juditClient: JuditApiClient | null = null;

export function getJuditApiClient(): JuditApiClient {
  if (!juditClient) {
    juditClient = new JuditApiClient();
  }
  return juditClient;
}

export default JuditApiClient;