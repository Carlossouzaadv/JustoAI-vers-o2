// ================================================================
// REDIS CLIENT - Upstash Redis with Cost Optimization
// ================================================================
// Centralized Redis client with idle-friendly configuration
// Optimized for Railway + Upstash deployment
// Cost: ~$0.20/day for 10 requests/day (REST API)
//       ~$10-15/month for active workers
// ================================================================

import IORedis, { Redis, RedisOptions } from 'ioredis';

// Simple inline logger to avoid external dependencies that may not be in container
const logger = {
  info: (msg: any, data?: any) => console.log(`[INFO]`, msg, data || ''),
  error: (msg: any, data?: any) => console.error(`[ERROR]`, msg, data || ''),
  warn: (msg: any, data?: any) => console.warn(`[WARN]`, msg, data || ''),
  debug: (msg: any, data?: any) => console.debug(`[DEBUG]`, msg, data || ''),
};

// Circuit breaker import - lazy loaded to avoid circular dependency
let circuitBreakerService: any = null;
const getCircuitBreaker = () => {
  if (!circuitBreakerService) {
    try {
      circuitBreakerService = require('./services/circuitBreakerService').circuitBreakerService;
    } catch (e) {
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

        // Connection Optimization (Low Idle Cost)
        lazyConnect: true, // Don't connect until first command
        keepAlive: 60000, // Keep connection alive for 60s (reduced PINGs: was 30s)
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
            logger.error(
              {
                component: 'redis',
                retries: times,
                mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
              },
              `Max retry attempts reached for Redis (${isStrictMode ? 'strict mode' : 'graceful mode'}), giving up`
            );
            return null; // Stop retrying
          }

          if (times % 3 === 0) {
            // Log every 3rd retry to avoid spam
            logger.warn(
              {
                component: 'redis',
                attempt: times,
                delay_ms: delay,
                mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
              },
              `Redis retry attempt (${isStrictMode ? 'strict' : 'graceful'} mode)`
            );
          }

          return delay;
        },

        // Queue behavior based on mode
        // CRITICAL: Enable offline queue for workers to buffer commands during brief disconnects
        // This prevents failures during Upstash reconnection (happens every ~30-35s)
        enableOfflineQueue: true, // Queue commands if connection drops (was: isStrictMode ? false : true)
        enableReadyCheck: true, // Both modes: wait for READY state

        // Connection pool (BullMQ compatibility)
        maxRetriesPerRequest: null, // Required for BullMQ (overrides above for queue operations)
      };
    } catch (error) {
      console.error('[REDIS] Failed to parse REDIS_URL:', error);
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

    // Same optimization as above, but with mode-appropriate settings
    lazyConnect: true,
    keepAlive: 60000, // Keep connection alive for 60s (reduced PINGs: was 30s)
    connectTimeout: 60000, // Increased from 10-30s to 60s for stability
    commandTimeout: 30000, // Increased from 5-15s to 30s for reliability

    maxRetriesPerRequest: 5, // Increased from 2 to 5 for more resilience
    retryStrategy: (times: number) => {
      const maxDelay = 10000; // Increased from 5-10s to 10s
      const delay = Math.min(times * 100, maxDelay);
      const maxAttempts = 10; // Increased from 5-10 to 10

      if (times > maxAttempts) {
        logger.error(
          {
            component: 'redis',
            retries: times,
            mode: isStrictMode ? 'STRICT' : 'GRACEFUL',
            config_source: 'REDIS_HOST/PORT (legacy)'
          },
          `Max retry attempts reached for Redis (${isStrictMode ? 'strict' : 'graceful'} mode, legacy config)`
        );
        return null;
      }
      if (times % 3 === 0) {
        logger.warn(
          {
            component: 'redis',
            attempt: times,
            delay_ms: delay,
            mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
          },
          `Redis retry attempt (${isStrictMode ? 'strict' : 'graceful'} mode, legacy config)`
        );
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
    console.log(`[MOCK REDIS] GET ${key}`);
    return this.mockData.get(key) || null;
  }

  async set(key: string, value: string, ...args: any[]) {
    console.log(`[MOCK REDIS] SET ${key}`);
    this.mockData.set(key, value);
    return 'OK';
  }

  async del(key: string) {
    console.log(`[MOCK REDIS] DEL ${key}`);
    return this.mockData.delete(key) ? 1 : 0;
  }

  async ttl(key: string) {
    return -1; // No TTL in mock
  }

  async expire(key: string, seconds: number) {
    return 1; // Always success in mock
  }

  async exists(key: string) {
    return this.mockData.has(key) ? 1 : 0;
  }

  async keys(pattern: string) {
    return Array.from(this.mockData.keys());
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
    logger.warn(
      { component: 'redis', mode: 'mock' },
      'Running in MOCK mode (REDIS_DISABLED=true) - Workers and queues will NOT function properly'
    );
    redisClient = new MockRedis();
    return redisClient;
  }

  // Check if REDIS_URL is configured
  const REDIS_URL = getRedisURL();
  if (!REDIS_URL && !process.env.REDIS_HOST) {
    logger.warn(
      { component: 'redis', mode: 'mock' },
      'No REDIS_URL or REDIS_HOST configured - Falling back to MOCK mode for development'
    );
    redisClient = new MockRedis();
    return redisClient;
  }

  // Create real Redis client
  const isStrictMode = IS_WORKER && IS_RAILWAY;

  logger.info(
    {
      component: 'redis',
      config_source: REDIS_URL ? 'REDIS_URL' : 'REDIS_HOST/PORT',
      mode: isStrictMode ? 'STRICT (Workers)' : 'GRACEFUL (Web/Dev)',
      is_worker: IS_WORKER,
      is_railway: IS_RAILWAY,
      is_vercel: IS_VERCEL,
      is_local: IS_LOCAL
    },
    'Initializing Redis client'
  );

  const config = getRedisConfig();
  const client = new IORedis(config);

  // ================================================================
  // EVENT HANDLERS (Observability)
  // ================================================================

  client.on('connect', () => {
    logger.info({ component: 'redis', event: 'connect', mode: isStrictMode ? 'STRICT' : 'GRACEFUL' }, 'Connected to Redis');
  });

  client.on('ready', () => {
    logger.info({ component: 'redis', event: 'ready', mode: isStrictMode ? 'STRICT' : 'GRACEFUL' }, 'Redis client ready');
  });

  let hasErrored = false;
  let fallbackToMock = false;

  client.on('error', (error) => {
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

    const level = isQuotaExceededError ? 'error' : isMaxRetriesError ? 'warn' : 'error';

    logger[level](
      {
        component: 'redis',
        event: 'error',
        error_message: error.message,
        error_code: (error as any).code,
        is_max_retries: isMaxRetriesError,
        is_quota_exceeded: isQuotaExceededError,
        mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
      },
      `Redis connection error: ${error.message}`
    );

    if (isMaxRetriesError && !isStrictMode) {
      // Graceful mode: fall back to mock after max retries
      if (!fallbackToMock && !hasErrored) {
        hasErrored = true;
        logger.warn(
          { component: 'redis' },
          'Redis unavailable in GRACEFUL mode, will fall back to MockRedis on next operation'
        );
      }
    }
    // In STRICT mode, errors will propagate and crash the worker (correct behavior)
  });

  client.on('close', () => {
    logger.info({ component: 'redis', event: 'close', mode: isStrictMode ? 'STRICT' : 'GRACEFUL' }, 'Redis connection closed');
  });

  client.on('reconnecting', (timeToReconnect) => {
    logger.info(
      {
        component: 'redis',
        event: 'reconnecting',
        time_to_reconnect_ms: timeToReconnect,
        mode: isStrictMode ? 'STRICT' : 'GRACEFUL'
      },
      `Reconnecting to Redis in ${timeToReconnect}ms`
    );
  });

  client.on('end', () => {
    logger.info({ component: 'redis', event: 'end', mode: isStrictMode ? 'STRICT' : 'GRACEFUL' }, 'Redis connection ended');
  });

  // In graceful mode, wrap the client to fall back to mock on connection errors
  if (!isStrictMode) {
    const originalClient = client;

    // Create a proxy that falls back to mock if connection fails
    return new Proxy(client, {
      get(target: any, prop: string | symbol) {
        if (hasErrored && typeof prop === 'string' && !['on', 'once', 'off', 'connect', 'ping'].includes(prop)) {
          // Return mock client methods
          if (!fallbackToMock) {
            logger.warn({ component: 'redis' }, 'Falling back to MockRedis due to connection failure');
            fallbackToMock = true;
            redisClient = new MockRedis();
            return (redisClient as any)[prop];
          }
        }
        return target[prop];
      }
    }) as any;
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
    console.warn('[REDIS] ⚠️  Cannot create BullMQ connection - Redis disabled');
    return null;
  }

  const REDIS_URL = getRedisURL();
  if (!REDIS_URL && !process.env.REDIS_HOST) {
    console.warn('[REDIS] ⚠️  Cannot create BullMQ connection - no Redis configured');
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
      logger.warn({ component: 'redis' }, 'Using MockRedis - skipping real connection test');
      return true;
    }

    const result = await client.ping();
    logger.info({ component: 'redis', ping_result: result }, 'Redis connection test successful');
    return result === 'PONG';
  } catch (error) {
    logger.error(
      { component: 'redis', error: error instanceof Error ? error.message : String(error) },
      'Redis connection test failed'
    );
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
    logger.info({ component: 'redis' }, 'Closing Redis connection');
    await redisClient.quit();
    redisClient = null;
    logger.info({ component: 'redis' }, 'Redis connection closed successfully');
  } catch (error) {
    logger.error(
      { component: 'redis', error: error instanceof Error ? error.message : String(error) },
      'Error closing Redis connection'
    );

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
  console.log('[REDIS] 📡 SIGTERM received, closing Redis...');
  await closeRedisConnection();
});

process.on('SIGINT', async () => {
  console.log('[REDIS] 📡 SIGINT received, closing Redis...');
  await closeRedisConnection();
});

// ================================================================
// EXPORTS
// ================================================================

export default getRedisClient;
export type { Redis, RedisOptions };
