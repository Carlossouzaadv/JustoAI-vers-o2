# Railway Worker Deployment Checklist

Copy & paste this checklist when deploying the worker to Railway.

---

## 🔴 Pre-Deployment (Local Machine)

- [ ] All changes committed and pushed to GitHub
  ```bash
  git add .
  git commit -m "chore(railway): add workers service configuration"
  git push origin main
  ```

- [ ] Verify local configuration
  ```bash
  npm run verify:worker
  ```

- [ ] All checks passed (or only warnings)

---

## 🟠 Railway Dashboard Setup

### Service 1: API Service (justoai-v2-api)

- [ ] Service exists in Railway project
- [ ] Service shows "Deploying" or "Running"
- [ ] Go to **Variables** and verify these exist:
  - [ ] `REDIS_URL` - Value looks like: `redis://...`
  - [ ] `DATABASE_URL` - Value looks like: `postgresql://...@...pooler...`
  - [ ] `DIRECT_URL` - Value looks like: `postgresql://...@db...`
  - [ ] `JUDIT_API_KEY` - Value length > 10 characters
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` - Exists
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Exists

### Service 2: Workers Service (justoai-v2-workers)

- [ ] Service exists (Railway auto-created from `railway.toml`)
- [ ] Go to **Variables** and set:
  - [ ] `REDIS_URL` - **Copy exact value from API service**
    ```
    redis://...
    ```
  - [ ] `DATABASE_URL` - **Copy exact value from API service**
    ```
    postgresql://...
    ```
  - [ ] `DIRECT_URL` - **Copy exact value from API service** (if applicable)
    ```
    postgresql://...
    ```
  - [ ] `JUDIT_API_KEY` - **Copy exact value from API service**
    ```
    (same as API)
    ```
  - [ ] `NODE_ENV` - Set to `production`
    ```
    production
    ```

- [ ] Click "Save" and wait for redeploy

---

## 🟡 Worker Service Startup (30-60 seconds)

Go to: **justoai-v2-workers → Logs**

- [ ] Logs are appearing (not empty)
- [ ] Look for these messages in order:

```
[INFO] worker_startup
     ↓
[INFO] message: "🚀 INICIANDO JUDIT ONBOARDING WORKER"
     ↓
[INFO] configuration: {
  "redis_connected": true,        ← MUST BE true
  "judit_configured": true         ← MUST BE true
}
     ↓
[INFO] message: "⏳ Aguardando jobs..."
```

**If you see these ✅ → Worker is ready!**

### If Worker Won't Start

- [ ] Check for error messages in logs
- [ ] Common errors:
  - `FATAL: Redis connection not available` → Check `REDIS_URL`
  - `JUDIT_API_KEY not configured` → Check `JUDIT_API_KEY`
  - Service keeps crashing → Increase memory: Resources → Set to 1GB

---

## 🟢 Verify API Service

Go to: **justoai-v2-api → Logs**

- [ ] Logs show recent entries (not old from before redeploy)
- [ ] Look for:
  ```
  [INFO] Ready on 0.0.0.0:3000
  ```

---

## 🔵 Test Worker (5 minutes)

### Test 1: API Health Check

```bash
curl https://your-api.railway.app/api/health

# Should return: {"status":"ok","database":"connected"}
```

- [ ] API responds with status OK
- [ ] Database shows "connected"

### Test 2: Queue Statistics

```bash
curl https://your-api.railway.app/api/judit/queue/stats | jq '.data.stats'

# Should show:
{
  "waiting": 0,
  "active": 0,
  "completed": 0,
  "failed": 0,
  "health": "healthy"
}
```

- [ ] Queue endpoint responds
- [ ] Health shows "healthy"

### Test 3: Upload PDF (End-to-End Test)

1. Open JustoAI web app (https://your-app.railway.app)
2. Upload a test PDF document
3. Verify:
   - [ ] Upload succeeds (no error)
   - [ ] Preview appears in < 5 seconds
   - [ ] Response includes `"juditJobId":"onboard-..."`

**Example response**:
```json
{
  "success": true,
  "caseId": "clu...",
  "preview": {...},
  "juditJobId": "onboard-0012345678-1729400000000",
  "message": "Preview gerado com sucesso!"
}
```

- [ ] Response contains `juditJobId`

### Test 4: Monitor Worker Processing

```bash
# Get the jobId from Step 3 response
JOB_ID="onboard-0012345678-1729400000000"

# Check job status (run every 5 seconds)
curl https://your-api.railway.app/api/judit/onboarding/status/$JOB_ID | jq '.data.status'

# Watch progression:
# → "waiting" (job in queue)
# → "active" (worker processing)
# → "completed" (DONE!)
```

In Worker logs (**justoai-v2-workers → Logs**), you should see:

```
✅ [INFO] job_active (job_id, cnj)
✅ [DEBUG] calling_judit_service
✅ [INFO] fase2_start
✅ [INFO] fase2_attachments_done (X attachments)
✅ [INFO] fase2_timeline_done
✅ [INFO] job_completed (duration: X ms)
```

- [ ] See "job_active" message
- [ ] See "fase2_start" (Phase 2 processing)
- [ ] See "job_completed" (job finished)
- [ ] Job status endpoint shows "completed"

---

## 🟣 Performance Baseline

After successful test, note these baseline metrics:

- [ ] Preview generation time: `_____ ms` (< 5000ms)
- [ ] Job processing time: `_____ ms` (typically 15-30s)
- [ ] Queue health: ✅ healthy
- [ ] Failed jobs: `0` or `none`

---

## ⚫ Production Verification

- [ ] Set up Railway Alerts for:
  - [ ] Service crashes
  - [ ] High CPU (> 80%)
  - [ ] High memory (> 90%)

- [ ] Monitor over 24 hours:
  - [ ] No crashes
  - [ ] Jobs completing successfully
  - [ ] No spike in failed jobs

- [ ] Test with real-world PDFs:
  - [ ] Various file sizes (10MB, 50MB)
  - [ ] Different document types
  - [ ] Check timeline unification works

---

## 📊 Quick Monitoring Commands

Save these for daily monitoring:

```bash
# Queue status
alias queue-status='curl -s https://your-api.railway.app/api/judit/queue/stats | jq ".data.stats"'

# Active jobs
alias queue-active='curl -s https://your-api.railway.app/api/judit/queue/stats | jq ".data.activeJobs"'

# Worker logs
alias worker-logs='railway logs -s justoai-v2-workers -f'

# API health
alias api-health='curl -s https://your-api.railway.app/api/health | jq ".status"'
```

---

## 🆘 Rollback If Issues

If worker causes problems:

1. Go to **justoai-v2-workers → Deployments**
2. Find the version before worker was added
3. Click "Rollback to this deployment"
4. Verify API still works: `curl https://your-api.railway.app/api/health`

---

## ✅ DEPLOYMENT COMPLETE

Once you've completed all checks above:

- [ ] Worker is running and healthy
- [ ] All tests passed
- [ ] End-to-end (upload → processing → complete) works
- [ ] You understand how to monitor it

🎉 **You're ready for production!**

---

## 📞 Need Help?

If something fails at any step:

1. **Check the specific error in logs**
2. **Refer to RAILWAY_WORKER_SETUP.md for detailed troubleshooting**
3. **Run verification script**: `npm run verify:worker`
4. **Check endpoint documentation**: WORKER_MONITORING.md

---

**Print this checklist and check off each box as you go!** ✅
