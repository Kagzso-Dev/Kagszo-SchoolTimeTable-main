# 🚀 Vercel Deployment Guide

## Quick Deploy Steps

### 1. Push Your Code to GitHub
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Connect to Vercel

**Option A: Via Vercel Dashboard (Recommended)**
1. Go to [https://vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository: `karthickg7000-hub/Kagszo-SchoolTimeTable`
4. Vercel will auto-detect settings

**Option B: Via Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel
```

### 3. Configure Project Settings in Vercel Dashboard

**Root Directory:** Leave empty (or set to root of repo)

**Build Settings:**
- **Framework Preset:** Other
- **Build Command:** (leave empty or `echo "No build step required"`)
- **Output Directory:** (leave empty)
- **Install Command:** `npm install`

**Node Version:** 18.x or 20.x (set in package.json engines)

### 4. ⚠️ CRITICAL: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

```
DB_TYPE=postgresql
DATABASE_URL=postgresql://postgres.ejauatpcoulrgndavwsm:Greatking7397111142@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

**Important Notes:**
- Use the **connection pooler URL** (port 6543) for better reliability on Vercel
- Apply to: Production, Preview, and Development
- After adding, **redeploy** the project

### 5. Deploy

**Automatic:**
- Push to `main` branch → Auto-deploys

**Manual:**
- Go to Vercel Dashboard → Deployments → Click "Redeploy"

### 6. Verify Deployment

After deployment completes, check:

✅ **Root URL:** `https://your-project.vercel.app/`
   - Should show user portal

✅ **Admin Portal:** `https://your-project.vercel.app/admin`
   - Should show admin login page

✅ **API Endpoint:** `https://your-project.vercel.app/api/config/school`
   - Should return JSON (may require authentication)

## 🔧 Troubleshooting

### Error: 500 INTERNAL_SERVER_ERROR / FUNCTION_INVOCATION_FAILED

**Possible Causes:**

1. **Database Connection Issue**
   - Check environment variables are set correctly
   - Verify DATABASE_URL uses connection pooler (port 6543)
   - Check Supabase database is running and accessible

2. **Timeout Issues**
   - Database initialization may take time
   - Function timeout set to 30 seconds in vercel.json
   - Check Vercel logs for timeout errors

3. **Missing Environment Variables**
   - Verify DB_TYPE and DATABASE_URL are set
   - Check they're applied to correct environment (Production/Preview)

**Solution Steps:**
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the failed deployment
3. Check "Function Logs" tab for detailed error
4. Common fixes:
   ```bash
   # Check your .env or environment variables match:
   DB_TYPE=postgresql
   DATABASE_URL=postgresql://postgres.ejauatpcoulrgndavwsm:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
   ```

### Error: 404 NOT_FOUND

**Cause:** Routing not configured properly

**Solution:** The `vercel.json` should route all requests to `/api/index.js`. Verify the file is in root directory and committed to git.

### Database Connection Timeout

**Cause:** Supabase database may be paused or connection string incorrect

**Solutions:**
1. Check Supabase dashboard - ensure database is active
2. Use connection pooler URL (port 6543) instead of direct connection (port 5432)
3. Verify password is correct in DATABASE_URL
4. Check Supabase network settings allow connections from Vercel

### Function Timeout

**Cause:** Database initialization taking too long

**Solution:** 
- Function timeout increased to 30 seconds in vercel.json
- If still timing out, check database connection string and Supabase status

## 📋 Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All code is committed and pushed to GitHub
- [ ] `vercel.json` is in root directory
- [ ] `api/index.js` exists and exports the Express app
- [ ] `package.json` has correct dependencies
- [ ] Environment variables are ready (DB_TYPE, DATABASE_URL)
- [ ] Database is accessible and running
- [ ] No hardcoded credentials in code

## 🔐 Security Notes

- ✅ Never commit `DATABASE_URL` with password to git
- ✅ Use Vercel environment variables for sensitive data
- ✅ Use connection pooler for better security and performance
- ✅ Regularly rotate database passwords

## 📝 Current Configuration Files

- `vercel.json` - Vercel routing configuration
- `api/index.js` - Serverless function entry point
- `server.js` - Express app (exported for Vercel)

## 🌐 URLs After Deployment

Your deployed app will be available at:
- Production: `https://your-project.vercel.app`
- Preview: `https://your-project-git-branch.vercel.app` (for each branch)

## 📞 Need Help?

1. Check Vercel deployment logs
2. Check Supabase database logs
3. Verify environment variables are set correctly
4. Test database connection locally first

---

**Last Updated:** 2025-11-25  
**Version:** Based on commit `26b4322`

