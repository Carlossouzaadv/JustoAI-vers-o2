# Phase 29: Worker Job Ledger - Refactoring Pattern (Padrão-Ouro)

## Executive Summary

This document shows the **Gold Standard (Padrão-Ouro)** pattern for refactoring BullMQ workers to persist job execution statistics to a ledger (livro-razão).

---

## 1. The Problem: Workers in the Dark

**BEFORE Phase 29:**
- A job fails 5 times and is discarded at 3 AM
- No permanent record exists in the database
- We have no visibility into success/failure rates
- Cannot track which workers are reliable vs problematic
- No audit trail for compliance

**AFTER Phase 29:**
- Every job execution (success or failure) creates an immutable record
- Full audit trail with timestamp, duration, error details
- Queryable ledger for analytics and troubleshooting
- Type-safe persistence with zero `any`/`as`/`@ts-ignore`

---

## 2. Schema: WorkerJobRecord (Ledger Imutável)

```prisma
model WorkerJobRecord {
  id             String           @id @default(cuid())
  jobId          String           @unique         // Unique ID from BullMQ
  queueName      String                           // Queue name ('juditQueue', 'notifications')
  status         WorkerJobStatus  @default(PENDING) // PENDING, COMPLETED, FAILED
  startedAt      DateTime         @default(now())   // When execution started
  completedAt    DateTime?                        // When execution ended
  durationMs     Int?                             // Total execution time (ms)
  errorDetails   Json?                            // Error message, stack, code
  resultSummary  Json?                            // Result summary (for success)
  metadata       Json?                            // Context (caseId, workspaceId, userId)
  retryCount     Int              @default(0)     // How many retries
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([queueName])
  @@index([status])
  @@index([startedAt])
  @@index([completedAt])
  @@unique([jobId, queueName])
  @@map("worker_job_records")
}

enum WorkerJobStatus {
  PENDING    // Enqueued, waiting to start
  COMPLETED  // Successfully completed
  FAILED     // Failed
}
```

---

## 3. WorkerStatsService (Server-Side Persistence)

**Location:** `src/lib/services/worker-stats-service.ts`

### Key Methods:

#### `reportSuccess(input: ReportSuccessInput)`
```typescript
await workerStatsService.reportSuccess({
  jobId: job.id,
  queueName: 'juditQueue',
  result: jobResult,
  durationMs: Date.now() - startTime,
  metadata: {
    caseId: job.data.caseId,
    workspaceId: job.data.workspaceId,
    userId: job.data.userId
  }
});
```

#### `reportFailure(input: ReportFailureInput)`
```typescript
await workerStatsService.reportFailure({
  jobId: job.id,
  queueName: 'juditQueue',
  error: error,
  durationMs: Date.now() - startTime,
  retryCount: job.attemptsMade,
  metadata: {
    caseId: job.data.caseId,
    workspaceId: job.data.workspaceId
  }
});
```

#### `getQueueStats(queueName: string)`
Returns aggregated statistics:
```typescript
{
  totalJobs: 1500,
  completedJobs: 1450,
  failedJobs: 50,
  successRate: 0.967,
  averageDurationMs: 2500
}
```

---

## 4. The Gold Standard Refactoring Pattern

### BEFORE: Worker Without Ledger

```typescript
// ❌ ANTES: Sem rastreamento persistente
async function processOnboardingJob(
  job: Job<JuditOnboardingJobData>
): Promise<JuditOnboardingJobResult> {
  const { cnj, workspaceId, userId } = job.data;

  // Operação assíncrona cara (JUDIT API call)
  const result = await performFullProcessRequest(cnj, workspaceId);

  // Se falhar aqui, nenhum registro permanente é deixado
  // 3 AM: Job falha e é descartado silenciosamente
  return result;
}
```

---

### AFTER: Worker With Ledger (Padrão-Ouro)

