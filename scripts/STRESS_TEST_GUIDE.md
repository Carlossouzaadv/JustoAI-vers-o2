# JUDIT Queue Stress Test Guide

## Quick Start

### Prerequisites

1. **Redis Running**
   ```bash
   # Option 1: Local Redis
   docker run -d -p 6379:6379 redis:alpine

   # Option 2: Use REDIS_URL in .env (Upstash)
   REDIS_URL=your-redis-url
   ```

2. **Environment Setup**
   ```bash
   # REQUIRED: Redis connection
   REDIS_URL=redis://localhost:6379

   # OPTIONAL: Remove for safe testing
   # JUDIT_API_KEY=your-key-here  # Comment this out!
   ```

3. **Worker Running** (in separate terminal)
   ```bash
   npx tsx src/workers/juditOnboardingWorker.ts
   ```

### Run the Test

```bash
# From project root
npx tsx scripts/stress-test-judit.ts
```

## What to Expect

### Phase 1: Initialization (0-2 seconds)
```
[METRICS] 🚀 INICIANDO STRESS TEST DO JUDIT QUEUE
[METRICS] ✅ JUDIT API KEY NOT CONFIGURED - Safe test mode
[METRICS] 📊 Initial memory usage: 82 MB
[METRICS] 📝 Adding 10 jobs to queue...
[METRICS] ✅ Successfully added 10 jobs to queue
```

### Phase 2: Monitoring (2 seconds - 10 minutes)
```
[METRICS] ⏳ Monitoring queue for 10 minutes...

[METRICS] Elapsed: 0m 2s | Remaining: 9m 58s
Queue: { waiting: 5, active: 2, completed: 3, failed: 0 }
Memory: { current_mb: 85, peak_mb: 87, increase_mb: 3 }

[METRICS] Elapsed: 0m 4s | Remaining: 9m 56s
Queue: { waiting: 0, active: 0, completed: 10, failed: 0 }
Memory: { current_mb: 83, peak_mb: 87, increase_mb: 1 }
```

**Note:** If JUDIT_API_KEY is NOT set, all jobs will fail quickly (within seconds) because the worker blocks them. This is expected and safe!

### Phase 3: Summary
```
[METRICS] ✅ All jobs processed! Stopping test early.
[METRICS] 🏁 STRESS TEST COMPLETE
[METRICS] 📊 FINAL SUMMARY
Test Duration: 0m 4s
Jobs: { added: 10, completed: 0, failed: 10, success_rate: "0%" }
Memory: { average_mb: 84, peak_mb: 87, samples: 2 }

[METRICS] 🔍 DIAGNOSTICS
[METRICS] ✅ Memory usage is stable (< 150 MB) - peak_mb: 87
[METRICS] ✅ Queue emptied successfully
[METRICS] ✅ All jobs were processed

[METRICS] 🎉 All checks passed! System is stable and ready.
```

## Success Criteria

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| **Memory Stable** | Peak < 150 MB | ? MB | ✅/⚠️ |
| **Queue Empty** | waiting=0, active=0 | ? | ✅/⚠️ |
| **All Jobs Processed** | completed+failed = 10 | ? | ✅/⚠️ |

### Interpreting Results

#### ✅ ALL PASS (Expected without API key)
- Memory: ~80-100 MB
- Jobs: All failed quickly (blocked by worker)
- Queue: Empty within seconds
- **Meaning:** System is stable and ready for API key integration

#### ⚠️ MEMORY WARNING (Peak > 150 MB)
- **Possible Causes:**
  - Memory leak in worker
  - Too many jobs in memory
  - Large payloads being cached
- **Next Steps:**
  1. Review worker code for memory leaks
  2. Check Redis connection pooling
  3. Monitor with `ps aux | grep node` during test

#### ⚠️ QUEUE NOT EMPTY
- **Possible Causes:**
  - Worker crashed or stopped
  - Jobs stuck in retry loop
  - BullMQ configuration issue
- **Next Steps:**
  1. Check worker is running: `ps aux | grep worker`
  2. Review worker logs for errors
  3. Check Redis connection

#### ⚠️ JOBS NOT PROCESSED
- **Possible Causes:**
  - Queue configuration error
  - Worker not connected to queue
  - Jobs lost during processing
