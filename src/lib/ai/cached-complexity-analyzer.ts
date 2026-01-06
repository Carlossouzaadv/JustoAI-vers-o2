// ================================================================
// CACHED COMPLEXITY ANALYZER - Performance-Optimized Document Analysis
// ================================================================
// Wraps ComplexityAnalyzer with hash-based caching to avoid
// recalculating complexity for documents already analyzed
// Uses Redis for distributed caching across instances

import { type ComplexityScore } from '../ai-model-types';
import { ComplexityAnalyzer } from './complexity-analyzer';
import { getRedisClient } from '@/lib/redis';
import { log } from '@/lib/services/logger';
import * as crypto from 'crypto';

// ================================================================
// CONFIGURATION
// ================================================================

/** Cache TTL in seconds (24 hours) */
const CACHE_TTL_SECONDS = 86400;

/** Cache key prefix */
const CACHE_KEY_PREFIX = 'complexity:';

/** Maximum text length to hash for cache key (first 50KB) */
const MAX_TEXT_HASH_LENGTH = 50000;

// ================================================================
// CACHED COMPLEXITY ANALYZER
// ================================================================

/**
 * Cached Complexity Analyzer
 * 
 * Wraps the base ComplexityAnalyzer with Redis caching.
 * Cache hit rate improvements:
 * - Same document uploaded multiple times → instant response
 * - Duplicate documents across workspaces → instant response
 * - Retry operations → instant response
 * 
 * Expected savings: 10-30% reduction in analysis time for repeated docs
 */
export class CachedComplexityAnalyzer {
    private readonly baseAnalyzer: ComplexityAnalyzer;
    private cacheHits = 0;
    private cacheMisses = 0;

    constructor() {
        this.baseAnalyzer = new ComplexityAnalyzer();
    }

    /**
     * Analyzes document complexity with caching
     * 
     * @param text - Document text to analyze
     * @param fileSizeMB - File size in megabytes
     * @param options - Cache options
     * @returns ComplexityScore with cache metadata
     */
    async analyzeComplexity(
        text: string,
        fileSizeMB: number = 0,
        options: {
            skipCache?: boolean;
            workspaceId?: string;
        } = {}
    ): Promise<ComplexityScore & { cached?: boolean; cacheKey?: string }> {

        // Generate cache key from text hash
        const cacheKey = this.generateCacheKey(text, fileSizeMB);

        // Skip cache if requested
        if (!options.skipCache) {
            try {
                const cached = await this.getCached(cacheKey);
                if (cached) {
                    this.cacheHits++;
                    log.info({
                        msg: '⚡ Complexity cache HIT',
                        component: 'cachedComplexityAnalyzer',
                        cacheKey: cacheKey.slice(0, 16) + '...',
                        hitRate: this.getHitRate(),
                    });
                    return { ...cached, cached: true, cacheKey };
                }
            } catch (error) {
                // Cache read failed - proceed with calculation
                log.warn({
                    msg: '⚠️ Cache read failed, calculating fresh',
                    component: 'cachedComplexityAnalyzer',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        // Cache miss - calculate complexity
        this.cacheMisses++;
        log.info({
            msg: '🔄 Complexity cache MISS - calculating',
            component: 'cachedComplexityAnalyzer',
            cacheKey: cacheKey.slice(0, 16) + '...',
            hitRate: this.getHitRate(),
        });

        const result = this.baseAnalyzer.analyzeComplexity(text, fileSizeMB);

        // Store in cache (non-blocking)
        this.setCached(cacheKey, result).catch((error) => {
            log.warn({
                msg: '⚠️ Failed to cache complexity result',
                component: 'cachedComplexityAnalyzer',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        });

        return { ...result, cached: false, cacheKey };
    }

    /**
     * Synchronous analysis without caching (for immediate results)
     * Delegates to base analyzer directly
     */
    analyzeComplexitySync(text: string, fileSizeMB: number = 0): ComplexityScore {
        return this.baseAnalyzer.analyzeComplexity(text, fileSizeMB);
    }

    /**
     * Detects document type (delegates to base analyzer)
     */
    detectDocumentType(text: string) {
        return this.baseAnalyzer.detectDocumentType(text);
    }

    /**
     * Generates cache key from document content
     * Uses SHA-256 hash of first N characters + file size
     */
    private generateCacheKey(text: string, fileSizeMB: number): string {
        const textToHash = text.slice(0, MAX_TEXT_HASH_LENGTH);
        const hash = crypto
            .createHash('sha256')
            .update(`${textToHash}:${fileSizeMB}`)
            .digest('hex')
            .slice(0, 32); // First 32 chars of hash

        return `${CACHE_KEY_PREFIX}${hash}`;
    }

    /**
     * Gets cached complexity result
     */
    private async getCached(cacheKey: string): Promise<ComplexityScore | null> {
        const redis = getRedisClient();
        const cached = await redis.get(cacheKey);

        if (!cached) return null;

        try {
            return JSON.parse(cached) as ComplexityScore;
        } catch {
            return null;
        }
    }

    /**
     * Stores complexity result in cache
     */
    private async setCached(cacheKey: string, result: ComplexityScore): Promise<void> {
        const redis = getRedisClient();
        await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
    }

    /**
     * Invalidates cache for a specific document
     */
    async invalidateCache(text: string, fileSizeMB: number = 0): Promise<void> {
        const cacheKey = this.generateCacheKey(text, fileSizeMB);
        const redis = getRedisClient();
        await redis.del(cacheKey);

        log.info({
            msg: '🗑️ Complexity cache invalidated',
            component: 'cachedComplexityAnalyzer',
            cacheKey: cacheKey.slice(0, 16) + '...',
        });
    }

    /**
     * Gets cache statistics
     */
    getStats(): { hits: number; misses: number; hitRate: string } {
        return {
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate: this.getHitRate(),
        };
    }

    /**
     * Calculates hit rate percentage
     */
    private getHitRate(): string {
        const total = this.cacheHits + this.cacheMisses;
        if (total === 0) return '0%';
        return `${Math.round((this.cacheHits / total) * 100)}%`;
    }

    /**
     * Warms up cache for frequently analyzed documents
     */
    async warmCache(documents: { text: string; fileSizeMB?: number }[]): Promise<number> {
        let warmed = 0;

        for (const doc of documents) {
            await this.analyzeComplexity(doc.text, doc.fileSizeMB || 0);
            warmed++;
        }

        log.info({
            msg: `🔥 Cache warmed with ${warmed} documents`,
            component: 'cachedComplexityAnalyzer',
        });

        return warmed;
    }
}

// Export singleton instance
export const cachedComplexityAnalyzer = new CachedComplexityAnalyzer();

// Also export the base analyzer for direct access when needed
export { complexityAnalyzer } from './complexity-analyzer';
