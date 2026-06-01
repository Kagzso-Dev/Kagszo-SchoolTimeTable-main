# ⚡ Quick Vercel Deployment Guide

## 🚀 Deploy in 3 Steps

### Step 1: Push to GitHub ✅
```bash
git add .
git commit -m "Configure for Vercel deployment"
git push origin main
```

### Step 2: Connect to Vercel

**Go to:** https://vercel.com/new

1. Click **"Add New Project"**
2. **Import** your GitHub repo: `karthickg7000-hub/Kagszo-SchoolTimeTable`
3. Click **"Import"**

### Step 3: Configure Environment Variables

**⚠️ CRITICAL - Do this before deploying!**

In Vercel project settings → **Environment Variables**, add:

**Name:** `DB_TYPE`  
**Value:** `postgresql`

**Name:** `DATABASE_URL`  
**Value:** `postgresql://postgres.ejauatpcoulrgndavwsm:Greatking7397111142@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`

✅ Apply to: **Production, Preview, Development**

### Step 4: Deploy

Click **"Deploy"** button

---

## 📋 Vercel Project Settings

After importing, verify these settings:

- **Framework Preset:** Other
- **Root Directory:** (leave empty)
- **Build Command:** (leave empty)
- **Output Directory:** (leave empty)
- **Install Command:** `npm install`
- **Node Version:** 18.x (auto-detected from package.json)

---

## ✅ After Deployment

Your app will be live at:
- `https://your-project.vercel.app`
- `https://your-project.vercel.app/admin`
- `https://your-project.vercel.app/user`

---

## 🔧 If You Get Errors

### Error: 500 INTERNAL_SERVER_ERROR

**Check:**
1. ✅ Environment variables are set correctly
2. ✅ DATABASE_URL uses connection pooler (port 6543)
3. ✅ Supabase database is running
4. ✅ Check Vercel Function Logs for details

**View Logs:**
- Vercel Dashboard → Your Project → Deployments → Click deployment → **Function Logs**

### Error: Function Timeout

**Solution:** Already configured with 30-second timeout in `vercel.json`

---

## 📝 Files Ready for Deployment

✅ `vercel.json` - Routing configuration  
✅ `api/index.js` - Serverless function entry  
✅ `package.json` - Dependencies & Node version  
✅ `server.js` - Express app (exports for Vercel)

---

## 🔗 Full Guide

For detailed troubleshooting, see: `VERCEL_DEPLOYMENT_GUIDE.md`

---

**Ready to deploy?** Push your code and follow the steps above! 🚀

