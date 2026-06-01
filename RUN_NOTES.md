## Quick Run Notes

- Command Prompt path:
  `cd "C:\Users\karth\OneDrive\Desktop\ai-timetable-enterprise-v5.3\ai-timetable-enterprise-v5.3"`
- Environment variables (pooler for IPv4):
  ```
  set DB_TYPE=postgresql
  set DATABASE_URL=postgresql://postgres.ejauatpcoulrgndavwsm:Greatking7397111142@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
  ```
- Start server:
  `node server.js` (or run `start-server.bat`)
- Wait for logs confirming:
  - `✅ Email service initialized and verified`
  - `✅ Connected to PostgreSQL database`
  - `✅ Server running on http://localhost:3000`
- Access portals:
  - Admin `http://localhost:3000/admin` (admin / kagzso@123)
  - User `http://localhost:3000/user`
- Stop server: press `Ctrl + C` in the same CMD window.

Notes: keep CMD open while server runs; pooling URL avoids IPv4 issues.

