/**
 * Redis Client Configuration
 * Configuração otimizada para desenvolvimento local e produção
 *
 * CRITICAL: Uses REDIS_URL as single source of truth for Redis configuration.
 * Falls back to mock client only in development if no REDIS_URL is provided.
 * In production, missing REDIS_URL throws an error to prevent data loss.
 */

import Redis from 'ioredis';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Check if Redis should be disabled (only in development without REDIS_URL)
// In production, if REDIS_URL is missing, error will be thrown when Redis is first accessed
const REDIS_DISABLED = isDevelopment && !process.env.REDIS_URL;

// Track if we've already logged the production Redis warning
let productionRedisErrorLogged = false;

// Build Redis connection config from REDIS_URL
// If REDIS_URL is provided, parse it and use it exclusively
let redisConfig: any = {
  lazyConnect: true,
  retryDelayOnFailover: 100,
  enableReadyCheck: isDevelopment ? false : true,
  db: 0,
};

if (isProduction) {
  // Production-specific settings for stability
  redisConfig = {
    ...redisConfig,
    connectTimeout: 5000,
    commandTimeout: 3000,
    retryDelayOnError: 100,
    maxRetriesPerRequest: 1, // ⚠️ CRITICAL: Limit to 1 retry to prevent CPU spike
    enableOfflineQueue: false, // ⚠️ CRITICAL: Don't queue when offline
    reconnectOnError: null, // ⚠️ CRITICAL: Don't auto-reconnect on error
  };
} else {
  // Development-specific settings
  redisConfig = {
    ...redisConfig,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    reconnectOnError: null,
  };
}

// Use REDIS_URL if provided, otherwise use fallback for development
if (process.env.REDIS_URL) {
  // Parse REDIS_URL - the URL is the primary configuration source
  // This handles both redis://, rediss:// (Upstash), and other formats
  redisConfig.url = process.env.REDIS_URL;
} else if (isDevelopment) {
  // Fallback to host/port/password only in development
  // These variables should NOT be used if REDIS_URL is present
  redisConfig.host = process.env.REDIS_HOST || 'localhost';
  redisConfig.port = parseInt(process.env.REDIS_PORT || '6379', 10);
  if (process.env.REDIS_PASSWORD) {
    redisConfig.password = process.env.REDIS_PASSWORD;
  }
}

// Lazy initialization - só cria conexão quando necessário
let redisInstance: Redis | null = null;
let bullRedisInstance: Redis | null = null;

/**
 * Mock Redis client for when Redis is disabled
 * Returns a no-op client that doesn't try to connect
 */
class MockRedis {
  async get() { return null; }
  async set() { return 'OK'; }
  async setex() { return 'OK'; }
  async del() { return 0; }
  async keys() { return []; }
  async ping() { return 'PONG'; }
  async info() { return ''; }
  on() { return this; }
  connect() { return Promise.resolve(); }
  disconnect() { return Promise.resolve(); }
  quit() { return Promise.resolve(); }
}

/**
 * Get Redis client (lazy initialization)
 * Returns mock if Redis is disabled (development only, no REDIS_URL)
 * In production without REDIS_URL, throws error when first accessed (not during build)
 */
