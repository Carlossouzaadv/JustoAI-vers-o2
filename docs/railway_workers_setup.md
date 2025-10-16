# 🚂 Railway Workers Setup Guide

Deploy backend and workers as **separate Railway services** for better scalability, cost control, and isolation.

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Part 1: Create Web Service (Backend API)](#part-1-create-web-service-backend-api)
4. [Part 2: Create Workers Service](#part-2-create-workers-service)
5. [Environment Configuration](#environment-configuration)
6. [Deployment](#deployment)
7. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
8. [Scaling & Cost Optimization](#scaling--cost-optimization)

---

## Architecture Overview

```
┌─────────────────────────────────┐
│      Railway Project            │
├─────────────────────────────────┤
│                                 │
│  ┌──────────────────────────┐   │
│  │ Service: Web (Backend)   │   │
│  │ ✅ API Routes            │   │
│  │ ✅ Database Queries      │   │
│  │ ✅ Business Logic        │   │
│  └──────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐   │
│  │ Service: Workers         │   │
│  │ ✅ JUDIT Onboarding     │   │
│  │ ✅ Queue Processing      │   │
│  │ ✅ Background Jobs       │   │
│  └──────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐   │
│  │ Shared Resources         │   │
│  │ ✅ Redis (Upstash)       │   │
│  │ ✅ PostgreSQL (Supabase) │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

### Benefits of Separate Services

- **Cost Optimization**: Stop workers when idle, only pay for web service
- **Isolation**: Worker failures don't affect API availability
- **Scalability**: Scale workers independently from API
- **Observability**: Monitor each service separately
- **Deployment**: Deploy workers without redeploying web

---

## Prerequisites

Before starting, you need:

1. **Railway Account**: https://railway.app
2. **GitHub Repository**: Connected to Railway (already done)
3. **Upstash Redis**: https://upstash.com (free tier available)
4. **Supabase Database**: Already configured
5. **Railway CLI** (optional):
   ```bash
   npm install -g @railway/cli
   railway login
   ```

---

## Part 1: Create Web Service (Backend API)

### Step 1.1: Navigate to Railway Dashboard

1. Go to: https://railway.app/dashboard
2. Select your `justoai-v2` project
3. You should see the existing web service

### Step 1.2: Configure Web Service

1. **Click on the existing web service** (or create new if needed)
2. Go to **"Settings"** tab
3. Verify these settings:

   **Build Settings:**
   - Build Command: `npm run build`
   - Start Command: `npm start` or `node server.js`
   - Watch Paths: (leave default)

   **Deploy:**
   - Auto Deploy: `ON` (recommended)
   - Restart Policy: `on-failure`

### Step 1.3: Set Environment Variables for Web

Go to **"Variables"** tab and ensure these are set:

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://justoai-v2.vercel.app

# Database
DATABASE_URL=postgresql://[user:password@host:port/database?sslmode=require]
DIRECT_URL=postgresql://[user:password@host:port/database]

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Redis (Upstash)
REDIS_URL=rediss://default:[password]@[host]:[port]
REDIS_DISABLED=false

# APIs
GOOGLE_API_KEY=your_google_api_key
JUDIT_API_BASE_URL=https://api.judit.ai/v1
# JUDIT_API_KEY is set in workers service (not needed here)

# CORS
ALLOWED_ORIGINS=https://justoai-v2.vercel.app,https://localhost:3000

# Email
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=your_resend_api_key
FROM_EMAIL=noreply@justoai.com

# Logging
LOG_LEVEL=info
```

> **Important**: Do not set `JUDIT_API_KEY` in the web service - it's only for workers

---

## Part 2: Create Workers Service

### Step 2.1: Create New Service

1. **In Railway Dashboard**, select your project
2. Click **"+ New"** button (top right)
3. Choose **"Service"** → **"Dockerfile"**
4. Select your GitHub repository
5. Name it: `justoai-workers`
6. Leave other fields empty for now

### Step 2.2: Configure Build

1. After service is created, go to **"Settings"**
2. **Dockerfile Path**: `Dockerfile.workers` (use the one in repo root)
3. **Build Command**: Leave empty (uses Dockerfile)
4. **Start Command**: Leave empty (uses Dockerfile)

### Step 2.3: Configure Deployment

1. Go to **"Deploy"** tab
2. **Auto Deploy**: `ON` (matches web service)
3. **Restart Policy**: `on-failure`
4. **Auto-sleep**: `ON` (recommended - saves costs)
   - Sleep after: `5 minutes` (idle time)

### Step 2.4: Set Environment Variables for Workers

Go to **"Variables"** tab and set:

```bash
# Application
NODE_ENV=production

# Database (same as web service)
DATABASE_URL=postgresql://[user:password@host:port/database?sslmode=require]
DIRECT_URL=postgresql://[user:password@host:port/database]

# Redis (same as web service)
REDIS_URL=rediss://default:[password]@[host]:[port]
REDIS_DISABLED=false

# APIs
GOOGLE_API_KEY=your_google_api_key
JUDIT_API_BASE_URL=https://api.judit.ai/v1
JUDIT_API_KEY=your_judit_api_key  # ⚠️ ONLY set in workers!

# Logging
LOG_LEVEL=info

# Worker Configuration
WORKER_CONCURRENCY=2  # Number of concurrent jobs
WORKER_TIMEOUT=300000  # 5 minutes (ms)
```

> **Critical**: Set `JUDIT_API_KEY` **ONLY** in workers service, not in web service

---

## Environment Configuration

### Redis (Upstash)

If not already created:

1. Go to: https://upstash.com
2. Create a **Redis Database**:
   - Region: Europe (or closest to your Railway)
   - Type: Standard
   - Database size: Free tier is usually enough

3. Copy the connection string: `rediss://default:[password]@[host]:[port]`

4. Add to **both** services:
   ```
   REDIS_URL=rediss://default:[password]@[host]:[port]
   REDIS_DISABLED=false
   ```

### Database (Supabase)

Your Supabase database should already be configured. Get these from Supabase:

- **Project URL**: Settings → API → Project URL
- **Anon Key**: Settings → API → Anon Key
- **Service Role Key**: Settings → API → Service Role Key
- **Connection String**: Database → Connection Pooler → URI

---

## Deployment

### Step 1: Commit Changes

```bash
# Make sure you're on the infra/separate-workers branch
git status

# Add all files
git add .

# Commit changes
git commit -m "chore(railway): configure separate web and workers services"

# Push to Railway trigger deployment
git push origin infra/separate-workers
```

### Step 2: Verify Web Service

1. **Wait for deployment** (~2-5 minutes)
2. Check **Logs** tab for errors
3. Verify service is `Running` (green status)
4. Test API:
   ```bash
   curl https://[your-railway-domain]/api/health
   ```

### Step 3: Verify Workers Service

1. **Wait for deployment** (~2-5 minutes)
2. Check **Logs** tab for messages like:
   ```
   🚀 INICIANDO JUDIT ONBOARDING WORKER
   ✅ Connected to Redis
   ✅ Worker initialized
   ```
3. Verify service status is `Running`

### Step 4: Test Queue Processing

1. **Add a test job**:
   ```bash
   npm run worker:judit
   # Or via Railway web service API:
   curl -X POST https://[your-railway-domain]/api/judit/test-job
   ```

2. **Monitor logs**:
   ```bash
   # Via Railway CLI
   railway logs --service justoai-workers --follow

   # Or check Railway Dashboard > Logs
   ```

---

## Monitoring & Troubleshooting

### View Logs

**Via Railway Dashboard:**
1. Select service (web or workers)
2. Click **"Logs"** tab
3. Filter by level (info, warn, error)

**Via Railway CLI:**
```bash
# Web service logs
railway logs --service justoai-v2 --follow

# Workers service logs
railway logs --service justoai-workers --follow

# Search for specific pattern
railway logs --follow | grep "ERROR"
```

### Common Issues

#### Issue 1: Workers Service Won't Start

**Symptoms:**
- Service status is `Crashed` or `Failed`
- Logs show: `Cannot find module` or `Cannot connect to Redis`

**Solutions:**
1. Check `REDIS_URL` is correct (starts with `rediss://`)
2. Check `DATABASE_URL` is accessible
3. Verify `Dockerfile.workers` exists in repository
4. Check logs for the exact error message

#### Issue 2: High CPU Usage

**Symptoms:**
- CPU usage > 50%
- Workers taking too long to process jobs

**Solutions:**
1. Reduce `WORKER_CONCURRENCY` (try 1 or 2)
2. Check for long-running JUDIT API calls
3. Monitor queue size for stuck jobs
4. Increase `WORKER_TIMEOUT` if needed

#### Issue 3: Redis Connection Errors

**Symptoms:**
- Logs show `ECONNREFUSED` or `TimeoutError`
- Error: `Cannot connect to Redis`

**Solutions:**
1. Verify `REDIS_URL` includes `rediss://` (not `redis://`)
2. Check Upstash Redis is running: https://upstash.com
3. Verify both services have same `REDIS_URL`
4. Check Railway firewall allows outbound to Upstash

#### Issue 4: Jobs Not Processing

**Symptoms:**
- Jobs stay in "waiting" status
- No worker logs appear
- Queue shows jobs but no "active" jobs

**Solutions:**
1. Verify workers service is `Running`
2. Check `JUDIT_API_KEY` is set in workers service
3. Run test script to verify connection: `npm run worker:judit`
4. Check worker logs for error messages

---

## Scaling & Cost Optimization

### Monitoring Costs

**Check Railway Costs:**
1. Go to Railway Dashboard
2. Click **"Account"** → **"Billing"**
3. See breakdown by service
4. Estimated monthly cost shown for each

**Expected Monthly Costs:**

| Service | CPU | Memory | Idle Cost | Active Cost |
|---------|-----|--------|-----------|-------------|
| Web API | 0.5 vCPU | 256 MB | $5-7 | $10-15 |
| Workers (idle) | 0.01 vCPU | 50 MB | $0-1 | N/A |
| Workers (processing) | 0.1-0.5 vCPU | 256 MB | N/A | $3-10 |
| **Total** | | | **$5-8** | **$13-25** |

> With auto-sleep, workers cost near $0 when idle!

### Cost Optimization Tips

1. **Enable Auto-sleep for Workers**:
   - Sleep after 5 minutes of inactivity
   - Wakes up automatically when jobs arrive
   - Reduces cost to near $0

2. **Adjust Worker Concurrency**:
   ```env
   WORKER_CONCURRENCY=2  # Lower = less CPU usage
   ```

3. **Monitor Queue Growth**:
   - Too many jobs = higher worker cost
   - Consider batch processing limits

4. **Use Upstash Redis Free Tier**:
   - 10,000 commands/day included
   - $0.20 per 100K commands after
   - Check usage at https://upstash.com/console

### Scaling Up

When you need more capacity:

1. **Increase Web Service Memory**:
   - Railway Dashboard → Service → Settings
   - Adjust memory allocation (256MB → 512MB → 1GB)
   - CPU will scale automatically

2. **Increase Worker Concurrency**:
   - Set `WORKER_CONCURRENCY=4` (or higher)
   - More concurrent jobs processed
   - Higher CPU and memory usage

3. **Add More Worker Instances**:
   - Create multiple `justoai-workers-2`, `justoai-workers-3`, etc.
   - Each processes jobs independently
   - Requires careful Redis key management

---

## Management Commands

### Railway CLI Commands

```bash
# List all services
railway service list

# View specific service logs
railway logs --service justoai-workers --follow

# Restart a service
railway service restart --service justoai-workers

# Stop a service
railway service stop --service justoai-workers

# Start a service
railway service start --service justoai-workers

# View environment variables
railway variable list

# Deploy latest code
railway deploy --service justoai-workers
```

### Local Testing

Before deploying to Railway:

```bash
# Test worker locally
npm run worker:judit

# Run stress test
npm run stress-test-judit

# Test JUDIT connection
npx tsx scripts/test-judit-connection.ts

# Check queue status
npm run db:studio  # View jobs in database
```

---

## Health Checks

### Web Service Health

```bash
curl https://[your-railway-domain]/api/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected",
  "redis": "connected"
}
```

### Workers Service Health

Check logs for startup messages:
```
🚀 INICIANDO JUDIT ONBOARDING WORKER
✅ Connected to Redis
✅ Worker initialized and listening for jobs
```

---

## Checklist Before Going Live

- [ ] Web service deployed and running
- [ ] Workers service deployed and running
- [ ] All environment variables set correctly
- [ ] Redis connection working
- [ ] Database connection working
- [ ] Test job processed successfully
- [ ] No errors in logs
- [ ] Auto-sleep configured for workers
- [ ] Monitoring dashboards set up
- [ ] Team has access to Railway dashboard

---

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Railway Environment Variables](https://docs.railway.app/guides/environment-variables)
- [Railway Scaling Guide](https://docs.railway.app/guides/scaling)
- [Upstash Redis Documentation](https://upstash.com/docs)
- [BullMQ Documentation](https://docs.bullmq.io)

---

**Last Updated**: 2025-10-16
**Status**: ✅ Production Ready
