# 🧭 Infrastructure Changes Summary

Branch: `infra/separate-workers`

This branch prepares JustoAI V2 for deployment of backend and workers as **separate Railway services**, enabling better scalability, cost control, and isolation.

---

## 📋 Overview

### Goals Achieved

✅ **Separation of Concerns**: Backend API and workers run independently
✅ **Cost Optimization**: Workers can auto-sleep when idle (near $0 idle cost)
✅ **Improved Reliability**: Worker failures don't affect API availability
✅ **Better Observability**: Monitor each service separately
✅ **Security Hardening**: API keys segregated by service
✅ **Documentation**: Comprehensive setup guides and examples

### Architecture

```
Railway Project
├── Service: justoai-v2 (Backend API)
│   ├── Handles: API requests, database queries
│   ├── Memory: 256MB
│   ├── Auto-sleep: Disabled (always available)
│   └── Cost: ~$5-7/month idle
│
└── Service: justoai-workers (Background Jobs)
    ├── Handles: JUDIT processing, queue jobs
    ├── Memory: 256MB
    ├── Auto-sleep: Enabled (5 min idle timeout)
    └── Cost: ~$0/month idle, $3-5/month active

Shared Resources:
├── Redis (Upstash): ~$6/month
├── PostgreSQL (Supabase): Free tier
└── Total: ~$13/month (or $6-8 idle)
```

---

## 📁 Files Added

### Documentation

| File | Purpose |
|------|---------|
| `docs/railway_workers_setup.md` | Complete step-by-step Railway deployment guide |
| `docs/SECURITY_README.md` | Security best practices for secrets management |
| `CHANGES_INFRA.md` | This file - infrastructure changes summary |
| `deploy/railway_web.toml` | Example configuration for web service |
| `deploy/railway_workers.toml` | Example configuration for workers service |

### Scripts

| File | Purpose |
|------|---------|
| `scripts/test-judit-connection.ts` | Test JUDIT API connectivity (safe mode) |
| `scripts/stress-test-judit.ts` | Already existed - stress tests worker resilience |
| `scripts/test-judit-queue.ts` | Already existed - functional queue testing |

### Configuration

| File | Status |
|------|--------|
| `Dockerfile.workers` | Already existed - containerizes workers |
| `.env.workers.example` | Already existed - example env for workers |
| `.env.railway.example` | Already existed - example env for Railway |
| `package.json` | **Updated** - added worker scripts |
| `.gitignore` | **Verified** - ensures no secrets committed |

---

## 📝 Files Modified

### package.json

**Changes Made:**
- ✅ Added `"worker:judit": "npx tsx src/workers/juditOnboardingWorker.ts"`
- ✅ Added `"worker:judit:pm2": "pm2 start --no-autorestart --name judit-worker --interpreter=node -- src/workers/juditOnboardingWorker.ts"`

**Rationale:**
- Allows running JUDIT worker directly for testing
- Supports both npm and pm2-based deployments

**To Verify:**
```bash
npm run worker:judit        # Should start worker
npm run worker:judit:pm2    # Should start with PM2
```

### .gitignore

**Status:** ✅ **Already Configured**

Verified to include:
```gitignore
.env
.env.local
.env.*.local
.secrets
/uploads/
```

**Action Taken:** Reviewed and confirmed complete

---

## 🚀 Deployment Workflow

### Current Setup

```
Local Development
    ↓
Git Push (to branch)
    ↓
Railway Auto-Deploy (automatic)
    ├── Web Service Updated
    └── Workers Service Updated
    ↓
Health Checks
    ├── API /api/health
    └── Workers logs monitoring
```

### How to Deploy

1. **Ensure all changes committed:**
   ```bash
   git status  # Should be clean
   ```

2. **Push to Railway (triggers auto-deploy):**
   ```bash
   git push origin infra/separate-workers
   ```

3. **Monitor deployments:**
   - Railway Dashboard: https://railway.app
   - Logs tab shows build and deployment progress

4. **Verify services:**
   ```bash
   # Test web service
   curl https://[railway-domain]/api/health

   # Check worker logs
   railway logs --service justoai-workers --follow
   ```

---

## 🔑 Environment Variables by Service

### Web Service (Backend API)

