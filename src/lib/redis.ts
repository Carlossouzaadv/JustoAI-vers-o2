// ================================================================
// REDIS CLIENT - Upstash Redis with Cost Optimization
// ================================================================
// Centralized Redis client with idle-friendly configuration
// Optimized for Railway + Upstash deployment
// Cost: ~$0.20/day for 10 requests/day (REST API)
//       ~$10-15/month for active workers
// ================================================================

import IORedis, { Redis, RedisOptions } from 'ioredis';
import { log, logError } from '@/lib/services/logger';

// Circuit breaker service interface - lazy loaded to avoid circular dependency
interface CircuitBreakerService {
  triggerQuotaExceeded?: (_error: Error) => void;
}

let circuitBreakerService: CircuitBreakerService | null = null;
const getCircuitBreaker = (): CircuitBreakerService | null => {
  if (!circuitBreakerService) {
    try {
      // Using dynamic import to avoid circular dependencies
      import('./services/circuitBreakerService')
        .then((module) => {
          circuitBreakerService = module.circuitBreakerService as CircuitBreakerService;
        })
        .catch(() => {
          // Fallback if circuit breaker not available
          return null;
        });
    } catch {
      // Fallback if circuit breaker not available
      return null;
    }
  }
  return circuitBreakerService;
};

// ================================================================
// CONFIGURATION
// ================================================================

/**
 * Detect deployment environment
 * - Railway workers: process.env.RAILWAY_ENVIRONMENT === 'production' && process.env.WORKER_ENABLED
 * - Vercel web: process.env.VERCEL === '1' || process.env.VERCEL_ENV
 * - Local dev: neither
 */
const IS_WORKER = process.env.WORKER_ENABLED === 'true' || process.env.IS_WORKER === 'true';
const IS_RAILWAY = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const IS_LOCAL = !IS_RAILWAY && !IS_VERCEL;

/**
 * Check if Redis should be disabled (fallback to mock for development)
 * Redis is REQUIRED in production for workers
 * NOTE: Use function to defer env access until runtime (not build time)
 */
const REDIS_DISABLED = () => process.env.REDIS_DISABLED === 'true';
const getRedisURL = () => process.env.REDIS_URL;

/**
 * Upstash Redis Configuration with Cost Optimization
 *
 * TWO MODES:
 *
 * 1. STRICT MODE (Workers on Railway):
 *    - enableOfflineQueue: false (fail fast if can't connect)
 *    - enableReadyCheck: true (wait for connection to be ready)
 *    - Will crash if Redis is unavailable (correct for workers!)
 *
 * 2. GRACEFUL MODE (Web on Vercel, Local dev):
 *    - enableOfflineQueue: true (queue commands during connection)
 *    - enableReadyCheck: true (wait for connection to be ready)
 *    - Will fall back to MockRedis if connection fails
 *
 * Key features for low idle costs:
 * - lazyConnect: true (don't connect until first command)
 * - keepAlive: 30000 (30s instead of default 0)
 * - maxRetriesPerRequest: appropriate to mode
 * - retryStrategy: exponential backoff with max delay
 * - connectTimeout: reasonable timeout
 * - commandTimeout: 5s timeout for commands
 */
