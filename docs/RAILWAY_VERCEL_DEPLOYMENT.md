# Railway + Vercel Deployment Guide - JustoAI V2

Complete guide for deploying JustoAI V2 with **Railway (Backend)** + **Vercel (Frontend)** architecture.

---

## 🏗️ Architecture Overview

```
┌────────────────────────────────────────┐
│         VERCEL (Frontend)              │
│  - Next.js Pages & Components          │
│  - Server-Side Rendering (SSR)         │
│  - Static Site Generation (SSG)        │
│  - Client-side interactions            │
└──────────────┬─────────────────────────┘
               │
               │ HTTPS API Calls
               │
               ↓
┌────────────────────────────────────────┐
│         RAILWAY (Backend)              │
│  - API Routes (/api/*)                 │
│  - Bull Queue Workers                  │
│  - Background Jobs                     │
│  - Cron Jobs (unlimited)               │
│  - AI Processing                       │
│  - Report Generation                   │
│  - No timeouts, full Node.js          │
└──────────────┬─────────────────────────┘
               │
               ↓
┌────────────────────────────────────────┐
│    SUPABASE (PostgreSQL Database)      │
│    UPSTASH (Redis Cache)               │
└────────────────────────────────────────┘
```

---

## 🎯 Why This Architecture?

### Railway (Backend)
- ✅ **No timeout limits** (vs 10s on Vercel Hobby)
- ✅ **Persistent workers** (Bull Queue runs 24/7)
- ✅ **Unlimited cron jobs** (vs 1/day on Vercel Hobby)
- ✅ **Full memory control** (vs 2GB max on Vercel Hobby)
- ✅ **Docker support** (complete control)
- ✅ **$5/month free credit** (then pay-as-you-go ~$10-20/month)

### Vercel (Frontend)
- ✅ **Free Hobby plan** (perfect for frontend)
- ✅ **Best Next.js performance** (SSR/SSG optimized)
- ✅ **Global CDN** (fast worldwide)
- ✅ **Auto-deploy from GitHub**

---

## 📋 Prerequisites

### Accounts
- [x] Railway account (you already have)
- [x] Vercel account
- [x] GitHub repository
- [x] Supabase project
- [x] Upstash Redis instance

### Local Setup
```bash
# Install Railway CLI
npm install -g @railway/cli

# Install Vercel CLI
npm install -g vercel

# Login
railway login
vercel login
```

---

## 🚀 Part 1: Deploy Backend to Railway

### Step 1: Prepare Railway Project

1. **Go to Railway Dashboard:**
   https://railway.app/project/119cfa4b-15c4-4178-8aec-981393718583

2. **Create new service in the same project:**
   - Click "+ New Service"
   - Select "GitHub Repo"
   - Connect your `justoai-v2` repository
   - Select branch: `main`

### Step 2: Configure Railway Environment

Railway will auto-detect the `Dockerfile.railway`, but you need to configure environment variables.

**Click on the new service → Variables → Add all these:**

```bash
# Application
NODE_ENV=production

# Database (Supabase)
DATABASE_URL=postgresql://postgres.[project]:password@host:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[project]:password@host:5432/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Redis (Upstash)
REDIS_HOST=us1-xxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-password
UPSTASH_REDIS_REST_URL=https://us1-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Authentication
NEXTAUTH_SECRET=your-super-secret-min-32-chars
NEXTAUTH_URL=https://your-railway-url.up.railway.app

# APIs
GOOGLE_API_KEY=AIzaSy...
JUDIT_API_KEY=your-judit-key  # When you receive it

# Email (Resend)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_your-api-key
FROM_EMAIL=noreply@justoai.com.br

# Workers
BULL_BOARD_ACCESS_TOKEN=your-random-token-32-chars
SAVE_SYNC_STATS=true

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx  # Optional
SENTRY_ENVIRONMENT=production

# Alerts
ALERTS_EMAIL_ENABLED=true
ALERTS_EMAIL_FROM=alerts@justoai.com.br
ALERTS_EMAIL_TO=your-email@example.com
ALERTS_SLACK_ENABLED=false

# Security
ALLOWED_ORIGINS=https://v2.justoai.com.br,https://justoai-v2.vercel.app
CORS_CREDENTIALS=true
SECURITY_HEADERS_ENABLED=true

# Feature Flags
NEXT_PUBLIC_CLASSIC_DASHBOARD_ENABLED=true
NEXT_PUBLIC_PRO_FEATURES_ENABLED=true
NEXT_PUBLIC_PROCESS_MONITORING_ENABLED=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_SWAGGER_ENABLED=false
NEXT_PUBLIC_UPLOAD_MAX_SIZE=10485760

# Process Monitoring
PROCESS_MONITOR_INTERVAL_MINUTES=60
PROCESS_MONITOR_AUTO_START=true
ALERT_EMAIL_ENABLED=true
ALERT_WEBHOOK_ENABLED=false

# Version
JUSTOAI_VERSION=v2.1.0
```