**Must Have:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
GOOGLE_API_KEY=...
```

**NOT Needed:**
```bash
❌ JUDIT_API_KEY  # This goes to workers only!
```

### Workers Service

**Must Have:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
JUDIT_API_KEY=...          # ⚠️ ONLY here!
JUDIT_API_BASE_URL=https://api.judit.ai/v1
```

**Same as Web:**
```bash
GOOGLE_API_KEY=...
LOG_LEVEL=info
```

---

## 🔐 Security Improvements

### Before This Change

- ❌ All environment variables in single service
- ❌ JUDIT_API_KEY exposed if web service compromised
- ❌ No clear segregation of concerns
- ❌ Scaling workers required scaling web API

### After This Change

- ✅ API keys segregated by service
- ✅ JUDIT_API_KEY only in workers service
- ✅ Clear responsibility boundaries
- ✅ Independent scaling and deployments
- ✅ Security documentation provided

### Key Segregation

```
Web Service CAN have:     Workers Service MUST have:
✅ DATABASE_URL           ✅ DATABASE_URL
✅ REDIS_URL              ✅ REDIS_URL
✅ GOOGLE_API_KEY         ✅ GOOGLE_API_KEY
❌ JUDIT_API_KEY          ✅ JUDIT_API_KEY ← ONLY HERE!
```

---

## 💰 Cost Optimization

### Monthly Cost Breakdown

| Component | Idle | Active | Notes |
|-----------|------|--------|-------|
| Web API (Railway) | $5-7 | $10-15 | Always running |
| Workers (Railway) | $0 | $3-10 | Auto-sleep enabled |
| Redis (Upstash) | $6 | $6-15 | Usage-based |
| **Total** | **$11-13** | **$19-40** | Depends on load |

### Savings with Auto-sleep

- **Without optimization**: ~$25/month (workers always running)
- **With auto-sleep**: ~$13/month (workers sleep when idle)
- **Savings**: ~$12/month (48% reduction!)

### How Auto-sleep Works

1. No jobs for 5 minutes → Workers service auto-sleeps
2. New job added → Workers service auto-wakes
3. Processing completes → Sleeps again after 5 min idle
4. Billed only for compute time (not sleep time)

---

## 📊 Testing Checklist

Before production deployment:

### Local Tests

- [ ] `npm run build` - Build completes without errors
- [ ] `npm run worker:judit` - Worker starts locally
- [ ] `npm run stress-test-judit` - Stress test passes
- [ ] `npx tsx scripts/test-judit-connection.ts` - Connection test passes (if JUDIT_API_KEY set)

### Railway Web Service Tests

- [ ] Service status is "Running"
- [ ] `curl https://[domain]/api/health` returns 200
- [ ] API endpoints respond correctly
- [ ] Database queries work
- [ ] Supabase auth works

### Railway Workers Service Tests

- [ ] Service status is "Running"
- [ ] Logs show startup messages:
  ```
  🚀 INICIANDO JUDIT ONBOARDING WORKER
  ✅ Connected to Redis
  ✅ Worker initialized
  ```
- [ ] Test job processes successfully
- [ ] Worker goes to sleep after 5 min idle
- [ ] Worker wakes up when job arrives

### Integration Tests

- [ ] Web API can add jobs to queue
- [ ] Workers service processes jobs
- [ ] No errors in either service
- [ ] CPU/Memory usage is stable
- [ ] No memory leaks detected

---

## 📖 Documentation Added

### 1. Railway Workers Setup Guide

**File:** `docs/railway_workers_setup.md`

**Contents:**
- Architecture overview
- Step-by-step deployment instructions
- Environment variable configuration
- Troubleshooting guide
- Cost optimization strategies
- Scaling recommendations
- Health check procedures

**When to Use:**
- First-time Railway deployment
- Adding a new team member
- Troubleshooting deployment issues

### 2. Security Best Practices

**File:** `docs/SECURITY_README.md`

**Contents:**
- Secrets management guidelines
- .gitignore best practices
- Railway environment configuration
- Handling accidental commits
- Security audit checklist
- Incident response procedures

**When to Use:**
- Before deploying to production
- When onboarding new developers
- If security incident occurs

### 3. TOML Configuration Examples

**Files:** `deploy/railway_web.toml`, `deploy/railway_workers.toml`

