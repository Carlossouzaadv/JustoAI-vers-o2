# DEEP TECHNICAL ANALYSIS: JustoAI V2 Infrastructure & Operations

**Date:** 2025-10-15
**Scope:** Comprehensive analysis of 15 critical infrastructure questions
**Status:** Production-Ready Assessment with Gap Analysis

---

## TABLE OF CONTENTS

1. [File Storage & Lifecycle Policies](#1-file-storage--lifecycle-policies)
2. [Encryption & KMS](#2-encryption--kms)
3. [Multitenancy Schema & Isolation](#3-multitenancy-schema--isolation)
4. [Locking & Idempotency Specification](#4-locking--idempotency-specification)
5. [Cache Key Versioning](#5-cache-key-versioning---complete-function)
6. [Rate Limiting Per Workspace](#6-rate-limiting-per-workspace)
7. [Worker Scaling & Queue Management](#7-worker-scaling--queue-management)
8. [Retries, Backoff & DLQ](#8-retries-backoff--dlq)
9. [Monitoring, Metrics & Alert Rules](#9-monitoring-metrics--alert-rules)
10. [API Error Contracts](#10-api-error-contracts)
11. [Temp File Lifecycle](#11-temp-file-lifecycle)
12. [Cost Breakdown Per Operation](#12-cost-breakdown-per-operation)
13. [Sanitization & AV Scanning](#13-sanitization--av-scanning)
14. [Data Retention & Compliance](#14-data-retention--compliance)
15. [E2E Test Infrastructure](#15-e2e-test-infrastructure)

---

## 1. FILE STORAGE & LIFECYCLE POLICIES

### Current Implementation

**Storage Strategy:**
```typescript
// Local Filesystem ONLY (src/app/api/documents/upload/route-new.ts:560-573)
const UPLOAD_DIR = './uploads/pdfs/';
const TEMP_DIR = './uploads/temp/';

// Pattern:
// - Temp: ./uploads/temp/{workspaceId}/{timestamp}_{filename}
// - Final: ./uploads/pdfs/{workspaceId}/{sha256}.pdf
```

**Locations:**
- **PDFs:** `./uploads/pdfs/{workspaceId}/{textSha}.pdf`
- **Excel Temp:** `/tmp/excel_uploads/{workspaceId}/{timestamp}_{filename}`
- **Database:** PostgreSQL (Supabase/Railway) stores metadata only

### Lifecycle Policy

**Status: ⚠️ NOT IMPLEMENTED**

Current situation:
- Files persist indefinitely on local FS
- No automatic cleanup
- No cold storage migration
- No S3/GCS integration

### GAPS IDENTIFIED

1. **No Cloud Storage Integration**
   - Files stored on ephemeral Railway FS
   - Risk: Container restart = data loss
   - No CDN for faster retrieval

2. **No Lifecycle Management**
   - Missing TTL policies
   - Missing cold storage (>30 days → Glacier/Coldline)
   - Missing auto-deletion of temp files

3. **Scalability Issues**
   - Local FS doesn't scale horizontally
   - No multi-region support

### RECOMMENDED ARCHITECTURE

```typescript
// Proposed implementation:
interface StorageStrategy {
  hot: {
    provider: 'S3' | 'GCS',
    bucket: 'justoai-hot',
    region: 'us-east-1',
    ttl_days: 90,
    access_tier: 'STANDARD'
  },
  warm: {
    provider: 'S3_IA' | 'GCS_NEARLINE',
    bucket: 'justoai-warm',
    ttl_days: 365,
    transition_from_hot: 90
  },
  cold: {
    provider: 'GLACIER' | 'ARCHIVE',
    bucket: 'justoai-cold',
    retention_years: 7, // Compliance
    transition_from_warm: 365
  }
}

// Cleanup policy:
// - Temp files (requiresUserDecision): 24h TTL
// - Cache files: 7 days TTL
// - Duplicates: Reference only, no physical storage
```

---

## 2. ENCRYPTION & KMS

### Current Implementation

**Status: ⚠️ PARTIAL - TRANSIT ONLY**

```typescript
// lib/redis.ts:48-49
tls: url.protocol === 'rediss:' ? {} : undefined,  // TLS for Redis

// Supabase connection (implicit)
DATABASE_URL = postgres://.../...?sslmode=require
```

**What's Encrypted:**
- ✅ **In-Transit:** TLS for Redis, PostgreSQL, API calls
- ❌ **At-Rest:** NOT explicitly encrypted (relying on provider defaults)
- ❌ **Application-Level:** No field-level encryption

**KMS Management:**

**Status: ❌ NOT IMPLEMENTED**

No explicit KMS usage found in codebase:
- No AWS KMS integration
- No GCP Cloud KMS
- No HashiCorp Vault
- No envelope encryption

### GAPS IDENTIFIED

1. **At-Rest Encryption Dependency**
   - Relying 100% on Railway/Supabase default encryption
   - No control over keys
   - No key rotation policy
   - No BYOK (Bring Your Own Key)

2. **Sensitive Data Exposure**
   ```typescript
   // Stored in plaintext:
   // - Client.document (CPF/CNPJ)
   // - User.email
   // - CaseDocument.extractedText (may contain PII)
   ```

3. **No Secrets Management**
   ```bash
   # .env contains plaintext secrets:
   JUDIT_API_KEY=xxx
   REDIS_URL=rediss://default:password@...
   DATABASE_URL=postgresql://...
   ```

### RECOMMENDED IMPLEMENTATION

```typescript
// 1. Field-Level Encryption (PII)
import { createCipheriv, createDecipheriv } from 'crypto';

class FieldEncryption {
  private kms: AWS.KMS | GCP.KMS;

  async encryptField(plaintext: string, keyId: string): Promise<string> {
    // Get DEK from KMS
    const dek = await this.kms.generateDataKey({ KeyId: keyId });

    // Encrypt with AES-256-GCM
    const cipher = createCipheriv('aes-256-gcm', dek.Plaintext, iv);
    const encrypted = cipher.update(plaintext, 'utf8', 'base64');

    // Store: encryptedDEK + iv + ciphertext + authTag
    return JSON.stringify({
      dek: dek.CiphertextBlob.toString('base64'),
      iv: iv.toString('base64'),
      data: encrypted,
      tag: cipher.getAuthTag().toString('base64')
    });
  }
}

// 2. Prisma Middleware for Auto-Encryption
prisma.$use(async (params, next) => {
  if (params.model === 'Client' && params.action === 'create') {
    if (params.args.data.document) {
      params.args.data.document = await encrypt(params.args.data.document);
    }
  }
  return next(params);
});

// 3. KMS Key Hierarchy
// - Master Key (KMS-managed, auto-rotated yearly)
//   └─ Data Encryption Keys (DEK, generated per-field)
//       └─ Encrypted data
```

**Compliance Requirements:**
- LGPD (Brazil): PII encryption mandatory
- SOC 2 Type II: Key rotation required
- ISO 27001: Encryption at rest

---

## 3. MULTITENANCY SCHEMA & ISOLATION

### Current Implementation

**Strategy: ROW-LEVEL SECURITY via `workspaceId`**

```prisma
// prisma/schema.prisma:10-48
model Workspace {
  id     String @id @default(cuid())
  slug   String @unique
  plan   Plan   @default(FREE)

  // Relations (1:N)
  cases                Case[]
  clients              Client[]
  aiCache              AiCache[]
  monitoredProcesses   MonitoredProcess[]
  // ... +20 more relations
}

// Every tenant-scoped model:
model Case {
  workspaceId String
  // ...
  workspace   Workspace @relation(...)

  @@map("cases")
}
```

**Isolation Mechanism:**

```typescript
// Query pattern (application-level filtering):
await prisma.case.findMany({
  where: {
    workspaceId: session.workspaceId, // ← CRITICAL filter
    status: 'ACTIVE'
  }
});
```

**Indexes:**
```prisma
// Multi-column indexes for tenant isolation:
@@unique([workspaceId, processNumber])  // MonitoredProcess
@@unique([workspaceId, cacheKey])        // AiCache
@@index([workspaceId, createdAt])        // Most tables
```

### SECURITY ANALYSIS

**✅ Strengths:**
1. **Shared Schema = Cost Efficient**
   - Single DB, single connection pool
   - Scales to 10k+ workspaces easily

2. **Indexed Properly**
   - All queries have `workspaceId` in WHERE clause
   - Composite indexes for common query patterns

3. **Cascade Deletion**
   ```prisma
   workspace @relation(..., onDelete: Cascade)
   ```
   - Deleting workspace auto-deletes all related data

**⚠️ GAPS IDENTIFIED:**

1. **No Database-Level RLS**
   - PostgreSQL RLS not configured
   - Relies 100% on application logic
   - Risk: Forgotten filter = data leak

2. **No Middleware Enforcement**
   ```typescript
   // Missing global middleware:
   prisma.$use(async (params, next) => {
     // Should enforce workspaceId on ALL queries
     if (!params.args.where?.workspaceId) {
       throw new Error('Missing workspaceId filter');
     }
     return next(params);
   });
   ```

3. **Session Management**
   - No explicit session invalidation on workspace change
   - JWT may contain stale workspaceId

### RECOMMENDED HARDENING

```sql
-- PostgreSQL Row-Level Security (RLS)
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON cases
  USING (workspace_id = current_setting('app.workspace_id')::text);

-- Set per-request:
SET LOCAL app.workspace_id = 'clxxx';
```

```typescript
// Prisma Middleware (defense-in-depth)
export function enforceTenancy(prisma: PrismaClient) {
  prisma.$use(async (params, next) => {
    const TENANT_MODELS = ['Case', 'Client', 'CaseDocument', ...];

    if (TENANT_MODELS.includes(params.model)) {
      // Enforce workspaceId on reads
      if (params.action.startsWith('find')) {
        params.args.where = {
          ...params.args.where,
          workspaceId: getRequestContext().workspaceId
        };
      }

      // Enforce on writes
      if (['create', 'update'].includes(params.action)) {
        params.args.data.workspaceId = getRequestContext().workspaceId;
      }
    }

    return next(params);
  });
}
```

---

## 4. LOCKING & IDEMPOTENCY SPECIFICATION

### Lock Implementation (Redis-based)

**Location:** `lib/analysis-cache.ts:189-225`

```typescript
// Algorithm: SETNX with TTL (NOT Redlock)
async acquireLock(analysisKey: string): Promise<CacheLockResult> {
  const lockKey = `lock:analysis:${analysisKey}`;

  // SET NX EX (atomic operation)
  const result = await this.redis.set(
    lockKey,
    Date.now().toString(),
    'EX',
    this.LOCK_TTL,  // ← 300 seconds (5 min)
    'NX'            // ← Set if Not eXists
  );

  return {
    acquired: result === 'OK',
    lockKey,
    ttl: this.LOCK_TTL
  };
}

// Config:
private readonly LOCK_TTL = 300; // 5 minutes
```

**Lock Renewal:**

**Status: ❌ NOT IMPLEMENTED**

Current behavior:
- Lock acquired once
- **No TTL extension** during long operations
- If operation takes >5min → lock expires → double-processing risk

### Idempotency on CaseDocument Creation

**Mechanism:** `textSha` Unique Constraint

```prisma
// prisma/schema.prisma:170-206
model CaseDocument {
  id         String  @id @default(cuid())
  textSha    String? // ← SHA256 of file content

  // Deduplication fields:
  isDuplicate        Boolean  @default(false)
  originalDocumentId String?  // Reference to original

  @@index([textSha]) // Fast dedup lookup
}

// Behavior on duplicate:
// lib/document-hash.ts:51-102
async checkDeduplication(textSha, workspaceId, prisma) {
  const existingDocument = await prisma.caseDocument.findFirst({
    where: {
      textSha,
      case: { workspaceId }
    }
  });

  if (existingDocument) {
    // Return reference, don't create new
    return {
      isDuplicate: true,
      originalDocumentId: existingDocument.id
    };
  }

  return { isDuplicate: false };
}
```

**Violation Handling:**

```typescript
// Current: Try-catch at application level
try {
  await prisma.caseDocument.create({ data: { textSha, ... } });
} catch (error) {
  if (error.code === 'P2002') { // Unique constraint violation
    // Prisma error: NOT currently handled explicitly
    throw new Error('Duplicate document detected');
  }
}
```

### GAPS & ISSUES

1. **Single-Instance Lock (Not Distributed)**
   - Uses SETNX (correct) but NOT Redlock algorithm
   - Vulnerable to:
     - Redis failover (lock lost)
     - Clock drift between instances
   - **OK for single-instance, FAILS for multi-instance**

2. **No Lock Renewal**
   ```typescript
   // Missing implementation:
   async renewLock(lockKey: string): Promise<boolean> {
     const remaining = await redis.ttl(lockKey);
     if (remaining > 0 && remaining < 60) {
       await redis.expire(lockKey, 300); // Extend
       return true;
     }
     return false;
   }
   ```

3. **Idempotency Keys Missing**
   - No request-level idempotency (e.g., `Idempotency-Key` header)
   - Duplicate API call = duplicate processing (PDF upload)

### RECOMMENDED IMPLEMENTATION

```typescript
// 1. Distributed Lock (Redlock)
import Redlock from 'redlock';

const redlock = new Redlock(
  [redis1, redis2, redis3], // Multi-master
  {
    driftFactor: 0.01,
    retryCount: 10,
    retryDelay: 200,
    retryJitter: 200
  }
);

// 2. Auto-Renewal
class LockManager {
  private renewalIntervals = new Map<string, NodeJS.Timer>();

  async acquireWithRenewal(key: string): Promise<Redlock.Lock> {
    const lock = await redlock.acquire([`lock:${key}`], 5000);

    // Auto-renew every 2.5s (50% of TTL)
    const interval = setInterval(async () => {
      try {
        await lock.extend(5000);
      } catch (error) {
        clearInterval(interval);
        throw new Error('Lock renewal failed');
      }
    }, 2500);

    this.renewalIntervals.set(key, interval);
    return lock;
  }
}

// 3. API-Level Idempotency
interface IdempotentRequest {
  idempotencyKey: string; // From header
  endpoint: string;
  method: string;
  body: string;
  response: any;
  createdAt: Date;
}

// Redis storage:
const key = `idempotency:${idempotencyKey}`;
const existing = await redis.get(key);
if (existing) {
  return JSON.parse(existing).response; // Return cached
}

// Process request...
await redis.setex(key, 86400, JSON.stringify({
  response,
  createdAt: new Date()
}));
```

---

## 5. CACHE KEY VERSIONING - COMPLETE FUNCTION

### AI Cache Manager Implementation

**Location:** `lib/ai-cache-manager.ts:314-337`

```typescript
// ================================================================
// COMPLETE buildCacheKey IMPLEMENTATION
// ================================================================

private buildCacheKey(key: string, type: string): string {
  if (this.config.aggressive_mode) {
    // Modo agressivo: cache mais genérico para máxima reutilização
    return `${type}:${this.hashString(key)}`;
  }
  return `${type}:${key}`;
}

private hashString(str: string): string {
  // Hash simples para keys
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Usage patterns:
// 1. ESSENTIAL ANALYSIS
getEssential(textHash: string) {
  return this.get(`essential:${textHash}`, 'essential');
  // Key: essential:{hash_of_textHash} (if aggressive)
  // or   essential:essential:{textHash}
}

// 2. STRATEGIC ANALYSIS (with complexity tier)
getStrategic(textHash: string, complexityScore: number) {
  const tierKey = this.getTierFromComplexity(complexityScore);
  return this.get(`strategic:${tierKey}:${textHash}`, 'strategic');
  // Key: strategic:{hash_of_"strategic:flash:abc123"}
}

private getTierFromComplexity(score: number): string {
  if (score <= 25) return 'flash8b';
  if (score <= 49) return 'flash';
  return 'pro';
}

// 3. REPORT GENERATION
getReport(reportHash: string) {
  return this.get(`report:${reportHash}`, 'report');
}
```

### Analysis Cache (More Sophisticated)

**Location:** `lib/analysis-cache.ts:68-84`

```typescript
// ================================================================
// COMPLETE generateAnalysisKey IMPLEMENTATION (WITH VERSIONING)
// ================================================================

private generateAnalysisKey(
  textShas: string[],
  modelVersion: string,         // ← VERSION 1
  promptSignature: string,       // ← VERSION 2 (hash of prompt)
  lastMovementDate?: Date        // ← VERSION 3 (invalidation trigger)
): string {
  // Sort for consistency (order-independent)
  const sortedTextShas = [...textShas].sort();

  // Include movement date for cache invalidation
  const movementDateStr = lastMovementDate?.toISOString() || 'no-movements';

  // Composite key with all versions
  const keyData = [
    sortedTextShas.join('|'),
    modelVersion,           // e.g., "gemini-1.5-flash-v1.2"
    promptSignature,        // e.g., SHA256("Extract parties and dates...")
    movementDateStr         // e.g., "2024-01-15T10:30:00.000Z"
  ].join('|');

  // Final key: SHA256 of composite
  return createHash('sha256').update(keyData).digest('hex');
}

// Usage:
const analysisKey = generateAnalysisKey(
  ['abc123...', 'def456...'],    // Document SHAs
  'gemini-1.5-flash-v1.2',       // Model version
  'prompt_v3_2024-01',           // Prompt signature
  new Date('2024-01-15')         // Last movement
);
// → "7f3a9b2c..." (64-char hex)
```

### Versioning Strategy

```typescript
// 1. Model Version Format
const MODEL_VERSIONS = {
  'gemini-1.5-flash-8b': 'v1.0',
  'gemini-1.5-flash': 'v1.2',
  'gemini-1.5-pro': 'v2.1'
};

// 2. Prompt Versioning (hash-based)
function getPromptSignature(promptTemplate: string): string {
  // Include prompt content + structure version
  const versionedPrompt = `v3_2024-01:${promptTemplate}`;
  return createHash('sha256').update(versionedPrompt).digest('hex').substring(0, 16);
}

// 3. Cache Invalidation Trigger
// When new movement detected:
checkAnalysisCache(textShas, modelVersion, promptSignature, lastMovementDate) {
  const cached = await redis.get(cacheKey);
  if (cached) {
    const cacheCreatedAt = new Date(JSON.parse(cached).cachedAt);

    // Invalidate if movement is newer than cache
    const isValidByMovement = !lastMovementDate || cacheCreatedAt > lastMovementDate;

    if (!isValidByMovement) {
      await redis.del(cacheKey); // Invalidate
      return { hit: false };
    }
  }
}
```

### GAPS IDENTIFIED

1. **No Global Cache Version**
   - Missing: `CACHE_VERSION = 'v2'` prefix
   - Impact: Can't bulk-invalidate on schema changes

2. **Prompt Hash Not Stored**
   - Current: `promptSignature` passed as string
   - Missing: Auto-generation from prompt content

### RECOMMENDED

```typescript
// Global versioning wrapper
const GLOBAL_CACHE_VERSION = 'v2';

function buildVersionedKey(
  type: string,
  textShas: string[],
  model: string,
  prompt: string,
  movement?: Date
): string {
  const promptHash = createHash('sha256').update(prompt).digest('hex').slice(0, 16);
  const key = generateAnalysisKey(textShas, model, promptHash, movement);

  return `${GLOBAL_CACHE_VERSION}:${type}:${key}`;
  // → "v2:analysis:7f3a9b2c..."
}

// Bulk invalidation on version bump:
await redis.keys('v1:*').then(keys => redis.del(...keys));
```

---

## 6. RATE LIMITING PER WORKSPACE

### Current Implementation

**Global Rate Limiter ONLY (No Per-Workspace Limits)**

**Location:** `lib/rate-limiter.ts:237-251`

```typescript
// JUDIT API Rate Limiter (GLOBAL, not per-workspace)
export function createJuditRateLimiter(): RateLimitedApiClient {
  return new RateLimitedApiClient(
    {
      maxTokens: 60,      // 60 calls total
      refillRate: 60,     // 1 token/second
      initialTokens: 60
    },
    {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true
    }
  );
}

// Algorithm: Token Bucket
class TokenBucketRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;

  async consume(tokens = 1): Promise<boolean> {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false; // Rate limited
  }
}
```

### GAPS IDENTIFIED

1. **No Per-Workspace Isolation**
   - One workspace can exhaust global quota
   - Noisy neighbor problem

2. **No Plan-Based Limits**
   ```prisma
   enum Plan {
     FREE     // Should have: 10 req/min
     STARTER  // Should have: 60 req/min
     PROFESSIONAL  // Should have: 300 req/min
   }
   ```

3. **No HTTP Headers**
   - Missing: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`

### RECOMMENDED IMPLEMENTATION

```typescript
// Per-Workspace Rate Limiter
class WorkspaceRateLimiter {
  private limiters = new Map<string, TokenBucketRateLimiter>();

  private getLimitsForPlan(plan: Plan): RateLimiterOptions {
    const limits = {
      FREE: { maxTokens: 10, refillRate: 10 },         // 10/min
      STARTER: { maxTokens: 60, refillRate: 60 },      // 60/min
      PROFESSIONAL: { maxTokens: 300, refillRate: 300 } // 300/min
    };
    return limits[plan];
  }

  async checkLimit(workspaceId: string, plan: Plan): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: Date;
  }> {
    // Get or create limiter for workspace
    if (!this.limiters.has(workspaceId)) {
      const options = this.getLimitsForPlan(plan);
      this.limiters.set(workspaceId, new TokenBucketRateLimiter(options));
    }

    const limiter = this.limiters.get(workspaceId)!;
    const allowed = await limiter.consume(1);
    const status = limiter.getStatus();

    return {
      allowed,
      limit: status.maxTokens,
      remaining: status.tokens,
      resetAt: new Date(Date.now() + 60000) // 1 min window
    };
  }
}

// Middleware
export async function rateLimitMiddleware(req: Request) {
  const workspaceId = getWorkspaceIdFromSession(req);
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true }
  });

  const result = await rateLimiter.checkLimit(workspaceId, workspace.plan);

  // Set response headers
  res.setHeader('X-RateLimit-Limit', result.limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

  if (!result.allowed) {
    res.setHeader('Retry-After', '60');
    return Response.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded for ${workspace.plan} plan`,
        limit: result.limit,
        retryAfter: 60
      },
      { status: 429 }
    );
  }

  return next();
}
```

**Redis-Backed Implementation (for multi-instance):**

```typescript
// Distributed rate limiting with Redis
class RedisRateLimiter {
  async checkLimit(workspaceId: string, limit: number, window: number): Promise<boolean> {
    const key = `ratelimit:${workspaceId}:${Math.floor(Date.now() / window)}`;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, window);
    }

    return current <= limit;
  }
}
```

---

## 7. WORKER SCALING & QUEUE MANAGEMENT

### Current Configuration

**Location:** `src/lib/queue/juditQueue.ts:68-98`

```typescript
const QUEUE_CONFIG = {
  name: 'judit-onboarding',
  defaultJobOptions: {
    attempts: 3,  // Retry 3 times
    backoff: {
      type: 'exponential',
      delay: 5000  // 5s → 10s → 20s
    },
    removeOnComplete: {
      age: 24 * 3600,  // Keep 24h
      count: 1000      // Keep last 1000
    },
    removeOnFail: {
      age: 7 * 24 * 3600  // Keep 7 days
    }
  }
};

// Worker instance (src/workers/juditOnboardingWorker.ts)
const worker = new Worker<JuditOnboardingJobData>(
  'judit-onboarding',
  processJob,
  {
    connection,
    concurrency: 5,  // ← Process 5 jobs simultaneously
    limiter: {
      max: 10,       // ← Max 10 jobs per...
      duration: 1000 // ← ...per second
    }
  }
);
```

### Scaling Policy

**Status: ⚠️ STATIC - NO AUTO-SCALING**

Current deployment:
- **Single worker instance** on Railway
- Fixed concurrency: 5
- No horizontal scaling
- No CPU/memory-based scaling

### GAPS IDENTIFIED

1. **No Auto-Scaling Triggers**
   - Missing: Queue depth monitoring
   - Missing: CPU/memory thresholds
   - Missing: Worker count adjustment

2. **No Load Balancing**
   - Single instance handles all jobs
   - No distribution across multiple workers

3. **No Circuit Breaker**
   - No protection against cascading failures
   - No rate limiting on failed jobs

### RECOMMENDED SCALING STRATEGY

```typescript
// 1. Queue Metrics for Scaling Decisions
interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;  // ms
  throughput: number;         // jobs/min
}

async function getQueueMetrics(): Promise<QueueMetrics> {
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount()
  ]);

  // Calculate throughput from last 60s
  const recentJobs = await queue.getCompleted(0, 100);
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  const jobsLastMinute = recentJobs.filter(j => j.finishedOn! > oneMinuteAgo);

  return {
    waiting,
    active,
    completed,
    failed,
    avgProcessingTime: calculateAvg(recentJobs.map(j => j.processedOn! - j.timestamp)),
    throughput: jobsLastMinute.length
  };
}

// 2. Auto-Scaling Rules
interface ScalingConfig {
  minWorkers: number;
  maxWorkers: number;
  scaleUpThreshold: {
    queueDepth: number;      // Scale up if >100 waiting
    processingTime: number;  // Scale up if >5min avg
    cpuPercent: number;      // Scale up if >80% CPU
  };
  scaleDownThreshold: {
    queueDepth: number;      // Scale down if <10 waiting
    idleTime: number;        // Scale down if idle >5min
  };
  cooldown: number;          // Wait 5min between scale events
}

const SCALING_CONFIG: ScalingConfig = {
  minWorkers: 1,
  maxWorkers: 10,
  scaleUpThreshold: {
    queueDepth: 100,
    processingTime: 5 * 60 * 1000,
    cpuPercent: 80
  },
  scaleDownThreshold: {
    queueDepth: 10,
    idleTime: 5 * 60 * 1000
  },
  cooldown: 5 * 60 * 1000
};

// 3. Scaling Decision Engine
class WorkerScaler {
  private lastScaleEvent = 0;

  async evaluateScaling(): Promise<'scale_up' | 'scale_down' | 'no_change'> {
    // Cooldown check
    if (Date.now() - this.lastScaleEvent < SCALING_CONFIG.cooldown) {
      return 'no_change';
    }

    const metrics = await getQueueMetrics();
    const currentWorkers = await this.getCurrentWorkerCount();

    // Scale UP conditions (any triggers scale up)
    if (
      metrics.waiting > SCALING_CONFIG.scaleUpThreshold.queueDepth ||
      metrics.avgProcessingTime > SCALING_CONFIG.scaleUpThreshold.processingTime
    ) {
      if (currentWorkers < SCALING_CONFIG.maxWorkers) {
        this.lastScaleEvent = Date.now();
        return 'scale_up';
      }
    }

    // Scale DOWN conditions (all must be true)
    if (
      metrics.waiting < SCALING_CONFIG.scaleDownThreshold.queueDepth &&
      metrics.active === 0
    ) {
      if (currentWorkers > SCALING_CONFIG.minWorkers) {
        this.lastScaleEvent = Date.now();
        return 'scale_down';
      }
    }

    return 'no_change';
  }

  async scaleUp() {
    console.log('📈 Scaling UP workers');
    // Railway: Increase replica count
    await fetch('https://api.railway.app/v1/scale', {
      method: 'POST',
      body: JSON.stringify({ replicas: currentWorkers + 1 })
    });
  }

  async scaleDown() {
    console.log('📉 Scaling DOWN workers');
    // Railway: Decrease replica count
    await fetch('https://api.railway.app/v1/scale', {
      method: 'POST',
      body: JSON.stringify({ replicas: currentWorkers - 1 })
    });
  }
}

// 4. Monitoring Loop
setInterval(async () => {
  const decision = await scaler.evaluateScaling();

  if (decision === 'scale_up') {
    await scaler.scaleUp();
  } else if (decision === 'scale_down') {
    await scaler.scaleDown();
  }
}, 60000); // Check every minute
```

**Railway-Specific Config:**

```yaml
# railway.toml
[deploy]
  # Worker service
  [deploy.worker]
    startCommand = "node dist/workers/juditOnboardingWorker.js"
    healthcheckPath = "/health"
    healthcheckTimeout = 100

    # Auto-scaling (Railway Pro required)
    [deploy.worker.autoscaling]
      minReplicas = 1
      maxReplicas = 10
      targetCPU = 70       # Scale when CPU >70%
      targetMemory = 80     # Scale when Memory >80%
```

---

## 8. RETRIES, BACKOFF & DLQ

### Current Implementation

**BullMQ Configuration:**

```typescript
// src/lib/queue/juditQueue.ts:68-84
const QUEUE_CONFIG = {
  defaultJobOptions: {
    attempts: 3,  // ← MAX 3 ATTEMPTS
    backoff: {
      type: 'exponential',
      delay: 5000  // ← BASE DELAY 5s
    },
    // Delays: 5s, 10s, 20s (exponential doubling)
    removeOnComplete: {
      age: 24 * 3600,  // 24h retention
      count: 1000
    },
    removeOnFail: {
      age: 7 * 24 * 3600  // 7 days retention
    }
  }
};
```

**API-Level Retry (JUDIT):**

```typescript
// lib/rate-limiter.ts:108-161
class ExponentialBackoffRetry {
  private readonly options: RetryOptions;

  constructor(options: {
    maxAttempts: number;  // 5 for JUDIT
    baseDelay: number;    // 1000ms
    maxDelay: number;     // 30000ms
    jitter: boolean;      // true
  }) {}

  async execute<T>(fn: () => Promise<T>): Promise<ApiCallResult<T>> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(); // Success
      } catch (error) {
        if (attempt < maxAttempts) {
          const delay = this.calculateDelay(attempt);
          await sleep(delay);
        }
      }
    }
    return { success: false, error: lastError };
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    let delay = Math.min(exponentialDelay, maxDelay);

    // Add jitter (±10%)
    if (jitter) {
      const jitterAmount = delay * 0.1;
      const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay = Math.max(0, delay + jitter);
    }

    return Math.floor(delay);
  }
}

// Example progression:
// Attempt 1: 1000ms
// Attempt 2: 2000ms ± 200ms jitter
// Attempt 3: 4000ms ± 400ms jitter
// Attempt 4: 8000ms ± 800ms jitter
// Attempt 5: 16000ms (capped at 30000ms)
```

### Dead Letter Queue (DLQ)

**Status: ⚠️ MANUAL IMPLEMENTATION**

```typescript
// Current approach: Failed jobs remain in Redis with 7-day TTL
// No explicit DLQ queue

// Accessing failed jobs:
const failedJobs = await queue.getFailed(0, 100);

// Manual reprocessing:
for (const job of failedJobs) {
  await job.retry(); // Move back to waiting
}
```

### GAPS IDENTIFIED

1. **No Dedicated DLQ**
   - Failed jobs mixed with regular jobs
   - No separate processing logic for DLQ
   - No alerting on DLQ threshold

2. **No Failure Classification**
   - All failures treated equally
   - Missing: Permanent vs Transient error detection
   - Missing: Automatic retry skip for permanent errors

3. **No Circuit Breaker**
   - Will keep retrying even if API is down
   - No temporary disable of job processing

### RECOMMENDED DLQ IMPLEMENTATION

```typescript
// 1. Dedicated DLQ Queue
const dlqQueue = new Queue('judit-onboarding-dlq', {
  connection,
  defaultJobOptions: {
    attempts: 1,  // No retries in DLQ
    removeOnFail: false,  // Keep forever (manual intervention)
    removeOnComplete: {
      age: 30 * 24 * 3600  // 30 days after resolution
    }
  }
});

// 2. Enhanced Worker with DLQ Logic
const worker = new Worker(
  'judit-onboarding',
  async (job) => {
    try {
      return await processJob(job);
    } catch (error) {
      // Classify error
      const errorType = classifyError(error);

      if (errorType === 'PERMANENT') {
        // Move to DLQ immediately (don't retry)
        await moveToDLQ(job, error, 'PERMANENT_FAILURE');
        throw error; // Mark as failed
      } else if (errorType === 'TRANSIENT') {
        // Allow retry
        throw error;
      } else if (errorType === 'RATE_LIMIT') {
        // Delay and retry with backoff
        await delay(calculateBackoff(job.attemptsMade));
        throw error;
      }
    }
  },
  {
    connection,
    concurrency: 5,
    settings: {
      // Moved failed jobs after max attempts
      stalledInterval: 30000,
      maxStalledCount: 3
    }
  }
);

// 3. Error Classification
function classifyError(error: Error): 'PERMANENT' | 'TRANSIENT' | 'RATE_LIMIT' {
  const message = error.message.toLowerCase();

  // Permanent failures (don't retry)
  if (
    message.includes('invalid cnj') ||
    message.includes('process not found') ||
    message.includes('unauthorized')
  ) {
    return 'PERMANENT';
  }

  // Rate limiting (retry with backoff)
  if (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('too many requests')
  ) {
    return 'RATE_LIMIT';
  }

  // Transient failures (retry normally)
  return 'TRANSIENT';
}

// 4. Move to DLQ
async function moveToDLQ(
  job: Job,
  error: Error,
  reason: string
): Promise<void> {
  await dlqQueue.add('failed-job', {
    originalJobId: job.id,
    originalQueue: 'judit-onboarding',
    data: job.data,
    error: {
      message: error.message,
      stack: error.stack
    },
    reason,
    failedAt: new Date(),
    attempts: job.attemptsMade
  });

  // Alert ops team
  await sendAlert({
    type: 'DLQ_ENTRY',
    severity: 'HIGH',
    message: `Job ${job.id} moved to DLQ: ${reason}`,
    metadata: { jobId: job.id, cnj: job.data.cnj }
  });
}

// 5. DLQ Processing Worker
const dlqWorker = new Worker(
  'judit-onboarding-dlq',
  async (job) => {
    // Manual intervention logic
    console.log('DLQ job requires manual review:', job.data);

    // Could implement:
    // - Slack notification
    // - Email to ops
    // - Dashboard alert
    // - Automatic analysis
  },
  { concurrency: 1 } // Process one at a time
);

// 6. DLQ Reprocessing API
app.post('/api/admin/dlq/:jobId/retry', async (req, res) => {
  const { jobId } = req.params;

  const dlqJob = await dlqQueue.getJob(jobId);
  if (!dlqJob) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Move back to main queue
  await queue.add('onboard-process', dlqJob.data.data, {
    priority: 10  // High priority for manual retry
  });

  // Remove from DLQ
  await dlqJob.remove();

  res.json({ success: true, newJobId: job.id });
});
```

**Circuit Breaker Integration:**

```typescript
// Stop processing if too many failures
class CircuitBreaker {
  private failures = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private lastFailureTime = 0;

  private readonly FAILURE_THRESHOLD = 5;  // Open after 5 failures
  private readonly TIMEOUT = 60000;         // Stay open for 60s

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if timeout elapsed
      if (Date.now() - this.lastFailureTime > this.TIMEOUT) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      // Success: Reset
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.FAILURE_THRESHOLD) {
        this.state = 'OPEN';
        console.error('⚠️ CIRCUIT BREAKER OPENED');
      }

      throw error;
    }
  }
}
```

---

## 9. MONITORING, METRICS & ALERT RULES

### Current Metrics

**Locations:**
- `src/lib/observability/metrics.ts`
- `src/lib/observability/alerting.ts`
- `lib/monitoring-telemetry.ts`

**Collected Metrics:**

```typescript
// JUDIT API Metrics (JuditTelemetry model)
interface JuditMetrics {
  success: boolean;
  responseTimeMs: number;
  docsRetrieved: number;
  movementsCount: number;
  partiesCount: number;
  errorCode?: string;
  retryCount: number;
  rateLimitHit: boolean;
}

// JUDIT Cost Tracking (JuditCostTracking model)
interface CostMetrics {
  operationType: 'ONBOARDING' | 'MONITORING_CHECK' | 'ATTACHMENT_FETCH';
  searchCost: Decimal;          // R$ 0.69 per search
  attachmentsCost: Decimal;     // R$ 0.25 per doc
  totalCost: Decimal;
  documentsRetrieved: number;
  durationMs: number;
}

// AI Cache Metrics
interface CacheMetrics {
  memory: {
    size: number;
    hits: number;
    misses: number;
    hit_rate: number;
  };
  redis: {
    connected: boolean;
    estimated_keys: number;
  };
  postgresql: {
    total_entries: number;
    tokens_saved_today: number;
    cost_saved_usd: number;
  };
}
```

### Alert System

**JuditAlert Model (Prisma):**

```prisma
model JuditAlert {
  id         String         @id
  alertType  JuditAlertType
  severity   AlertSeverity  // LOW, MEDIUM, HIGH, CRITICAL
  title      String
  message    String
  errorCode  String?
  numeroCnj  String?
  resolved   Boolean        @default(false)
  notified   Boolean        @default(false)
  createdAt  DateTime       @default(now())
}

enum JuditAlertType {
  API_ERROR
  RATE_LIMIT
  CIRCUIT_BREAKER
  HIGH_COST
  TIMEOUT
  ATTACHMENT_TRIGGER
  MONITORING_FAILED
}
```

### GAPS IDENTIFIED

**Status: ⚠️ INCOMPLETE - NO THRESHOLDS OR PLAYBOOKS**

Missing:
1. No P95/P99 latency tracking
2. No Prometheus/Grafana integration
3. No PagerDuty/Opsgenie alerts
4. No runbooks/playbooks
5. No SLO/SLI definitions

### RECOMMENDED IMPLEMENTATION

```typescript
// ================================================================
// COMPREHENSIVE METRICS SYSTEM
// ================================================================

// 1. Prometheus Metrics
import { Counter, Histogram, Gauge, register } from 'prom-client';

const metrics = {
  // Request counters
  apiRequests: new Counter({
    name: 'justoai_api_requests_total',
    help: 'Total API requests',
    labelNames: ['method', 'endpoint', 'status', 'workspace']
  }),

  // Latency histograms
  apiLatency: new Histogram({
    name: 'justoai_api_latency_seconds',
    help: 'API latency in seconds',
    labelNames: ['method', 'endpoint', 'workspace'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]  // P50, P95, P99
  }),

  // Queue depth gauge
  queueDepth: new Gauge({
    name: 'justoai_queue_depth',
    help: 'Number of jobs in queue',
    labelNames: ['queue', 'state']  // waiting, active, failed
  }),

  // AI cost tracker
  aiCost: new Counter({
    name: 'justoai_ai_cost_usd',
    help: 'AI costs in USD',
    labelNames: ['model', 'workspace', 'operation']
  }),

  // JUDIT API metrics
  juditApiCalls: new Counter({
    name: 'justoai_judit_api_calls_total',
    help: 'JUDIT API calls',
    labelNames: ['operation', 'success', 'workspace']
  }),

  juditApiLatency: new Histogram({
    name: 'justoai_judit_api_latency_ms',
    help: 'JUDIT API latency in ms',
    labelNames: ['operation'],
    buckets: [100, 500, 1000, 2000, 5000, 10000]
  }),

  juditCost: new Counter({
    name: 'justoai_judit_cost_brl',
    help: 'JUDIT costs in BRL',
    labelNames: ['operation', 'workspace']
  }),

  // Cache metrics
  cacheHitRate: new Gauge({
    name: 'justoai_cache_hit_rate',
    help: 'Cache hit rate percentage',
    labelNames: ['cache_type']  // memory, redis, postgresql
  })
};

// 2. Middleware for automatic tracking
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const workspace = getWorkspaceId(req);

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    // Record request
    metrics.apiRequests.inc({
      method: req.method,
      endpoint: req.route?.path || req.path,
      status: res.statusCode,
      workspace
    });

    // Record latency
    metrics.apiLatency.observe({
      method: req.method,
      endpoint: req.route?.path || req.path,
      workspace
    }, duration);
  });

  next();
}

// 3. Alert Rules & Thresholds
interface AlertRule {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  window: number;  // seconds
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  playbook: string;
}

const ALERT_RULES: AlertRule[] = [
  {
    name: 'API Latency P95 High',
    metric: 'justoai_api_latency_seconds{quantile="0.95"}',
    condition: 'gt',
    threshold: 5,  // >5 seconds
    window: 300,   // 5 minutes
    severity: 'HIGH',
    playbook: 'https://wiki.justoai.com/runbooks/high-latency'
  },
  {
    name: 'Queue Depth Critical',
    metric: 'justoai_queue_depth{state="waiting"}',
    condition: 'gt',
    threshold: 1000,
    window: 300,
    severity: 'CRITICAL',
    playbook: 'https://wiki.justoai.com/runbooks/queue-backlog'
  },
  {
    name: 'Error Rate High',
    metric: 'rate(justoai_api_requests_total{status=~"5.."}[5m])',
    condition: 'gt',
    threshold: 0.05,  // >5% error rate
    window: 300,
    severity: 'HIGH',
    playbook: 'https://wiki.justoai.com/runbooks/high-errors'
  },
  {
    name: 'JUDIT API Failure Rate',
    metric: 'rate(justoai_judit_api_calls_total{success="false"}[5m])',
    condition: 'gt',
    threshold: 0.10,  // >10% failure rate
    window: 300,
    severity: 'MEDIUM',
    playbook: 'https://wiki.justoai.com/runbooks/judit-failures'
  },
  {
    name: 'Redis Cache Hit Rate Low',
    metric: 'justoai_cache_hit_rate{cache_type="redis"}',
    condition: 'lt',
    threshold: 50,  // <50%
    window: 600,
    severity: 'LOW',
    playbook: 'https://wiki.justoai.com/runbooks/low-cache-hit'
  },
  {
    name: 'Daily Cost Threshold',
    metric: 'increase(justoai_ai_cost_usd[1d])',
    condition: 'gt',
    threshold: 100,  // >$100/day
    window: 86400,
    severity: 'MEDIUM',
    playbook: 'https://wiki.justoai.com/runbooks/cost-spike'
  }
];

// 4. Alert Manager
class AlertManager {
  async evaluateRule(rule: AlertRule): Promise<void> {
    const value = await this.queryMetric(rule.metric, rule.window);
    const triggered = this.checkCondition(value, rule.condition, rule.threshold);

    if (triggered) {
      await this.sendAlert({
        rule: rule.name,
        severity: rule.severity,
        value,
        threshold: rule.threshold,
        playbook: rule.playbook
      });
    }
  }

  private async sendAlert(alert: Alert): Promise<void> {
    // Send to multiple channels
    await Promise.all([
      this.sendToPagerDuty(alert),
      this.sendToSlack(alert),
      this.createJiraTicket(alert),
      this.logToDatabase(alert)
    ]);
  }

  private async sendToPagerDuty(alert: Alert): Promise<void> {
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Authorization': `Token token=${process.env.PAGERDUTY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        routing_key: process.env.PAGERDUTY_ROUTING_KEY,
        event_action: 'trigger',
        payload: {
          summary: `[${alert.severity}] ${alert.rule}`,
          severity: alert.severity.toLowerCase(),
          source: 'JustoAI Monitoring',
          custom_details: {
            value: alert.value,
            threshold: alert.threshold,
            playbook: alert.playbook
          }
        }
      })
    });
  }
}

// 5. Runbook Examples
const PLAYBOOKS = {
  'high-latency': `
## High API Latency Runbook

**Symptoms:** P95 latency >5s

**Possible Causes:**
1. Database slow queries
2. External API (JUDIT) slow
3. AI model timeouts
4. High queue depth

**Diagnosis:**
1. Check database query times:
   SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
2. Check JUDIT API metrics:
   Check justoai_judit_api_latency_ms histogram
3. Check queue depth:
   Check justoai_queue_depth gauge

**Mitigation:**
1. Scale up workers if queue depth >100
2. Enable query caching if DB slow
3. Switch to faster AI model tier
4. Implement circuit breaker for JUDIT

**Escalation:**
- If P95 >10s for >10min → Page on-call engineer
- If P95 >30s → Incident Commander
  `,

  'queue-backlog': `
## Queue Backlog Runbook

**Symptoms:** Queue depth >1000 jobs

**Immediate Actions:**
1. Scale up workers immediately:
   railway scale workers --replicas=10
2. Check worker health:
   railway logs --tail=100 worker
3. Verify Redis connection:
   redis-cli PING

**Diagnosis:**
1. Check worker concurrency:
   Current: 5, consider increasing to 10
2. Check for stuck jobs:
   queue.getStalled()
3. Check for rate limiting:
   Check justoai_judit_api_calls_total rate limit hits

**Resolution:**
1. Increase worker concurrency from 5 to 10
2. Clear stuck jobs if any
3. Monitor queue drain rate
4. Consider temporary pause of non-critical jobs
  `
};

// 6. SLO/SLI Definitions
const SLO_DEFINITIONS = {
  availability: {
    target: 99.9,  // 99.9% uptime
    measurement_window: 30 * 24 * 3600,  // 30 days
    error_budget: 0.001 * 30 * 24 * 60,  // 43.2 minutes/month
    alert_threshold: 0.0005  // Alert at 50% error budget consumption
  },
  latency: {
    target_p95: 2000,  // P95 <2s
    target_p99: 5000,  // P99 <5s
    measurement_window: 24 * 3600,  // 24 hours
    alert_threshold: 1.2  // Alert if 20% over target
  },
  success_rate: {
    target: 99.5,  // 99.5% success rate
    measurement_window: 24 * 3600,
    error_budget: 0.005 * 86400,  // 432 seconds/day
    alert_threshold: 0.5
  }
};
```

**Grafana Dashboard (JSON):**

```json
{
  "dashboard": {
    "title": "JustoAI Production Metrics",
    "panels": [
      {
        "title": "API Latency P95/P99",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(justoai_api_latency_seconds_bucket[5m]))"
          },
          {
            "expr": "histogram_quantile(0.99, rate(justoai_api_latency_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Queue Depth",
        "targets": [
          {
            "expr": "justoai_queue_depth{state='waiting'}"
          }
        ]
      },
      {
        "title": "Error Rate (%)",
        "targets": [
          {
            "expr": "rate(justoai_api_requests_total{status=~'5..'}[5m]) / rate(justoai_api_requests_total[5m]) * 100"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "justoai_cache_hit_rate"
          }
        ]
      },
      {
        "title": "Daily Costs (USD)",
        "targets": [
          {
            "expr": "increase(justoai_ai_cost_usd[1d])"
          },
          {
            "expr": "increase(justoai_judit_cost_brl[1d]) / 5.5"
          }
        ]
      }
    ]
  }
}
```

---

## 10. API ERROR CONTRACTS

### Current Implementation

**Status: ⚠️ PARTIAL - NOT FULLY STANDARDIZED**

```typescript
// Standard error format (inconsistent across endpoints)
interface ApiError {
  error: {
    code: string;     // 'RATE_LIMIT_EXCEEDED', 'INVALID_CNJ', etc.
    message: string;
    details?: object;
    requestId?: string;
  };
  status: number;
}
```

### GAPS IDENTIFIED

1. **No Consistent Error Format**
   - Different endpoints return different error structures
   - Some return `{ error: string }`, others `{ message: string }`

2. **Missing Error Codes**
   - No enum of standard error codes
   - Hard to parse errors programmatically

3. **No Request IDs**
   - Can't trace errors across services
   - No correlation between frontend/backend logs

### RECOMMENDED IMPLEMENTATION

```typescript
// Standardized error response
interface StandardApiError {
  error: {
    code: ErrorCode;           // Enum value
    message: string;            // Human-readable
    details?: Record<string, any>;  // Additional context
    requestId: string;          // Unique per request
    timestamp: string;          // ISO 8601
    path: string;               // Request path
  };
}

enum ErrorCode {
  // Client errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_CNJ = 'INVALID_CNJ',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_DOCUMENT = 'DUPLICATE_DOCUMENT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
}

// Error handler middleware
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || generateRequestId();

  // Log error
  logger.error({
    requestId,
    error: {
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    },
    request: {
      method: req.method,
      path: req.path,
      body: req.body
    }
  });

  // Determine status code and error code
  const statusCode = (error as any).statusCode || 500;
  const errorCode = (error as any).code || ErrorCode.INTERNAL_ERROR;

  // Send standardized response
  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: error.message,
      details: (error as any).details,
      requestId,
      timestamp: new Date().toISOString(),
      path: req.path
    }
  });
}
```

### Error Examples by Status Code

**422 - Validation Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid CNJ format",
    "details": {
      "field": "numeroProcesso",
      "value": "123456",
      "expected": "1234567-89.2024.8.26.0100"
    },
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/documents/upload"
  }
}
```

**429 - Rate Limit Exceeded:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded for STARTER plan",
    "details": {
      "limit": 60,
      "remaining": 0,
      "resetAt": "2024-01-15T10:31:00Z",
      "retryAfter": 60
    },
    "requestId": "req_def456",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/judit/onboarding"
  }
}
```

**503 - Service Unavailable:**
```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Redis connection unavailable",
    "details": {
      "service": "redis",
      "fallback": "Using in-memory cache"
    },
    "requestId": "req_ghi789",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/documents/upload"
  }
}
```

**500 - Internal Error:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": {
      "errorId": "err_jkl012"
    },
    "requestId": "req_mno345",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/process/analyze"
  }
}
```

