# AI Timetable Enterprise - Server Startup Script
Write-Host "🚀 Starting AI Timetable Enterprise Server..." -ForegroundColor Green
Write-Host ""

# Set environment variables
$env:DB_TYPE = "postgresql"
$env:DATABASE_URL = "postgresql://postgres:Greatking98765@db.ejauatpcoulrgndavwsm.supabase.co:5432/postgres"

Write-Host "✅ Environment variables set" -ForegroundColor Cyan
Write-Host "   DB_TYPE: $env:DB_TYPE"
Write-Host "   DATABASE_URL: [configured]"
Write-Host ""

# Start the server
Write-Host "📡 Starting server on http://localhost:3000..." -ForegroundColor Yellow
Write-Host ""

node server.js

