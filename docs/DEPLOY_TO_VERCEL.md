# 🚀 Deploy to Vercel - Step by Step

## ✅ Files Ready

All necessary files are in place:
- ✅ `api/index.js` - Serverless function entry point
- ✅ `vercel.json` - Simplified configuration
- ✅ `server.js` - Express app with proper exports

## 📋 Your DATABASE_URL

```
postgresql://postgres:Greatking98765@db.ejauatpcoulrgndavwsm.supabase.co:5432/postgres
```

## 🚀 Deployment Steps

### Step 1: Commit All Files

Make sure `api/index.js` is committed:

```bash
# Check if api/index.js is tracked
git status

# If not, add it
git add api/index.js vercel.json server.js
git commit -m "Fix Vercel deployment - Add api/index.js"
git push
```

### Step 2: Set Environment Variables in Vercel

1. Go to **Vercel Dashboard**
2. Click on your project: **school-time-table-version-new**
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**

**Add Variable 1:**
- **Key:** `DATABASE_URL`
- **Value:** `postgresql://postgres:Greatking98765@db.ejauatpcoulrgndavwsm.supabase.co:5432/postgres`
- **Environment:** Select all (Production, Preview, Development)
- Click **Save**

**Add Variable 2:**
- **Key:** `DB_TYPE`
- **Value:** `postgresql`
- **Environment:** Select all
- Click **Save**

### Step 3: Redeploy

**Option A: Automatic (Recommended)**
- Push to your Git repository
- Vercel will auto-deploy

**Option B: Manual**
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **Redeploy** button
4. Select **Use existing Build Cache** (optional)
5. Click **Redeploy**

### Step 4: Verify Deployment

After deployment completes:

1. **Check Function Logs:**
   - Go to **Functions** tab
   - Click on `api/index.js`
   - Check for any errors

2. **Test URLs:**
   - `https://school-time-table-version-new.vercel.app/` → Should show user portal
   - `https://school-time-table-version-new.vercel.app/admin` → Should show admin login
   - `https://school-time-table-version-new.vercel.app/user` → Should show user portal

## 🔍 Troubleshooting

### Still Getting 404?

1. **Check if `api/index.js` is in repository:**
   ```bash
   git ls-files | grep api/index.js
   ```
   If empty, the file isn't committed. Add it:
   ```bash
   git add api/index.js
   git commit -m "Add api/index.js"
   git push
   ```

2. **Check Build Logs:**
   - Vercel Dashboard → Deployment → Build Logs
   - Look for: "Building api/index.js"
   - Check for any errors

3. **Check Function Logs:**
   - Vercel Dashboard → Functions → api/index.js
   - Look for runtime errors
   - Check if database connection is working

4. **Verify Environment Variables:**
   - Settings → Environment Variables
   - Ensure `DATABASE_URL` is set correctly
   - Make sure it's enabled for Production environment

### Common Errors

**"Cannot find module '../server'"**
- **Solution:** Ensure `server.js` is in the root directory (same level as `api/`)

**"Database connection failed"**
- **Solution:** Check `DATABASE_URL` environment variable
- Verify Supabase database is accessible

**"404 on static files"**
- **Solution:** Check if `public/` directory exists
- Verify files are committed to Git

## 📝 File Structure (Must Match)

```
ai-timetable-enterprise-v5.3/
├── api/
│   └── index.js          ← Vercel serverless function
├── server.js              ← Express app (exports app)
├── vercel.json            ← Vercel config (rewrites only)
├── package.json
├── db-postgres.js
└── public/
    ├── admin/
    │   └── index.html
    ├── user/
    │   └── index.html
    └── common/
```

## ✅ Success Checklist

After deployment, verify:
- [ ] Build completes successfully
- [ ] Function `api/index.js` appears in Functions tab
- [ ] Root URL (`/`) loads user portal
- [ ] `/admin` loads admin login
- [ ] `/user` loads user portal
- [ ] No 404 errors in browser console
- [ ] Database connection works (check function logs)

---

**If issues persist, share the Function Logs from Vercel Dashboard.**