---

## 11. TEMP FILE LIFECYCLE

### Current Implementation

**Status: ❌ NO AUTO-CLEANUP**

```typescript
// Files stored in:
// - ./uploads/temp/{workspaceId}/{timestamp}_{filename}
// - /tmp/excel_uploads/{workspaceId}/{timestamp}_{filename}

// NO cleanup logic found in codebase
```

**Problem:**
- Temp files persist indefinitely
- Disk space gradually consumed
- No TTL enforcement
- No cron job for cleanup

### RECOMMENDED IMPLEMENTATION

```typescript
// 1. Temp File Manager
class TempFileManager {
  private readonly TEMP_DIR = './uploads/temp/';
  private readonly TTL_HOURS = 24;  // 24h for requiresUserDecision

  /**
   * Create temp file with metadata
   */
  async createTempFile(
    workspaceId: string,
    buffer: Buffer,
    metadata: {
      originalFilename: string;
      textSha: string;
      expiresAt?: Date;
    }
  ): Promise<{
    tempPath: string;
    expiresAt: Date;
  }> {
    const timestamp = Date.now();
    const filename = `${timestamp}_${metadata.originalFilename}`;
    const tempPath = path.join(this.TEMP_DIR, workspaceId, filename);

    // Ensure directory exists
    await fs.mkdir(path.dirname(tempPath), { recursive: true });

    // Write file
    await fs.writeFile(tempPath, buffer);

    // Write metadata for cleanup job
    const expiresAt = metadata.expiresAt || new Date(Date.now() + this.TTL_HOURS * 60 * 60 * 1000);
    const metadataPath = `${tempPath}.meta`;
    await fs.writeFile(metadataPath, JSON.stringify({
      ...metadata,
      createdAt: new Date(),
      expiresAt
    }));

    return { tempPath, expiresAt };
  }

  /**
   * Cleanup expired temp files
   */
  async cleanupExpired(): Promise<{
    deleted: number;
    errors: number;
  }> {
    let deleted = 0;
    let errors = 0;

    try {
      const workspaces = await fs.readdir(this.TEMP_DIR);

      for (const workspaceId of workspaces) {
        const workspaceDir = path.join(this.TEMP_DIR, workspaceId);
        const files = await fs.readdir(workspaceDir);

        for (const file of files) {
          // Skip metadata files
          if (file.endsWith('.meta')) continue;

          const filePath = path.join(workspaceDir, file);
          const metaPath = `${filePath}.meta`;

          try {
            // Check metadata for expiration
            if (await fs.access(metaPath).then(() => true).catch(() => false)) {
              const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));

              if (new Date(metadata.expiresAt) < new Date()) {
                // Expired: Delete file and metadata
                await fs.unlink(filePath);
                await fs.unlink(metaPath);
                deleted++;
                console.log(`Deleted expired temp file: ${file}`);
              }
            } else {
              // No metadata: Delete if older than TTL
              const stats = await fs.stat(filePath);
              const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

              if (ageHours > this.TTL_HOURS) {
                await fs.unlink(filePath);
                deleted++;
                console.log(`Deleted old temp file (no metadata): ${file}`);
              }
            }
          } catch (error) {
            errors++;
            console.error(`Error processing ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Cleanup job failed:', error);
      errors++;
    }

    return { deleted, errors };
  }
}

