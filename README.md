AI Timetable Enterprise v5.3
============================

Overview
--------
AI-powered school timetable manager with leave workflow, email notifications, and admin/user portals.

Key Features
------------
- Admin and user portals (`/admin`, `/user`)
- Leave apply/approve/reject with IST timestamps
- Email notifications via Nodemailer
- PostgreSQL (Supabase) backend
- Vercel deployment ready (serverless via `api/index.js`)

Local Development
-----------------
1) Install dependencies:
   npm install

2) Run locally (PostgreSQL):
   set DB_TYPE=postgresql
   set DATABASE_URL=postgresql://postgres:Greatking98765@db.ejauatpcoulrgndavwsm.supabase.co:5432/postgres
   node server.js

   Open:
   - Admin: http://localhost:3000/admin
   - User:  http://localhost:3000/user

Deployment (Vercel)
-------------------
- Root Directory: ai-timetable-enterprise-v5.3
- Build Command: echo "No build step required"
- Install Command: npm install
- Output Directory: (leave empty)
- Env:
  - DB_TYPE=postgresql
  - DATABASE_URL=postgresql://postgres:Greatking98765@db.ejauatpcoulrgndavwsm.supabase.co:5432/postgres

Scripts
-------
- npm run dev   → node server.js
- npm run start → node server.js
- npm run build → echo "No build step required"

Notes
-----
- All date handling uses IST via `utils/dateUtils.js`.
- Serverless entry for Vercel: `api/index.js` exports the Express `app` from `server.js`.

AI Timetable Enterprise v5 - Leave Tracker + Auto Substitution POC
Run:
1. npm install
2. node server.js
3. Open http://localhost:3000 (user) and http://localhost:3000/admin (admin)
Admin credentials: admin / kagzso@123
Flow:
- Admin: Generate timetable -> Publish (optional)
- Admin: Apply Sample Leave -> Approve First Pending -> substitution runs and published.json auto-updated
Files created in output/: timetable.json, published.json, timetable_substitute.json, substitute_audit.json, fallout_log.json
