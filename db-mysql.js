const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashPassword(password) {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) return false;
  if (inputPassword === storedPassword) return true; // Plaintext fallback
  const hashed = crypto.createHash('sha256').update(inputPassword).digest('hex');
  return hashed === storedPassword;
}

// Manually parse .env file at the very beginning of DB module
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
  console.warn('⚠️ Could not parse .env file dynamically:', e.message);
}

// Default MySQL connection config
// Set these via environment variables
const DEFAULT_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'timetable_db',
  port: parseInt(process.env.DB_PORT) || 3306,
  connectionLimit: 10
};

let pool = null;
let dbConfig = null;
let databaseName = null;

// Cache for resolved table names
const tableNameCache = {};

// ===============================
// Helper: Get actual table name
// ===============================
async function getActualTableName(tableName) {
  return tableName; 
}

// ===============================
// Initialize MySQL Connection
// ===============================
async function initDatabase() {
  try {
    const connectionString = process.env.DATABASE_URL;
    let targetDbName = process.env.DB_NAME || DEFAULT_CONFIG.database;
    
    if (connectionString && connectionString.startsWith('mysql://')) {
      try {
        const url = new URL(connectionString);
        targetDbName = url.pathname.substring(1);
        
        // Connect without db first to create it
        const connectionUrlWithoutDb = connectionString.replace(`/${targetDbName}`, '');
        const tempConn = await mysql.createConnection(connectionUrlWithoutDb);
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${targetDbName}\``);
        await tempConn.end();
      } catch (e) {
        console.warn('⚠️ Could not automatically verify/create database via URL:', e.message);
      }
      
      const sslOption = process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined;
      pool = mysql.createPool(sslOption
        ? connectionString + (connectionString.includes('?') ? '&' : '?') + 'ssl={"rejectUnauthorized":false}'
        : connectionString
      );
      databaseName = targetDbName;
    } else {
      const isCloud = (process.env.DB_HOST || '').toLowerCase() !== 'localhost' &&
                      (process.env.DB_HOST || '') !== '127.0.0.1';
      const sslOption = (process.env.DB_SSL === 'true' || isCloud)
        ? { rejectUnauthorized: false }
        : undefined;

      const connConfig = {
        host: process.env.DB_HOST || DEFAULT_CONFIG.host,
        user: process.env.DB_USER || DEFAULT_CONFIG.user,
        password: process.env.DB_PASSWORD || DEFAULT_CONFIG.password,
        port: parseInt(process.env.DB_PORT) || DEFAULT_CONFIG.port,
        ...(sslOption && { ssl: sslOption })
      };

      // Auto-create database if it doesn't exist
      try {
        const tempConn = await mysql.createConnection(connConfig);
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${targetDbName}\``);
        await tempConn.end();
        console.log(`🌱 Verified/Created MySQL database: ${targetDbName}`);
      } catch (e) {
        console.warn(`⚠️ Could not automatically create database '${targetDbName}':`, e.message);
      }

      dbConfig = {
        ...connConfig,
        database: targetDbName,
        waitForConnections: true,
        connectionLimit: DEFAULT_CONFIG.connectionLimit,
        queueLimit: 0
      };
      databaseName = dbConfig.database;
      pool = mysql.createPool(dbConfig);
    }

    // Raise max_allowed_packet per-session so large LONGTEXT (photos) are accepted
    pool.on('connection', (conn) => {
      conn.query('SET SESSION max_allowed_packet = 67108864', (err) => {
        if (err) console.warn('Could not set max_allowed_packet', err.message);
      });
    });

    // Test connection
    const connection = await pool.getConnection();
    connection.release();
    console.log('✅ Connected to MySQL database');

    // Create all tables
    await createTables();

    // Seed default data
    await seedDatabase();

    console.log('✅ MySQL Database initialized');
    return true;
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    throw err;
  }
}