// 2. Cron Job for Cleanup
import cron from 'node-cron';

const tempFileManager = new TempFileManager();

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Starting temp file cleanup job...');

  const result = await tempFileManager.cleanupExpired();

  console.log(`Cleanup complete: ${result.deleted} files deleted, ${result.errors} errors`);

  // Alert if too many errors
  if (result.errors > 10) {
    await sendAlert({
      type: 'CLEANUP_ERRORS',
      severity: 'MEDIUM',
      message: `Temp file cleanup had ${result.errors} errors`
    });
  }
});

// 3. Manual Cleanup API
app.post('/api/admin/cleanup/temp-files', async (req, res) => {
  const result = await tempFileManager.cleanupExpired();

  res.json({
    success: true,
    deleted: result.deleted,
    errors: result.errors
  });
});

// 4. Disk Space Monitoring
async function checkDiskSpace(): Promise<{
  available: number;
  used: number;
  total: number;
}> {
  const disk = await checkDiskSpace('/');

  return {
    available: disk.free,
    used: disk.used,
    total: disk.size
  };
}

// Alert if disk >80% full
cron.schedule('0 * * * *', async () => {  // Hourly
  const disk = await checkDiskSpace();
  const usagePercent = (disk.used / disk.total) * 100;

  if (usagePercent > 80) {
    await sendAlert({
      type: 'DISK_SPACE_WARNING',
      severity: 'HIGH',
      message: `Disk usage at ${usagePercent.toFixed(1)}%`,
      metadata: disk
    });
  }
});
```

---

## 12. COST BREAKDOWN PER OPERATION

### Detailed Cost Analysis

**For 1,000 Documents:**

```
AI COSTS (1k documents, ~50k tokens each):
├─ With Router + Cache (70% hit rate):
│   ├─ Flash 8B (40%): 400 docs × $0.0375/1M × 50k = $0.75
│   ├─ Flash (45%): 450 docs × $0.075/1M × 50k = $1.69
│   ├─ Pro (15%): 150 docs × $1.25/1M × 50k = $9.38
│   ├─ Cache hits (70%): 700 docs × $0 = $0
│   └─ TOTAL: ~$12/1k docs (with cache)
│       Without cache: ~$40/1k docs (233% more expensive)

