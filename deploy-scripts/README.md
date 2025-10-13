# 🚀 Deploy Scripts - JustoAI V2

Automated deployment and configuration scripts for production.

---

## 📁 Scripts Overview

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `01-pre-deploy-check.js` | Validates environment and code before deploy | Before every deploy |
| `02-configure-vercel.sh` | Configures Vercel environment variables | Once, or when env vars change |
| `03-configure-supabase.sql` | Sets up RLS policies and security | Once, after database setup |
| `04-test-connections.js` | Tests all external service connections | Before deploy, after changes |
| `05-rollback.sh` | Rolls back to previous deployment | When something goes wrong |

---

## 🔧 Prerequisites

```bash
# Install required tools
npm install -g vercel
npm install  # Install project dependencies

# Make scripts executable (Linux/Mac)
chmod +x deploy-scripts/*.sh
```

---

## 📋 Deployment Workflow

### First-Time Setup

```bash
# 1. Copy and fill environment file
cp .env.production.example .env.production
# Edit .env.production with real values

# 2. Test connections
node deploy-scripts/04-test-connections.js

# 3. Pre-deploy validation
node deploy-scripts/01-pre-deploy-check.js

# 4. Configure Supabase (via Supabase SQL Editor)
# Open deploy-scripts/03-configure-supabase.sql
# Copy content and run in Supabase SQL Editor

# 5. Configure Vercel
./deploy-scripts/02-configure-vercel.sh production

# 6. Deploy
vercel --prod
```

### Regular Deployments

```bash
# 1. Pre-deploy check
node deploy-scripts/01-pre-deploy-check.js

# 2. Test connections
node deploy-scripts/04-test-connections.js

# 3. Deploy via Git (Vercel auto-deploys)
git push origin main

# OR manual deploy
vercel --prod
```

### Emergency Rollback

```bash
# Rollback to previous deployment
./deploy-scripts/05-rollback.sh

# OR specify deployment
./deploy-scripts/05-rollback.sh <deployment-url>
```

---

## 📖 Script Documentation

### 01-pre-deploy-check.js

**Purpose:** Validates environment, code, and configuration before deployment.

**Checks:**
- ✅ Required environment variables present
- ✅ Database migrations exist and valid
- ✅ Critical files present
- ✅ No mock data in production code
- ✅ Dependencies installed correctly
- ✅ Build configuration valid

**Usage:**
```bash
node deploy-scripts/01-pre-deploy-check.js
```

**Exit Codes:**
- `0` - All checks passed
- `1` - Critical errors found (deploy blocked)

**Example Output:**
```
============================================================
🔍 CHECKING ENVIRONMENT VARIABLES
============================================================

✅ NODE_ENV: configured
✅ DATABASE_URL: configured
✅ NEXTAUTH_SECRET: configured
...

============================================================
📊 VALIDATION SUMMARY
============================================================

🎉 ALL CHECKS PASSED!
✅ Your application is ready for production deploy
```

---

### 02-configure-vercel.sh

**Purpose:** Configures all environment variables in Vercel from `.env.production`.

**Usage:**
```bash
# For production
./deploy-scripts/02-configure-vercel.sh production

# For preview
./deploy-scripts/02-configure-vercel.sh preview
```

**Requirements:**
- Vercel CLI installed and authenticated
- `.env.production` file exists with all values
- Vercel project linked (`vercel link`)

**What it does:**
1. Reads `.env.production`
2. Sets each variable in Vercel
3. Applies to specified environment

**Example Output:**
```
[INFO] Configuring Vercel for environment: production
[INFO] Loading environment variables from .env.production...
[INFO] Setting NODE_ENV...
[SUCCESS] NODE_ENV configured
[INFO] Setting DATABASE_URL...
[SUCCESS] DATABASE_URL configured
...
[SUCCESS] ✅ Vercel environment variables configured for production
```

---

### 03-configure-supabase.sql

**Purpose:** Sets up Row Level Security policies and database security.

**Usage:**
```sql
-- Option 1: Via Supabase SQL Editor
-- 1. Open https://app.supabase.com/project/[id]/sql/new
-- 2. Copy entire content of this file
-- 3. Click "Run"

-- Option 2: Via psql
psql $DATABASE_URL -f deploy-scripts/03-configure-supabase.sql
```

**What it does:**
1. Enables RLS on all tables
2. Creates security policies for each table
3. Creates helper functions
4. Creates performance indexes
5. Grants appropriate permissions

**Verification:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;

-- Should return 0 rows
```

---

### 04-test-connections.js

**Purpose:** Tests connections to all external services before deployment.

**Tests:**
- 🗄️ Database (Prisma + Supabase)
- 🔴 Redis (Upstash)
- 📧 Email (SMTP/Resend)
- 🔑 API Keys (validation)
- 🌐 JUDIT API (if configured)

**Usage:**
```bash
# Test all connections
node deploy-scripts/04-test-connections.js