// ===============================
// Seed Initial Data
// ===============================
// ===============================
// Seed Initial Data
// ===============================
async function seedDatabase() {
  try {
    let XLSX;
    try {
      XLSX = require('xlsx');
    } catch (e) {
      console.warn('⚠️ Could not load xlsx module inside db-mysql:', e.message);
    }

    const configPath = path.join(__dirname, 'config', 'config.xlsx');
    let excelData = null;
    if (XLSX && fs.existsSync(configPath)) {
      try {
        excelData = XLSX.readFile(configPath);
        console.log('📖 Found config.xlsx. Seeding database from Excel sheets...');
      } catch (err) {
        console.error('⚠️ Error reading config.xlsx for seeding:', err.message);
      }
    }

    // 1. Seed SchoolConfig if empty
    const [schoolRows] = await pool.query('SELECT COUNT(*) as count FROM SchoolConfig');
    if (schoolRows[0].count === 0) {
      let seeded = false;
      if (excelData && excelData.Sheets['SchoolConfig']) {
        try {
          const sheet = excelData.Sheets['SchoolConfig'];
          const rows = XLSX.utils.sheet_to_json(sheet);
          if (rows.length > 0) {
            const row = rows[0];
            let schoolName = row['School Name'] || row['school_name'] || 'Sample High School';
            // Replace Kagzoh with Kagzso case-insensitively
            schoolName = schoolName.replace(/Kagzoh/gi, 'Kagzso');
            const startTime = row['School Start time'] || row['start_time'] || '08.30AM';
            const totalPeriods = parseInt(row['Total Periods'] || row['total_periods'] || 6);
            const minutesPerPeriod = parseInt((row['Time/periods'] || row['minutes_per_period'] || '').match(/\d+/)?.[0] || 45);
            
            await pool.query(`
              INSERT INTO SchoolConfig (id, school_name, start_time, total_periods, minutes_per_period)
              VALUES (1, ?, ?, ?, ?)
            `, [schoolName, startTime, totalPeriods, minutesPerPeriod]);
            console.log(`🌱 Seeded SchoolConfig table from Excel: "${schoolName}"`);
            seeded = true;
          }
        } catch (err) {
          console.error('⚠️ Failed to seed SchoolConfig from Excel:', err.message);
        }
      }
      if (!seeded) {
        await pool.query(`
          INSERT INTO SchoolConfig (id, school_name, start_time, total_periods, minutes_per_period)
          VALUES (1, 'Kagzso School', '9.00AM', 6, 45)
        `);
        console.log('🌱 Seeded SchoolConfig with default: Kagzso School');
      }
    } else {
      // If table has existing config, make sure "Kagzoh" is renamed to "Kagzso"
      const [rows] = await pool.query('SELECT * FROM SchoolConfig WHERE id = 1');
      if (rows.length > 0 && rows[0].school_name && rows[0].school_name.includes('Kagzoh')) {
        const renamed = rows[0].school_name.replace(/Kagzoh/gi, 'Kagzso');
        await pool.query('UPDATE SchoolConfig SET school_name = ? WHERE id = 1', [renamed]);
        console.log(`🌱 Migrated SchoolConfig name from Kagzoh to Kagzso: "${renamed}"`);
      }
    }

    // 2. Seed AdminConfig if empty
    const [adminRows] = await pool.query('SELECT COUNT(*) as count FROM AdminConfig');
    if (adminRows[0].count === 0) {
      let seeded = false;
      if (excelData && excelData.Sheets['AdminConfig']) {
        try {
          const sheet = excelData.Sheets['AdminConfig'];
          const rows = XLSX.utils.sheet_to_json(sheet);
          if (rows.length > 0) {
            const row = rows[0];
            let username = row['Username'] || row['username'] || 'admin';
            let password = row['Password'] || row['password'] || 'kagzso@123';
            if (password === 'kagzoh@123') password = 'kagzso@123';
            const role = row['Role'] || row['role'] || 'Super Admin';
            const permissions = row['Permissions'] || row['permissions'] || 'all';
            const email = row['Email'] || row['email'] || 'admin@example.com';
            
            // SMTP Config from Excel
            let emailPass = row['Email Password'] || row['email_password'] || row['email password'] || '';
            if (emailPass && typeof emailPass === 'object') {
              emailPass = emailPass.text || emailPass.h || emailPass.toString();
            }
            if (emailPass) {
              emailPass = emailPass.toString().replace(/\s+/g, '').trim();
            }
            
            const smtpHost = row['SMTP Host'] || row['smtp_host'] || row['smtp host'] || '';
            const smtpPortVal = row['SMTP Port'] || row['smtp_port'] || row['smtp port'] || null;
            const smtpPort = smtpPortVal ? parseInt(smtpPortVal.toString().trim()) : null;

            await pool.query(`
              INSERT INTO AdminConfig (username, password, role, permissions, email, email_password, smtp_host, smtp_port)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [username, password, role, permissions, email, emailPass || null, smtpHost || null, smtpPort]);
            console.log(`🌱 Seeded AdminConfig table from Excel with user: "${username}"`);
            seeded = true;
          }
        } catch (err) {
          console.error('⚠️ Failed to seed AdminConfig from Excel:', err.message);
        }
      }
      if (!seeded) {
        await pool.query(`
          INSERT INTO AdminConfig (username, password, role, permissions, email)
          VALUES ('admin', 'kagzso@123', 'Super Admin', 'all', 'admin@example.com')
        `);
        console.log('🌱 Seeded AdminConfig table with default admin');
      }
    } else {
      // Migrate existing kagzoh@123 to kagzso@123
      await pool.query(`UPDATE AdminConfig SET password = 'kagzso@123' WHERE password = 'kagzoh@123'`);
    }

    // 3. Seed Teachers if empty
    const [teacherRows] = await pool.query('SELECT COUNT(*) as count FROM Teachers');
    if (teacherRows[0].count === 0) {
      let seeded = false;
      if (excelData && excelData.Sheets['Teachers']) {
        try {
          const sheet = excelData.Sheets['Teachers'];
          const rows = XLSX.utils.sheet_to_json(sheet);
          if (rows.length > 0) {
            for (const row of rows) {
              const name = row['Teachers Name'] || row['name'] || '';
              if (!name) continue;
              const subject   = row['Subject'] || row['subject'] || '';
              const classes   = row['Class'] || row['classes'] || '';
              const contact   = row['Contact number'] || row['contact'] || '';
              const email     = row['Email'] || row['email'] || '';
              const type      = row['Type'] || row['type'] || 'teaching';
              const password  = row['Password'] || row['password'] || '';
              const username  = row['Username'] || row['username'] || name.toLowerCase().replace(/\s+/g, '.');

              await pool.query(
                `INSERT INTO Teachers (name, subject, classes, contact, email, type, password, username)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, subject, classes, contact, email, type, password ? password.toString() : null, username]
              );
            }
            console.log(`🌱 Seeded Teachers table with ${rows.length} teachers from Excel`);
            seeded = true;
          }
        } catch (err) {
          console.error('⚠️ Failed to seed Teachers from Excel:', err.message);
        }
      }
      if (!seeded) {
        // name, subject, classes, contact, email, type, password, username
        const sampleTeachers = [
          ['Arjun Kumar',    'Mathematics',   '10A,10B,11A', '9876543210', 'arjun.kumar@kagzso.edu',   'teaching',         null, 'arjun.kumar'],
          ['Priya Sharma',   'Science',       '10A,10C,11B', '9876543211', 'priya.sharma@kagzso.edu',  'teaching',         null, 'priya.sharma'],
          ['Suresh Nair',    'English',       '10B,10C,12A', '9876543212', 'suresh.nair@kagzso.edu',   'teaching',         null, 'suresh.nair'],
          ['Meena Pillai',   'Social Studies','10A,10B,10C', '9876543213', 'meena.pillai@kagzso.edu',  'teaching',         null, 'meena.pillai'],
          ['Ravi Verma',     'Computer Sci',  '11A,11B,12A', '9876543214', 'ravi.verma@kagzso.edu',    'teaching',         null, 'ravi.verma'],
          ['Anita Desai',    'Hindi',         '10A,11A,12A', '9876543215', 'anita.desai@kagzso.edu',   'teaching',         null, 'anita.desai'],
          ['Kiran Rao',      'Physical Ed',   '10A,10B,10C', '9876543216', 'kiran.rao@kagzso.edu',     'extracurricular',  null, 'kiran.rao'],
          ['Deepa Thomas',   'Art & Craft',   '11A,11B',     '9876543217', 'deepa.thomas@kagzso.edu',  'extracurricular',  null, 'deepa.thomas']
        ];
        for (const t of sampleTeachers) {
          await pool.query(
            `INSERT INTO Teachers (name, subject, classes, contact, email, type, password, username)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            t
          );
        }
        console.log('🌱 Seeded Teachers table with 8 sample teachers');
      }
    }

    // 4. Seed Dynamic Class Timetables
    const [tablesResult] = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name LIKE 'Class_%'
    `);
    if (tablesResult.length === 0) {
      if (excelData) {
        console.log('🌱 No Class_ tables found. Seeding dynamic timetables from Excel...');
        const classSheets = excelData.SheetNames.filter(name => name.startsWith('Class_'));
        for (const sheetName of classSheets) {
          try {
            const className = sheetName.substring(6);
            const sheet = excelData.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet);
            if (rows.length > 0) {
              await saveClassTimetable(className, rows);
              console.log(`   - Seeded class: ${className} (${rows.length} rows)`);
            }
          } catch (err) {
            console.error(`⚠️ Failed to seed class ${sheetName}:`, err.message);
          }
        }
      } else {
        // No Excel — seed sample timetables for 3 classes
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const sampleClasses = {
          '10A': [
            { 'Period 1': 'Arjun Kumar', 'Period 2': 'Priya Sharma', 'Period 3': 'Suresh Nair',  'Period 4': 'Meena Pillai', 'Period 5': 'Anita Desai',  'Period 6': 'Kiran Rao' },
            { 'Period 1': 'Priya Sharma','Period 2': 'Arjun Kumar',  'Period 3': 'Meena Pillai', 'Period 4': 'Suresh Nair',  'Period 5': 'Ravi Verma',   'Period 6': 'Deepa Thomas' },
            { 'Period 1': 'Suresh Nair', 'Period 2': 'Meena Pillai','Period 3': 'Arjun Kumar',  'Period 4': 'Ravi Verma',   'Period 5': 'Priya Sharma', 'Period 6': 'Kiran Rao' },
            { 'Period 1': 'Meena Pillai','Period 2': 'Anita Desai', 'Period 3': 'Priya Sharma', 'Period 4': 'Arjun Kumar',  'Period 5': 'Suresh Nair',  'Period 6': 'Ravi Verma' },
            { 'Period 1': 'Arjun Kumar', 'Period 2': 'Ravi Verma',  'Period 3': 'Anita Desai',  'Period 4': 'Suresh Nair',  'Period 5': 'Meena Pillai', 'Period 6': 'Deepa Thomas' }
          ],
          '10B': [
            { 'Period 1': 'Suresh Nair', 'Period 2': 'Arjun Kumar',  'Period 3': 'Priya Sharma', 'Period 4': 'Kiran Rao',    'Period 5': 'Meena Pillai', 'Period 6': 'Anita Desai' },
            { 'Period 1': 'Arjun Kumar', 'Period 2': 'Suresh Nair',  'Period 3': 'Anita Desai',  'Period 4': 'Meena Pillai', 'Period 5': 'Ravi Verma',   'Period 6': 'Priya Sharma' },
            { 'Period 1': 'Meena Pillai','Period 2': 'Priya Sharma', 'Period 3': 'Arjun Kumar',  'Period 4': 'Suresh Nair',  'Period 5': 'Kiran Rao',    'Period 6': 'Ravi Verma' },
            { 'Period 1': 'Priya Sharma','Period 2': 'Meena Pillai', 'Period 3': 'Ravi Verma',   'Period 4': 'Arjun Kumar',  'Period 5': 'Anita Desai',  'Period 6': 'Suresh Nair' },
            { 'Period 1': 'Ravi Verma',  'Period 2': 'Anita Desai',  'Period 3': 'Suresh Nair',  'Period 4': 'Priya Sharma', 'Period 5': 'Arjun Kumar',  'Period 6': 'Meena Pillai' }
          ],
          '11A': [
            { 'Period 1': 'Ravi Verma',  'Period 2': 'Priya Sharma', 'Period 3': 'Arjun Kumar',  'Period 4': 'Anita Desai',  'Period 5': 'Suresh Nair',  'Period 6': 'Deepa Thomas' },
            { 'Period 1': 'Priya Sharma','Period 2': 'Ravi Verma',   'Period 3': 'Anita Desai',  'Period 4': 'Arjun Kumar',  'Period 5': 'Meena Pillai', 'Period 6': 'Kiran Rao' },
            { 'Period 1': 'Arjun Kumar', 'Period 2': 'Anita Desai',  'Period 3': 'Ravi Verma',   'Period 4': 'Priya Sharma', 'Period 5': 'Suresh Nair',  'Period 6': 'Deepa Thomas' },
            { 'Period 1': 'Anita Desai', 'Period 2': 'Arjun Kumar',  'Period 3': 'Suresh Nair',  'Period 4': 'Ravi Verma',   'Period 5': 'Priya Sharma', 'Period 6': 'Kiran Rao' },
            { 'Period 1': 'Suresh Nair', 'Period 2': 'Meena Pillai', 'Period 3': 'Priya Sharma', 'Period 4': 'Ravi Verma',   'Period 5': 'Arjun Kumar',  'Period 6': 'Anita Desai' }
          ]
        };
        for (const [cls, periodRows] of Object.entries(sampleClasses)) {
          const rows = days.map((day, i) => ({ Day: day, ...periodRows[i] }));
          await saveClassTimetable(cls, rows).catch(() => {});
          console.log(`🌱 Seeded sample timetable for class ${cls}`);
        }
      }
    }

    // 5. Seed LeaveRequests if empty and present in Excel
    const [leaveRows] = await pool.query('SELECT COUNT(*) as count FROM LeaveRequests');
    if (leaveRows[0].count === 0 && excelData && excelData.Sheets['LeaveRequests']) {
      try {
        const sheet = excelData.Sheets['LeaveRequests'];
        const rows = XLSX.utils.sheet_to_json(sheet);
        if (rows.length > 0) {
          for (const row of rows) {
            const teacherName = row['Teachers Name'] || row['teacher_name'] || '';
            if (!teacherName) continue;
            
            const startDate = row['Start Date'] || row['start_date'] || row['Leave Date'] || row['leave_date'] || null;
            const endDate = row['End Date'] || row['end_date'] || row['Leave Date'] || row['leave_date'] || null;
            const leaveDate = row['Leave Date'] || row['leave_date'] || startDate || null;
            const leaveType = row['Leave Type'] || row['leave_type'] || 'Personal';
            const reason = row['Reason'] || row['reason'] || '';
            const status = row['Status'] || row['status'] || 'Pending';
            const approvedBy = row['Approved By'] || row['approved_by'] || null;
            const approvedDate = row['Approved Date'] || row['approved_date'] || null;

            await pool.query(`
              INSERT INTO LeaveRequests (teacher_name, start_date, end_date, leave_date, leave_type, reason, status, approved_by, approved_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [teacherName, startDate, endDate, leaveDate, leaveType, reason, status, approvedBy, approvedDate]);
          }
          console.log(`🌱 Seeded LeaveRequests table with ${rows.length} entries from Excel`);
        }
      } catch (err) {
        console.error('⚠️ Failed to seed LeaveRequests from Excel:', err.message);
      }
    }
  } catch (err) {
    console.error('❌ Database seeding error:', err);
  }
}

// ===============================
// Create All Tables
// ===============================
async function createTables() {
  // db_config table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS db_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      config_key VARCHAR(100) UNIQUE NOT NULL,
      config_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // SchoolConfig table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS SchoolConfig (
      id INT PRIMARY KEY,
      school_name VARCHAR(255),
      start_time VARCHAR(50),
      total_periods INT,
      minutes_per_period INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Teachers table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Teachers (
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
  // Safe migration: add missing columns using INFORMATION_SCHEMA (works on MySQL 5.6/5.7/8+)
  const migrations = [
    { column: 'username', def: 'VARCHAR(255)' },
    { column: 'photo',    def: 'LONGTEXT' }
  ];
  for (const m of migrations) {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Teachers' AND COLUMN_NAME = ?`,
      [m.column]
    );
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE Teachers ADD COLUMN \`${m.column}\` ${m.def}`);
      console.log(`✅ Migration: added Teachers.${m.column} (${m.def})`);
    }
  }

  // AdminConfig table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS AdminConfig (
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

  // LeaveRequests table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS LeaveRequests (
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

  // Versions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      version_id VARCHAR(50) NOT NULL,
      published_at DATETIME,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ All tables created/verified');
}

// ===============================
// School Config Operations
// ===============================
async function getSchoolConfig() {
  const [rows] = await pool.query(`SELECT * FROM SchoolConfig ORDER BY id DESC LIMIT 1`);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    'School Name': row.school_name || '',
    'School Start time': row.start_time || '',
    'Total Periods': row.total_periods || 0,
    'Time/periods': `${row.minutes_per_period || 30} Minutes`
  };
}

async function saveSchoolConfig(config) {
  const schoolName = config.SchoolName || config['School Name'] || '';
  const startTime = config.StartTime || config['School Start time'] || '';
  const totalPeriods = parseInt(config.TotalPeriods || config['Total Periods'] || 0);
  const minutesPerPeriod = parseInt(config.MinutesPerPeriod || (config['Time/periods'] || '').match(/\d+/) || 30);
  
  await pool.query(
    `INSERT INTO SchoolConfig (id, school_name, start_time, total_periods, minutes_per_period, updated_at)
     VALUES (1, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE 
     school_name = VALUES(school_name),
     start_time = VALUES(start_time),
     total_periods = VALUES(total_periods),
     minutes_per_period = VALUES(minutes_per_period),
     updated_at = NOW()`,
    [schoolName, startTime, totalPeriods, minutesPerPeriod]
  );
}

// ===============================
// Teacher Operations
// ===============================
async function getTeachers() {
  const [rows] = await pool.query(`SELECT * FROM Teachers ORDER BY name`);
  return rows;
}

async function getTeacherByName(name) {
  const [rows] = await pool.query(`SELECT * FROM Teachers WHERE name = ?`, [name]);
  return rows.length > 0 ? rows[0] : null;
}

async function addTeacher(teacher) {
  const plainPassword = teacher.password || teacher['Password'] || null;
  const name = teacher.name || teacher['Teachers Name'] || '';
  const username = teacher.username || teacher['Username'] || name.toLowerCase().trim() || null;

  const [result] = await pool.query(
    `INSERT INTO Teachers (name, subject, classes, contact, email, type, password, username)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      teacher.subject || teacher['Subject'] || '',
      teacher.classes || teacher['Class'] || '',
      teacher.contact || teacher['Contact number'] || '',
      teacher.email || teacher['Email'] || '',
      teacher.type || teacher['Type'] || 'teaching',
      plainPassword,
      username
    ]
  );
  return result.insertId;
}

let _teacherColumnsMigrated = false;

async function updateTeacher(originalName, updates) {
  if (!_teacherColumnsMigrated) {
    await ensureTeacherColumns().catch(() => {});
    _teacherColumnsMigrated = true;
  }
  const fields = [];
  const values = [];
  
  if (updates.name || updates['Teachers Name']) {
    fields.push(`name = ?`);
    values.push(updates.name || updates['Teachers Name']);
  }
  if (updates.subject || updates['Subject']) {
    fields.push(`subject = ?`);
    values.push(updates.subject || updates['Subject']);
  }
  if (updates.classes || updates['Class']) {
    fields.push(`classes = ?`);
    values.push(updates.classes || updates['Class']);
  }
  if (updates.contact || updates['Contact number']) {
    fields.push(`contact = ?`);
    values.push(updates.contact || updates['Contact number']);
  }
  if (updates.email || updates['Email']) {
    fields.push(`email = ?`);
    values.push(updates.email || updates['Email']);
  }
  if (updates.type || updates['Type']) {
    fields.push(`type = ?`);
    values.push(updates.type || updates['Type']);
  }
  if (updates.password !== undefined || updates['Password'] !== undefined) {
    const pw = updates.password !== undefined ? updates.password : updates['Password'];
    fields.push(`password = ?`);
    values.push(pw || null);
  }
  if (updates.username !== undefined || updates['Username'] !== undefined) {
    fields.push(`username = ?`);
    values.push(updates.username !== undefined ? (updates.username || null) : (updates['Username'] || null));
  }
  if (updates.photo !== undefined || updates['Photo'] !== undefined) {
    fields.push(`photo = ?`);
    values.push(updates.photo !== undefined ? (updates.photo || null) : (updates['Photo'] || null));
  }

  if (fields.length === 0) return false;
  
  fields.push(`updated_at = NOW()`);
  values.push(originalName);
  
  const [result] = await pool.query(
    `UPDATE Teachers SET ${fields.join(', ')} WHERE name = ?`,
    values
  );
  return result.affectedRows > 0;
}

async function deleteTeacher(name) {
  const [result] = await pool.query(`DELETE FROM Teachers WHERE name = ?`, [name]);
  return result.affectedRows > 0;
}

// ===============================
// Admin Config Operations
// ===============================
async function getAdmins() {
  const [rows] = await pool.query(`SELECT * FROM AdminConfig`);
  return rows;
}

async function getAdminByUsername(username) {
  const [rows] = await pool.query(`SELECT * FROM AdminConfig WHERE username = ?`, [username]);
  return rows.length > 0 ? rows[0] : null;
}

async function addAdmin(admin) {
  const plainPassword = admin.password || admin['Password'] || '';
  const hashedPassword = hashPassword(plainPassword);
  
  await pool.query(
    `INSERT INTO AdminConfig (username, password, role, permissions, email, email_password, smtp_host, smtp_port)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
     password = VALUES(password),
     role = VALUES(role),
     permissions = VALUES(permissions),
     email = VALUES(email),
     email_password = VALUES(email_password),
     smtp_host = VALUES(smtp_host),
     smtp_port = VALUES(smtp_port),
     updated_at = NOW()`,
    [
      admin.username || admin['Username'] || '',
      hashedPassword,
      admin.role || admin['Role'] || '',
      admin.permissions || admin['Permissions'] || '',
      admin.email || admin['Email'] || '',
      admin.email_password || admin['Email Password'] || '',
      admin.smtp_host || admin['SMTP Host'] || '',
      admin.smtp_port || admin['SMTP Port'] || null
    ]
  );
}

// ===============================
// Leave Request Operations
// ===============================
async function getLeaveRequests() {
  const [rows] = await pool.query(`SELECT * FROM LeaveRequests ORDER BY applied_date DESC, id DESC`);
  return rows;
}

async function getLeaveRequestById(id) {
  const [rows] = await pool.query(`SELECT * FROM LeaveRequests WHERE id = ?`, [id]);
  return rows.length > 0 ? rows[0] : null;
}

async function addLeaveRequest(leave) {
  const teacherName = leave.Teacher || leave.teacher || leave.teacher_name || '';
  const startDate = leave.StartDate || leave.start_date || '';
  const endDate = leave.EndDate || leave.end_date || '';
  const reason = leave.Reason || leave.reason || '';
  const status = leave.Status || leave.status || 'Pending';
  const leaveType = leave.LeaveType || leave.leave_type || 'Personal';
  
  try {
    const [result] = await pool.query(
      `INSERT INTO LeaveRequests (teacher_name, start_date, end_date, leave_date, leave_type, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        teacherName,
        startDate,
        endDate,
        startDate || null,
        leaveType,
        reason,
        status
      ]
    );
    return result.insertId;
  } catch (err) {
    if (err.message.includes('start_date') || err.message.includes('end_date') || err.code === 'ER_BAD_FIELD_ERROR') {
      const [result] = await pool.query(
        `INSERT INTO LeaveRequests (teacher_name, leave_date, leave_type, reason, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          teacherName,
          startDate,
          leaveType,
          reason,
          status
        ]
      );
      return result.insertId;
    } else {
      throw err;
    }
  }
}

async function updateLeaveRequest(id, updates) {
  const fields = [];
  const values = [];
  
  if (updates.status || updates.Status) {
    fields.push(`status = ?`);
    values.push(updates.status || updates.Status);
  }
  if (updates.teacher || updates.Teacher) {
    fields.push(`teacher_name = ?`);
    values.push(updates.teacher || updates.Teacher);
  }
  if (updates.start_date || updates.StartDate) {
    fields.push(`start_date = ?`);
    values.push(updates.start_date || updates.StartDate);
  }
  if (updates.end_date || updates.EndDate) {
    fields.push(`end_date = ?`);
    values.push(updates.end_date || updates.EndDate);
  }
  if (updates.reason || updates.Reason) {
    fields.push(`reason = ?`);
    values.push(updates.reason || updates.Reason);
  }
  if (updates.approved_by !== undefined) {
    fields.push(`approved_by = ?`);
    values.push(updates.approved_by);
  }
  if (updates.approved_date !== undefined) {
    fields.push(`approved_date = ?`);
    values.push(updates.approved_date);
  }
  if (updates.leave_date !== undefined) {
    fields.push(`leave_date = ?`);
    values.push(updates.leave_date);
  }
  
  if (fields.length === 0) return false;
  
  values.push(id);
  
  const query = `UPDATE LeaveRequests SET ${fields.join(', ')} WHERE id = ?`;
  const [result] = await pool.query(query, values);
  
  return result.affectedRows > 0;
}

async function deleteLeaveRequest(id) {
  const [result] = await pool.query(`DELETE FROM LeaveRequests WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

// ===============================
// Class Timetable Operations
// ===============================
async function getClassTimetables() {
  const [tablesResult] = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name LIKE 'Class_%'
    ORDER BY table_name
  `);
  
  const classes = {};
  
  for (const table of tablesResult) {
    const tableName = table.table_name || table.TABLE_NAME;
    const className = tableName.replace(/^class_/i, '');
    
    const [columnsResult] = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ordinal_position
    `, [tableName]);
    
    const columnNames = columnsResult.map(c => c.column_name || c.COLUMN_NAME);
    
    const dayColumn = columnNames.find(col => 
      col.toLowerCase() === 'days' || col.toLowerCase() === 'day'
    ) || 'Days';
    
    const periodColumns = columnNames
      .filter(col => {
        const colLower = col.toLowerCase();
        return /^p\d+$/.test(colLower) || 
               /^period_?\d+$/.test(colLower) ||
               /^period\s+\d+$/i.test(col);
      })
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    
    const [rowsResult] = await pool.query(`SELECT * FROM \`${tableName}\` ORDER BY \`${dayColumn}\``);
    
    classes[className] = rowsResult.map(row => {
      const classRow = { Day: row[dayColumn.toLowerCase()] || row[dayColumn] || row.Days || row.day || '' };
      
      periodColumns.forEach(periodCol => {
        const periodNum = periodCol.match(/\d+/)?.[0] || '';
        if (periodNum) {
          const periodValue = row[periodCol.toLowerCase()] || row[periodCol] || '';
          classRow[`Period ${periodNum}`] = periodValue;
        }
      });
      
      return classRow;
    });
  }
  
  return classes;
}

async function getClassTimetable(className) {
  const safeClassName = className.replace(/[^a-zA-Z0-9_]/g, '');
  const tableName = `Class_${safeClassName}`;
  
  const [tablesResult] = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = ?
  `, [tableName]);
  
  if (tablesResult.length === 0) {
    return [];
  }
  
  const [columnsResult] = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() AND table_name = ?
    ORDER BY ordinal_position
  `, [tableName]);
  
  const columnNames = columnsResult.map(c => c.column_name || c.COLUMN_NAME);
  const dayColumn = columnNames.find(col => 
    col.toLowerCase() === 'days' || col.toLowerCase() === 'day'
  ) || 'Days';
  
  const periodColumns = columnNames
    .filter(col => {
      const colLower = col.toLowerCase();
      return /^p\d+$/.test(colLower) || 
             /^period_?\d+$/.test(colLower) ||
             /^period\s+\d+$/i.test(col);
    })
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });
  
  const [rowsResult] = await pool.query(`SELECT * FROM \`${tableName}\` ORDER BY \`${dayColumn}\``);
  
  return rowsResult.map(row => {
    const classRow = { Day: row[dayColumn.toLowerCase()] || row[dayColumn] || row.Days || row.day || '' };
    
    periodColumns.forEach(periodCol => {
      const periodNum = periodCol.match(/\d+/)?.[0] || '';
      if (periodNum) {
        const periodValue = row[periodCol.toLowerCase()] || row[periodCol] || '';
        classRow[`Period ${periodNum}`] = periodValue;
      }
    });
    
    return classRow;
  });
}