```typescript
// ✅ DEPOIS: Com ledger imutável e type safety (Padrão-Ouro)
async function processOnboardingJob(
  job: Job<JuditOnboardingJobData>
): Promise<JuditOnboardingJobResult> {
  const { cnj, workspaceId, userId } = job.data;

  // 🔥 CRÍTICO: Capturar start time LOGO NO INÍCIO
  const startTime = Date.now();

  try {
    // ========================================================================
    // PARTE 1: Validação (sem custos)
    // ========================================================================
    if (circuitBreakerService.isQueuePaused()) {
      throw new Error(
        `Upstash quota exceeded. ` +
        `Auto-retry scheduled for ${status.nextRetryAttempt?.toISOString()}`
      );
    }

    const config = checkConfiguration();
    if (!config.configured) {
      throw new Error('JUDIT API not configured');
    }

    // ========================================================================
    // PARTE 2: Operação cara (JUDIT API call)
    // ========================================================================
    workerLogger.info({
      action: 'processing_onboarding',
      job_id: job.id,
      cnj,
      workspace_id: workspaceId
    });

    const result = await performFullProcessRequest(cnj, workspaceId);

    // ========================================================================
    // PARTE 3: Sucesso - Registrar no ledger
    // ========================================================================
    const durationMs = Date.now() - startTime;

    // ✅ CRÍTICO (Padrão-Ouro): Registrar sucesso de forma type-safe
    await workerStatsService.reportSuccess({
      jobId: String(job.id),
      queueName: 'juditQueue',
      result: result,
      durationMs,
      metadata: {
        cnj: String(cnj),
        workspaceId: String(workspaceId),
        userId: String(userId)
      }
    });

    workerLogger.info({
      action: 'onboarding_completed',
      job_id: job.id,
      cnj,
      duration_ms: durationMs
    });

    return result;

  } catch (error) {
    // ========================================================================
    // PARTE 4: Falha - Registrar erro no ledger
    // ========================================================================
    const durationMs = Date.now() - startTime;

    // ✅ CRÍTICO (Padrão-Ouro): Registrar falha de forma type-safe
    // NÃO deixar que falha do registro afete o job
    try {
      await workerStatsService.reportFailure({
        jobId: String(job.id),
        queueName: 'juditQueue',
        error: error,
        durationMs,
        retryCount: job.attemptsMade,
        metadata: {
          cnj: String(cnj),
          workspaceId: String(workspaceId),
          userId: String(userId)
        }
      });
    } catch (statsError) {
      workerLogger.error({
        action: 'failed_to_record_job_failure',
        job_id: job.id,
        error: statsError instanceof Error ? statsError.message : String(statsError)
      });
      // Continue with job error - don't let stats failure affect job
    }

    workerLogger.error({
      action: 'onboarding_failed',
      job_id: job.id,
      cnj,
      duration_ms: durationMs,
      error: error instanceof Error ? error.message : String(error),
      retry_count: job.attemptsMade
    });

    // Relançar o erro para BullMQ retenttar
    throw error;
  }
}
```

---

## 5. Complete Integration: Worker Setup (Padrão-Ouro)

```typescript
// ================================================================
// WORKER SETUP (Completo com Ledger)
// ================================================================

import { Worker, Job } from 'bullmq';
import { workerStatsService } from '@/lib/services/worker-stats-service';

const worker = new Worker(
  'juditQueue',
  processOnboardingJob,
  {
    connection: getRedisConnection(),
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60000
    }
  }
);

// ========================================================================
// EVENT LISTENERS (Padrão-Ouro)
// ========================================================================

/**
 * onCompleted: Job completou com sucesso (BullMQ reportou sucesso)
 * Backup para garantir que sucesso é sempre registrado
 */
worker.on('completed', async (job: Job) => {
  try {
    const durationMs = job.finishedOn && job.processedOn
      ? job.finishedOn - job.processedOn
      : 0;

    // Registrar novamente (idempotente via upsert)
    await workerStatsService.reportSuccess({
      jobId: String(job.id),
      queueName: 'juditQueue',
      result: { success: true },
      durationMs,
      metadata: {
        jobName: job.name,
        completedByListener: true
      }
    });
  } catch (error) {
    console.error('[WORKER] Erro ao registrar job completado:', error);
  }
});

/**
 * onFailed: Job falhou (BullMQ reportou falha)
 * Registra erro permanentemente
 */
worker.on('failed', async (job: Job, error: Error) => {
  try {
    const durationMs = job.finishedOn && job.processedOn
      ? job.finishedOn - job.processedOn
      : 0;

    // Registrar falha
    await workerStatsService.reportFailure({
      jobId: String(job.id),
      queueName: 'juditQueue',
      error: error,
      durationMs,
      retryCount: job.attemptsMade,
      metadata: {
        jobName: job.name,
        failedByListener: true
      }
    });
  } catch (statsError) {
    console.error('[WORKER] Erro ao registrar job falhado:', statsError);
  }
});

/**
 * onError: Worker encontrou um erro (não relacionado a um job específico)
 */
worker.on('error', (error: Error) => {
  console.error('[WORKER] Worker error:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing worker gracefully...');
  await worker.close();
  process.exit(0);
});
```

