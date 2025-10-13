# Railway + Vercel - Quick Start Guide

⚡ **Fast track deployment in 20 minutes**

---

## 🎯 What You'll Deploy

- **Railway**: Backend API + Workers + Cron Jobs
- **Vercel**: Frontend only (Pages, Components, UI)

---

## 🚀 Step-by-Step (20 minutes)

### 1. Deploy Backend to Railway (10 min)

**1.1. Go to your Railway project:**
https://railway.app/project/119cfa4b-15c4-4178-8aec-981393718583

**1.2. Create new service:**
- Click "+ New Service"
- Select "GitHub Repo"
- Choose `justoai-v2` repository
- Select branch: `main`

**1.3. Wait for auto-detection:**
Railway will detect `Dockerfile.railway` and build automatically.

**1.4. Add environment variables:**

Click service → Variables → Raw Editor → Paste all from `.env.production`:

```bash
# Copy from your .env.production file
NODE_ENV=production
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
# ... (all other variables)
```

**1.5. Get your Railway URL:**

After deployment completes (~5-10 min), copy the URL:
```
https://justoai-v2-production-xxxx.up.railway.app
```

**Save this URL!** ✅

---

### 2. Update Vercel Configuration (5 min)

**2.1. Update `vercel.json`:**

Edit the `rewrites` section to point to Railway:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://justoai-v2-production-xxxx.up.railway.app/api/:path*"
    }
  ]
}
```

Replace `justoai-v2-production-xxxx.up.railway.app` with **your Railway URL**.

**2.2. Update Vercel environment variables:**

Go to: https://vercel.com/[team]/justoai-v2/settings/environment-variables

Add/update these:

```bash
NEXT_PUBLIC_API_URL=https://justoai-v2-production-xxxx.up.railway.app
NEXT_PUBLIC_APP_URL=https://v2.justoai.com.br
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Feature flags
NEXT_PUBLIC_CLASSIC_DASHBOARD_ENABLED=true
NEXT_PUBLIC_PRO_FEATURES_ENABLED=true
NEXT_PUBLIC_PROCESS_MONITORING_ENABLED=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
```

---

### 3. Deploy Frontend to Vercel (5 min)

```bash
# Commit changes
git add vercel.json
git commit -m "config: point API to Railway backend"
git push origin main

# Deploy
vercel --prod
```

---

## ✅ Verification (2 min)

**Test Backend:**
```bash
curl https://your-railway-url.up.railway.app/api/health
```

Expected:
```json
{
  "status": "ok",
  "timestamp": "2025-...",
  "version": "v2.1.0"
}
```

**Test Frontend:**
```bash
# Visit your Vercel URL
https://justoai-v2.vercel.app
```

**Test Integration:**
1. Open frontend in browser
2. Open DevTools → Network tab
3. Perform any action (e.g., load processes)
4. Check API calls go to Railway URL ✅

---

## 🎉 Done!

You now have:
- ✅ Backend running on Railway (no limits!)
- ✅ Frontend running on Vercel (free tier)
- ✅ Full integration working
- ✅ Auto-deploy from GitHub

---

## 📚 Need More Details?

See complete guide: [RAILWAY_VERCEL_DEPLOYMENT.md](./RAILWAY_VERCEL_DEPLOYMENT.md)

---

## 🆘 Quick Troubleshooting

**Backend not responding:**
- Check Railway logs: Services → justoai-v2-api → Deployments → Logs
- Verify all environment variables are set

**Frontend can't reach backend:**
- Check `NEXT_PUBLIC_API_URL` in Vercel
- Check `rewrites` in `vercel.json`
- Check CORS: `ALLOWED_ORIGINS` in Railway must include Vercel URL

**CORS errors:**
- Add Vercel URL to Railway `ALLOWED_ORIGINS`:
  ```
  ALLOWED_ORIGINS=https://justoai-v2.vercel.app,https://v2.justoai.com.br
  ```

---

**Deploy Time:** ~20 minutes
**Cost:** $5 free (Railway) + $0 (Vercel) = **Free for 1 month!**
