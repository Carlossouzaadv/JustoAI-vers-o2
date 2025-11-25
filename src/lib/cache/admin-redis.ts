/**
 * Admin Dashboard Redis Cache Manager
 *
 * Provides type-safe caching for expensive admin dashboard queries using Redis.
 * Implements graceful fallback when Redis is unavailable.
 *
 * Cache Strategy:
 * - TTL-based invalidation (Tier 1)
 * - Manual invalidation via helper functions (Tier 2)
 * - Event-driven invalidation (future - Tier 3)
 *
 * Type Safety: Uses type guards for JSON deserialization (CLAUDE.md compliance)
 */

import { getRedisClient } from '@/lib/redis';
import { log, logError } from '@/lib/services/logger';

// Type guard for safe JSON parsing
function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

/**
 * Get Redis client instance
 */
function getAdminRedis() {
  return getRedisClient();
}

/**
 * Error handler for Redis operations
 * Falls back gracefully when Redis is unavailable
 */
function handleRedisError(operation: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logError(errorMessage, 'AdminCache Redis ${operation} failed:', { component: 'refactored' });
  // Silently continue - caller will recompute if needed
}

/**
 * Cache key builders - Centralized key naming convention
 * Format: admin:{metric}:{scope}
 */
export const AdminCacheKeys = {
  // System Health & Status
  healthStatus: () => 'admin:health:status:v1',
  systemStatus: () => 'admin:system:status:v1',

  // Webhook Management
  webhookStats: (period = 'latest') => `admin:webhook:${period}:v1`,
  webhookErrors: () => 'admin:webhook:errors:v1',

  // Cost & Telemetry
  costSummary: (workspaceId?: string) =>
    `admin:cost:summary:${workspaceId ?? 'global'}:v1`,
  costBreakdown: (workspaceId?: string) =>
    `admin:cost:breakdown:${workspaceId ?? 'global'}:v1`,
  dailyCosts: (workspaceId?: string) =>
    `admin:cost:daily:${workspaceId ?? 'global'}:v1`,

  // External APIs
  sentryStats: () => 'admin:sentry:stats:v1',
  sentryErrors: () => 'admin:sentry:errors:v1',

  // Queue Management
  bullStats: () => 'admin:bull:stats:v1',
  bullQueues: (queueName?: string) =>
    `admin:bull:queue:${queueName ?? 'all'}:v1`,

  // JUDIT Integration
  juditConsumption: () => 'admin:judit:consumption:daily:v1',

  // Observability
  observabilityStats: () => 'admin:observability:stats:v1',
} as const;

/**
 * Wrapper for caching async operations with Redis
 *
 * @param key - Cache key (use AdminCacheKeys helpers)
 * @param ttlSeconds - TTL in seconds
 * @param fetcher - Async function that computes the value
 * @returns Cached value or freshly computed value
 *
 * Type-safe: Uses type guard for JSON deserialization
 */
export async function withAdminCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = getAdminRedis();

  // Try to get from cache
  try {
    const cached = await redis.get(key);
    if (cached) {
      try {
        // Type guard: ensure JSON is valid object before parsing
        const parsed = JSON.parse(cached);
        if (isRecord(parsed) || Array.isArray(parsed) || typeof parsed === 'string' || typeof parsed === 'number') {
          return parsed as T;
        }
      } catch (_parseError) {
        logError(parseError, 'AdminCache JSON parse error for key ${key}:', { component: 'refactored' });
        // Continue to recompute
      }
    }
  } catch (_error) {
    handleRedisError(`GET ${key}`, error);
  }

  // Cache miss or Redis error - compute fresh value
  const result = await fetcher();

  // Attempt to cache the result
  try {
    const serialized = JSON.stringify(result);
    await redis.setex(key, ttlSeconds, serialized);
  } catch (_error) {
    handleRedisError(`SET ${key}`, error);
    // Still return the computed value even if cache write fails
  }

  return result;
}

/**
 * Clear a single cache key
 */
export async function clearAdminCache(key: string): Promise<void> {
  const redis = getAdminRedis();
  try {
    await redis.del(key);
  } catch (_error) {
    handleRedisError(`DEL ${key}`, error);
  }
}

/**
 * Clear multiple cache keys with pattern matching
 * Pattern: 'admin:health:*' will match all health-related caches
 */
export async function clearAdminCachePattern(pattern: string): Promise<void> {
  const redis = getAdminRedis();
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      // Delete in batches for compatibility with both Redis and MockRedis
      for (const key of keys) {
        await redis.del(key);
      }
    }
  } catch (_error) {
    handleRedisError(`KEYS/DEL ${pattern}`, error);
  }
}

/**
 * Clear all admin caches
 * Use sparingly - typically called after major data changes
 */
export async function clearAllAdminCaches(): Promise<void> {
  await clearAdminCachePattern('admin:*');
}

/**
 * Invalidation helpers - Called when specific data changes
 */

export async function invalidateHealthCache(): Promise<void> {
  await clearAdminCache(AdminCacheKeys.healthStatus());
  await clearAdminCache(AdminCacheKeys.systemStatus());
}

export async function invalidateCostCache(workspaceId?: string): Promise<void> {
  const wsId = workspaceId ?? 'global';
  await clearAdminCache(AdminCacheKeys.costSummary(wsId));
  await clearAdminCache(AdminCacheKeys.costBreakdown(wsId));
  await clearAdminCache(AdminCacheKeys.dailyCosts(wsId));
}

export async function invalidateWebhookCache(): Promise<void> {
  await clearAdminCachePattern('admin:webhook:*');
}

export async function invalidateSentryCache(): Promise<void> {
  await clearAdminCachePattern('admin:sentry:*');
}

export async function invalidateBullCache(): Promise<void> {
  await clearAdminCachePattern('admin:bull:*');
}

export async function invalidateJuditCache(): Promise<void> {
  await clearAdminCache(AdminCacheKeys.juditConsumption());
}

export async function invalidateObservabilityCache(): Promise<void> {
  await clearAdminCache(AdminCacheKeys.observabilityStats());
}

/**
 * Get cache statistics
 * Returns info about cached keys
 */
export async function getAdminCacheStats(): Promise<{
  totalKeys: number;
  connected: boolean;
}> {
  const redis = getAdminRedis();
  try {
    const keys = await redis.keys('admin:*');

    return {
      totalKeys: keys.length,
      connected: true,
    };
  } catch (_error) {
    handleRedisError('STATS', error);
    return {
      totalKeys: 0,
      connected: false,
    };
  }
}

/**
 * Cache TTL constants
 * Organized by data freshness requirements
 */
export const CacheTTL = {
  // System health - real-time operations, but expensive
  HEALTH_CHECK: 300, // 5 minutes

  // Queue operations - frequently changing
  QUEUE_STATS: 120, // 2 minutes

  // Webhook operations - near-real-time
  WEBHOOK_STATS: 300, // 5 minutes

  // Error tracking - can be slightly stale
  SENTRY_STATS: 300, // 5 minutes
  SENTRY_ERRORS: 300, // 5 minutes

  // Cost tracking - historical data, stable
  COST_SUMMARY: 1800, // 30 minutes
  COST_BREAKDOWN: 3600, // 1 hour
  DAILY_COSTS: 3600, // 1 hour

  // External reports - very stable
  JUDIT_CONSUMPTION: 86400, // 24 hours

  // Observability - operational metrics
  OBSERVABILITY: 600, // 10 minutes
} as const;