const getRedisConfig = (): RedisOptions => {
  // Parse Upstash Redis URL if available
  const REDIS_URL = getRedisURL();
  if (REDIS_URL) {
    // Upstash URLs come in format: rediss://default:password@host:6379
    try {
      const url = new URL(REDIS_URL);

      // Determine strict vs graceful mode
      const isStrictMode = IS_WORKER && IS_RAILWAY;

      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        username: url.username || 'default',

        // TLS Configuration (required for Upstash)
        tls: url.protocol === 'rediss:' ? {} : undefined,

        // Connection Optimization (Low Idle Cost) - OPTIMIZED 2025-10-25
        lazyConnect: true, // Don't connect until first command
        keepAlive: 120000, // INCREASED: 120s (was 60s) - reduces PING requests by ~50%
        connectTimeout: isStrictMode ? 60000 : 60000, // Increased from 30s to 60s (Upstash has ~30s idle timeout)
        commandTimeout: isStrictMode ? 30000 : 30000, // Increased from 15s to 30s for reliability

        // Retry Strategy (Appropriate to mode)
        maxRetriesPerRequest: isStrictMode ? 5 : 5, // Increased from 2 to 5 for workers (more resilient to brief disconnects)
        retryStrategy: (times: number) => {
          // Exponential backoff: 100ms, 200ms, 400ms, ..., max 10s
          const maxDelay = isStrictMode ? 10000 : 10000;
          const delay = Math.min(times * 100, maxDelay);

          // Stop retrying based on mode
          const maxAttempts = isStrictMode ? 10 : 10;
          if (times > maxAttempts) {
            log.error({
              msg: `Max retry attempts reached for Redis (${isStrictMode ? 'strict mode' : 'graceful mode'}), giving up`,
              component: 'redis',
              retries: times,
              mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
            });
            return null; // Stop retrying
          }

          if (times % 3 === 0) {
            // Log every 3rd retry to avoid spam
            log.warn({
              msg: `Redis retry attempt (${isStrictMode ? 'strict' : 'graceful'} mode)`,
              component: 'redis',
              attempt: times,
              delay_ms: delay,
              mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
            });
          }

          return delay;
        },

        // Queue behavior based on mode
        // CRITICAL: Enable offline queue for workers to buffer commands during brief disconnects
        // This prevents failures during Upstash reconnection (happens every ~30-35s)
        enableOfflineQueue: true, // Queue commands if connection drops (was: isStrictMode ? false : true)
        enableReadyCheck: true, // Both modes: wait for READY state
      };
    } catch (_error) {
      logError(error, 'Failed to parse REDIS_URL', { component: 'redis' });
      throw new Error('Invalid REDIS_URL format');
    }
  }

  // Fallback to individual env vars (legacy support)
  const isStrictMode = IS_WORKER && IS_RAILWAY;

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || 'default',

    // Same optimization as above, but with mode-appropriate settings - OPTIMIZED 2025-10-25
    lazyConnect: true,
    keepAlive: 120000, // INCREASED: 120s (was 60s) - reduces PING requests by ~50%
    connectTimeout: 60000, // Increased from 10-30s to 60s for stability
    commandTimeout: 30000, // Increased from 5-15s to 30s for reliability

    maxRetriesPerRequest: 5, // Increased from 2 to 5 for more resilience
    retryStrategy: (times: number) => {
      const maxDelay = 10000; // Increased from 5-10s to 10s
      const delay = Math.min(times * 100, maxDelay);
      const maxAttempts = 10; // Increased from 5-10 to 10

      if (times > maxAttempts) {
        log.error({
          msg: `Max retry attempts reached for Redis (${isStrictMode ? 'strict' : 'graceful'} mode, legacy config)`,
          component: 'redis',
          retries: times,
          mode: isStrictMode ? 'STRICT' : 'GRACEFUL',
          config_source: 'REDIS_HOST/PORT (legacy)'
        });
        return null;
      }
      if (times % 3 === 0) {
        log.warn({
          msg: `Redis retry attempt (${isStrictMode ? 'strict' : 'graceful'} mode, legacy config)`,
          component: 'redis',
          attempt: times,
          delay_ms: delay,
          mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
        });
      }
      return delay;
    },

    enableOfflineQueue: true, // Enable queue for all modes (was: isStrictMode ? false : true)
    enableReadyCheck: true,
  };
};

// ================================================================
// MOCK REDIS (Development/Testing Fallback)
// ================================================================

/**
 * Mock Redis Client for development without Redis
 * WARNING: This should NEVER be used in production with workers
 */
class MockRedis {
  private mockData: Map<string, string> = new Map();

  async get(key: string) {
    log.debug({ msg: `MOCK REDIS GET ${key}`, component: 'redis', key, command: 'GET' });
    return this.mockData.get(key) || null;
  }

  async set(key: string, value: string, ..._args: unknown[]) {
    log.debug({ msg: `MOCK REDIS SET ${key}`, component: 'redis', key, command: 'SET' });
    this.mockData.set(key, value);
    return 'OK';
  }

  async del(key: string) {
    log.debug({ msg: `MOCK REDIS DEL ${key}`, component: 'redis', key, command: 'DEL' });
    return this.mockData.delete(key) ? 1 : 0;
  }

  async ttl(_key: string) {
    return -1; // No TTL in mock
  }

  async expire(_key: string, _seconds: number) {
    return 1; // Always success in mock
  }

  async exists(key: string) {
    return this.mockData.has(key) ? 1 : 0;
  }

  async keys(_pattern: string) {
    return Array.from(this.mockData.keys());
  }

  async setex(key: string, _seconds: number, value: string) {
    log.debug({ msg: `MOCK REDIS SETEX ${key}`, component: 'redis', key, command: 'SETEX' });
    this.mockData.set(key, value);
    return 'OK';
  }

