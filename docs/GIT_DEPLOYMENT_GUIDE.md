# 📦 Git Deployment Guide for Vercel

## ⚠️ Important: Don't Upload ZIP Files!

**Zipping and uploading files to Git won't work for Vercel deployment.**

Vercel needs:
- ✅ Direct access to your Git repository
- ✅ Individual source files (not zipped)
- ✅ Proper Git history and structure

## ✅ Correct Way: Push Files to Git Repository

### Step 1: Initialize Git Repository (If Not Already Done)

```bash
cd ai-timetable-enterprise-v5.3
git init
```

### Step 2: Add All Files

```bash
# Add all files to Git
git add .

# Check what will be committed
git status
```

### Step 3: Create .gitignore (If Not Exists)

Create a `.gitignore` file with:

```
node_modules/
output/*.json
.env
.env.local
.DS_Store
*.log
.vercel
```

### Step 4: Commit Files

```bash
git commit -m "Initial commit - School Timetable Management System"
```

### Step 5: Connect to GitHub/GitLab/Bitbucket

**Option A: Create New Repository on GitHub**

1. Go to https://github.com
2. Click "New Repository"
3. Name it: `school-timetable-management`
4. Don't initialize with README
5. Copy the repository URL

**Option B: Use Existing Repository**

If you already have a repository, get its URL.

### Step 6: Add Remote and Push

```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/school-timetable-management.git

# Push to GitHub
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` and repository name with your actual GitHub details.

## 🔗 Connect Vercel to Git Repository

### Step 1: Import Project in Vercel

1. Go to **Vercel Dashboard**
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your Git provider (GitHub/GitLab/Bitbucket)
5. Authorize Vercel to access your repositories
6. Select your repository: `school-timetable-management`

### Step 2: Configure Project

Vercel will auto-detect:
- **Framework Preset:** Other (or Node.js)
- **Root Directory:** `./` (or `ai-timetable-enterprise-v5.3` if in subfolder)
- **Build Command:** Leave empty (or `npm install`)
- **Output Directory:** Leave empty

### Step 3: Set Environment Variables

Before deploying, add:

**Variable 1:**
- **Name:** `DATABASE_URL`
- **Value:** `postgresql://postgres:Greatking98765@db.ejauatpcoulrgndavwsm.supabase.co:5432/postgres`

**Variable 2:**
- **Name:** `DB_TYPE`
- **Value:** `postgresql`

### Step 4: Deploy

Click **"Deploy"** button.

Vercel will:
1. Clone your repository
2. Install dependencies (`npm install`)
3. Build the project
4. Deploy to production

## 📋 Required Files in Repository

Make sure these files are in your Git repository:

```
✅ api/index.js          ← Vercel serverless function
✅ server.js             ← Express app
✅ vercel.json           ← Vercel configuration
✅ package.json          ← Dependencies
✅ db-postgres.js        ← Database module
✅ emailService.js       ← Email service
✅ substitutionEngine.js ← Substitution logic
✅ utils/dateUtils.js    ← Date utilities
✅ public/               ← Static files
   ├── admin/
   ├── user/
   └── common/
```

## 🔍 Verify Files Are in Git

```bash
# Check if api/index.js is tracked
git ls-files | grep api/index.js

# Check all tracked files
git ls-files

# If api/index.js is missing, add it
git add api/index.js
git commit -m "Add api/index.js for Vercel"
git push
```

## 🚫 What NOT to Do

❌ **Don't upload ZIP files to Git**
- Git is for source code, not archives
- Vercel can't deploy from ZIP files

❌ **Don't commit `node_modules/`**
- Add to `.gitignore`
- Vercel will install dependencies automatically

❌ **Don't commit sensitive data**
- Never commit `.env` files
- Never commit passwords in code
- Use environment variables in Vercel

## ✅ What TO Do

✅ **Push individual source files**
- Each file should be in the repository
- Vercel reads files directly from Git

✅ **Use proper Git workflow**
- Commit changes
- Push to repository
- Vercel auto-deploys on push

✅ **Set environment variables in Vercel**
- Never hardcode credentials
- Use Vercel's environment variables

## 🔄 Workflow After Initial Setup

Once connected to Vercel:

1. **Make changes locally**
2. **Commit changes:**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```
3. **Push to Git:**
   ```bash
   git push
   ```
4. **Vercel auto-deploys** (takes 1-2 minutes)
5. **Check deployment** in Vercel Dashboard

## 🎯 Quick Start Commands

```bash
# Navigate to project
cd ai-timetable-enterprise-v5.3

# Initialize Git (if not done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Push
git push -u origin main
```

## 📝 Next Steps

1. ✅ Push files to Git (not ZIP)
2. ✅ Connect Vercel to your Git repository
3. ✅ Set environment variables
4. ✅ Deploy
5. ✅ Test the deployment

---

**Remember:** Vercel deploys from Git repositories, not ZIP files. Make sure all your source files are properly committed and pushed to Git.


