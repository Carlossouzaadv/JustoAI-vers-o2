// ================================================================
// RATE LIMITER - Token Bucket & Exponential Backoff
// ================================================================
// Implementa controle de taxa para API Judit com retry inteligente

import { ICONS } from './icons';
import { log, logError } from '@/lib/services/logger';

export interface RateLimiterOptions {
  maxTokens: number; // Máximo de tokens no bucket
  refillRate: number; // Tokens por minuto
  initialTokens?: number; // Tokens iniciais
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // em ms
  maxDelay: number; // em ms
  jitter: boolean;
}

export interface ApiCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempt: number;
  totalDelay: number;
}

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per minute

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxTokens;
    this.refillRate = options.refillRate;
    this.tokens = options.initialTokens ?? options.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Tenta consumir um token
   */
  async consume(tokens: number = 1): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      log.info({ msg: "Token consumido. Restantes: /" });
      return true;
    }

    log.info({ msg: "Rate limit atingido. Tokens disponíveis: , necessários:" });
    return false;
  }

  /**
   * Calcula tempo de espera até próximo token disponível
   */
  getWaitTime(tokens: number = 1): number {
    this.refill();

    if (this.tokens >= tokens) {
      return 0;
    }

    const tokensNeeded = tokens - this.tokens;
    const waitTimeMs = (tokensNeeded / this.refillRate) * 60 * 1000;

    return Math.ceil(waitTimeMs);
  }

  /**
   * Reabastece tokens baseado no tempo passado
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor((timePassed / (60 * 1000)) * this.refillRate);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Obtém status atual do rate limiter
   */
  getStatus() {
    this.refill();
    return {
      tokens: this.tokens,
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
      utilizationPercent: Math.round((this.tokens / this.maxTokens) * 100)
    };
  }
}

/**
 * Retry com Exponential Backoff + Jitter
 */
export class ExponentialBackoffRetry {
  private readonly options: RetryOptions;

  constructor(options: RetryOptions) {
    this.options = options;
  }

  /**
   * Executa função com retry automático
   */
  async execute<T>(
    fn: () => Promise<T>,
    context: string = 'API call'
  ): Promise<ApiCallResult<T>> {
    let lastError: Error | undefined;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        log.info({ msg: "- Tentativa /" });

        const result = await fn();

        log.info({ msg: "- Sucesso na tentativa" });
        return {
          success: true,
          data: result,
          attempt,
          totalDelay
        };

      } catch (_error) {
        lastError = _error instanceof Error ? _error : new Error(String(_error));
        log.info({ msg: "- Falha na tentativa :" });

        // Se não é a última tentativa, esperar antes de tentar novamente
        if (attempt < this.options.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          totalDelay += delay;

          log.info({ msg: "Aguardando ms antes da próxima tentativa..." });
          await this.sleep(delay);
        }
      }
    }

    log.info({ msg: "- Todas as tentativas falharam" });
    return {
      success: false,
      error: lastError?.message || 'Erro desconhecido',
      attempt: this.options.maxAttempts,
      totalDelay
    };
  }

  /**
   * Calcula delay com exponential backoff + jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.options.baseDelay * Math.pow(2, attempt - 1);
    let delay = Math.min(exponentialDelay, this.options.maxDelay);

    // Adicionar jitter se habilitado
    if (this.options.jitter) {
      const jitterAmount = delay * 0.1; // 10% de jitter
      const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay = Math.max(0, delay + jitter);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Rate Limited API Client
 */
export class RateLimitedApiClient {
  private rateLimiter: TokenBucketRateLimiter;
  private retryHandler: ExponentialBackoffRetry;

  constructor(
    rateLimiterOptions: RateLimiterOptions,
    retryOptions: RetryOptions
  ) {
    this.rateLimiter = new TokenBucketRateLimiter(rateLimiterOptions);
    this.retryHandler = new ExponentialBackoffRetry(retryOptions);
  }

  /**
   * Executa chamada à API com rate limiting e retry
   */
  async call<T>(
    apiFunction: () => Promise<T>,
    context: string = 'API call',
    tokens: number = 1
  ): Promise<ApiCallResult<T>> {
    // Verificar se há tokens disponíveis
    while (!(await this.rateLimiter.consume(tokens))) {
      const waitTime = this.rateLimiter.getWaitTime(tokens);

      if (waitTime > 0) {
        log.info({ msg: "Rate limit: aguardando ms para" });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Executar com retry
    return await this.retryHandler.execute(apiFunction, context);
  }

  /**
   * Obtém status do rate limiter
   */
  getStatus() {
    return this.rateLimiter.getStatus();
  }
}

// ================================================================
// CONFIGURAÇÕES PRÉ-DEFINIDAS
// ================================================================

/**
 * Rate limiter configurado para API Judit
 */
export function createJuditRateLimiter(): RateLimitedApiClient {
  return new RateLimitedApiClient(
    {
      maxTokens: 60, // 60 chamadas por minuto
      refillRate: 60, // 1 token por segundo
      initialTokens: 60
    },
    {
      maxAttempts: 5,
      baseDelay: 1000, // 1 segundo
      maxDelay: 30000, // 30 segundos
      jitter: true
    }
  );
}

/**
 * Rate limiter mais conservador para produção
 */
export function createConservativeRateLimiter(): RateLimitedApiClient {
  return new RateLimitedApiClient(
    {
      maxTokens: 30,
      refillRate: 30, // 0.5 tokens por segundo
      initialTokens: 10
    },
    {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 60000,
      jitter: true
    }
  );
}

/**
 * Rate limiter para desenvolvimento/testes
 */
export function createDevelopmentRateLimiter(): RateLimitedApiClient {
  return new RateLimitedApiClient(
    {
      maxTokens: 10,
      refillRate: 10,
      initialTokens: 10
    },
    {
      maxAttempts: 2,
      baseDelay: 500,
      maxDelay: 5000,
      jitter: false
    }
  );
}