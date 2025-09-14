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
    maxRetriesPerRequest: 3,
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

// Cliente Redis principal
export const redis = new Redis(config);

// Cliente Redis para Bull Queue (separado para melhor isolamento)
export const bullRedis = new Redis({
  ...config,
  db: 1, // Use DB 1 para Bull Queue
});

// Event handlers para logs
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

redis.on('ready', () => {
  console.log('🟢 Redis ready to accept commands');
});

bullRedis.on('connect', () => {
  console.log('✅ Bull Redis connected successfully');
});

bullRedis.on('error', (error) => {
  console.error('❌ Bull Redis connection error:', error);
});

// Utility functions para cache
export const redisUtils = {
  /**
   * Set com TTL automático
   */
  async setWithTTL(key: string, value: any, ttlSeconds: number = 3600) {
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttlSeconds, serialized);
  },

  /**
   * Get com parse automático
   */
  async get(key: string) {
    const value = await redis.get(key);
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
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length;
  },

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const ping = await redis.ping();
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
      const info = await redis.info('memory');
      const keyspace = await redis.info('keyspace');

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