# With environment file
NODE_ENV=production node deploy-scripts/04-test-connections.js
```

**Exit Codes:**
- `0` - All tests passed
- `1` - One or more tests failed

**Example Output:**
```
🚀 JustoAI V2 - CONNECTION TESTING

🧪 Testing: Environment Variables...
   - All 15 required variables present
✅ Environment Variables: PASSED

🧪 Testing: Database (Prisma)...
   - Connection successful
   - Query successful (5 users)
   - Workspace table accessible (2 workspaces)
✅ Database (Prisma): PASSED

...

============================================================
📊 TESTING SUMMARY
============================================================
Total tests: 7
✅ Passed: 7
❌ Failed: 0

🎉 ALL TESTS PASSED!
✅ All connections are working correctly
```

---

### 05-rollback.sh

**Purpose:** Rolls back production deployment to a previous version.

**Usage:**
```bash
# Interactive (prompts for deployment)
./deploy-scripts/05-rollback.sh

# Direct (specify deployment URL)
./deploy-scripts/05-rollback.sh <deployment-url>
```

**Example:**
```bash
# List recent deployments
vercel ls --prod

# Rollback to specific deployment
./deploy-scripts/05-rollback.sh https://justoai-v2-abc123.vercel.app
```

**What it does:**
1. Confirms rollback with user
2. Promotes previous deployment to production
3. Verifies rollback success
4. Runs post-rollback checks
5. Logs rollback event

**Example Output:**
```
============================================================
⚠️  ROLLBACK PROCEDURE
============================================================

This will revert your production deployment to the previous version

Are you sure you want to rollback? (yes/no): yes

[INFO] Starting rollback procedure...
[INFO] Fetching deployment history...
[INFO] Rolling back to previous deployment...
[SUCCESS] ✅ Rollback completed successfully
[INFO] Verifying rollback...
[SUCCESS] ✅ Application is responding (HTTP 200)

============================================================
ROLLBACK COMPLETED
============================================================
```

---

## 🔍 Troubleshooting

### Issue: "Vercel CLI not found"

```bash
# Install Vercel CLI
npm install -g vercel

# Verify installation
vercel --version
```

### Issue: "Permission denied" (Linux/Mac)

```bash
# Make scripts executable
chmod +x deploy-scripts/*.sh
```

### Issue: "Cannot find module"

```bash
# Install dependencies
npm install

# Verify Prisma client
npx prisma generate
```

### Issue: ".env.production not found"

```bash
# Copy template
cp .env.production.example .env.production

# Edit with real values
nano .env.production
```

### Issue: Pre-deploy check fails

**Read the error output carefully.** Common issues:

- **Missing environment variables:**
  - Edit `.env.production`
  - Add missing variables

- **Mock data detected:**
  - Search for `mockData`, `MOCK_`, or `development && mock`
  - Remove or replace with real implementations

- **Build fails:**
  - Run `npm run build` locally
  - Fix TypeScript errors
  - Fix linting errors

---

## 📊 Best Practices

### Before Every Deploy

```bash
# 1. Always run pre-deploy check
node deploy-scripts/01-pre-deploy-check.js

# 2. Test connections
node deploy-scripts/04-test-connections.js

# 3. If both pass, proceed with deploy
```

### Environment Variables

- ✅ **DO:** Keep `.env.production` secure and never commit
- ✅ **DO:** Use strong, unique secrets for production
- ✅ **DO:** Rotate secrets every 90 days
- ❌ **DON'T:** Reuse development secrets in production
- ❌ **DON'T:** Share secrets via unsecure channels

### Deployments

- ✅ **DO:** Deploy during low-traffic hours
- ✅ **DO:** Notify team before deploying
- ✅ **DO:** Monitor for 30 minutes after deploy
- ❌ **DON'T:** Deploy on Fridays (unless emergency)
- ❌ **DON'T:** Deploy without testing first

### Rollbacks

- ✅ **DO:** Document why rollback was needed
- ✅ **DO:** Investigate root cause after rollback
- ✅ **DO:** Fix issue before redeploying
- ❌ **DON'T:** Repeatedly rollback without fixing issue

---

## 🆘 Getting Help

### Documentation
- **Production Setup:** `docs/PRODUCTION_SETUP.md`
- **Runbook:** `docs/RUNBOOK.md`
- **Checklist:** `CHECKLIST.md`

### Support Channels
- **Slack:** #engineering-support
- **Email:** devops@justoai.com
- **On-Call:** See RUNBOOK.md for contacts

---

**Last Updated:** 2025-01-22
**Maintained by:** DevOps Team
