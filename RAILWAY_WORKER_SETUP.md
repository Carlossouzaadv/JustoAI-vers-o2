# Railway Worker Setup Guide - JustoAI V2

Complete step-by-step guide to configure and deploy the JUDIT Onboarding Worker on Railway.

## Overview

JustoAI V2 uses a **multi-service architecture** on Railway:
- **Service 1: API** (`justoai-v2-api`) - Next.js frontend + backend API
- **Service 2: Workers** (`justoai-v2-workers`) - Background job processing (BullMQ)

Both services share:
- Same Redis instance (for job queue)
- Same PostgreSQL database
- Same environment variables

---

## Prerequisites

✅ Verify you have:
1. Railway project created
2. Redis instance deployed
3. PostgreSQL database deployed
4. Environment variables ready

---

## Step 1: Verify Environment Variables

### 1.1 For API Service (justoai-v2-api)

In Railway Dashboard → `justoai-v2-api` → Variables:

```
REDIS_URL=                    # Redis connection string
DATABASE_URL=                 # PostgreSQL pooler URL (pgBouncer)
DIRECT_URL=                   # PostgreSQL direct connection (for migrations)
JUDIT_API_KEY=                # Your JUDIT API key
NEXT_PUBLIC_SUPABASE_URL=     # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase key
# ... other Next.js variables
```

### 1.2 For Workers Service (justoai-v2-workers)

**Must have SAME variables as API:**

```
REDIS_URL=                    # ✅ SAME as API
DATABASE_URL=                 # ✅ SAME as API
DIRECT_URL=                   # ✅ SAME as API
JUDIT_API_KEY=                # ✅ SAME as API
NODE_ENV=production
```

❌ **Critical**: Worker MUST connect to SAME Redis and PostgreSQL as API

---

## Step 2: Configure Worker Service in Railway

### 2.1 Create New Service

1. Go to Railway Dashboard → Your Project
2. Click **`+ New`** button
3. Choose **`Deploy from GitHub repo`** or **`Create a service`**
4. If creating manually:
   - Select your GitHub repo
   - Or upload the repository

### 2.2 Configure Service Name

- Name: `justoai-v2-workers`
- This matches the name in `railway.toml`

### 2.3 Set Build Configuration

In Railway UI → Service Settings:

- **Builder**: Dockerfile
- **Dockerfile Path**: `Dockerfile.workers`
- **Build Command**: (Leave empty - Dockerfile handles it)
- **Start Command**: `npx tsx src/workers/juditOnboardingWorker.ts`

### 2.4 Link Variables

Worker needs access to Redis and Database:

1. Go to Service → Variables
2. Add/Link these variables:
   - `REDIS_URL` → Link to your Redis plugin
   - `DATABASE_URL` → Link to your PostgreSQL
   - `DIRECT_URL` → (if using pooler)
   - `JUDIT_API_KEY` → Set manually (same value as API)
   - `NODE_ENV` → Set to `production`

---

## Step 3: Verify Configuration

### 3.1 Check Redis Connectivity

After worker starts, check logs for:

```
✅ SUCCESS: Redis conectado (cache nível 2)
```

Or if Redis disabled (development):

```
⚠️ WARNING: Redis não disponível, usando apenas memória + PostgreSQL
```

**If Redis connection fails:**
- ❌ `REDIS_URL` is incorrect
- ❌ Redis service not running
- ❌ Network/firewall blocking connection

### 3.2 Check JUDIT Configuration

In worker logs, you should see:

```
⚖️ JUDIT_API_KEY configured: ✅
✅ JUDIT API Base URL: https://api-v2.judit.io
```

**If JUDIT not configured:**
- ❌ `JUDIT_API_KEY` missing from environment
- ❌ `JUDIT_API_KEY` value is empty

### 3.3 Check Worker Startup

Look for these log messages:

```
[INFO] worker_startup
[INFO] message: "🚀 INICIANDO JUDIT ONBOARDING WORKER"
[INFO] configuration: {
  "concurrency": 2,
  "rate_limit_per_minute": 10,
  "lock_duration_seconds": 30,
  "redis_connected": true,
  "judit_configured": true,
  "judit_has_api_key": true
}
[INFO] message: "⏳ Aguardando jobs..."
```

---

## Step 4: Monitor Worker Health

### 4.1 Via Railway Dashboard

1. Go to Service → `justoai-v2-workers` → Logs
2. Look for:
   - ✅ `worker_ready` - Worker is ready
   - ✅ `job_active` - Job started processing
   - ✅ `job_completed` - Job finished successfully
   - ❌ `job_failed` - Job failed (check error message)
   - ❌ `worker_error` - Worker crashed

### 4.2 Via API Endpoints

From your API service, check queue status:

```bash
# Queue Statistics
GET https://your-api.railway.app/api/judit/queue/stats

Response:
{
  "success": true,
  "data": {
    "stats": {
      "waiting": 5,      # Jobs waiting to process
      "active": 1,       # Jobs currently processing
      "completed": 123,  # Total jobs completed
      "failed": 2,       # Total jobs failed
      "delayed": 0,
      "health": "healthy" # "healthy" | "warning" | "critical"
    },
    "activeJobs": [
      {
        "jobId": "onboard-0012345678-1729400000000",
        "cnj": "0012345-67.2024.1.01.2345",
        "progress": 50,
        "processedOn": 1729400100000
      }
    ]
  }
}
```

### 4.3 Check Individual Job Status