JUDIT API COSTS (1k processes):
├─ Onboarding: 1000 × R$ 0.69 = R$ 690 (~$125 USD)
├─ Monitoring (monthly): 1000 × R$ 0.69 × 30 = R$ 20,700 (~$3,763)
│   └─ With keyword optimization: R$ 834.50 (~$152) - 96% reduction
└─ TOTAL: ~$277/month for 1k processes

STORAGE (10k documents):
├─ Railway FS: $0 (included)
├─ PostgreSQL (metadata): $0.01/GB = ~$0.10
└─ TOTAL: ~$0.10/10k docs

INFRASTRUCTURE:
├─ Railway (web + worker): $7.45/month
├─ Vercel (frontend): $0/month
├─ Upstash Redis: $10-15/month
├─ Supabase PostgreSQL: $0/month (free tier)
└─ TOTAL: ~$20/month base cost
```

### Cost Breakdown Per Component

**For 10,000 Documents:**

| Component | Per Doc | Per 1k Docs | Per 10k Docs |
|-----------|---------|-------------|--------------|
| AI Analysis (with cache) | $0.012 | $12 | $120 |
| AI Analysis (no cache) | $0.040 | $40 | $400 |
| JUDIT Onboarding | $0.125 | $125 | $1,250 |
| JUDIT Monitoring (30d) | $0.152/mo | $152/mo | $1,520/mo |
| Storage (FS) | $0 | $0 | $0 |
| Storage (DB metadata) | $0.00001 | $0.01 | $0.10 |
| **TOTAL (onboarding)** | **$0.137** | **$137** | **$1,370** |
| **TOTAL (monthly ops)** | **$0.164/mo** | **$164/mo** | **$1,640/mo** |

### Optimization Impact

**Cache Hit Rate Scenarios:**

| Cache Hit Rate | AI Cost/1k | Savings | Monthly Ops Cost |
|----------------|------------|---------|------------------|
| 0% (no cache) | $40 | - | $192 |
| 50% | $20 | 50% | $172 |
| 70% (current) | $12 | 70% | $164 |
| 90% (optimal) | $4 | 90% | $156 |

**JUDIT Keyword Optimization:**

| Strategy | Monthly Cost (1k processes) | Savings |
|----------|----------------------------|---------|
| Fetch all attachments | R$ 20,700 (~$3,763) | - |
| Keyword-based fetch | R$ 834.50 (~$152) | 96% |

---

## 13. SANITIZATION & AV SCANNING

### Current Implementation

**Status: ❌ NOT IMPLEMENTED**

No antivirus or sanitization logic found in codebase:
- No file scanning before storage
- No malware detection
- No macro stripping from Office docs
- No content sanitization

### GAPS IDENTIFIED

1. **Security Risk**
   - Malicious files can be uploaded
   - No protection against malware
   - No scanning of PDFs for exploits

2. **Compliance Risk**
   - SOC 2 requires malware scanning
   - ISO 27001 requires file validation

3. **Data Integrity Risk**
   - Corrupted files may crash processors
   - No validation of file structure

### RECOMMENDED IMPLEMENTATION

```typescript
// 1. ClamAV Integration
import ClamScan from 'clamscan';

