/**
 * ================================================================
 * HTTP REQUEST RATE LIMITING MIDDLEWARE
 * ================================================================
 * Protects sensitive API endpoints from abuse and brute force attacks
 *
 * Usage:
 *  import { checkRateLimit } from '@/lib/middleware/rate-limit-middleware';
 *  // In route handler:
 *  const rateLimitKey = `${userId}:${endpoint}`;
 *  const rateLimited = await checkRateLimit(rateLimitKey, 10, 60); // 10 req/min
 *  if (rateLimited) return NextResponse.json({...}, { status: 429 });
 */

import { getRedisConnection } from '@/lib/redis';
import { log } from '@/lib/services/logger';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix?: string;
}

/**
 * In-memory fallback store for rate limiting when Redis is unavailable
 */
class InMemoryRateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  async check(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const record = this.store.get(key);

    // Create new record if doesn't exist
    if (!record) {
      this.store.set(key, { count: 1, resetTime: now + windowSeconds * 1000 });
      return false; // Not rate limited
    }

    // Check if window has expired
    if (now > record.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + windowSeconds * 1000 });
      return false; // Not rate limited (window reset)
    }

    // Check if limit exceeded
    if (record.count >= maxRequests) {
      return true; // Rate limited
    }

    // Increment counter
    record.count++;
    return false; // Not rate limited
  }

  /**
   * Cleanup expired entries (run periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

const memoryStore = new InMemoryRateLimitStore();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => memoryStore.cleanup(), 5 * 60 * 1000);
}

/**
 * Check if a request should be rate limited
 *
 * @param key - Unique identifier (userId, IP, endpoint combination)
 * @param maxRequests - Max requests allowed in window
 * @param windowSeconds - Time window in seconds
 * @returns true if rate limited, false if allowed
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const redis = getRedisConnection();

    if (redis) {
      // Try Redis first
      const redisKey = `rate-limit:${key}`;
      const current = await redis.incr(redisKey);

      // Set expiration on first request
      if (current === 1) {
        await redis.expire(redisKey, windowSeconds);
      }

      const isRateLimited = current > maxRequests;

      if (isRateLimited) {
        log.warn({
          msg: 'Rate limit exceeded',
          component: 'rateLimitMiddleware',
          key,
          current,
          maxRequests,
          windowSeconds
        });
      }

      return isRateLimited;
    }
  } catch (_error) {
    log.warn({
      msg: 'Redis rate limiting failed, falling back to memory store',
      component: 'rateLimitMiddleware',
      error: _error instanceof Error ? _error.message : String(_error)
    });
  }

  // Fallback to in-memory store
  return await memoryStore.check(key, maxRequests, windowSeconds);
}

/**
 * Reset rate limit for a key
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    if (redis) {
      await redis.del(`rate-limit:${key}`);
    }
  } catch (_error) {
    log.warn({
      msg: 'Failed to reset rate limit',
      error: _error instanceof Error ? _error.message : String(_error)
    });
  }
}

/**
 * Predefined rate limit configurations for common scenarios
 */
export const RATE_LIMIT_CONFIGS = {
  // Payment endpoints: 5 requests per minute per user
  PAYMENT: {
    maxRequests: 5,
    windowSeconds: 60,
    keyPrefix: 'payment'
  },

  // Credit consumption: 20 requests per minute per workspace
  CREDIT_CONSUMPTION: {
    maxRequests: 20,
    windowSeconds: 60,
    keyPrefix: 'credit'
  },

  // User registration: 3 requests per hour per IP
  USER_REGISTRATION: {
    maxRequests: 3,
    windowSeconds: 3600,
    keyPrefix: 'registration'
  },

  // API quota checks: 100 requests per minute per user
  QUOTA_CHECK: {
    maxRequests: 100,
    windowSeconds: 60,
    keyPrefix: 'quota'
  },

  // Webhook delivery: 10 requests per second per workspace
  WEBHOOK: {
    maxRequests: 10,
    windowSeconds: 1,
    keyPrefix: 'webhook'
  },

  // Login attempts: 10 requests per minute per email
  LOGIN: {
    maxRequests: 10,
    windowSeconds: 60,
    keyPrefix: 'login'
  },

  // Password reset: 3 requests per hour per email
  PASSWORD_RESET: {
    maxRequests: 3,
    windowSeconds: 3600,
    keyPrefix: 'password-reset'
  }
};

/**
 * Helper to check rate limit with config preset
 */
export async function checkRateLimitWithConfig(
  identifier: string,
  config: RateLimitConfig
): Promise<boolean> {
  const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier;
  return await checkRateLimit(key, config.maxRequests, config.windowSeconds);
}

/**
 * Returns remaining requests and reset time
 */
export async function getRateLimitStatus(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ remaining: number; resetTime: number }> {
  try {
    const redis = getRedisConnection();

    if (redis) {
      const redisKey = `rate-limit:${key}`;
      const current = await redis.get(redisKey);
      const ttl = await redis.ttl(redisKey);

      const requestCount = current ? parseInt(current) : 0;
      const remaining = Math.max(0, maxRequests - requestCount);
      const resetTime = ttl > 0 ? Date.now() + ttl * 1000 : Date.now();

      return { remaining, resetTime };
    }
  } catch (_error) {
    log.warn({
      msg: 'Failed to get rate limit status',
      error: _error instanceof Error ? _error.message : String(_error)
    });
  }

  return { remaining: maxRequests, resetTime: Date.now() + windowSeconds * 1000 };
}