async function saveClassTimetable(className, rows) {
  const safeClassName = className.replace(/[^a-zA-Z0-9_]/g, '');
  const tableName = `Class_${safeClassName}`;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [tablesResult] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = ?
    `, [tableName]);
    
    let maxPeriods = 0;
    rows.forEach(row => {
      Object.keys(row).forEach(key => {
        const periodMatch = key.match(/Period\s*(\d+)/i);
        if (periodMatch) {
          const periodNum = parseInt(periodMatch[1]);
          if (periodNum > maxPeriods) maxPeriods = periodNum;
        }
      });
    });
    
    // Fetch total_periods from SchoolConfig to ensure we have at least that many columns
    let schoolConfigTotalPeriods = 0;
    try {
      const [schoolConfigRows] = await connection.query('SELECT total_periods FROM SchoolConfig ORDER BY id DESC LIMIT 1');
      if (schoolConfigRows.length > 0) {
        schoolConfigTotalPeriods = parseInt(schoolConfigRows[0].total_periods || schoolConfigRows[0].TOTAL_PERIODS) || 0;
      }
    } catch (e) {
      console.warn('⚠️ Could not fetch school config total_periods:', e.message);
    }
    
    maxPeriods = Math.max(maxPeriods, schoolConfigTotalPeriods, 5);
    
    if (tablesResult.length === 0) {
      const periodColumns = [];
      for (let i = 1; i <= maxPeriods; i++) {
        periodColumns.push(`P${i} VARCHAR(255)`);
      }
      
      await connection.query(`
        CREATE TABLE \`${tableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          Days VARCHAR(50) NOT NULL,
          ${periodColumns.join(',\n          ')}
        )
      `);
    } else {
      const [columnsResult] = await connection.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY ordinal_position
      `, [tableName]);
      
      const existingColumns = columnsResult.map(c => c.column_name || c.COLUMN_NAME);
      const existingPeriods = existingColumns
        .filter(col => /^p\d+$/i.test(col))
        .map(col => parseInt(col.match(/\d+/)?.[0] || '0'))
        .filter(num => num > 0);
      
      const maxExistingPeriod = existingPeriods.length > 0 ? Math.max(...existingPeriods) : 0;
      
      for (let i = maxExistingPeriod + 1; i <= maxPeriods; i++) {
        try {
          await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN P${i} VARCHAR(255)`);
        } catch (err) {
          if (err.code !== 'ER_DUP_FIELDNAME') {
            throw err;
          }
        }
      }
    }
    
    const [columnsResult] = await connection.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ordinal_position
    `, [tableName]);
    
    const columnNames = columnsResult.map(c => c.column_name || c.COLUMN_NAME);
    const dayColumn = columnNames.find(col => 
      col.toLowerCase() === 'days' || col.toLowerCase() === 'day'
    ) || 'Days';
    
    const periodColumns = columnNames
      .filter(col => {
        const colLower = col.toLowerCase();
        if (colLower === 'id') return false;
        return /^p\d+$/.test(colLower) || 
               /^period_?\d+$/.test(colLower) ||
               /^period\s+\d+$/i.test(col);
      })
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    
    await connection.query(`DELETE FROM \`${tableName}\``);
    
    for (const row of rows) {
      const day = row.Day || row.day || row.Days || '';
      if (!day) continue;
      
      const values = [day];
      const cols = [dayColumn];
      const placeholders = ['?'];
      
      periodColumns.forEach(periodCol => {
        const periodNum = periodCol.match(/\d+/)?.[0] || '';
        if (periodNum) {
          cols.push(periodCol);
          placeholders.push('?');
          const periodValue = row[`Period ${periodNum}`] || 
                             row[`Period${periodNum}`] ||
                             row[`P${periodNum}`] ||
                             row[`p${periodNum}`] ||
                             row[periodCol] ||
                             '';
          values.push(periodValue || null);
        }
      });
      
      if (cols.length !== values.length) {
        throw new Error(`Column/value mismatch: ${cols.length} columns but ${values.length} values`);
      }
      
      const insertQuery = `INSERT INTO \`${tableName}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders.join(', ')})`;
      await connection.query(insertQuery, values);
    }
    
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function deleteClassTimetable(className) {
  const safeClassName = className.replace(/[^a-zA-Z0-9_]/g, '');
  const tableName = `Class_${safeClassName}`;
  await pool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
  return true;
}