class AntivirusScanner {
  private clamscan: ClamScan;

  async initialize() {
    this.clamscan = await new ClamScan().init({
      removeInfected: true,  // Auto-delete infected files
      quarantineInfected: './quarantine/',
      clamdscan: {
        host: process.env.CLAMAV_HOST || '127.0.0.1',
        port: parseInt(process.env.CLAMAV_PORT || '3310'),
        timeout: 60000,
        localFallback: true
      },
      preference: 'clamdscan'  // Use daemon for speed
    });
  }

  async scanFile(filePath: string): Promise<{
    isClean: boolean;
    viruses: string[];
  }> {
    try {
      const { isInfected, viruses } = await this.clamscan.isInfected(filePath);

      if (isInfected) {
        console.error(`🦠 VIRUS DETECTED: ${viruses.join(', ')}`);

        // Alert security team
        await sendAlert({
          type: 'VIRUS_DETECTED',
          severity: 'CRITICAL',
          message: `Virus detected in uploaded file`,
          metadata: {
            filePath,
            viruses
          }
        });

        // File already deleted by ClamAV (removeInfected: true)
        return { isClean: false, viruses };
      }

      return { isClean: true, viruses: [] };
    } catch (error) {
      console.error('AV scan failed:', error);
      // Fail closed: Reject file if scan fails
      throw new Error('File scanning failed');
    }
  }
}

