# 🚀 Deploy Frontend to Vercel - Quick Guide

## ✅ Railway Backend Status

**Your Railway backend is deployed at:**
```
https://justoai-vers-o2-production.up.railway.app
```

**Health Check:** Test at https://justoai-vers-o2-production.up.railway.app/api/health

---

## 📋 Step-by-Step Vercel Deployment (15 minutes)

### Step 1: Test Railway Backend (1 minute)

First, verify your Railway backend is working:

```bash
curl https://justoai-vers-o2-production.up.railway.app/api/health
```

**Expected response:**
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2025-10-13T..."
}
```

If you get this response, your backend is working! ✅

---

### Step 2: Deploy to Vercel (5 minutes)

#### Option A: Via Vercel Dashboard (Recommended)

1. **Go to Vercel:**
   - Visit: https://vercel.com/
   - Login with your account

2. **Create New Project:**
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Select the `justoai-v2` folder (or root if it's the main project)

3. **Configure Build Settings:**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `.` (or `./justoai-v2` if in monorepo)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

4. **DON'T CLICK DEPLOY YET!**
   - We need to add environment variables first

---

### Step 3: Configure Environment Variables (5 minutes)

Before deploying, add these environment variables in Vercel:

1. **In the Vercel project setup screen:**
   - Scroll down to "Environment Variables"
   - Add each variable below

2. **Or after deployment:**
   - Go to: Project → Settings → Environment Variables

#### Required Environment Variables

**Copy and paste these into Vercel:**

```bash
# CRITICAL - Backend API URL
NEXT_PUBLIC_API_URL=https://justoai-vers-o2-production.up.railway.app

# Your Vercel URL (will be auto-generated, update after first deploy)
NEXT_PUBLIC_APP_URL=https://justoai-v2.vercel.app

# Supabase (for authentication)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...YOUR_SUPABASE_ANON_KEY

⚠️ GET REAL VALUES FROM YOUR .env.production FILE OR RAILWAY ENV VARS

# Feature Flags
NEXT_PUBLIC_CLASSIC_DASHBOARD_ENABLED=true
NEXT_PUBLIC_PRO_FEATURES_ENABLED=true
NEXT_PUBLIC_PROCESS_MONITORING_ENABLED=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_SWAGGER_ENABLED=false
NEXT_PUBLIC_UPLOAD_MAX_SIZE=10485760
```

**How to add each variable:**
1. Click "Add New"
2. Name: `NEXT_PUBLIC_API_URL`
3. Value: `https://justoai-vers-o2-production.up.railway.app`
4. Environment: Select **Production**, **Preview**, and **Development**
5. Click "Save"
6. Repeat for all variables

---

### Step 4: Deploy! (2 minutes)

1. **Click "Deploy"** in Vercel
2. **Wait for build** (2-5 minutes)
3. **Watch the logs** for any errors

#### What Vercel Does:
```
1. Cloning repository...           ✓ Done
2. Installing dependencies...      ✓ Done
3. Building Next.js application... ✓ Done
4. Optimizing and uploading...     ✓ Done
5. Deployment ready!               ✓ Live
```

---

### Step 5: Verify Deployment (5 minutes)

Once deployment is complete, Vercel will give you a URL like:
```
https://justoai-v2.vercel.app
```

#### Test Checklist:

**1. Homepage Loads:**
```
https://justoai-v2.vercel.app
```
- Should show the landing page ✅
- No errors in console ✅
- Navigation works ✅

**2. API Connection Works:**
- Open browser console (F12)
- Go to Network tab
- Try to navigate to login page
- API calls should go to: `https://justoai-vers-o2-production.up.railway.app/api/*`

**3. Authentication Works:**
- Go to: `https://justoai-v2.vercel.app/signup`
- Try to create an account
- Should redirect to dashboard after signup
- Check if user is created in Supabase

**4. Dashboard Loads:**
- After login, dashboard should load
- Data should fetch from Railway backend
- No CORS errors in console

---

## 🔧 Troubleshooting

### Issue 1: Build Fails with TypeScript Errors

**Solution:**
The project has `typescript: { ignoreBuildErrors: true }` in `next.config.ts`, so builds should succeed even with TS errors. If build still fails:

