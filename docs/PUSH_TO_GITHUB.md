# 🚀 Push to GitHub - Step by Step

## ✅ Git Repository Initialized

Your local Git repository is ready! Now you need to push it to GitHub.

## 📋 Step-by-Step Guide

### Step 1: Create GitHub Repository

1. Go to **https://github.com**
2. Click the **"+"** icon → **"New repository"**
3. Repository name: `school-timetable-management` (or any name you prefer)
4. Description: "School Timetable Management System with Leave Tracking"
5. **Visibility:** Choose Public or Private
6. **DO NOT** check "Initialize with README" (you already have files)
7. Click **"Create repository"**

### Step 2: Copy Repository URL

After creating the repository, GitHub will show you the URL. It will look like:
```
https://github.com/YOUR_USERNAME/school-timetable-management.git
```

Copy this URL.

### Step 3: Add Remote and Push

Open terminal in your project directory and run:

```bash
# Navigate to project
cd ai-timetable-enterprise-v5.3

# Add GitHub repository as remote (replace with your URL)
git remote add origin https://github.com/YOUR_USERNAME/school-timetable-management.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

**Replace `YOUR_USERNAME` and repository name with your actual GitHub details.**

### Step 4: Verify on GitHub

1. Go to your GitHub repository
2. Check that all files are there:
   - ✅ `api/index.js`
   - ✅ `server.js`
   - ✅ `vercel.json`
   - ✅ `package.json`
   - ✅ `public/` directory
   - ✅ All other source files

## 🔗 Connect to Vercel

### Step 1: Import Project in Vercel

1. Go to **https://vercel.com**
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select **GitHub** (or your Git provider)
5. Authorize Vercel to access your repositories
6. Find and select: `school-timetable-management` (or your repo name)
7. Click **"Import"**

### Step 2: Configure Project

Vercel will auto-detect settings. Verify:

- **Framework Preset:** Other (or Node.js)
- **Root Directory:** `./` (or leave empty)
- **Build Command:** Leave empty
- **Output Directory:** Leave empty
- **Install Command:** `npm install` (auto-detected)

### Step 3: Set Environment Variables

**BEFORE clicking Deploy**, click **"Environment Variables"** and add:

**Variable 1:**
- **Name:** `DATABASE_URL`
- **Value:** `postgresql://postgres:Greatking98765@db.ejauatpcoulrgndavwsm.supabase.co:5432/postgres`
- **Environment:** Select all (Production, Preview, Development)

**Variable 2:**
- **Name:** `DB_TYPE`
- **Value:** `postgresql`
- **Environment:** Select all

Click **"Add"** for each variable.

### Step 4: Deploy

1. Click **"Deploy"** button
2. Wait for deployment (1-2 minutes)
3. Check deployment status

### Step 5: Test Deployment

After deployment completes:

1. Click **"Visit"** button or use the deployment URL
2. Test:
   - Root URL → Should show user portal
   - `/admin` → Should show admin login
   - `/user` → Should show user portal

## 🔄 Future Updates

After initial deployment, to update:

1. **Make changes locally**
2. **Commit:**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```
3. **Push:**
   ```bash
   git push
   ```
4. **Vercel auto-deploys** (takes 1-2 minutes)

## 🔍 Troubleshooting

### "Repository not found" Error

- Check repository URL is correct
- Verify you have access to the repository
- Check if repository is private (may need authentication)

### "Permission denied" Error

- Set up SSH keys or use HTTPS with personal access token
- For HTTPS: `git remote set-url origin https://YOUR_TOKEN@github.com/USERNAME/REPO.git`

### Files Not Showing on GitHub

- Check `.gitignore` isn't excluding important files
- Verify `git add .` included all files
- Check `git status` to see untracked files

---

**Once pushed to GitHub and connected to Vercel, your deployment should work!** 🎉


