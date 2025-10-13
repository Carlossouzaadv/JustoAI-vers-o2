# 🚀 Complete Deployment Instructions

## ⚠️ Network Connectivity Issue Detected

Your local machine cannot connect directly to Supabase database due to firewall/network restrictions (ports 5432/6543 blocked).

**Solution:** Manual deployment via Supabase SQL Editor (browser-based)

---

## 📋 COMPLETE DEPLOYMENT PROCEDURE

### **PHASE 1: Database Setup (30 minutes)**

#### **Step 1.1: Apply Base Schema**

1. Open Supabase SQL Editor:
   https://supabase.com/dashboard/project/overbsbivbuevmyltyet/sql/new

2. Open local file: `deploy-scripts/00-base-schema.sql`

3. Copy **ALL** content (1444 lines)

4. Paste in SQL Editor and click **"Run"**

5. ✅ Verify: Should complete in ~10 seconds with "Success" message

---

#### **Step 1.2: Apply Additional Migrations (In Order)**

Run these **6 migration files** in **exact order**:

**Migration 1:** `prisma/migrations/001_performance_indexes.sql`
- Creates performance indexes for all tables
- ~126 lines

**Migration 2:** `prisma/migrations/20231201_telemetry_quota_system.sql`
- Creates telemetry and quota tracking tables
- ~177 lines

**Migration 3:** `prisma/migrations/20250115_credit_system.sql`
- Creates unified credit system
- ~289 lines

**Migration 4:** `prisma/migrations/20250119_deepen_analysis_system.sql`
- Creates analysis versioning and cache system
- ~270 lines

**Migration 5:** `prisma/migrations/20250119_scheduled_reports_enhancement.sql`
- Enhances report system with quotas
- ~232 lines

**Migration 6:** `prisma/migrations/20250119_upload_batch_system.sql`
- Creates Excel upload batch processing system
- ~215 lines

**For each migration:**
1. Open the file locally
2. Copy ALL content
3. Paste in Supabase SQL Editor
4. Click **"Run"**
5. Wait for "Success" message
6. Proceed to next migration

---

#### **Step 1.3: Configure Row Level Security (RLS)**

1. Open Supabase SQL Editor (new query)

2. Open local file: `deploy-scripts/03-configure-supabase.sql`

3. Copy **ALL** content

4. Paste in SQL Editor and click **"Run"**

5. ✅ Verify RLS is enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should show `rowsecurity = t` (true)

---

#### **Step 1.4: Verify Database Setup**

Run this verification query:

```sql
-- Count all tables
SELECT COUNT(*) as total_tables
FROM pg_tables
WHERE schemaname = 'public';
```

**Expected result:** ~50+ tables

```sql
-- List all tables
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Key tables to verify exist:**
- workspaces
- users
- clients
- cases
- monitored_processes
- process_movements
- workspace_credits
- credit_allocations
- upload_batch
- analysis_jobs
- report_schedules

---

###  **PHASE 2: Connection Testing (5 minutes)**

Since we can't connect from your machine, we'll test after Vercel deployment.

**Skip to Phase 3** for now.

---

### **PHASE 3: Configure Vercel Environment Variables (15 minutes)**

You have two options:

#### **Option A: Manual Configuration (Recommended)**

1. Go to: https://vercel.com/justoais-projects/justoaiv2/settings/environment-variables

2. Click **"Add New"** for each variable below

3. Set Environment: **Production** ✅

4. Click **"Save"**

**Copy these variables from `.env.production`:**

```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://justoaiv2.vercel.app
DATABASE_URL=postgresql://postgres.overbsbivbuevmyltyet:Nuwjjr$3@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:Nuwjjr$3@db.overbsbivbuevmyltyet.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://overbsbivbuevmyltyet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92ZXJic2JpdmJ1ZXZteWx0eWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczNzY1NTQsImV4cCI6MjA1Mjk1MjU1NH0.RMqYVPWEhH5xMTuUxdBVGPxK_AuZYRDmBiKuCWIL3zw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92ZXJic2JpdmJ1ZXZteWx0eWV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzM3NjU1NCwiZXhwIjoyMDUyOTUyNTU0fQ.T-LkBqgJNqXXVpGQG1ycQZ9h_sT0JW5wvBkPKvLHNLk
REDIS_HOST=accepted-cobra-23421.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=AVt9AAIncDI5Y2Q5YjE2NmZlOWE0N2MzYTM3ZWMyYzgyMGJiNDczNXAyMjM0MjE
REDIS_URL=rediss://default:AVt9AAIncDI5Y2Q5YjE2NmZlOWE0N2MzYTM3ZWMyYzgyMGJiNDczNXAyMjM0MjE@accepted-cobra-23421.upstash.io:6379
UPSTASH_REDIS_REST_URL=https://accepted-cobra-23421.upstash.io
UPSTASH_REDIS_REST_TOKEN=AVt9AAIncDI5Y2Q5YjE2NmZlOWE0N2MzYTM3ZWMyYzgyMGJiNDczNXAyMjM0MjE
NEXTAUTH_URL=https://justoaiv2.vercel.app
NEXTAUTH_SECRET=Jk3m9Wp2Lq7Xz5Rt8Yn4Cv6Bx1Mf3Gh9Kp2Wd7Qs5Vt8Hn4Jx6Lc1Rf3Zp9Mn
GOOGLE_API_KEY=AIzaSyBepx-oedsAOION2hvIbR5fYzUaU1Zs3kM
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_9xwwqQ9R_EcjRQuA6eD9Aj1xHmgAo8Tvz
FROM_EMAIL=noreply@justoai.com.br
ALLOWED_ORIGINS=https://justoaiv2.vercel.app,https://www.justoai.com.br,https://app.justoai.com.br
SENTRY_DSN=https://8a6efddb7bab038e0d0601edd41ea152@o4510178719039488.ingest.us.sentry.io/4510179104456704
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=justoai-v2@1.0.0
BULL_BOARD_ACCESS_TOKEN=7d8f3e9c2a1b4f6e8d3c7a9b2e1f4d6c8a3b7e2f9d1c4a6e8b3d7f2a9c1e4b6d