// 2. File Validation & Sanitization
class FileValidator {
  /**
   * Validate PDF structure
   */
  async validatePDF(buffer: Buffer): Promise<boolean> {
    // Check PDF magic bytes
    const header = buffer.slice(0, 4).toString();
    if (!header.startsWith('%PDF')) {
      throw new Error('Invalid PDF file');
    }

    // Check for JavaScript (potential XSS)
    const content = buffer.toString('utf-8');
    if (content.includes('/JavaScript') || content.includes('/JS')) {
      console.warn('PDF contains JavaScript - removing...');
      // Use pdf-lib to strip JavaScript
      return await this.stripPDFJavaScript(buffer);
    }

    return true;
  }

  /**
   * Validate Excel structure
   */
  async validateExcel(buffer: Buffer): Promise<boolean> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // Check for macros
      if (workbook.vbaraw) {
        throw new Error('Excel file contains macros - not allowed');
      }

      // Check number of sheets
      if (workbook.SheetNames.length > 50) {
        throw new Error('Excel file has too many sheets');
      }

      return true;
    } catch (error) {
      throw new Error('Invalid Excel file');
    }
  }

  /**
   * Strip macros from Office documents
   */
  async stripMacros(buffer: Buffer, type: 'xlsx' | 'docx'): Promise<Buffer> {
    // Use office-converter to strip macros
    // This is a placeholder - actual implementation depends on library
    return buffer;
  }
}

// 3. Upload Pipeline with Security
async function secureUpload(file: File, workspaceId: string) {
  // Step 1: File type validation
  const allowedTypes = ['application/pdf', 'application/vnd.ms-excel', ...];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not allowed');
  }

  // Step 2: File size validation
  const MAX_SIZE = 50 * 1024 * 1024;  // 50MB
  if (file.size > MAX_SIZE) {
    throw new Error('File too large');
  }

  // Step 3: Save to temp location
  const tempPath = `/tmp/scan/${Date.now()}_${file.name}`;
  await fs.writeFile(tempPath, file.buffer);

  // Step 4: Antivirus scan
  const scanner = new AntivirusScanner();
  const scanResult = await scanner.scanFile(tempPath);

  if (!scanResult.isClean) {
    await fs.unlink(tempPath);
    throw new Error('File failed virus scan');
  }

  // Step 5: Content validation
  const validator = new FileValidator();

  if (file.type === 'application/pdf') {
    await validator.validatePDF(file.buffer);
  } else if (file.type.includes('excel')) {
    await validator.validateExcel(file.buffer);
  }

  // Step 6: Move to final location
  const finalPath = `./uploads/pdfs/${workspaceId}/${file.textSha}.pdf`;
  await fs.rename(tempPath, finalPath);

  return { path: finalPath, scanResult };
}

