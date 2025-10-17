/**
 * Redis Client Configuration
 * Configuração otimizada para desenvolvimento local e produção
 *
 * Uses REDIS_URL as primary configuration source.
 * For Railway/Upstash production: Set REDIS_URL environment variable
 * For local development: Use REDIS_HOST, REDIS_PORT, REDIS_PASSWORD or redis://localhost:6379
 */

import Redis from 'ioredis';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Build Redis connection config
// Priority: REDIS_URL > individual variables > defaults
let redisConfig: any = {
  lazyConnect: true,
  retryDelayOnFailover: 100,
  enableReadyCheck: !isDevelopment,
  db: 0,
  // Production settings for stability
  ...(isProduction && {
    connectTimeout: 5000,
    commandTimeout: 3000,
    retryDelayOnError: 100,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    reconnectOnError: null,
  }),
  // Development settings
  ...(!isProduction && {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    reconnectOnError: null,
  }),
};

// Use REDIS_URL if provided, otherwise use host/port/password
if (process.env.REDIS_URL) {
  redisConfig.url = process.env.REDIS_URL;
} else {
  // Fallback to individual variables for development/local setup
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
 * Get Redis client (lazy initialization)
 */
export function getRedis(): any {
  if (!redisInstance) {
    redisInstance = new Redis(redisConfig);

    redisInstance.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisInstance.on('error', (error) => {
      console.error('❌ Redis connection error:', error.message);
    });

    redisInstance.on('ready', () => {
      console.log('🟢 Redis ready to accept commands');
    });
  }

  return redisInstance;
}

/**
 * Get Bull Redis client (lazy initialization)
 * Uses DB 1 to separate Bull queue data from general cache
 */
export function getBullRedis(): any {
  if (!bullRedisInstance) {
    bullRedisInstance = new Redis({
      ...redisConfig,
      db: 1, // Use DB 1 for Bull Queue (separate from general cache in DB 0)
    });

    bullRedisInstance.on('connect', () => {
      console.log('✅ Bull Redis connected successfully (DB 1)');
    });

    bullRedisInstance.on('error', (error) => {
      console.error('❌ Bull Redis connection error:', error.message);
    });
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