```bash
# Job Status
GET https://your-api.railway.app/api/judit/onboarding/status/[jobId]

# Example:
GET https://your-api.railway.app/api/judit/onboarding/status/onboard-0012345678-1729400000000

Response:
{
  "success": true,
  "data": {
    "jobId": "onboard-0012345678-1729400000000",
    "status": "completed",           # waiting | active | completed | failed
    "statusDescription": "Concluído",
    "progress": 100,
    "result": {
      "success": true,
      "processoId": "12345678",
      "requestId": "req-abc123",
      "numeroCnj": "0012345-67.2024.1.01.2345",
      "duration": 15000
    },
    "isComplete": true
  }
}
```

---

## Step 5: Upload Test & Worker Verification

### 5.1 Test Upload (Phase 1)

1. Open JustoAI web app
2. Upload a test PDF
3. Verify:
   - ✅ Preview appears in < 5 seconds
   - ✅ Cache saves successfully
   - ✅ Job ID returned in response

### 5.2 Check API Logs

In API logs, you should see:

```
[Upload] Job de onboarding da JUDIT adicionado à fila para o processo [CNJ]. Job ID: [jobId]
[Async Flow] JUDIT worker processará caso em background (workspaceId: ..., caseId: ...)
```

### 5.3 Check Worker Logs

In Worker logs, within 30 seconds you should see:

```
[INFO] job_active (job_id, cnj)
[INFO] calling_judit_service
[DEBUG] fase2_start - Iniciando FASE 2
[INFO] fase2_attachments_done
[INFO] fase2_timeline_done
[INFO] job_completed
```

---

## Step 6: Common Issues & Troubleshooting

### Issue 1: Worker doesn't start

**Error in logs:**
```
FATAL: Redis connection not available
Workers cannot run without Redis
```

**Solution:**
1. Check `REDIS_URL` is set in Variables
2. Verify Redis service is running in Railway
3. Test Redis connection: use `redis-cli` to connect
4. Check firewall/network allows connection

---

### Issue 2: Jobs stay in "waiting" state

**Symptom:**
- Queue stats show `waiting: 10+` but `active: 0`
- Worker logs show `⏳ Aguardando jobs...`

**Solution:**
1. Check worker is actually running: `ps aux | grep juditOnboardingWorker`
2. Check Redis connection (see Issue 1)
3. Check if worker crashed: look for error messages in logs
4. Restart worker: in Railway UI, go to Deployment and restart

---

### Issue 3: Jobs fail with "JUDIT_API_KEY not configured"

**Error in logs:**
```
[ERROR] action: 'job_blocked_no_config'
error: 'JUDIT_API_KEY not configured'
```

**Solution:**
1. Add `JUDIT_API_KEY` to worker Variables
2. Use exact same value as API service
3. Restart worker after adding variable
4. Test: `echo $JUDIT_API_KEY` in worker startup logs

---

### Issue 4: Worker crashes after 30 seconds

**Symptom:**
- Worker starts, then Railway marks as crashed
- Restart policy kicks in: "Restarting..."

**Likely causes:**
1. Redis connection timeout
2. Database connection issues
3. Out of memory

**Solution:**
1. Check logs for actual error (before crash)
2. Increase memory allocation: Railway UI → Service → Resources
3. Verify Redis/Database URLs are correct

---

## Step 7: Production Readiness Checklist

Before using in production:

- [ ] Redis is running and accessible
- [ ] Worker logs show `worker_ready` ✅
- [ ] `JUDIT_API_KEY` is set and valid
- [ ] Queue stats endpoint returns health: "healthy"
- [ ] Tested upload → preview works in < 5s
- [ ] Tested worker processes job (Phase 2)
- [ ] Worker restart policy is set
- [ ] Error notifications configured

---

## Step 8: Monitoring & Alerts

### Set up Railway Alerts

1. Go to Railway Dashboard → Project Settings → Alerts
2. Create alert for:
   - ❌ Service unavailable
   - ❌ High CPU usage
   - ❌ High memory usage
   - ❌ Service crashes

### Manual Health Check Script

Create a monitoring script to check worker health:

```bash
#!/bin/bash
# Check queue stats
curl -s https://your-api.railway.app/api/judit/queue/stats | jq '.data.stats.health'

# Should output: "healthy"
# If not, investigate worker logs
```

---

## API Endpoints for Monitoring

Use these endpoints to monitor worker status from your application:

### Queue Statistics
```
GET /api/judit/queue/stats
```

Returns current queue state and health status.

### Job Status
```
GET /api/judit/onboarding/status/:jobId
```

Returns detailed status of a specific job.

### Health Check (API)
```
GET /api/health
```

Checks if API service is healthy (includes database connectivity).

---

## Next Steps

After worker is running:

1. ✅ **Test Phase 1 (Preview)** - Upload PDF, verify preview in < 5s
2. ✅ **Test Phase 2 (JUDIT Enrichment)** - Wait for worker to complete
3. ✅ **Test Phase 3 (Analysis)** - Manually request full analysis
4. ✅ **Monitor Queue** - Use API endpoints to check worker health
5. ✅ **Set Alerts** - Configure Railway alerts for issues

---

## Support & Debugging

### Enable Debug Logging

Set environment variable for detailed logs:

```
DEBUG=*
```

This will show all structured logging from the worker.

### Access Worker Container

Via Railway CLI:

```bash
railway shell justoai-v2-workers
ps aux | grep judit
tail -f /var/log/worker.log  # If applicable
```

### Check Redis Directly

```bash
redis-cli
> INFO
> KEYS judit*
> HGETALL judit-onboarding:jobs
```

---

## Resources

- [Railway Documentation](https://docs.railway.app)
- [BullMQ Documentation](https://docs.bullmq.io)
- [Redis Documentation](https://redis.io/docs)
- [JustoAI Worker Code](src/workers/juditOnboardingWorker.ts)

---

**Last Updated**: 2025-10-20
**Version**: 1.0
**Status**: Production-Ready
