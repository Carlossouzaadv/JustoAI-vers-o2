// ================================================================
// REDIS CACHE TYPES - Type Definitions for Redis Operations
// ================================================================
// Centralizes all Redis cache structure definitions
// Provides type-safe cache operations without using Record<string, unknown>
//
// Cache Namespaces:
// - session:* - User sessions and authentication
// - analysis:* - AI analysis results and cache
// - report:* - Report generation cache
// - judit:* - JUDIT API response cache
// - timeline:* - Timeline merge deduplication cache
// - process:* - Process metadata cache
// - webhook:* - Webhook event deduplication
// - ratelimit:* - Rate limiting counters
//

// ================================================================
// CACHE ENTRY STRUCTURES
// ================================================================

/**
 * Session Cache Entry
 * Stores user session data in Redis
 */
export interface SessionCacheEntry {
  userId: string;
  workspaceId: string;
  email: string;
  role?: string;
  permissions?: string[];
  expiresAt: number; // Unix timestamp
  createdAt: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Analysis Cache Entry
 * Stores AI analysis results
 */
export interface AnalysisCacheEntry {
  caseId: string;
  documentId?: string;
  analysisType: 'FULL' | 'SUMMARY' | 'ENTITY_EXTRACTION';
  result: {
    summary?: string;
    entities?: Record<string, unknown>;
    analysis?: Record<string, unknown>;
    confidence?: number;
  };
  modelVersion: string;
  tokensUsed: number;
  costEstimated: number;
  expiresAt: number;
  createdAt: number;
}

/**
 * Report Cache Entry
 * Stores generated report data
 */
export interface ReportCacheEntry {
  reportId: string;
  caseId: string;
  reportType: string;
  format: 'PDF' | 'DOCX' | 'XLSX';
  status: 'GENERATING' | 'READY' | 'FAILED';
  sections: Array<{
    name: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }>;
  summary?: string;
  totalRecords?: number;
  generatedAt: number;
  expiresAt: number;
  fileUrl?: string;
  _error?: string;
}

/**
 * JUDIT Cache Entry
 * Stores JUDIT API response data
 */
export interface JuditCacheEntry {
  numeroCnj: string;
  requestId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  processData?: {
    numeroCnj?: string;
    status?: string;
    parties?: string[];
    movements?: Array<{
      date: string;
      type: string;
      description: string;
    }>;
  };
  lastUpdated: number;
  expiresAt: number;
  createdAt: number;
  errorMessage?: string;
}

/**
 * Timeline Deduplication Cache Entry
 * Stores content hashes for timeline merge deduplication
 */
export interface TimelineDeduplicationEntry {
  caseId: string;
  contentHash: string;
  eventType: string;
  eventDate: string; // ISO date
  entryId: string; // Reference to database ID
  source: 'DOCUMENT_UPLOAD' | 'API_JUDIT' | 'MANUAL_ENTRY' | 'SYSTEM_IMPORT' | 'AI_EXTRACTION';
  createdAt: number;
}

/**
 * Process Metadata Cache Entry
 * Stores metadata about legal processes
 */
export interface ProcessMetadataCacheEntry {
  numeroCnj: string;
  status: string;
  courtLevel: string;
  judge?: string;
  parties: string[];
  lastMovement?: {
    date: string;
    description: string;
  };
  lastUpdated: number;
  expiresAt: number;
}

/**
 * Webhook Event Deduplication Entry
 * Prevents duplicate webhook processing
 */
export interface WebhookDeduplicationEntry {
  webhookId: string;
  eventType: string;
  signature: string; // Hash of webhook payload
  processedAt: number;
  expiresAt: number;
  status: 'PROCESSED' | 'PROCESSING' | 'FAILED';
  _error?: string;
}

/**
 * Rate Limit Counter Entry
 * Tracks request counts for rate limiting
 */
export interface RateLimitEntry {
  userId: string;
  endpoint: string;
  count: number;
  windowStart: number;
  windowEnd: number;
  exceeded: boolean;
}

/**
 * Job Queue Entry
 * Stores async job metadata
 */
export interface JobQueueEntry {
  jobId: string;
  jobType: string;
  userId: string;
  workspaceId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  _error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  expiresAt: number;
}

/**
 * Authentication Token Entry
 * Stores temporary authentication tokens
 */
export interface TokenCacheEntry {
  token: string;
  userId: string;
  type: 'REFRESH' | 'RESET_PASSWORD' | 'EMAIL_VERIFICATION' | 'API_KEY';
  expiresAt: number;
  createdAt: number;
  used: boolean;
  usedAt?: number;
}

/**
 * Distributed Lock Entry
 * For preventing concurrent operations on same resource
 */
export interface DistributedLockEntry {
  resourceId: string;
  lockId: string;
  owner: string;
  acquiredAt: number;
  expiresAt: number;
  releaseToken: string;
}

// ================================================================
// CACHE KEY PATTERNS
// ================================================================

/**
 * Cache Key Builder with type safety
 * Prevents typos in cache key names
 */
export const CacheKeys = {
  // Session cache
  session: (sessionId: string) => `session:${sessionId}`,
  sessionUser: (userId: string) => `session:user:${userId}`,

  // Analysis cache
  analysisFull: (caseId: string) => `analysis:full:${caseId}`,
  analysisSummary: (caseId: string) => `analysis:summary:${caseId}`,
  analysisEntity: (documentId: string) => `analysis:entity:${documentId}`,

  // Report cache
  reportGeneration: (reportId: string) => `report:${reportId}`,
  reportList: (caseId: string) => `report:list:${caseId}`,

  // JUDIT cache
  juditProcess: (numeroCnj: string) => `judit:${numeroCnj}`,
  juditRequest: (requestId: string) => `judit:req:${requestId}`,

  // Timeline cache
  timelineDedup: (caseId: string, contentHash: string) => `timeline:dedup:${caseId}:${contentHash}`,
  timelineEntries: (caseId: string) => `timeline:entries:${caseId}`,

  // Process metadata cache
  processMetadata: (numeroCnj: string) => `process:${numeroCnj}`,
  processList: (userId: string) => `process:list:${userId}`,

  // Webhook deduplication
  webhookDedup: (webhookId: string) => `webhook:dedup:${webhookId}`,
  webhookStatus: (webhookId: string) => `webhook:status:${webhookId}`,

  // Rate limiting
  rateLimit: (userId: string, endpoint: string) => `ratelimit:${userId}:${endpoint}`,

  // Job queue
  jobQueue: (jobId: string) => `job:${jobId}`,
  jobsList: (userId: string) => `jobs:${userId}`,

  // Authentication tokens
  token: (token: string) => `token:${token}`,
  refreshToken: (userId: string) => `refresh:${userId}`,

  // Distributed locks
  lock: (resourceId: string) => `lock:${resourceId}`,
} as const;

// ================================================================
// CACHE OPERATION WRAPPERS
// ================================================================

/**
 * Cached Value Result Type
 * Either the cached value exists or it doesn't
 */
export type CachedValueResult<T> =
  | { success: true; data: T }
  | { success: false; data: null };

/**
 * Cache Set Options
 * Configuration for setting cache values
 */
export interface CacheSetOptions {
  ttlSeconds?: number;
  overwrite?: boolean;
  nx?: boolean; // Only set if not exists
  xx?: boolean; // Only set if exists
}

/**
 * Cache Operation Result
 * Result of cache operations
 */
export interface CacheOperationResult {
  success: boolean;
  _error?: string;
  operationTime?: number;
}

/**
 * Cache Stats
 * Statistics about cache operations
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  lastUpdated: number;
}

// ================================================================
// CACHE STRATEGY TYPES
// ================================================================

/**
 * Cache Strategy
 * Different caching strategies for different use cases
 */
export type CacheStrategy = 'LRU' | 'TTL' | 'WRITE_THROUGH' | 'WRITE_BEHIND' | 'NO_CACHE';

/**
 * Cache Configuration
 * Settings for cache behavior
 */
export interface CacheConfiguration {
  enabled: boolean;
  strategy: CacheStrategy;
  defaultTtlSeconds: number;
  maxSize?: number;
  compressionEnabled?: boolean;
}

/**
 * Cacheable Function Metadata
 * Metadata for cached function results
 */
export interface CacheableMetadata {
  key: string;
  ttlSeconds: number;
  tags?: string[];
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  invalidationDeps?: string[];
}

// ================================================================
// REDIS CLIENT WRAPPER TYPES
// ================================================================

/**
 * Redis Client Options
 * Configuration for Redis connection
 */
export interface RedisClientOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: boolean;
  connectTimeout?: number;
  commandTimeout?: number;
  retryStrategy?: 'EXPONENTIAL' | 'LINEAR' | 'FIXED';
  maxRetries?: number;
  keepAlive?: number;
}