### Step 3: Configure Railway Settings

In Railway service settings:

**Root Directory:** Leave empty (project root)

**Build Command:** (Auto-detected from Dockerfile)

**Start Command:**
```bash
node server.js
```

**Health Check Path:**
```
/api/health
```

**Port:** Railway will auto-detect (uses $PORT env var)

**Region:** Choose closest to your users (e.g., us-west1)

### Step 4: Deploy

Railway will automatically deploy when you:
- Push to GitHub `main` branch
- Or click "Deploy" button in dashboard

**Wait 5-10 minutes for first build.**

### Step 5: Get Railway Backend URL

After deployment, Railway will give you a URL like:
```
https://justoai-v2-production-xxxx.up.railway.app
```

**Save this URL - you'll need it for Vercel!**

---

## 🎨 Part 2: Deploy Frontend to Vercel

### Step 1: Update Vercel Configuration

Since backend is on Railway, update `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "next build",
  "framework": "nextjs",

  "build": {
    "env": {
      "NODE_ENV": "production",
      "NEXT_TELEMETRY_DISABLED": "1"
    }
  },

  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-DNS-Prefetch-Control",
          "value": "on"
        }
      ]
    }
  ],

  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-railway-backend.up.railway.app/api/:path*"
    }
  ]
}
```

**Replace `your-railway-backend.up.railway.app` with your actual Railway URL!**

### Step 2: Configure Vercel Environment Variables

Go to: https://vercel.com/[team]/justoai-v2/settings/environment-variables

**Add only frontend-related variables:**

```bash
# Public variables (embedded in client bundle)
NEXT_PUBLIC_APP_URL=https://v2.justoai.com.br
NEXT_PUBLIC_API_URL=https://your-railway-backend.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Feature flags
NEXT_PUBLIC_CLASSIC_DASHBOARD_ENABLED=true
NEXT_PUBLIC_PRO_FEATURES_ENABLED=true
NEXT_PUBLIC_PROCESS_MONITORING_ENABLED=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_SWAGGER_ENABLED=false
NEXT_PUBLIC_UPLOAD_MAX_SIZE=10485760
```

**That's it for Vercel! All backend logic is on Railway.**

### Step 3: Deploy to Vercel

```bash
# Via CLI
vercel --prod

# Or push to GitHub (auto-deploy)
git push origin main
```

---

## 🔗 Part 3: Connect Frontend to Backend

### Update API Calls

In your frontend code, make sure API calls go to Railway backend:

**Method 1: Using environment variable (recommended)**

