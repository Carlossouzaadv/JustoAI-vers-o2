# 🚀 Railway Worker - Quick Start Guide

**TL;DR**: Deploy a worker service to process background jobs on Railway.

---

## 📋 What's New

Your `railway.toml` was updated to include **two services**:

1. **API Service** (`justoai-v2-api`) - Your web app & API
2. **Workers Service** (`justoai-v2-workers`) - Background job processor ← NEW!

Both share the same Redis and PostgreSQL databases.

---

## ⚡ Quick Setup (5 minutes)

### Step 1: Push to GitHub

```bash
git add .
git commit -m "chore(railway): add workers service configuration"
git push origin main
```

Your changes include:
- ✅ Updated `railway.toml` (multi-service config)
- ✅ `Dockerfile.workers` (already exists)
- ✅ Documentation & verification scripts

### Step 2: Railway Dashboard

Go to **Railway → Your Project Dashboard**

You should now see **two services**:
- ✅ `justoai-v2-api` (existing)
- ✅ `justoai-v2-workers` (new) ← Should be creating now

### Step 3: Verify Variables

#### For API Service (`justoai-v2-api`)

Go to: Service Settings → Variables

You should already have:
```
REDIS_URL=redis://...
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JUDIT_API_KEY=your_key_here
```

✅ If these exist, API is fine.

#### For Workers Service (`justoai-v2-workers`)

Go to: Service Settings → Variables

**Add these variables** (copy from API):

```
REDIS_URL=           ← Link to your Redis plugin
DATABASE_URL=        ← Link to your PostgreSQL
DIRECT_URL=          ← (if using pgBouncer)
JUDIT_API_KEY=       ← Same value as API
NODE_ENV=production
```

> **⚠️ CRITICAL**: These MUST match the API service exactly for Redis/Database

### Step 4: Check Worker Status

After variables are set, Railway will automatically redeploy the worker.

Go to: **Worker Service → Logs**

Look for this message (appears in ~30-60 seconds):

```
✅ INFO: worker_startup
✅ INFO: message: "🚀 INICIANDO JUDIT ONBOARDING WORKER"
✅ INFO: redis_connected: true
✅ INFO: judit_configured: true
✅ INFO: message: "⏳ Aguardando jobs..."
```

If you see these ✅, **worker is ready!**

---

## 🧪 Test Worker (2 minutes)

### Upload a Test PDF

1. Open your JustoAI web app
2. Upload a test PDF
3. Check:
   - ✅ Preview appears in < 5 seconds
   - ✅ Response includes `juditJobId`

### Monitor in Real-Time

#### Option A: Dashboard

Go to: **Worker Service → Logs**

In the next 30 seconds, you'll see:

```
✅ job_active - Job started
✅ fase2_start - Processing attachments
✅ fase2_attachments_done - Downloaded files
✅ fase2_timeline_done - Unified timeline
✅ job_completed - DONE!
```

#### Option B: API Endpoint

```bash
# Check queue status
curl https://your-api.railway.app/api/judit/queue/stats

# Result:
{
  "data": {
    "stats": {
      "waiting": 0,      # No jobs waiting
      "active": 0,       # No jobs processing
      "completed": 1,    # Job completed!
      "health": "healthy"
    }
  }
}
```

---

## ❌ Troubleshooting

### Problem 1: Worker not starting

**Symptom**: Service stuck in "Deploying..." or shows crash

**Check**:
1. Go to Worker → Logs
2. Look for error message

**Common errors**:

| Error | Fix |
|-------|-----|
| `FATAL: Redis connection not available` | Check `REDIS_URL` is set in Variables |
| `JUDIT_API_KEY not configured` | Add `JUDIT_API_KEY` to Variables |
| `Cannot read property 'connect' of null` | Database connection failed - check `DATABASE_URL` |

**Solution**:
1. Fix the variable
2. Click "Restart" in Railway UI
3. Check logs again

### Problem 2: Jobs stay "waiting"

**Symptom**: Queue shows jobs but worker doesn't process them

**Cause**: Worker crashed or lost Redis connection

**Fix**:
1. Check worker logs for errors
2. Verify `REDIS_URL` is correct
3. Restart service

### Problem 3: Worker crashes after 30 seconds

**Symptom**: Logs show worker starting, then `Deployment failed`

**Cause**: Usually out of memory or connection timeout

**Fix**:
1. Go to Worker Service → Resources
2. Increase memory from 512MB to 1GB
3. Restart

---

## 📊 Monitoring

### Queue Health Dashboard

Create this endpoint in your app (or use your existing monitoring):

```bash
# Daily health check
curl https://your-api.railway.app/api/judit/queue/stats
```

Expected output when healthy:

```json
{
  "data": {
    "stats": {
      "waiting": 0,
      "active": 0,
      "completed": 100,
      "failed": 0,
      "health": "healthy"
    },
    "activeJobs": [],
    "timestamp": "2025-10-20T01:00:00.000Z"
  }
}
```

### Worker Health Check

Check if worker is alive:

```bash
# Via Railway CLI
railway logs -s justoai-v2-workers | tail -20

# Should show recent timestamps (not old logs)
```

---

## 🛡️ Production Checklist

Before using in production:

- [ ] Worker shows "healthy" in queue stats
- [ ] Tested upload → preview in < 5s
- [ ] Worker processed job successfully
- [ ] No errors in worker logs
- [ ] Redis connection stable
- [ ] JUDIT API key valid
- [ ] Database connectivity verified

**Verification script**:

```bash
npm run verify:worker
```

---

## 📚 More Information

For detailed setup & troubleshooting:
👉 See `RAILWAY_WORKER_SETUP.md` in the project root

---

## 🎯 What Happens Now

### User uploads PDF:

```
1️⃣ API receives upload
   └─ Extracts text
   └─ Detects CNJ number
   └─ Calls Gemini Flash (Phase 1)
   └─ Returns preview ✅ (instant)

2️⃣ API adds job to queue
   └─ Returns with juditJobId

3️⃣ Worker picks up job (seconds later)
   └─ Calls JUDIT API
   └─ Downloads attachments
   └─ Unifies timeline
   └─ Updates database ✅

4️⃣ User sees "Enrich Complete"
   └─ Can now request full analysis ✅
```

All automated, all in background!

---

## 🆘 Need Help?

1. **Check logs**: `railway logs -s justoai-v2-workers`
2. **Run verification**: `npm run verify:worker`
3. **Check API health**: `GET /api/health`
4. **Monitor queue**: `GET /api/judit/queue/stats`

---

**Ready?** Push your changes and watch the worker go! 🚀
