/**
 * Redis Client Configuration
 * Configuração otimizada para desenvolvimento local e produção
 *
 * EMERGENCY MODE: Se REDIS_DISABLED=true, retorna mock sem tentar conectar
 */

import Redis from 'ioredis';

// Check if Redis should be disabled (for Railway without Redis)
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true' || !process.env.REDIS_HOST;

// Configuração Redis baseada no ambiente
const redisConfig = {
  development: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1, // Limit retries to prevent infinite loops
    enableOfflineQueue: false, // Don't queue commands when disconnected
    reconnectOnError: null, // Don't reconnect automatically
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
    // Configurações de produção com limites agressivos
    connectTimeout: 5000,
    commandTimeout: 3000,
    retryDelayOnError: 100,
    maxRetriesPerRequest: 1, // ⚠️ CRITICAL: Limit to 1 retry to prevent CPU spike
    enableOfflineQueue: false, // ⚠️ CRITICAL: Don't queue when offline
    reconnectOnError: null, // ⚠️ CRITICAL: Don't auto-reconnect on error
  }
};

const isDevelopment = process.env.NODE_ENV === 'development';
const config = isDevelopment ? redisConfig.development : redisConfig.production;

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
 * Returns mock if Redis is disabled to prevent connection attempts
 */
export function getRedis(): any {
  if (REDIS_DISABLED) {
    console.warn('⚠️ Redis is disabled - using mock client');
    return new MockRedis();
  }

  if (!redisInstance) {
    redisInstance = new Redis(config);

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
 * Returns mock if Redis is disabled
 */
export function getBullRedis(): any {
  if (REDIS_DISABLED) {
    console.warn('⚠️ Bull Redis is disabled - using mock client');
    return new MockRedis();
  }

  if (!bullRedisInstance) {
    bullRedisInstance = new Redis({
      ...config,
      db: 1, // Use DB 1 para Bull Queue
    });

    bullRedisInstance.on('connect', () => {
      console.log('✅ Bull Redis connected successfully');
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