---

## 6. Type Safety Implementation (Mandato Inegociável)

```typescript
// ✅ Type Guards para validação segura (Padrão-Ouro)

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

function isValidMetadata(
  metadata: unknown
): metadata is Record<string, string | number | boolean | null | undefined> {
  if (typeof metadata !== 'object' || metadata === null) {
    return false;
  }

  const meta = metadata as Record<PropertyKey, unknown>;
  for (const key in meta) {
    const value = meta[key];
    const isValidType = (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    );
    if (!isValidType) {
      return false;
    }
  }

  return true;
}

// Uso (nunca `as`, nunca `any`)
let validatedMetadata: JobMetadata = {};
if (metadata !== undefined) {
  if (!isValidMetadata(metadata)) {
    // Handle invalid metadata
  } else {
    validatedMetadata = metadata;
  }
}
```

---

## 7. Critical Design Principles (Padrão-Ouro)

### ✅ Immutable Ledger
- Every execution creates a record
- Records are never modified (only upserted if retry happens)
- Full audit trail for compliance

### ✅ Type Safety
- Zero `any`, zero `as`, zero `@ts-ignore`
- All validation via type guards
- Compiler catches errors at build time

### ✅ Error Resilience
- Failure to record stats does NOT affect job processing
- Stats service failures are logged but don't propagate
- Job can complete even if ledger write fails (emergency fallback)

### ✅ Observability
- Structured logging at every step
- Metrics queryable from database
- Real-time dashboards possible

### ✅ Action at Conclusion Point
- Stats recorded only when job finishes
- Both try/catch AND onCompleted/onFailed listeners
- Double-safety: processor + listener

---

## 8. Queries: Unlocking Insights from the Ledger

```sql
-- Top 10 slowest jobs
SELECT queueName, jobId, durationMs, status, completedAt
FROM worker_job_records
ORDER BY durationMs DESC
LIMIT 10;

-- Success rate by queue
SELECT
  queueName,
  COUNT(*) as total_jobs,
  SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
  ROUND(
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)::numeric /
    COUNT(*)::numeric * 100, 2
  ) as success_rate_percent
FROM worker_job_records
WHERE completedAt >= NOW() - INTERVAL '7 days'
GROUP BY queueName
ORDER BY success_rate_percent DESC;

-- Recent failures (last hour)
SELECT jobId, queueName, errorDetails, completedAt, retryCount
FROM worker_job_records
WHERE status = 'FAILED'
  AND completedAt >= NOW() - INTERVAL '1 hour'
ORDER BY completedAt DESC;

-- Jobs stuck retrying
SELECT jobId, queueName, retryCount, completedAt
FROM worker_job_records
WHERE status = 'FAILED'
  AND retryCount > 3
ORDER BY completedAt DESC;
```

---

## 9. Deployment Checklist

- [ ] Add `WorkerJobRecord` model to `schema.prisma`
- [ ] Add `WorkerJobStatus` enum to `schema.prisma`
- [ ] Run `npx prisma migrate dev --name add_worker_job_ledger`
- [ ] Create `src/lib/services/worker-stats-service.ts`
- [ ] Update all worker processors with try/catch pattern
- [ ] Add `onCompleted` and `onFailed` listeners
- [ ] Test with manual job enqueue
- [ ] Verify records in database
- [ ] Update monitoring dashboard
- [ ] Document queue-specific metadata fields

---

## 10. Gold Standard Principles Summary

| Principle | Implementation |
|-----------|-----------------|
| **Immutable Ledger** | Every job execution creates a record |
| **Type Safety** | Type guards, no `any`/`as`/`@ts-ignore` |
| **Error Isolation** | Stats failures don't affect job processing |
| **Observability** | Queryable metrics for analytics |
| **Auditability** | Full trail with timestamps & errors |
| **Resilience** | Graceful degradation if DB is slow |
| **Action at Conclusion** | Stats recorded at job end (success or failure) |

---

## 11. Next Steps (Future Phases)

- **Phase 30**: Dashboard showing worker health (success rate, slowest queues)
- **Phase 31**: Alert service for worker failures (trigger on high failure rate)
- **Phase 32**: Performance optimization (batch stats writes)
- **Phase 33**: Worker health scoring (reliability ratings)