export function getRedis(): any {
  if (REDIS_DISABLED) {
    console.warn('⚠️ Redis is disabled - using mock client (development mode, no REDIS_URL configured)');
    return new MockRedis();
  }

  // Lazy validation in production - only throw when Redis is actually used
  if (isProduction && !process.env.REDIS_URL) {
    if (!productionRedisErrorLogged) {
      productionRedisErrorLogged = true;
      const errorMsg = 'REDIS_URL is not defined in the environment! ' +
        'This is required for production. ' +
        'Set REDIS_URL in Railway variables with format: ' +
        'rediss://default:password@host:port (for Upstash) ' +
        'or redis://default:password@host:port (for Railway Redis)';
      console.error('❌ Redis configuration error:', errorMsg);
    }
    throw new Error(
      'REDIS_URL is not defined in the environment! ' +
      'This is required for production. ' +
      'Set REDIS_URL in Railway variables with format: ' +
      'rediss://default:password@host:port (for Upstash) ' +
      'or redis://default:password@host:port (for Railway Redis)'
    );
  }

  if (!redisInstance) {
    try {
      redisInstance = new Redis(redisConfig);

      redisInstance.on('connect', () => {
        console.log('✅ Redis connected successfully', {
          url: process.env.REDIS_URL ? 'configured' : 'not configured',
          env: process.env.NODE_ENV,
        });
      });

      redisInstance.on('error', (error) => {
        console.error('❌ Redis connection error:', {
          message: error.message,
          code: error.code,
          url: process.env.REDIS_URL ? 'configured' : 'not configured',
        });
      });

      redisInstance.on('ready', () => {
        console.log('🟢 Redis ready to accept commands');
      });
    } catch (error) {
      console.error('❌ Failed to create Redis instance:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  return redisInstance;
}

/**
 * Get Bull Redis client (lazy initialization)
 * Returns mock if Redis is disabled (development only, no REDIS_URL)
 * Uses DB 1 to separate Bull queue data from general cache
 * In production without REDIS_URL, throws error when first accessed (not during build)
 */
export function getBullRedis(): any {
  if (REDIS_DISABLED) {
    console.warn('⚠️ Bull Redis is disabled - using mock client (development mode, no REDIS_URL configured)');
    return new MockRedis();
  }

  // Lazy validation in production - only throw when Bull Redis is actually used
  if (isProduction && !process.env.REDIS_URL) {
    if (!productionRedisErrorLogged) {
      productionRedisErrorLogged = true;
      const errorMsg = 'REDIS_URL is not defined in the environment! ' +
        'This is required for production. ' +
        'Set REDIS_URL in Railway variables with format: ' +
        'rediss://default:password@host:port (for Upstash) ' +
        'or redis://default:password@host:port (for Railway Redis)';
      console.error('❌ Redis configuration error:', errorMsg);
    }
    throw new Error(
      'REDIS_URL is not defined in the environment! ' +
      'This is required for production. ' +
      'Set REDIS_URL in Railway variables with format: ' +
      'rediss://default:password@host:port (for Upstash) ' +
      'or redis://default:password@host:port (for Railway Redis)'
    );
  }

  if (!bullRedisInstance) {
    try {
      bullRedisInstance = new Redis({
        ...redisConfig,
        db: 1, // Use DB 1 for Bull Queue (separate from general cache in DB 0)
      });

      bullRedisInstance.on('connect', () => {
        console.log('✅ Bull Redis connected successfully (DB 1)');
      });

      bullRedisInstance.on('error', (error) => {
        console.error('❌ Bull Redis connection error:', {
          message: error.message,
          code: error.code,
          db: 1,
        });
      });
    } catch (error) {
      console.error('❌ Failed to create Bull Redis instance:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  return bullRedisInstance;
}

// Exports para compatibilidade (lazy with disabled check)
export const redis = new Proxy({} as any, {
  get(_target, prop) {
    return getRedis()[prop];
  }
});

export const bullRedis = new Proxy({} as any, {
  get(_target, prop) {
    return getBullRedis()[prop];
  }
});

// Utility functions para cache
export const redisUtils = {
  /**
   * Set com TTL automático
   */
  async setWithTTL(key: string, value: any, ttlSeconds: number = 3600) {
    const serialized = JSON.stringify(value);
    await getRedis().setex(key, ttlSeconds, serialized);
  },

  /**
   * Get com parse automático
   */
  async get(key: string) {
    const value = await getRedis().get(key);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return value; // Return as string if not JSON
    }
  },

  /**
   * Delete keys por pattern
   */
  async deletePattern(pattern: string) {
    const keys = await getRedis().keys(pattern);
    if (keys.length > 0) {
      await getRedis().del(...keys);
    }
    return keys.length;
  },

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const ping = await getRedis().ping();
      return ping === 'PONG';
    } catch {
      return false;
    }
  },

  /**
   * Estatísticas de uso
   */
  async getStats() {
    try {
      const info = await getRedis().info('memory');
      const keyspace = await getRedis().info('keyspace');

      return {
        memory: info,
        keyspace: keyspace,
        connected: await this.healthCheck(),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        connected: false,
      };
    }
  }
};

// Export default para compatibilidade
export default redis;