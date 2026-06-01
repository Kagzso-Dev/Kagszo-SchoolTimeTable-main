const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Manually parse .env file if it exists
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim();
        const cleanedValue = value.replace(/^['"]|['"]$/g, '');
        process.env[key] = cleanedValue;
      }
    });
  }
} catch (e) {
  console.warn('⚠️ Could not parse .env file:', e.message);
}


async function checkPendingLeaves() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'timetable_db'
  });

  try {
    const [rows] = await pool.query('SELECT * FROM LeaveRequests WHERE status = ?', ['Pending']);
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkPendingLeaves();