- **Next Steps:**
  1. Check Redis is running
  2. Verify REDIS_URL in .env
  3. Review queue/worker connection code

## Testing Scenarios

### Scenario 1: Safe Test (No API Key)
**Setup:**
- JUDIT_API_KEY is NOT set
- Redis running
- Worker running

**Expected:**
- Jobs fail immediately (within 1-2 seconds each)
- Error: "JUDIT_API_KEY not configured"
- No API calls
- No costs
- Memory stable

**Use Case:** Pre-deployment validation

### Scenario 2: Full Integration Test (With API Key)
**Setup:**
- JUDIT_API_KEY IS set
- Redis running
- Worker running

**Expected:**
- Jobs take 30s-5min each (JUDIT polling)
- Some may complete, some may timeout
- API calls will be made
- Cost: ~R$6.90 (10 jobs × R$0.69)
- Memory may increase during polling

**Use Case:** Production readiness test (COSTS MONEY!)

⚠️ **WARNING:** Only run Scenario 2 if you're ready to incur JUDIT API costs!

## Troubleshooting

### Error: "Cannot connect to Redis"
```
[QUEUE] error: Redis connection failed
```
**Solution:**
1. Check Redis is running: `docker ps | grep redis`
2. Verify REDIS_URL in .env
3. Test connection: `redis-cli ping`

### Error: "Worker not processing jobs"
Jobs stay in "waiting" status forever.

**Solution:**
1. Start worker: `npx tsx src/workers/juditOnboardingWorker.ts`
2. Check worker logs for errors
3. Verify worker connects to same Redis

### Error: "Memory keeps growing"
Memory usage increases continuously.

**Solution:**
1. Stop test (Ctrl+C)
2. Review worker code for memory leaks
3. Check for unclosed connections
4. Monitor with: `node --inspect src/workers/juditOnboardingWorker.ts`

### Warning: "Jobs stuck in active state"
Jobs never complete or fail.

**Solution:**
1. Worker may have crashed - restart it
2. Check worker logs for errors
3. Review job processing code
4. Check JUDIT API connectivity (if key is set)

## Advanced Usage

### Custom Test Duration
Edit `scripts/stress-test-judit.ts`:
```typescript
const STRESS_TEST_CONFIG = {
  TOTAL_JOBS: 10,
  TEST_DURATION_MS: 5 * 60 * 1000, // 5 minutes instead of 10
  METRICS_INTERVAL_MS: 2000,
  CNJ_PREFIX: '0000000-0',
} as const;
```

### More Jobs
```typescript
const STRESS_TEST_CONFIG = {
  TOTAL_JOBS: 50, // Test with 50 jobs
  TEST_DURATION_MS: 10 * 60 * 1000,
  METRICS_INTERVAL_MS: 2000,
  CNJ_PREFIX: '0000000-0',
} as const;
```

### Faster Metrics Logging
```typescript
const STRESS_TEST_CONFIG = {
  TOTAL_JOBS: 10,
  TEST_DURATION_MS: 10 * 60 * 1000,
  METRICS_INTERVAL_MS: 500, // Log every 0.5 seconds
  CNJ_PREFIX: '0000000-0',
} as const;
```

## Next Steps

### After Successful Test (All checks pass)
1. ✅ System is stable
2. ✅ Ready to add JUDIT_API_KEY
3. ✅ Deploy to staging/production
4. ⚠️ Start with low concurrency (2 workers)
5. ⚠️ Monitor costs closely

### If Tests Fail
1. ⚠️ Review diagnostics output
2. ⚠️ Check specific failure reason
3. ⚠️ Fix issues before proceeding
4. ⚠️ Re-run test until all pass
5. ⚠️ Do NOT add API key until stable

## Related Documentation

- **Queue Implementation:** `src/lib/queue/juditQueue.ts`
- **Worker Implementation:** `src/workers/juditOnboardingWorker.ts`
- **JUDIT Service:** `src/lib/services/juditService.ts`
- **Test Scripts:** `scripts/README.md`

## Support

If you encounter issues:
1. Check this guide first
2. Review logs in `src/lib/observability/logger.ts`
3. Check BullMQ documentation: https://docs.bullmq.io
4. Review JUDIT API docs (if API key is set)
