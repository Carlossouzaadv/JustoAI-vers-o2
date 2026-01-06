// ================================================================
// DISTRIBUTED RATE LIMITER - Redis-based for Multi-Pod Environments
// ================================================================
// Implements sliding window rate limiting using Upstash Redis
// Works correctly across multiple instances (Railway, Vercel, etc.)
// ================================================================

import { getRedisClient } from './redis';
import { log, logError } from '@/lib/services/logger';

export interface RateLimitConfig {
    /**
     * Maximum number of requests allowed in the window
     */
    maxRequests: number;

    /**
     * Time window in seconds
     */
    windowSizeSeconds: number;

    /**
     * Prefix for Redis keys (for namespacing)
     */
    prefix?: string;
}

export interface RateLimitResult {
    /**
     * Whether the request is allowed
     */
    allowed: boolean;

    /**
     * Number of remaining requests in the current window
     */
    remaining: number;

    /**
     * Total limit for the window
     */
    limit: number;

    /**
     * Unix timestamp when the window resets
     */
    resetAt: number;

    /**
     * Seconds until the window resets
     */
    retryAfter: number;
}

/**
 * Distributed Rate Limiter using Redis
 * 
 * Implements a sliding window counter algorithm that works across
 * multiple application instances (pods/serverless functions).
 * 
 * @example
 * ```typescript
 * const limiter = new DistributedRateLimiter({
 *   maxRequests: 100,
 *   windowSizeSeconds: 60,
 *   prefix: 'api'
 * });
 * 
 * const result = await limiter.checkLimit('user:123');
 * if (!result.allowed) {
 *   return new Response('Too Many Requests', { status: 429 });
 * }
 * ```
 */
export class DistributedRateLimiter {
    private readonly config: Required<RateLimitConfig>;

    constructor(config: RateLimitConfig) {
        this.config = {
            maxRequests: config.maxRequests,
            windowSizeSeconds: config.windowSizeSeconds,
            prefix: config.prefix || 'ratelimit',
        };
    }

    /**
     * Check if a request is allowed for the given identifier
     * 
     * @param identifier - Unique identifier for the rate limit (e.g., IP, user ID)
     * @returns Rate limit result with allowed status and metadata
     */
    async checkLimit(identifier: string): Promise<RateLimitResult> {
        const redis = getRedisClient();
        const key = `${this.config.prefix}:${identifier}`;
        const now = Math.floor(Date.now() / 1000);
        const windowStart = now - this.config.windowSizeSeconds;

        try {
            // Use Redis sorted set for sliding window
            // Remove old entries, add new entry, count entries
            const pipeline = (redis as {
                multi: () => {
                    zremrangebyscore: (key: string, min: number, max: number) => unknown;
                    zadd: (key: string, score: number, member: string) => unknown;
                    zcount: (key: string, min: number, max: number) => unknown;
                    expire: (key: string, seconds: number) => unknown;
                    exec: () => Promise<Array<[Error | null, unknown]>>;
                };
            }).multi();

            // Remove entries older than the window
            pipeline.zremrangebyscore(key, 0, windowStart);

            // Add current request with timestamp as score
            pipeline.zadd(key, now, `${now}:${Math.random().toString(36).substring(7)}`);

            // Count requests in the current window
            pipeline.zcount(key, windowStart, now);

            // Set TTL on the key (cleanup)
            pipeline.expire(key, this.config.windowSizeSeconds + 1);

            const results = await pipeline.exec();

            if (!results || results.length < 3) {
                // Redis error, allow request (fail open)
                log.warn({
                    msg: 'Rate limiter Redis error - failing open',
                    component: 'rate-limiter',
                    identifier,
                });
                return this.createAllowedResult();
            }

            // Get the count from the third command result
            const count = (results[2][1] as number) || 0;
            const remaining = Math.max(0, this.config.maxRequests - count);
            const resetAt = now + this.config.windowSizeSeconds;
            const allowed = count <= this.config.maxRequests;

            if (!allowed) {
                log.info({
                    msg: 'Rate limit exceeded',
                    component: 'rate-limiter',
                    identifier,
                    count,
                    limit: this.config.maxRequests,
                    window: this.config.windowSizeSeconds,
                });
            }

            return {
                allowed,
                remaining,
                limit: this.config.maxRequests,
                resetAt,
                retryAfter: allowed ? 0 : this.config.windowSizeSeconds,
            };

        } catch (error) {
            // Fail open on Redis errors to avoid blocking legitimate requests
            logError(error, 'Rate limiter error - failing open', {
                component: 'rate-limiter',
                identifier,
            });
            return this.createAllowedResult();
        }
    }