  async call(_command: string, ..._args: unknown[]) {
    log.debug({ msg: `MOCK REDIS CALL ${_command}`, component: 'redis', command: _command });
    return 0; // Mock response for MEMORY USAGE
  }

  async ping() {
    return 'PONG';
  }

  async quit() {
    this.mockData.clear();
    return 'OK';
  }

  async disconnect() {
    this.mockData.clear();
  }

  on() { return this; }
  once() { return this; }
  off() { return this; }

  // BullMQ compatibility
  async hgetall() { return {}; }
  async hset() { return 1; }
  async zadd() { return 1; }
  async zrange() { return []; }
  async zrem() { return 1; }
}

// ================================================================
// REDIS CLIENT SINGLETON
// ================================================================

let redisClient: Redis | MockRedis | null = null;

/**
 * Get Redis client instance (singleton)
 *
 * @returns Redis client (real or mock)
 */
export const getRedisClient = (): Redis | MockRedis => {
  if (redisClient) {
    return redisClient;
  }

  // Check if Redis should be disabled
  if (REDIS_DISABLED()) {
    log.warn({
      msg: 'Running in MOCK mode (REDIS_DISABLED=true) - Workers and queues will NOT function properly',
      component: 'redis',
      mode: 'mock'
    });
    redisClient = new MockRedis();
    return redisClient;
  }

  // Check if REDIS_URL is configured
  const REDIS_URL = getRedisURL();
  if (!REDIS_URL && !process.env.REDIS_HOST) {
    log.warn({
      msg: 'No REDIS_URL or REDIS_HOST configured - Falling back to MOCK mode for development',
      component: 'redis',
      mode: 'mock'
    });
    redisClient = new MockRedis();
    return redisClient;
  }

  // Create real Redis client
  const isStrictMode = IS_WORKER && IS_RAILWAY;

  log.info({
    msg: 'Initializing Redis client',
    component: 'redis',
    config_source: REDIS_URL ? 'REDIS_URL' : 'REDIS_HOST/PORT',
    mode: isStrictMode ? 'STRICT (Workers)' : 'GRACEFUL (Web/Dev)',
    is_worker: IS_WORKER,
    is_railway: IS_RAILWAY,
    is_vercel: IS_VERCEL,
    is_local: IS_LOCAL
  });

  const config = getRedisConfig();
  const client = new IORedis(config);

  // ================================================================
  // EVENT HANDLERS (Observability)
  // ================================================================

  client.on('connect', () => {
    log.info({ msg: 'Connected to Redis', component: 'redis', event: 'connect', mode: isStrictMode ? 'STRICT' : 'GRACEFUL' });
  });

  client.on('ready', () => {
    log.info({ msg: 'Redis client ready', component: 'redis', event: 'ready', mode: isStrictMode ? 'STRICT' : 'GRACEFUL' });
  });

  let hasErrored = false;
  let fallbackToMock = false;

  client.on('error', (error: Error) => {
    // Check for Upstash quota exceeded error
    const isQuotaExceededError = error.message?.includes('ERR max requests limit exceeded') ||
      error.message?.includes('max_requests_limit') ||
      error.message?.includes('quota');

    // Check for max retries error
    const isMaxRetriesError = error.message?.includes('max retries') ||
      error.message?.includes('Reached the max') ||
      error.message?.includes('Stream isn\'t writeable');

    // Trigger circuit breaker if quota exceeded
    if (isQuotaExceededError) {
      const cb = getCircuitBreaker();
      if (cb && typeof cb.triggerQuotaExceeded === 'function') {
        cb.triggerQuotaExceeded(error);
      }
    }

    const rawErrorCode = 'code' in error ? (error as { code?: unknown }).code : undefined;
    // Type narrowing: convert unknown to safe type
    const errorCode = typeof rawErrorCode === 'string' || typeof rawErrorCode === 'number' ? rawErrorCode : undefined;

    if (isQuotaExceededError || isMaxRetriesError) {
      log.warn({
        msg: `Redis connection error: ${error.message}`,
        component: 'redis',
        event: 'error',
        error_message: error.message,
        error_code: errorCode,
        is_max_retries: isMaxRetriesError,
        is_quota_exceeded: isQuotaExceededError,
        mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
      });
    } else {
      log.error(error, 'Redis connection error', {
        component: 'redis',
        event: 'error',
        error_code: errorCode,
        is_max_retries: isMaxRetriesError,
        is_quota_exceeded: isQuotaExceededError,
        mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
      });
    }

    if (isMaxRetriesError && !isStrictMode) {
      // Graceful mode: fall back to mock after max retries
      if (!fallbackToMock && !hasErrored) {
        hasErrored = true;
        log.warn({
          msg: 'Redis unavailable in GRACEFUL mode, will fall back to MockRedis on next operation',
          component: 'redis'
        });
      }
    }
    // In STRICT mode, errors will propagate and crash the worker (correct behavior)
  });

  client.on('close', () => {
    log.info({ msg: 'Redis connection closed', component: 'redis', event: 'close', mode: isStrictMode ? 'STRICT' : 'GRACEFUL' });
  });

  client.on('reconnecting', (timeToReconnect: number) => {
    log.info({
      msg: `Reconnecting to Redis in ${timeToReconnect}ms`,
      component: 'redis',
      event: 'reconnecting',
      time_to_reconnect_ms: timeToReconnect,
      mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
    });
  });

  client.on('end', () => {
    log.info({ msg: 'Redis connection ended', component: 'redis', event: 'end', mode: isStrictMode ? 'STRICT' : 'GRACEFUL' });
  });

  // In graceful mode, wrap the client to fall back to mock on connection errors
  if (!isStrictMode) {
    // Create a proxy that falls back to mock if connection fails
    return new Proxy(client, {
      get(target: Redis, prop: string | symbol) {
        if (hasErrored && typeof prop === 'string' && !['on', 'once', 'off', 'connect', 'ping'].includes(prop)) {
          // Return mock client methods
          if (!fallbackToMock) {
            log.warn({ msg: 'Falling back to MockRedis due to connection failure', component: 'redis' });
            fallbackToMock = true;
            redisClient = new MockRedis();
            return (redisClient as unknown as { [key: string | symbol]: unknown })[prop];
          }
        }
        return (target as unknown as { [key: string | symbol]: unknown })[prop];
      }
    }) as Redis | MockRedis;
  }

  redisClient = client;
  return redisClient;
};