Create `src/lib/api-client.ts`:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function apiCall(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include', // Important for cookies
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// Usage:
// const data = await apiCall('/api/processes');
```

**Method 2: Using Vercel rewrites (already configured in vercel.json)**

API calls like `/api/processes` will automatically proxy to Railway backend.

---

## ✅ Part 4: Verification

### Test Backend (Railway)

```bash
# Health check
curl https://your-railway-backend.up.railway.app/api/health

# Should return:
{
  "status": "ok",
  "timestamp": "2025-...",
  "version": "v2.1.0"
}
```

### Test Frontend (Vercel)

```bash
# Visit your Vercel URL
https://justoai-v2.vercel.app

# Or your custom domain
https://v2.justoai.com.br
```

### Test Integration

1. Open frontend in browser
2. Open DevTools → Network tab
3. Perform an action that calls API
4. Verify request goes to Railway backend URL
5. Check response is successful

---

## 🔄 Part 5: Continuous Deployment

### Automatic Deployments

**Backend (Railway):**
- Push to `main` branch → Railway auto-deploys backend
- Build time: ~5-10 minutes
- URL stays the same

**Frontend (Vercel):**
- Push to `main` branch → Vercel auto-deploys frontend
- Build time: ~2-3 minutes
- URL stays the same

### Manual Deployment

**Railway:**
```bash
# Via Railway CLI
railway up

# Or via dashboard
# Click "Deploy" button
```

**Vercel:**
```bash
vercel --prod
```

---

## 🐛 Troubleshooting

### Backend Issues

**Problem: Railway build fails**

Check logs in Railway dashboard:
```
Services → justoai-v2-api → Deployments → [Latest] → View Logs
```

Common issues:
- Missing environment variables
- Prisma schema not generated
- Docker build errors

**Solution:**
- Add missing env vars
- Check Dockerfile.railway
- Ensure all dependencies in package.json

---

**Problem: API endpoints return 500**

Check Railway logs:
```bash
railway logs
```

Common issues:
- Database connection failed
- Redis connection failed
- Missing secrets

**Solution:**
- Verify DATABASE_URL
- Verify REDIS credentials
- Check all env vars are set

---

### Frontend Issues

**Problem: API calls fail with CORS error**

Check CORS configuration in Railway backend.

**Solution:**
Add frontend URL to `ALLOWED_ORIGINS`:
```bash
ALLOWED_ORIGINS=https://justoai-v2.vercel.app,https://v2.justoai.com.br
```

---

**Problem: Frontend can't reach backend**

Check `NEXT_PUBLIC_API_URL` in Vercel env vars.

**Solution:**
```bash
NEXT_PUBLIC_API_URL=https://your-railway-backend.up.railway.app
```

---

## 📊 Monitoring

### Railway Monitoring

**Logs:**
```bash
railway logs --tail
```

**Metrics:**
- CPU, Memory, Network in Railway dashboard
- Under "Metrics" tab

**Alerts:**
- Configure in Railway → Settings → Notifications

### Vercel Monitoring

**Logs:**
```bash
vercel logs --follow
```

**Analytics:**
https://vercel.com/[team]/justoai-v2/analytics

---

## 💰 Cost Estimation

### Railway (Backend + Workers)
- **Free tier:** $5/month credit
- **Typical usage:** $10-20/month
  - API server: $5-10
  - Workers: $5-10
  - Database queries: included in Supabase
  - Redis: included in Upstash

### Vercel (Frontend)
- **Free tier:** $0/month (Hobby plan)
- Includes:
  - 100 GB bandwidth
  - Unlimited deployments
  - Automatic SSL

### Total Estimated Cost
- **Month 1:** $0 (Railway free credit)
- **Month 2+:** $10-20/month

**Much cheaper than upgrading Vercel to Pro ($20/month + usage)**

---

## 🚀 Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Deploy frontend to Vercel
3. ✅ Configure environment variables
4. ✅ Test integration
5. ✅ Configure custom domain
6. ✅ Set up monitoring
7. ✅ Configure alerts

---

## 📞 Support

### Railway
- Dashboard: https://railway.app/
- Docs: https://docs.railway.app/
- Discord: https://discord.gg/railway

### Vercel
- Dashboard: https://vercel.com/
- Docs: https://vercel.com/docs
- Discord: https://discord.gg/vercel

---

**Last Updated:** 2025-10-13
**Architecture:** Railway (Backend) + Vercel (Frontend)
**Status:** ✅ Production Ready
