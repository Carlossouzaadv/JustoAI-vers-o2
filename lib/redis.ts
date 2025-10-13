/**
 * Redis Client Configuration
 * Configuração otimizada para desenvolvimento local e produção
 */

import Redis from 'ioredis';

// Configuração Redis baseada no ambiente
const redisConfig = {
  development: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    db: 0,
  },
  production: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    lazyConnect: true,
    db: 0,
    // Configurações de produção
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnError: 50,
    maxRetriesPerRequest: 3,
  }
};

const isDevelopment = process.env.NODE_ENV === 'development';
const config = isDevelopment ? redisConfig.development : redisConfig.production;

// Lazy initialization - só cria conexão quando necessário
let redisInstance: Redis | null = null;
let bullRedisInstance: Redis | null = null;

/**
 * Get Redis client (lazy initialization)
 * Só cria a conexão quando realmente necessário, não durante build
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(config);

    redisInstance.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisInstance.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
    });

    redisInstance.on('ready', () => {
      console.log('🟢 Redis ready to accept commands');
    });
  }

  return redisInstance;
}

/**
 * Get Bull Redis client (lazy initialization)
 */
export function getBullRedis(): Redis {
  if (!bullRedisInstance) {
    bullRedisInstance = new Redis({
      ...config,
      db: 1, // Use DB 1 para Bull Queue
    });

    bullRedisInstance.on('connect', () => {
      console.log('✅ Bull Redis connected successfully');
    });

    bullRedisInstance.on('error', (error) => {
      console.error('❌ Bull Redis connection error:', error);
    });
  }

  return bullRedisInstance;
}

// Exports para compatibilidade (lazy)
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return getRedis()[prop as keyof Redis];
  }
});

export const bullRedis = new Proxy({} as Redis, {
  get(_target, prop) {
    return getBullRedis()[prop as keyof Redis];
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