(Continue with all variables from .env.production...)
```

**See full list in:** `.env.production`

---

### **PHASE 4: Git Commit & Deploy (10 minutes)**

#### **Step 4.1: Verify Git Status**

```bash
cd "C:\Users\carlo\Documents\PROJETO JUSTOAI\NOVA FASE\justoai-v2"
git status
```

#### **Step 4.2: Add Files**

```bash
git add .
```

#### **Step 4.3: Verify .env.production is NOT staged**

```bash
git status
```

If you see `.env.production` in the list, remove it:

```bash
git reset .env.production
```

#### **Step 4.4: Commit**

```bash
git commit -m "feat: Production deployment ready

- Remove all mock data from APIs
- Add complete production environment configuration
- Add 6 database migrations (telemetry, credits, analysis, reports, uploads)
- Add RLS security policies
- Add deployment automation scripts
- Add comprehensive documentation
- Add manual migration guide for network restrictions

Production URL: https://justoaiv2.vercel.app
Supabase Project: overbsbivbuevmyltyet
Redis: Upstash accepted-cobra-23421

Ready for production deployment."
```

#### **Step 4.5: Push to Git**

```bash
git push origin main
```

**Vercel will automatically:**
1. Detect the push
2. Run `npm install`
3. Run `npm run build`
4. Deploy to production
5. URL: https://justoaiv2.vercel.app

---

### **PHASE 5: Monitor Deployment (5 minutes)**

1. **Watch Vercel Dashboard:**
   https://vercel.com/justoais-projects/justoaiv2/deployments

2. **Wait for "Ready" status** (usually 3-5 minutes)

3. **Check for errors** in build logs

---

### **PHASE 6: Verify Production (5 minutes)**

#### **Test 1: Health Check**

Open in browser:
```
https://justoaiv2.vercel.app/api/health
```

**Expected response:**
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2025-10-12T..."
}
```

#### **Test 2: Homepage**

Open:
```
https://justoaiv2.vercel.app
```

Should load without errors.

#### **Test 3: Database Connection**

The health API should connect to database. If it works, database connection is OK.

#### **Test 4: Check Sentry**

Open:
```
https://justoai.sentry.io/issues/
```

Should show no critical errors from the new deployment.

---

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] Phase 1.1: Base schema applied ✅
- [ ] Phase 1.2: All 6 migrations applied ✅
- [ ] Phase 1.3: RLS configured ✅
- [ ] Phase 1.4: Database verified ✅
- [ ] Phase 3: Vercel environment variables configured ✅
- [ ] Phase 4: Git pushed, Vercel deployed ✅
- [ ] Phase 5: Deployment monitoring complete ✅
- [ ] Phase 6: All tests passed ✅

---

## 🔧 IF SOMETHING GOES WRONG

### **Build Fails on Vercel**

1. Check Vercel deployment logs
2. Look for TypeScript or ESLint errors
3. Fix errors locally
4. Commit and push again

### **Database Connection Fails**

1. Verify environment variables in Vercel match `.env.production`
2. Check Supabase is not paused (free tier auto-pauses after 7 days inactivity)
3. Verify all migrations were applied successfully

### **Application Crashes**

1. Check Vercel logs: https://vercel.com/justoais-projects/justoaiv2/deployments
2. Check Sentry for errors: https://justoai.sentry.io/issues/
3. Check Supabase logs: https://supabase.com/dashboard/project/overbsbivbuevmyltyet/logs/explorer

### **Emergency Rollback**

Via Vercel Dashboard:
1. Go to: https://vercel.com/justoais-projects/justoaiv2/deployments
2. Find the previous working deployment
3. Click "..." → "Promote to Production"

---

## 📅 NEXT STEPS (Friday)

When you receive the **JUDIT_API_KEY**:

1. Edit `.env.production` locally:
   ```
   JUDIT_API_KEY=your-actual-key-here
   ```

2. Add to Vercel:
   - Dashboard → Settings → Environment Variables
   - Add: `JUDIT_API_KEY` = [your key]
   - Environment: Production

3. Redeploy:
   ```bash
   git commit --allow-empty -m "Add JUDIT API key"
   git push origin main
   ```

---

## 📞 SUPPORT

If you encounter any issues during deployment:

1. Check the deployment logs in Vercel
2. Check Supabase dashboard for database errors
3. Check Sentry for application errors
4. Review the documentation files:
   - `START_HERE.md` - Quick start
   - `DEPLOY_NOW.md` - Detailed guide
   - `QUICK_COMMANDS.md` - Command reference
   - `deploy-scripts/MANUAL_MIGRATION_GUIDE.md` - Database setup

---

**Created:** 2025-10-12
**Status:** Ready for execution
**Estimated Time:** 70 minutes total
**Network Issue:** Firewall blocking direct DB connection - using manual SQL Editor approach