// 4. Background Scanning (for existing files)
cron.schedule('0 2 * * *', async () => {  // Daily at 2 AM
  console.log('Starting daily virus scan of stored files...');

  const scanner = new AntivirusScanner();
  const uploadDir = './uploads/pdfs/';

  let scanned = 0;
  let infected = 0;

  // Scan all workspaces
  const workspaces = await fs.readdir(uploadDir);

  for (const workspaceId of workspaces) {
    const files = await fs.readdir(path.join(uploadDir, workspaceId));

    for (const file of files) {
      const filePath = path.join(uploadDir, workspaceId, file);

      const result = await scanner.scanFile(filePath);
      scanned++;

      if (!result.isClean) {
        infected++;

        // Mark document as infected in DB
        await prisma.caseDocument.updateMany({
          where: { path: filePath },
          data: {
            processed: false,
            ocrStatus: 'FAILED',
            summary: `Infected: ${result.viruses.join(', ')}`
          }
        });
      }
    }
  }

  console.log(`Scan complete: ${scanned} files scanned, ${infected} infected`);
});
```

**Docker Setup for ClamAV:**

```dockerfile
# docker-compose.yml
services:
  clamav:
    image: clamav/clamav:latest
    ports:
      - "3310:3310"
    volumes:
      - clamav-data:/var/lib/clamav
    environment:
      - CLAMAV_NO_FRESHCLAM=false  # Auto-update virus definitions
    healthcheck:
      test: ["CMD", "clamdscan", "--ping"]
      interval: 60s
      timeout: 10s
      retries: 3
```

---

## 14. DATA RETENTION & COMPLIANCE

### Current Implementation

**Status: ⚠️ PARTIAL - CASCADE DELETE EXISTS**

```prisma
// Workspace deletion cascades to all related data
workspace @relation(..., onDelete: Cascade)

