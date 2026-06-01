@echo off
echo.
echo ========================================
echo   AI Timetable Enterprise - Server
echo ========================================
echo.

REM Set environment variables
set DB_TYPE=postgresql
set DATABASE_URL=postgresql://postgres.ejauatpcoulrgndavwsm:Greatking7397111142@aws-1-ap-south-1.pooler.supabase.com:6543/postgres

echo [INFO] Environment variables configured
echo [INFO] Starting server on http://localhost:3000...
echo.

REM Start the server
node server.js

pause

