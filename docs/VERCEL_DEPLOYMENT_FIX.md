# 🔧 Vercel Deployment Fix Guide

## Issue: 404 NOT_FOUND Error on Vercel

The 404 error occurs because Vercel needs explicit routing configuration for serverless functions.

## ✅ Solution Applied

### 1. Updated `vercel.json`

The configuration now includes explicit routes for:
- API endpoints (`/api/*`)
- Config endpoints (`/config/*`)
- Leave management (`/leave/*`)
- Class timetables (`/classes/*`)
- Static file serving (`/admin/*`, `/user/*`, `/common/*`)
- Root route (`/`)

### 2. Added Root Route Handler

Added explicit route handlers in `server.js`:
- `/` → Serves user portal
-, `/user` → Serves user portal
- `/admin` → Serves admin portal

### 3. Static File Serving

Updated static file serving to ensure all public files are accessible.

## 🚀 Deployment Steps

### Step 1: Commit Changes

```bash
git add .
git commit -m "Fix Vercel deployment routing"
git push
```

### Step 2: Redeploy on Vercel

1. Go to your Vercel dashboard
2. Find your project
3. Click "Redeploy" or push to trigger automatic deployment

### Step 3: Set Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

```
DB_TYPE=postgresql
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

**Important:** Replace `YOUR_PASSWORD` and `xxxxx` with your actual Supabase credentials.

### Step 4: Verify Deployment

After deployment, check:
- ✅ Root URL (`https://your-project.vercel.app/`) → Should show user portal
- ✅ Admin portal (`https://your-project.vercel.app/admin`) → Should show admin login
- ✅ User portal (`https://your-project.vercel.app/user`) → Should show timetable portal

## 🔍 Troubleshooting

### Still Getting 404?

1. **Check Build Logs**
   - Go to Vercel dashboard → Deployments → Click on latest deployment
   - Check "Build Logs" for errors

2. **Verify Environment Variables**
   - Ensure `DATABASE_URL` is set correctly
   - Check for typos in variable names

3. **Check Function Logs**
   - Go to Vercel dashboard → Functions
   - Check for runtime errors

4. **Verify File Structure**
   - Ensure `public/` directory exists
   - Ensure `server.js` is in root directory
   - Ensure `vercel.json` is in root directory

### Database Connection Issues

If you see database errors:
1. Verify `DATABASE_URL` is correct
2. Check Supabase connection settings
3. Ensure IP whitelisting is configured (if required)

### Static Files Not Loading

If CSS/JS files aren't loading:
1. Check browser console for 404 errors
2. Verify file paths in HTML
3. Ensure files exist in `public/` directory

## 📝 Additional Notes

- **Serverless Functions:** Vercel converts `server.js` into serverless functions
- **Cold Starts:** First request may be slower (cold start)
- **File System:** Vercel has read-only file system (except `/tmp`)
- **Output Files:** Files written to `output/` directory won't persist between deployments

## 🔗 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)
- [Express on Vercel](https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/node-js)

---

**Last Updated:** 2024