// Example:
model Case {
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}
```

**Deletion Flow:**
- Deleting a workspace automatically deletes:
  - All cases
  - All documents
  - All clients
  - All timeline entries
  - All AI cache entries
  - All monitoring data

**What's Missing:**
- GDPR/LGPD data export endpoint
- Right to erasure automation
- Audit log of deletions
- Soft delete option
- Retention policies by data type

### GAPS IDENTIFIED

1. **No Data Export**
   - Missing: GDPR Article 20 (data portability)
   - Missing: LGPD Article 18 (right to data)

2. **No Audit Trail**
   - Can't prove compliance
   - Can't track who deleted what

3. **No Retention Policies**
   - All data kept indefinitely (until workspace deletion)
   - No automatic cleanup after X years

### RECOMMENDED IMPLEMENTATION

```typescript
// 1. Data Export (GDPR/LGPD Compliance)
app.post('/api/workspace/:id/data-export', async (req, res) => {
  const { id: workspaceId } = req.params;
  const { format } = req.body;  // 'json' | 'zip'

  // Check permissions
  const user = await getUserFromSession(req);
  const hasPermission = await checkPermission(user, workspaceId, 'EXPORT_DATA');

  if (!hasPermission) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Collect all data
  const data = {
    workspace: await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        cases: {
          include: {
            documents: true,
            events: true,
            timelineEntries: true
          }
        },
        clients: true,
        monitoredProcesses: {
          include: {
            movements: true,
            alerts: true
          }
        },
        users: true
      }
    }),
    exportedAt: new Date().toISOString(),
    exportedBy: user.email
  };

  // Create audit log
  await prisma.dataExportLog.create({
    data: {
      workspaceId,
      userId: user.id,
      format,
      recordCount: countRecords(data),
      createdAt: new Date()
    }
  });

  if (format === 'zip') {
    // Create ZIP with JSON + PDFs
    const zip = new JSZip();

    // Add metadata
    zip.file('metadata.json', JSON.stringify(data, null, 2));

    // Add all documents
    for (const caseData of data.workspace.cases) {
      for (const doc of caseData.documents) {
        const fileBuffer = await fs.readFile(doc.path);
        zip.file(`documents/${doc.id}/${doc.name}`, fileBuffer);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="workspace-${workspaceId}.zip"`);
    res.send(zipBuffer);
  } else {
    res.json(data);
  }
});

// 2. Data Erasure (Right to be Forgotten)
app.delete('/api/workspace/:id/erase', async (req, res) => {
  const { id: workspaceId } = req.params;
  const { confirm } = req.body;

  if (confirm !== 'PERMANENTLY_DELETE') {
    return res.status(400).json({
      error: 'Confirmation required',
      required: 'Set confirm to "PERMANENTLY_DELETE"'
    });
  }

  const user = await getUserFromSession(req);
  const hasPermission = await checkPermission(user, workspaceId, 'DELETE_WORKSPACE');

  if (!hasPermission) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Create audit log BEFORE deletion
  const auditEntry = await prisma.dataErasureLog.create({
    data: {
      workspaceId,
      userId: user.id,
      reason: req.body.reason || 'User requested',
      recordsDeleted: await countWorkspaceRecords(workspaceId),
      deletedAt: new Date()
    }
  });

  // Delete physical files
  const uploadDir = `./uploads/pdfs/${workspaceId}`;
  await fs.rm(uploadDir, { recursive: true, force: true });

  // Delete workspace (cascades to all related data)
  await prisma.workspace.delete({
    where: { id: workspaceId }
  });

  // Send confirmation email
  await sendEmail({
    to: user.email,
    subject: 'Workspace Deleted',
    body: `Your workspace has been permanently deleted. Audit ID: ${auditEntry.id}`
  });

  res.json({
    success: true,
    auditId: auditEntry.id,
    deletedAt: auditEntry.deletedAt
  });
});

// 3. Data Retention Policy
class DataRetentionManager {
  async enforceRetentionPolicies() {
    const policies = {
      // Delete completed batch uploads after 90 days
      batchUploads: {
        table: 'ProcessBatchUpload',
        ttl_days: 90,
        condition: { status: 'COMPLETED' }
      },

      // Delete AI cache after 7 days
      aiCache: {
        table: 'AiCache',
        ttl_days: 7,
        condition: {}
      },

      // Delete logs after 30 days
      logs: {
        table: 'GlobalLog',
        ttl_days: 30,
        condition: {}
      },

      // Archive closed cases after 7 years (legal requirement)
      closedCases: {
        table: 'Case',
        ttl_days: 7 * 365,
        condition: { status: 'CLOSED' },
        action: 'ARCHIVE'  // Don't delete, move to cold storage
      }
    };

    for (const [name, policy] of Object.entries(policies)) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.ttl_days);

      const deleted = await prisma[policy.table].deleteMany({
        where: {
          ...policy.condition,
          createdAt: { lt: cutoffDate }
        }
      });

      console.log(`Retention policy ${name}: deleted ${deleted.count} records`);
    }
  }
}

// Run daily
cron.schedule('0 3 * * *', async () => {
  const manager = new DataRetentionManager();
  await manager.enforceRetentionPolicies();
});

// 4. Audit Log Models
model DataExportLog {
  id            String   @id @default(cuid())
  workspaceId   String
  userId        String
  format        String   // 'json' | 'zip'
  recordCount   Int
  createdAt     DateTime @default(now())

  @@map("data_export_logs")
}

model DataErasureLog {
  id             String   @id @default(cuid())
  workspaceId    String
  userId         String
  reason         String?
  recordsDeleted Int
  deletedAt      DateTime

  @@map("data_erasure_logs")
}

// 5. Data Audit API
app.get('/api/workspace/:id/data-audit', async (req, res) => {
  const { id: workspaceId } = req.params;

  const audit = {
    cases: await prisma.case.count({ where: { workspaceId } }),
    documents: await prisma.caseDocument.count({
      where: { case: { workspaceId } }
    }),
    clients: await prisma.client.count({ where: { workspaceId } }),
    timelineEntries: await prisma.processTimelineEntry.count({
      where: { case: { workspaceId } }
    }),
    monitoredProcesses: await prisma.monitoredProcess.count({
      where: { workspaceId }
    }),
    aiCacheEntries: await prisma.aiCache.count({ where: { workspaceId } }),

    // Storage estimates
    documentSizeBytes: await calculateDocumentSize(workspaceId),
    databaseSizeBytes: await calculateDatabaseSize(workspaceId),

    // Compliance
    oldestRecord: await getOldestRecord(workspaceId),
    retentionStatus: await checkRetentionCompliance(workspaceId)
  };

  res.json(audit);
});
```

---

## 15. E2E TEST INFRASTRUCTURE

### Current Implementation

**Status: ⚠️ MINIMAL - ONLY UNIT TESTS**

```bash
# Existing tests (from glob results):
src/lib/__tests__/messages.test.ts
src/lib/__tests__/api-utils.test.ts
src/hooks/__tests__/use-mobile.test.ts
src/app/api/health/__tests__/route.test.ts
```

**Coverage:**
- Only 4 unit test files
- No integration tests
- No E2E tests
- No load tests
- No critical path coverage

### GAPS IDENTIFIED

1. **No Integration Tests**
   - No tests for API + DB interactions
   - No tests for worker + queue flows
   - No tests for external API integrations (JUDIT)

2. **No E2E Tests**
   - No full user journey tests
   - No browser automation
   - No screenshot comparison

3. **No Critical Path Tests**
   - Document upload flow not tested
   - Deduplication logic not tested
   - Timeline merge not tested
   - Worker processing not tested

4. **No Load/Performance Tests**
   - No queue capacity tests
   - No concurrent upload tests
   - No cache performance tests

### RECOMMENDED TEST SUITE

```typescript
// ================================================================
// INTEGRATION TESTS
// ================================================================

// tests/integration/deduplication.test.ts
describe('Document Deduplication', () => {
  let workspace: Workspace;
  let testCase: Case;

  beforeAll(async () => {
    workspace = await createTestWorkspace();
    testCase = await createTestCase(workspace.id);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('should detect duplicate by SHA256', async () => {
    const file = fs.readFileSync('./fixtures/test-process.pdf');

    // Upload first time
    const result1 = await uploadDocument({
      file,
      caseId: testCase.id,
      workspaceId: workspace.id
    });

    expect(result1.isDuplicate).toBe(false);

    // Upload same file again
    const result2 = await uploadDocument({
      file,
      caseId: testCase.id,
      workspaceId: workspace.id
    });

    expect(result2.isDuplicate).toBe(true);
    expect(result2.originalDocumentId).toBe(result1.documentId);

    // Verify only one file stored
    const documents = await prisma.caseDocument.findMany({
      where: { caseId: testCase.id }
    });

    expect(documents).toHaveLength(2);
    expect(documents.filter(d => !d.isDuplicate)).toHaveLength(1);
  });

  it('should not deduplicate across workspaces', async () => {
    const workspace2 = await createTestWorkspace();
    const testCase2 = await createTestCase(workspace2.id);
    const file = fs.readFileSync('./fixtures/test-process.pdf');

    // Upload to workspace 1
    const result1 = await uploadDocument({
      file,
      caseId: testCase.id,
      workspaceId: workspace.id
    });

    // Upload same file to workspace 2
    const result2 = await uploadDocument({
      file,
      caseId: testCase2.id,
      workspaceId: workspace2.id
    });

    // Should NOT be duplicate (different workspaces)
    expect(result2.isDuplicate).toBe(false);
  });
});

// tests/integration/timeline-merge.test.ts
describe('Timeline Merge', () => {
  it('should deduplicate similar events', async () => {
    const testCase = await createTestCase();

    // Add first event
    await createTimelineEntry({
      caseId: testCase.id,
      eventDate: new Date('2024-01-15'),
      description: 'Juntada de Petição - Protocolo 12345',
      source: 'DOCUMENT_UPLOAD'
    });

    // Add similar event (different protocol number)
    await createTimelineEntry({
      caseId: testCase.id,
      eventDate: new Date('2024-01-15'),
      description: 'Juntada petição protocolo 67890',
      source: 'API_JUDIT'
    });

    // Fetch timeline
    const timeline = await getTimeline(testCase.id);

    // Should be deduped (same normalized content)
    expect(timeline).toHaveLength(1);
    expect(timeline[0].eventType).toBe('JUNTADA');
  });

  it('should preserve events with different dates', async () => {
    const testCase = await createTestCase();

    await createTimelineEntry({
      caseId: testCase.id,
      eventDate: new Date('2024-01-15'),
      description: 'Juntada de Petição',
      source: 'DOCUMENT_UPLOAD'
    });

    await createTimelineEntry({
      caseId: testCase.id,
      eventDate: new Date('2024-01-16'),  // Different date
      description: 'Juntada de Petição',
      source: 'API_JUDIT'
    });

    const timeline = await getTimeline(testCase.id);

    // Should NOT be deduped (different dates)
    expect(timeline).toHaveLength(2);
  });
});

// tests/integration/worker-processing.test.ts
describe('Worker Processing', () => {
  it('should process Excel upload job', async () => {
    const workspace = await createTestWorkspace();
    const file = fs.readFileSync('./fixtures/test-processes.xlsx');

    // Create batch
    const batch = await createBatch({
      workspaceId: workspace.id,
      file
    });

    // Add job to queue
    const job = await addOnboardingJob(batch.id);

    // Wait for processing
    await waitForJobComplete(job.id, { timeout: 60000 });

    // Verify results
    const updatedBatch = await getBatch(batch.id);

    expect(updatedBatch.status).toBe('COMPLETED');
    expect(updatedBatch.successful).toBeGreaterThan(0);
    expect(updatedBatch.failed).toBe(0);

    // Verify processes created
    const processes = await prisma.monitoredProcess.findMany({
      where: { workspaceId: workspace.id }
    });

    expect(processes.length).toBe(updatedBatch.successful);
  });

  it('should handle JUDIT API failures gracefully', async () => {
    // Mock JUDIT API to fail
    mockJuditApi.mockFailure();

    const job = await addOnboardingJob('1234567-89.2024.8.26.0100');

    await waitForJobComplete(job.id);

    const status = await getJobStatus(job.id);

    expect(status.status).toBe('failed');
    expect(status.error).toContain('JUDIT API');

    // Verify retry attempts
    expect(status.attempts).toBe(3);  // Max attempts
  });
});

// ================================================================
// E2E TESTS (Playwright)
// ================================================================

// tests/e2e/document-upload.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Document Upload Flow', () => {
  test('complete upload journey', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@justoai.com');
    await page.fill('[name="password"]', 'test123');
    await page.click('button[type="submit"]');

    // Navigate to upload
    await page.goto('/processos/novo');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./fixtures/test-process.pdf');

    // Wait for processing
    await page.waitForSelector('.upload-success', { timeout: 30000 });

    // Verify success message
    const successMessage = page.locator('.upload-success');
    await expect(successMessage).toContainText('Upload concluído');

    // Verify document appears in list
    await page.goto('/documentos');
    const documentList = page.locator('.document-list');
    await expect(documentList).toContainText('test-process.pdf');

    // Take screenshot for visual regression
    await page.screenshot({ path: 'screenshots/upload-success.png' });
  });

  test('duplicate detection flow', async ({ page }) => {
    await page.goto('/processos/novo');

    // Upload same file twice
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./fixtures/test-process.pdf');

    await page.waitForSelector('.upload-success');

    // Upload again
    await fileInput.setInputFiles('./fixtures/test-process.pdf');

    // Should show duplicate warning
    const warning = page.locator('.duplicate-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('duplicado');
  });
});

// ================================================================
// LOAD TESTS
// ================================================================

// tests/load/queue-processing.test.ts
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100
    { duration: '2m', target: 0 }     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // P95 < 2s
    http_req_failed: ['rate<0.05']       // <5% error rate
  }
};

export default function() {
  // Test concurrent uploads
  const file = open('./fixtures/test-process.pdf', 'b');

  const res = http.post('http://localhost:3000/api/documents/upload', {
    file: http.file(file, 'test-process.pdf')
  }, {
    headers: {
      'Authorization': `Bearer ${__ENV.TEST_TOKEN}`
    }
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
    'no errors': (r) => !r.body.includes('error')
  });
}

// tests/load/queue-capacity.test.ts
describe('Queue Capacity Test', () => {
  it('should handle 1000 jobs in <10 minutes', async () => {
    const start = Date.now();

    // Add 1000 jobs
    const jobs = [];
    for (let i = 0; i < 1000; i++) {
      const cnj = `1234567-89.2024.8.26.${i.toString().padStart(4, '0')}`;
      jobs.push(addOnboardingJob(cnj));
    }

    await Promise.all(jobs);

    // Wait for all to complete
    await waitForQueueEmpty({ timeout: 10 * 60 * 1000 });

    const duration = Date.now() - start;
    const durationMinutes = duration / (1000 * 60);

    expect(durationMinutes).toBeLessThan(10);

    // Verify throughput
    const throughput = 1000 / durationMinutes;
    expect(throughput).toBeGreaterThan(100);  // >100 jobs/min
  });
});

// ================================================================
// FIXTURES & HELPERS
// ================================================================

// tests/helpers/fixtures.ts
export async function createTestWorkspace(): Promise<Workspace> {
  return await prisma.workspace.create({
    data: {
      name: `Test Workspace ${Date.now()}`,
      slug: `test-${Date.now()}`,
      plan: 'PROFESSIONAL'
    }
  });
}

export async function createTestCase(workspaceId: string): Promise<Case> {
  const client = await prisma.client.create({
    data: {
      workspaceId,
      name: 'Test Client',
      type: 'INDIVIDUAL'
    }
  });

  return await prisma.case.create({
    data: {
      workspaceId,
      clientId: client.id,
      number: `1234567-89.2024.8.26.${Date.now()}`,
      title: 'Test Case',
      status: 'ACTIVE',
      createdById: 'test-user'
    }
  });
}

export async function cleanupTestData(): Promise<void> {
  await prisma.workspace.deleteMany({
    where: {
      slug: {
        startsWith: 'test-'
      }
    }
  });
}

// ================================================================
// TEST CONFIGURATION
// ================================================================

// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/tests/**/*.test.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'lib/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};

// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});
```

---

## CRITICAL RECOMMENDATIONS SUMMARY

### HIGH PRIORITY (Implement within 1 month)

1. ✅ **Move to Cloud Storage (S3/GCS)** - Files on ephemeral FS are at risk
2. ✅ **Field-Level Encryption for PII** - LGPD compliance requirement
3. ✅ **Database-Level RLS** - Security hardening
4. ✅ **Per-Workspace Rate Limiting** - Fair usage enforcement
5. ✅ **DLQ with Error Classification** - Improve reliability

### MEDIUM PRIORITY (Implement within 3 months)

6. ✅ **Distributed Locks (Redlock)** - Multi-instance safety
7. ✅ **Auto-Scaling Workers** - Cost + performance optimization
8. ✅ **Prometheus + Grafana** - Production-grade monitoring
9. ✅ **AV Scanning** - Security compliance
10. ✅ **E2E Test Suite** - Quality assurance

### LOW PRIORITY (Nice to have)

11. ✅ **Cold Storage Migration** - Cost optimization for old files
12. ✅ **API Idempotency Keys** - Better retry handling
13. ✅ **Advanced Circuit Breakers** - Resilience improvements

---

## CONCLUSION

This document provides a comprehensive technical analysis of all 15 critical infrastructure questions for JustoAI V2. Each section includes:

- Current implementation details with code references
- Gap analysis with severity ratings
- Recommended implementations with code examples
- Configuration examples and best practices

**Next Steps:**
1. Review and prioritize recommendations with stakeholders
2. Create implementation tickets with estimates
3. Begin with HIGH PRIORITY items
4. Establish monitoring before major changes
5. Implement changes incrementally with rollback plans

**Document Maintenance:**
- Update this document as implementations are completed
- Add new sections as infrastructure evolves
- Review quarterly for accuracy

---

**Last Updated:** 2025-10-15
**Version:** 1.0
**Authors:** Technical Architecture Team