    /**
     * Get current rate limit status without consuming a request
     */
    async getStatus(identifier: string): Promise<RateLimitResult> {
        const redis = getRedisClient();
        const key = `${this.config.prefix}:${identifier}`;
        const now = Math.floor(Date.now() / 1000);
        const windowStart = now - this.config.windowSizeSeconds;

        try {
            // Count without adding
            const count = await (redis as {
                zcount: (key: string, min: number, max: number) => Promise<number>;
            }).zcount(key, windowStart, now);

            const remaining = Math.max(0, this.config.maxRequests - count);
            const resetAt = now + this.config.windowSizeSeconds;

            return {
                allowed: count < this.config.maxRequests,
                remaining,
                limit: this.config.maxRequests,
                resetAt,
                retryAfter: count >= this.config.maxRequests ? this.config.windowSizeSeconds : 0,
            };
        } catch (error) {
            logError(error, 'Rate limiter getStatus error', {
                component: 'rate-limiter',
                identifier,
            });
            return this.createAllowedResult();
        }
    }

    /**
     * Reset rate limit for an identifier
     */
    async reset(identifier: string): Promise<void> {
        const redis = getRedisClient();
        const key = `${this.config.prefix}:${identifier}`;

        try {
            await redis.del(key);
            log.info({
                msg: 'Rate limit reset',
                component: 'rate-limiter',
                identifier,
            });
        } catch (error) {
            logError(error, 'Rate limiter reset error', {
                component: 'rate-limiter',
                identifier,
            });
        }
    }

    private createAllowedResult(): RateLimitResult {
        return {
            allowed: true,
            remaining: this.config.maxRequests,
            limit: this.config.maxRequests,
            resetAt: Math.floor(Date.now() / 1000) + this.config.windowSizeSeconds,
            retryAfter: 0,
        };
    }
}

// ================================================================
// PRE-CONFIGURED RATE LIMITERS
// ================================================================

/**
 * API Rate Limiter - 100 requests per minute per IP
 */
export const apiRateLimiter = new DistributedRateLimiter({
    maxRequests: 100,
    windowSizeSeconds: 60,
    prefix: 'ratelimit:api',
});

/**
 * Auth Rate Limiter - 5 attempts per 15 minutes per IP (brute force protection)
 */
export const authRateLimiter = new DistributedRateLimiter({
    maxRequests: 5,
    windowSizeSeconds: 900, // 15 minutes
    prefix: 'ratelimit:auth',
});

/**
 * AI/Heavy Operations Rate Limiter - 10 requests per minute per workspace
 */
export const aiRateLimiter = new DistributedRateLimiter({
    maxRequests: 10,
    windowSizeSeconds: 60,
    prefix: 'ratelimit:ai',
});

/**
 * Upload Rate Limiter - 20 uploads per hour per workspace
 */
export const uploadRateLimiter = new DistributedRateLimiter({
    maxRequests: 20,
    windowSizeSeconds: 3600, // 1 hour
    prefix: 'ratelimit:upload',
});

/**
 * Export Rate Limiter - 5 exports per hour per user (LGPD data export)
 */
export const exportRateLimiter = new DistributedRateLimiter({
    maxRequests: 5,
    windowSizeSeconds: 3600, // 1 hour
    prefix: 'ratelimit:export',
});

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');

    // Priority: Cloudflare > x-forwarded-for > x-real-ip > fallback
    if (cfConnectingIp) return cfConnectingIp;
    if (forwarded) return forwarded.split(',')[0].trim();
    if (realIp) return realIp;

    return 'unknown';
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
    response: Response,
    result: RateLimitResult
): void {
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.resetAt.toString());

    if (!result.allowed) {
        response.headers.set('Retry-After', result.retryAfter.toString());
    }
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
    const response = new Response(
        JSON.stringify({
            success: false,
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
            retryAfter: result.retryAfter,
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );

    addRateLimitHeaders(response, result);
    return response;
}
