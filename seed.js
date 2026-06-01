/**
 * 🌱 Database Seeder for School Timetable System
 * Reads data from config/config.xlsx and seeds the MySQL database.
 */

const mysql = require('mysql2/promise');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashPassword(password) {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Manually parse .env file at the very beginning
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
    console.log('✅ Loaded environment variables from .env');
  }
} catch (e) {
  console.warn('⚠️ Could not parse .env file dynamically:', e.message);
}

// Config
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'timetable_db';
const DB_PORT = parseInt(process.env.DB_PORT) || 3306;

const xlsxPath = path.join(__dirname, 'config', 'config.xlsx');

async function seed() {
  console.log('\n🚀 Starting Database Seed from Excel Configuration...');

  // 1. Check Excel existence
  if (!fs.existsSync(xlsxPath)) {
    console.error(`❌ Excel file not found at: ${xlsxPath}`);
    process.exit(1);
  }
  console.log(`📋 Found configuration file: ${xlsxPath}`);

  // 2. Connect to MySQL (without db first to ensure it exists)
  let conn;
  try {
    conn = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT
    });
    console.log('✅ Connected to MySQL server');
  } catch (err) {
    console.error('❌ Failed to connect to MySQL server. Please verify your credentials in .env');
    console.error('Error:', err.message);
    process.exit(1);
  }

  try {
    // 3. Create database if not exists
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await conn.query(`USE \`${DB_NAME}\``);
    console.log(`🌱 Selected database: ${DB_NAME}`);

    // 4. Disable foreign key checks before dropping tables
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Drop all tables
    const [tables] = await conn.query('SHOW TABLES');
    const tableKey = `Tables_in_${DB_NAME}`;
    for (const t of tables) {
      const tableName = t[tableKey] || t[Object.keys(t)[0]];
      await conn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      console.log(`🗑️ Dropped table: ${tableName}`);
    }

    // Re-enable foreign key checks
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🧹 Database cleared. Ready for recreation.');

    // 5. Create core tables
    console.log('\n🛠️ Recreating Core Tables...');

    // db_config
    await conn.query(`
      CREATE TABLE db_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  - Table created: db_config');

    // SchoolConfig
    await conn.query(`
      CREATE TABLE SchoolConfig (
        id INT PRIMARY KEY,
        school_name VARCHAR(255),
        start_time VARCHAR(50),
        total_periods INT,
        minutes_per_period INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  - Table created: SchoolConfig');

    // Teachers
    await conn.query(`
      CREATE TABLE Teachers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        subject VARCHAR(255),
        classes TEXT,
        contact VARCHAR(255),
        email VARCHAR(255),
        type VARCHAR(50) DEFAULT 'teaching',
        password VARCHAR(255),
        username VARCHAR(255),
        photo LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  - Table created: Teachers');

    // AdminConfig
    await conn.query(`
      CREATE TABLE AdminConfig (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(100),
        permissions TEXT,
        email VARCHAR(255),
        email_password VARCHAR(255),
        smtp_host VARCHAR(255),
        smtp_port INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  - Table created: AdminConfig');

    // LeaveRequests
    await conn.query(`
      CREATE TABLE LeaveRequests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_name VARCHAR(255) NOT NULL,
        start_date DATE,
        end_date DATE,
        leave_date DATE,
        leave_type VARCHAR(100) DEFAULT 'Personal',
        reason TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        approved_by VARCHAR(255),
        approved_date DATETIME,
        applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  - Table created: LeaveRequests');

    // Versions
    await conn.query(`
      CREATE TABLE Versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        version_id VARCHAR(50) NOT NULL,
        published_at DATETIME,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  - Table created: Versions');

    // 6. Read Excel Data
    console.log('\n📊 Parsing Excel workbook sheets...');
    const wb = XLSX.readFile(xlsxPath);

    // -- SchoolConfig Sheet --
    if (wb.SheetNames.includes('SchoolConfig')) {
      const data = XLSX.utils.sheet_to_json(wb.Sheets['SchoolConfig']);
      if (data.length > 0) {
        const row = data[0];
        const schoolName = row['School Name'] || '';
        const startTime = row['School Start time'] || '';
        const totalPeriods = parseInt(row['Total Periods']) || 0;
        const minutesPerPeriod = parseInt((row['Time/periods'] || '').toString().match(/\d+/)?.[0]) || 30;

        await conn.query(
          `INSERT INTO SchoolConfig (id, school_name, start_time, total_periods, minutes_per_period) VALUES (1, ?, ?, ?, ?)`,
          [schoolName, startTime, totalPeriods, minutesPerPeriod]
        );
        console.log(`🌱 Seeded SchoolConfig: "${schoolName}"`);
      }
    }

    // -- Teachers Sheet --
    if (wb.SheetNames.includes('Teachers')) {
      const teachers = XLSX.utils.sheet_to_json(wb.Sheets['Teachers']);
      for (const t of teachers) {
        const name = t['Teachers Name'] || '';
        const subject = t['Subject'] || '';
        const classes = t['Class'] || '';
        const contact = t['Contact number'] ? String(t['Contact number']) : '';
        const email = t['Email'] || '';
        const type = t['Type'] || 'teaching';
        const password = t['Password'] ? String(t['Password']) : null;
        const hashedPassword = password ? hashPassword(password) : null;
        const username = name.toLowerCase().replace(/[^a-z0-9]/g, '');

        await conn.query(
          `INSERT INTO Teachers (name, subject, classes, contact, email, type, password, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [name, subject, classes, contact, email, type, hashedPassword, username]
        );
      }
      console.log(`🌱 Seeded ${teachers.length} teachers successfully`);
    }

    // -- AdminConfig Sheet --
    if (wb.SheetNames.includes('AdminConfig')) {
      const admins = XLSX.utils.sheet_to_json(wb.Sheets['AdminConfig']);
      for (const a of admins) {
        const username = a['Username'] || '';
        const password = a['Password'] || '';
        const role = a['Role'] || '';
        const permissions = a['Permissions'] || '';
        const email = a['Email'] || '';
        const emailPassword = a['Email Password'] || '';
        const smtpHost = a['SMTP Host'] || '';
        const smtpPort = a['SMTP Port'] ? parseInt(a['SMTP Port']) : null;
        const hashedPassword = hashPassword(password);

        await conn.query(
          `INSERT INTO AdminConfig (username, password, role, permissions, email, email_password, smtp_host, smtp_port) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [username, hashedPassword, role, permissions, email, emailPassword, smtpHost, smtpPort]
        );
      }
      console.log(`🌱 Seeded ${admins.length} administrators successfully`);
    }

    // -- LeaveRequests Sheet --
    if (wb.SheetNames.includes('LeaveRequests')) {
      const leaves = XLSX.utils.sheet_to_json(wb.Sheets['LeaveRequests']);
      for (const l of leaves) {
        let id = null;
        if (l.id && typeof l.id === 'string' && l.id.startsWith('LV')) {
          id = parseInt(l.id.replace('LV', ''), 10);
        } else if (l.id) {
          id = parseInt(l.id, 10);
        }

        const teacherName = l['Teacher'] || '';
        const startDate = l['StartDate'] || l['start_date'] || null;
        const endDate = l['EndDate'] || l['end_date'] || null;
        const leaveDate = startDate;
        const leaveType = l['LeaveType'] || l['leave_type'] || 'Personal';
        const reason = l['Reason'] || '';
        const status = l['Status'] || 'Pending';

        if (id) {
          await conn.query(
            `INSERT INTO LeaveRequests (id, teacher_name, start_date, end_date, leave_date, leave_type, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, teacherName, startDate, endDate, leaveDate, leaveType, reason, status]
          );
        } else {
          await conn.query(
            `INSERT INTO LeaveRequests (teacher_name, start_date, end_date, leave_date, leave_type, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [teacherName, startDate, endDate, leaveDate, leaveType, reason, status]
          );
        }
      }
      console.log(`🌱 Seeded ${leaves.length} leave requests successfully`);
    }

    // -- Versions Sheet --
    if (wb.SheetNames.includes('Versions')) {
      const versions = XLSX.utils.sheet_to_json(wb.Sheets['Versions']);
      for (const v of versions) {
        const versionId = v['version_id'] || '';
        const publishedAt = v['published_at'] || null;
        const notes = v['notes'] || '';

        await conn.query(
          `INSERT INTO Versions (version_id, published_at, notes) VALUES (?, ?, ?)`,
          [versionId, publishedAt, notes]
        );
      }
      console.log(`🌱 Seeded ${versions.length} version histories successfully`);
    }

    // -- Class Timetable Sheets --
    console.log('\n📅 Creating and seeding dynamic Class Timetables...');
    const classSheets = wb.SheetNames.filter(name => name.startsWith('Class_'));
    
    for (const sheetName of classSheets) {
      const className = sheetName.replace(/^Class_/i, '');
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      
      if (rows.length === 0) {
        console.log(`  - Sheet ${sheetName} is empty, skipping table creation.`);
        continue;
      }

      // Find max periods
      let maxPeriods = 0;
      rows.forEach(row => {
        Object.keys(row).forEach(key => {
          const m = key.match(/Period\s*(\d+)/i);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxPeriods) maxPeriods = num;
          }
        });
      });
      
      // Get the school configuration's total periods from Excel
      let schoolConfigTotalPeriods = 0;
      if (wb.SheetNames.includes('SchoolConfig')) {
        try {
          const schoolData = XLSX.utils.sheet_to_json(wb.Sheets['SchoolConfig']);
          if (schoolData.length > 0) {
            const schoolRow = schoolData[0];
            schoolConfigTotalPeriods = parseInt(schoolRow['Total Periods'] || schoolRow['total_periods']) || 0;
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch school config total periods from Excel sheet:', e.message);
        }
      }
      
      maxPeriods = Math.max(maxPeriods, schoolConfigTotalPeriods, 5); // default minimum of 5 periods

      // Create dynamic Class table
      const tableName = `Class_${className}`;
      const periodColumns = [];
      for (let i = 1; i <= maxPeriods; i++) {
        periodColumns.push(`\`P${i}\` VARCHAR(255)`);
      }
      
      await conn.query(`
        CREATE TABLE \`${tableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          Days VARCHAR(50) NOT NULL,
          ${periodColumns.join(',\n          ')}
        )
      `);

      // Insert periods
      for (const row of rows) {
        const day = row.Day || row.day || row.Days || '';
        if (!day) continue;

        const cols = ['Days'];
        const placeholders = ['?'];
        const values = [day];

        for (let i = 1; i <= maxPeriods; i++) {
          cols.push(`P${i}`);
          placeholders.push('?');
          const val = row[`Period ${i}`] || row[`Period${i}`] || row[`P${i}`] || row[`p${i}`] || null;
          values.push(val);
        }

        const query = `INSERT INTO \`${tableName}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders.join(', ')})`;
        await conn.query(query, values);
      }
      
      console.log(`  ✅ Created & Seeded Class table: "${tableName}" (${rows.length} rows, ${maxPeriods} periods)`);
    }

    console.log('\n💯 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Error during database seeding:', err);
    process.exit(1);
  } finally {
    if (conn) {
      await conn.end();
      console.log('👋 Database connection closed.\n');
    }
  }
}

seed();