/**
 * Get Redis connection for BullMQ
 * BullMQ requires a fresh connection instance
 *
 * @returns IORedis instance or null if disabled
 */
export const getRedisConnection = (): IORedis | null => {
  if (REDIS_DISABLED()) {
    log.warn({ msg: 'Cannot create BullMQ connection - Redis disabled', component: 'redis' });
    return null;
  }

  const REDIS_URL = getRedisURL();
  if (!REDIS_URL && !process.env.REDIS_HOST) {
    log.warn({ msg: 'Cannot create BullMQ connection - no Redis configured', component: 'redis' });
    return null;
  }

  const config = getRedisConfig();

  // BullMQ requires maxRetriesPerRequest: null
  const bullMQConfig: RedisOptions = {
    ...config,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    enableOfflineQueue: false,
  };

  return new IORedis(bullMQConfig);
};

/**
 * Test Redis connection
 *
 * @returns true if connection is working
 */
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const client = getRedisClient();

    if (client instanceof MockRedis) {
      log.warn({ msg: 'Using MockRedis - skipping real connection test', component: 'redis' });
      return true;
    }

    const result = await client.ping();
    log.info({ msg: 'Redis connection test successful', component: 'redis', ping_result: result });
    return result === 'PONG';
  } catch (_error) {
    logError(error, 'Redis connection test failed', { component: 'redis' });
    return false;
  }
};

/**
 * Close Redis connection (graceful shutdown)
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (!redisClient) {
    return;
  }

  try {
    log.info({ msg: 'Closing Redis connection', component: 'redis' });
    await redisClient.quit();
    redisClient = null;
    log.info({ msg: 'Redis connection closed successfully', component: 'redis' });
  } catch (_error) {
    logError(error, 'Error closing Redis connection', { component: 'redis' });

    // Force disconnect
    if (redisClient && 'disconnect' in redisClient) {
      (redisClient as Redis).disconnect();
    }
    redisClient = null;
  }
};

// ================================================================
// GRACEFUL SHUTDOWN
// ================================================================

process.on('SIGTERM', async () => {
  log.info({ msg: 'SIGTERM received, closing Redis...', component: 'redis', signal: 'SIGTERM' });
  await closeRedisConnection();
});

process.on('SIGINT', async () => {
  log.info({ msg: 'SIGINT received, closing Redis...', component: 'redis', signal: 'SIGINT' });
  await closeRedisConnection();
});

// ================================================================
// EXPORTS
// ================================================================

export default getRedisClient;
export type { Redis, RedisOptions };