// ===============================
// Version Operations
// ===============================
async function getVersions() {
  const [rows] = await pool.query(`SELECT * FROM Versions ORDER BY id DESC`);
  return rows;
}

async function addVersion(version) {
  await pool.query(
    `INSERT INTO Versions (version_id, published_at, notes)
     VALUES (?, ?, ?)`,
    [
      version.version_id || version['version_id'] || '',
      version.published_at || version['published_at'] || new Date().toISOString().slice(0, 19).replace('T', ' '),
      version.notes || version['notes'] || ''
    ]
  );
}

// ===============================
// Helper: Convert DB format to Excel format
// ===============================
function formatTeachersForExcel(teachers) {
  return teachers.map(t => ({
    'Teachers Name': t.name,
    'Subject': t.subject || '',
    'Class': t.classes || '',
    'Contact number': t.contact || '',
    'Email': t.email || '',
    'Type': t.type || 'teaching',
    'Password': t.password || t.Password || '',
    'Username': t.username || t.name.toLowerCase().trim(),
    'Photo': t.photo || ''
  }));
}

function formatLeavesForExcel(leaves) {
  return leaves.map(l => {
    let startDate = l.start_date || l.leave_date;
    let endDate = l.end_date || l.leave_date;
    
    if (startDate instanceof Date) {
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      startDate = `${year}-${month}-${day}`;
    } else if (typeof startDate === 'string') {
      startDate = startDate.split('T')[0].split(' ')[0];
    }
    
    if (endDate instanceof Date) {
      const year = endDate.getFullYear();
      const month = String(endDate.getMonth() + 1).padStart(2, '0');
      const day = String(endDate.getDate()).padStart(2, '0');
      endDate = `${year}-${month}-${day}`;
    } else if (typeof endDate === 'string') {
      endDate = endDate.split('T')[0].split(' ')[0];
    }
    
    const teacherName = l.teacher_name || l.teacher || '';
    
    return {
      id: l.id,
      Teacher: teacherName,
      StartDate: startDate,
      EndDate: endDate,
      Reason: l.reason || '',
      Status: l.status || 'Pending'
    };
  });
}

