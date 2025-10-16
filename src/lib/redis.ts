// ================================================================
// REDIS CLIENT - Upstash Redis with Cost Optimization
// ================================================================
// Centralized Redis client with idle-friendly configuration
// Optimized for Railway + Upstash deployment
// Cost: ~$0.20/day for 10 requests/day (REST API)
//       ~$10-15/month for active workers
// ================================================================

import IORedis, { Redis, RedisOptions } from 'ioredis';
import { logger } from '@/lib/observability/logger';

// ================================================================
// CONFIGURATION
// ================================================================

/**
 * Check if Redis should be disabled (fallback to mock for development)
 * Redis is REQUIRED in production for workers
 */
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
const REDIS_URL = process.env.REDIS_URL;

/**
 * Upstash Redis Configuration with Cost Optimization
 *
 * Key features for low idle costs:
 * - lazyConnect: true (don't connect until first command)
 * - keepAlive: 30000 (30s instead of default 0)
 * - maxRetriesPerRequest: 3 (limited retries)
 * - retryStrategy: exponential backoff with max delay
 * - enableOfflineQueue: false (fail fast, don't queue)
 * - connectTimeout: 10000 (10s timeout)
 * - commandTimeout: 5000 (5s timeout for commands)
 */
const getRedisConfig = (): RedisOptions => {
  // Parse Upstash Redis URL if available
  if (REDIS_URL) {
    // Upstash URLs come in format: rediss://default:password@host:6379
    try {
      const url = new URL(REDIS_URL);

      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
        username: url.username || 'default',

        // TLS Configuration (required for Upstash)
        tls: url.protocol === 'rediss:' ? {} : undefined,

        // Connection Optimization (Low Idle Cost)
        lazyConnect: true, // Don't connect until first command
        keepAlive: 30000, // Keep connection alive for 30s
        connectTimeout: 30000, // 30s connection timeout (increased for Upstash)
        commandTimeout: 15000, // 15s command timeout (increased for Upstash)

        // Retry Strategy (Fail fast, avoid infinite loops)
        maxRetriesPerRequest: 5, // Max 5 retries per command (increased for Upstash reliability)
        retryStrategy: (times: number) => {
          // Exponential backoff: 100ms, 200ms, 400ms, ..., max 10s
          const delay = Math.min(times * 100, 10000);

          // Stop retrying after 10 attempts
          if (times > 10) {
            logger.error(
              { component: 'redis', retries: times },
              'Max retry attempts reached for Redis, giving up'
            );
            return null; // Stop retrying
          }

          if (times % 3 === 0) {
            // Log every 3rd retry to avoid spam
            logger.warn(
              { component: 'redis', attempt: times, delay_ms: delay },
              'Redis retry attempt'
            );
          }

          return delay;
        },

        // Fail fast configuration
        enableOfflineQueue: false, // Don't queue commands when offline
        enableReadyCheck: false, // Don't wait for READY state

        // Connection pool (BullMQ compatibility)
        maxRetriesPerRequest: null, // Required for BullMQ (overrides above for queue operations)
      };
    } catch (error) {
      console.error('[REDIS] Failed to parse REDIS_URL:', error);
      throw new Error('Invalid REDIS_URL format');
    }
  }

  // Fallback to individual env vars (legacy support)
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || 'default',

    // Same optimization as above
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 30000,
    commandTimeout: 15000,

    maxRetriesPerRequest: 5,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 100, 10000);
      if (times > 10) {
        logger.error(
          { component: 'redis', retries: times },
          'Max retry attempts reached for Redis (legacy config)'
        );
        return null;
      }
      if (times % 3 === 0) {
        logger.warn(
          { component: 'redis', attempt: times, delay_ms: delay },
          'Redis retry attempt (legacy config)'
        );
      }
      return delay;
    },

    enableOfflineQueue: false,
    enableReadyCheck: false,
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
  if (REDIS_DISABLED) {
    logger.warn(
      { component: 'redis', mode: 'mock' },
      'Running in MOCK mode (REDIS_DISABLED=true) - Workers and queues will NOT function properly'
    );
    redisClient = new MockRedis();
    return redisClient;
  }

  // Check if REDIS_URL is configured
  if (!REDIS_URL && !process.env.REDIS_HOST) {
    logger.warn(
      { component: 'redis', mode: 'mock' },
      'No REDIS_URL or REDIS_HOST configured - Falling back to MOCK mode for development'
    );
    redisClient = new MockRedis();
    return redisClient;
  }

  // Create real Redis client
  logger.info(
    { component: 'redis', config_source: REDIS_URL ? 'REDIS_URL' : 'REDIS_HOST/PORT' },
    'Initializing Redis client'
  );

  const config = getRedisConfig();
  const client = new IORedis(config);

  // ================================================================
  // EVENT HANDLERS (Observability)
  // ================================================================

  client.on('connect', () => {
    logger.info({ component: 'redis', event: 'connect' }, 'Connected to Redis');
  });

  client.on('ready', () => {
    logger.info({ component: 'redis', event: 'ready' }, 'Redis client ready');
  });

  client.on('error', (error) => {
    // Check for max retries error
    const isMaxRetriesError = error.message?.includes('max retries') ||
      error.message?.includes('Reached the max');

    const level = isMaxRetriesError ? 'warn' : 'error';

    logger[level](
      {
        component: 'redis',
        event: 'error',
        error_message: error.message,
        error_code: (error as any).code,
        is_max_retries: isMaxRetriesError,
      },
      `Redis connection error: ${error.message}`
    );

    // Don't crash the application on Redis errors
    // Workers will handle retries, API will continue without cache
  });

  client.on('close', () => {
    logger.info({ component: 'redis', event: 'close' }, 'Redis connection closed');
  });

  client.on('reconnecting', (timeToReconnect) => {
    logger.info(
      { component: 'redis', event: 'reconnecting', time_to_reconnect_ms: timeToReconnect },
      `Reconnecting to Redis in ${timeToReconnect}ms`
    );
  });

  client.on('end', () => {
    logger.info({ component: 'redis', event: 'end' }, 'Redis connection ended');
  });

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
  if (REDIS_DISABLED) {
    console.warn('[REDIS] ⚠️  Cannot create BullMQ connection - Redis disabled');
    return null;
  }

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