1. Check Vercel build logs for the actual error
2. Common issues:
   - Missing dependencies: Check `package.json`
   - Node version: Ensure Node 20.x is used
   - Out of memory: Increase Vercel build memory (Project Settings → General → Build & Development Settings)

### Issue 2: "Cannot find module" Errors

**Solution:**
```bash
# In Vercel project settings:
Build Command: npm install && npm run build
```

### Issue 3: CORS Errors (API calls blocked)

**Symptoms:**
- Console shows: `Access-Control-Allow-Origin` error
- API calls fail with status 0 or CORS error

**Solution:**
Railway backend needs to allow Vercel domain:

1. Go to Railway project
2. Add environment variable:
   ```
   ALLOWED_ORIGINS=https://justoai-v2.vercel.app,https://justoai-v2-*.vercel.app
   ```
3. Redeploy Railway backend

### Issue 4: 404 on API Routes

**Symptoms:**
- Frontend loads but API calls return 404
- `NEXT_PUBLIC_API_URL` seems wrong

**Solution:**
1. Verify Railway URL is correct:
   ```
   https://justoai-vers-o2-production.up.railway.app
   ```
2. Test Railway health endpoint directly in browser
3. Check Vercel env vars are set correctly
4. Redeploy Vercel to pick up new env vars

### Issue 5: Blank Page / White Screen

**Symptoms:**
- Vercel deploys successfully
- But page shows nothing or white screen

**Solution:**
1. Open browser console (F12)
2. Look for JavaScript errors
3. Common causes:
   - Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Incorrect `NEXT_PUBLIC_API_URL`
4. Add missing env vars in Vercel
5. Redeploy

---

## 📊 After Deployment

### Update ALLOWED_ORIGINS in Railway

Once you have your Vercel URL, add it to Railway:

1. Go to Railway project: https://railway.app/project/[your-project]
2. Click on your service
3. Go to "Variables" tab
4. Add or update:
   ```
   ALLOWED_ORIGINS=https://justoai-v2.vercel.app,https://justoai-v2-git-main-*.vercel.app,https://justoai-v2-*.vercel.app
   ```
   (This allows your production and preview deployments)
5. Click "Deploy" to restart with new variables

### Optional: Custom Domain

If you have a custom domain (like `app.justoai.com`):

1. In Vercel: Project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed by Vercel
4. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars
5. Update `ALLOWED_ORIGINS` in Railway

---

## ✅ Success Checklist

- [ ] Railway backend health check returns 200 OK
- [ ] Vercel project created and linked to GitHub
- [ ] All environment variables added to Vercel
- [ ] Vercel deployment succeeded (green checkmark)
- [ ] Homepage loads at Vercel URL
- [ ] No console errors on homepage
- [ ] Login page loads
- [ ] Can create account (signup works)
- [ ] Dashboard loads after login
- [ ] API calls go to Railway backend (check Network tab)
- [ ] No CORS errors
- [ ] ALLOWED_ORIGINS updated in Railway

---

## 🎯 Next Steps After Vercel is Working

Once Vercel frontend is deployed and working:

1. **Test Full User Flow:**
   - Sign up → Login → Dashboard → Create Process → Logout

2. **Monitor for 24h:**
   - Check Vercel Analytics
   - Monitor Railway metrics
   - Look for errors in Sentry (if configured)

3. **Optional Improvements:**
   - Add Upstash Redis for caching ($10-15/month)
   - Enable background workers ($5-10/month)
   - Set up custom domain
   - Configure CDN/edge caching

---

## 📞 Need Help?

**Check these first:**
1. Vercel deployment logs: `https://vercel.com/[team]/justoai-v2/deployments`
2. Railway logs: `https://railway.app/project/[id]`
3. Browser console (F12) for frontend errors
4. Network tab to see API calls

**Common Solutions:**
- Redeploy Vercel (sometimes fixes caching issues)
- Clear browser cache and hard refresh (Ctrl+Shift+R)
- Check all env vars are set correctly
- Verify Railway backend is running

---

**Created:** 2025-10-13
**Railway Backend:** https://justoai-vers-o2-production.up.railway.app
**Target Vercel URL:** https://justoai-v2.vercel.app
**Estimated Time:** 15-20 minutes total

Good luck! 🚀