function formatAdminsForExcel(admins) {
  return admins.map(a => ({
    Username: a.username,
    Password: a.password,
    Role: a.role || '',
    Permissions: a.permissions || '',
    Email: a.email || '',
    'Email Password': a.email_password || '',
    'SMTP Host': a.smtp_host || '',
    'SMTP Port': a.smtp_port || ''
  }));
}

// Ensure teacher columns exist — safe to call at any time, no restart needed
async function ensureTeacherColumns() {
  if (!pool) return;
  const cols = [
    { column: 'username', def: 'VARCHAR(255)' },
    { column: 'photo',    def: 'LONGTEXT' }
  ];
  for (const c of cols) {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Teachers' AND COLUMN_NAME = ?`,
      [c.column]
    );
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE Teachers ADD COLUMN \`${c.column}\` ${c.def}`);
      console.log(`✅ Auto-migrated: added Teachers.${c.column}`);
    }
  }
}

// Initialize database
const initPromise = initDatabase().catch(err => {
  console.error('❌ Failed to initialize database:', err);
  throw err;
});

module.exports = {
  pool,
  initPromise,
  ensureTeacherColumns,
  getSchoolConfig,
  saveSchoolConfig,
  getTeachers,
  getTeacherByName,
  addTeacher,
  updateTeacher,
  deleteTeacher,
  formatTeachersForExcel,
  getAdmins,
  getAdminByUsername,
  addAdmin,
  formatAdminsForExcel,
  getLeaveRequests,
  getLeaveRequestById,
  addLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  formatLeavesForExcel,
  getClassTimetables,
  getClassTimetable,
  saveClassTimetable,
  deleteClassTimetable,
  getVersions,
  addVersion,
  hashPassword,
  verifyPassword
};