**Contents:**
- Recommended build settings
- Memory allocations
- Auto-sleep configurations
- Health check endpoints
- Pre/post deployment scripts
- Environment variable checklists

**When to Use:**
- As reference for manual configuration
- Understanding recommended settings
- Scaling decisions

---

## 🔄 Related Changes

### Infrastructure Already in Place

These were implemented in earlier commits but are foundational:

- ✅ **Redis Client**: `src/lib/redis.ts` - Centralized Upstash Redis
- ✅ **JUDIT Service**: `src/lib/services/juditService.ts` - API integration
- ✅ **Queue Setup**: `src/lib/queue/juditQueue.ts` - BullMQ queue
- ✅ **Worker**: `src/workers/juditOnboardingWorker.ts` - Queue processor
- ✅ **Logger**: `src/lib/observability/logger.ts` - Structured logging
- ✅ **Dockerfile.workers** - Container image for workers
- ✅ **Test Scripts** - Functional and stress testing

### What This Branch Adds

This branch adds the **deployment orchestration** layer:
- Clear documentation for multi-service setup
- Environment configuration templates
- Security guidelines
- Testing and monitoring procedures
- Cost optimization strategies

---

## ⚠️ Important Notes

### No Secrets Committed

✅ **Verified:** No API keys, passwords, or sensitive data in any committed files

All configuration files use **placeholders** with clear instructions for setting real values in Railway Dashboard.

### Backward Compatibility

✅ **Maintained:** Changes are fully backward compatible

Existing deployments continue to work. This branch adds new deployment options without removing old ones.

### Database Migrations

✅ **No Changes:** Database schema unchanged

The separation only affects deployment topology, not data structure. No migrations needed.

---

## 🔀 Merge Strategy

### For Code Review

1. **Review documentation first**
   - Understand the architecture changes
   - Review security guidelines

2. **Check configuration files**
   - Verify no secrets in templates
   - Confirm placeholders used

3. **Test locally**
   - Run scripts to verify functionality
   - Check package.json changes

4. **Approve and merge**
   - Use "Squash and merge" to keep history clean
   - Merge to `main` branch

### After Merge

1. **Push to Railway**
   - Auto-deploy triggers for both services
   - Monitor deployment progress

2. **Run deployment tests**
   - Verify both services online
   - Check health endpoints

3. **Monitor for 24 hours**
   - Watch CPU/Memory usage
   - Check error logs
   - Monitor queue processing

---

## 📚 Quick Reference

### Useful Commands

```bash
# Local testing
npm run worker:judit              # Run worker locally
npm run stress-test-judit         # Stress test
npx tsx scripts/test-judit-connection.ts  # Connection test

# Railway CLI
railway logs --service justoai-workers --follow
railway service restart --service justoai-workers
railway variable list

# Git operations
git checkout infra/separate-workers
git log --oneline -10
git diff main..infra/separate-workers
```

### Important URLs

- **Railway Dashboard**: https://railway.app/project/[id]
- **Web Service Logs**: Railway → Services → justoai-v2 → Logs
- **Workers Logs**: Railway → Services → justoai-workers → Logs
- **Redis Dashboard**: https://upstash.com/console
- **Supabase Dashboard**: https://app.supabase.com

---

## ✅ Checklist Before Merging

- [ ] All files created/modified
- [ ] No secrets committed
- [ ] Documentation complete
- [ ] Scripts tested locally
- [ ] .gitignore configured
- [ ] package.json verified
- [ ] CHANGES_INFRA.md updated
- [ ] Ready for PR review

---

## 📞 Support & Questions

If you have questions about the infrastructure changes:

1. **Check documentation first**
   - `docs/railway_workers_setup.md` - Deployment guide
   - `docs/SECURITY_README.md` - Security practices
   - `deploy/*.toml` - Configuration reference

2. **Review scripts**
   - `scripts/test-judit-connection.ts` - API testing
   - `scripts/stress-test-judit.ts` - Queue testing

3. **Check logs**
   - Railway Dashboard Logs tab
   - Search for specific error messages

---

**Branch**: `infra/separate-workers`
**Created**: 2025-10-16
**Status**: ✅ Ready for Review
**Target**: `main` branch