/**
 * Redis Connection State
 * Current state of Redis connection
 */
export interface RedisConnectionState {
  connected: boolean;
  ready: boolean;
  reconnecting: boolean;
  lastError?: string;
  connectionTime?: number;
}

/**
 * Redis Command Metrics
 * Metrics about Redis command execution
 */
export interface RedisCommandMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageLatencyMs: number;
  lastCommandTime: number;
}

// ================================================================
// BATCH OPERATION TYPES
// ================================================================

/**
 * Batch Cache Set Operation
 * For setting multiple cache entries atomically
 */
export interface BatchCacheSetOperation {
  key: string;
  value: unknown;
  ttlSeconds?: number;
}

/**
 * Batch Cache Delete Operation
 * For deleting multiple cache entries
 */
export interface BatchCacheDeleteOperation {
  key: string;
}

/**
 * Batch Operation Result
 * Result of batch operations
 */
export interface BatchOperationResult {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  errors?: Array<{ key: string; _error: string }>;
}

// ================================================================
// TYPE GUARDS AND HELPERS
// ================================================================

/**
 * Type guard for SessionCacheEntry
 */
export function isSessionCacheEntry(value: unknown): value is SessionCacheEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.userId === 'string' &&
    typeof obj.workspaceId === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.expiresAt === 'number'
  );
}

/**
 * Type guard for AnalysisCacheEntry
 */
export function isAnalysisCacheEntry(value: unknown): value is AnalysisCacheEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.caseId === 'string' &&
    typeof obj.analysisType === 'string' &&
    typeof obj.result === 'object' &&
    typeof obj.createdAt === 'number'
  );
}

/**
 * Type guard for JuditCacheEntry
 */
export function isJuditCacheEntry(value: unknown): value is JuditCacheEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.numeroCnj === 'string' &&
    typeof obj.requestId === 'string' &&
    typeof obj.status === 'string'
  );
}

/**
 * Type guard for CachedValueResult
 */
export function isCachedValueSuccess<T>(
  result: CachedValueResult<T>
): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard for CachedValueResult (failure case)
 */
export function isCachedValueFailure<T>(
  result: CachedValueResult<T>
): result is { success: false; data: null } {
  return result.success === false;
}
