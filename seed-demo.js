/**
 * Demo Data Seeder — Kagzso High School
 * Run: node seed-demo.js
 * Clears and rebuilds all tables with realistic demo data.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Load .env ─────────────────────────────────────────────────────────────────
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) {
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env[k] = v;
    }
  });
} catch (_) {}

function hash(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

// ── Connection ────────────────────────────────────────────────────────────────
const DB = {
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  port:     parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME     || 'timetable_db',
};

// ── Demo Data ─────────────────────────────────────────────────────────────────

const SCHOOL = {
  school_name:       'Kagzso High School',
  start_time:        '08.30AM',
  total_periods:     6,
  minutes_per_period: 45,
};

const ADMIN = {
  username:  'admin',
  password:  hash('kagzso@123'),
  role:      'Super Admin',
  permissions: 'all',
  email:     'admin@kagzso.edu.in',
};

// 11 teachers covering all subjects and classes
const TEACHERS = [
  { name: 'Kavitha Ramasamy', subject: 'Tamil',            classes: '6A,7A,8A',          contact: '9876543210', email: 'kavitha@kagzso.edu.in',  type: 'teaching' },
  { name: 'Priya Nair',       subject: 'English',          classes: '6A,7A,8A,9A',        contact: '9876543211', email: 'priya@kagzso.edu.in',    type: 'teaching' },
  { name: 'Rajesh Kumar',     subject: 'Math',             classes: '6A,7A,9A',           contact: '9876543212', email: 'rajesh@kagzso.edu.in',   type: 'teaching' },
  { name: 'Meena Sundaram',   subject: 'Science',          classes: '6A,7A,8A',           contact: '9876543213', email: 'meena@kagzso.edu.in',    type: 'teaching' },
  { name: 'Suresh Venkatesh', subject: 'Social Science',   classes: '6A,7A,8A,9A',        contact: '9876543214', email: 'suresh@kagzso.edu.in',   type: 'teaching' },
  { name: 'Anitha Krishnan',  subject: 'Hindi',            classes: '6A,7A,8A,9A,10A,10B',contact: '9876543215', email: 'anitha@kagzso.edu.in',   type: 'teaching' },
  { name: 'Divya Murugan',    subject: 'Computer Science', classes: '8A,9A,10A,10B',      contact: '9876543216', email: 'divya@kagzso.edu.in',    type: 'teaching' },
  { name: 'Senthil Kumar',    subject: 'Math',             classes: '8A,10A,10B',         contact: '9876543217', email: 'senthil@kagzso.edu.in',  type: 'teaching' },
  { name: 'Lakshmi Devi',     subject: 'Science',          classes: '9A,10A,10B',         contact: '9876543218', email: 'lakshmi@kagzso.edu.in',  type: 'teaching' },
  { name: 'Arjun Balaji',     subject: 'Tamil',            classes: '9A,10A,10B',         contact: '9876543219', email: 'arjun@kagzso.edu.in',    type: 'teaching' },
  { name: 'Vijay Selvam',     subject: 'PE',               classes: '6A,7A,8A,9A,10A,10B',contact: '9876543220', email: 'vijay@kagzso.edu.in',    type: 'teaching' },
];

// 6 periods × 5 days per class  (Period 1 … Period 6)
// Subjects used must match a teacher's subject column for correct assignment.
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const CLASS_TIMETABLES = {
  '6A': [
    { Day: 'Monday',    'Period 1': 'Tamil',          'Period 2': 'English',        'Period 3': 'Math',           'Period 4': 'Science',        'Period 5': 'Social Science', 'Period 6': 'Hindi' },
    { Day: 'Tuesday',   'Period 1': 'Math',           'Period 2': 'Tamil',          'Period 3': 'English',        'Period 4': 'Social Science', 'Period 5': 'Hindi',          'Period 6': 'Science' },
    { Day: 'Wednesday', 'Period 1': 'English',        'Period 2': 'Math',           'Period 3': 'Tamil',          'Period 4': 'Hindi',          'Period 5': 'Science',        'Period 6': 'Social Science' },
    { Day: 'Thursday',  'Period 1': 'Science',        'Period 2': 'Social Science', 'Period 3': 'Math',           'Period 4': 'Tamil',          'Period 5': 'English',        'Period 6': 'PE' },
    { Day: 'Friday',    'Period 1': 'Hindi',          'Period 2': 'English',        'Period 3': 'Social Science', 'Period 4': 'Math',           'Period 5': 'Tamil',          'Period 6': 'PE' },
  ],
  '7A': [
    { Day: 'Monday',    'Period 1': 'English',        'Period 2': 'Tamil',          'Period 3': 'Science',        'Period 4': 'Math',           'Period 5': 'Hindi',          'Period 6': 'Social Science' },
    { Day: 'Tuesday',   'Period 1': 'Tamil',          'Period 2': 'Math',           'Period 3': 'Social Science', 'Period 4': 'English',        'Period 5': 'Science',        'Period 6': 'Hindi' },
    { Day: 'Wednesday', 'Period 1': 'Math',           'Period 2': 'Science',        'Period 3': 'English',        'Period 4': 'Tamil',          'Period 5': 'Social Science', 'Period 6': 'PE' },
    { Day: 'Thursday',  'Period 1': 'Hindi',          'Period 2': 'English',        'Period 3': 'Tamil',          'Period 4': 'Science',        'Period 5': 'Math',           'Period 6': 'Social Science' },
    { Day: 'Friday',    'Period 1': 'Social Science', 'Period 2': 'Hindi',          'Period 3': 'Math',           'Period 4': 'English',        'Period 5': 'Tamil',          'Period 6': 'PE' },
  ],
  '8A': [
    { Day: 'Monday',    'Period 1': 'Math',           'Period 2': 'Tamil',          'Period 3': 'English',        'Period 4': 'Hindi',          'Period 5': 'Science',        'Period 6': 'Computer Science' },
    { Day: 'Tuesday',   'Period 1': 'English',        'Period 2': 'Science',        'Period 3': 'Math',           'Period 4': 'Tamil',          'Period 5': 'Computer Science','Period 6': 'Social Science' },
    { Day: 'Wednesday', 'Period 1': 'Tamil',          'Period 2': 'Math',           'Period 3': 'Science',        'Period 4': 'Social Science', 'Period 5': 'Hindi',          'Period 6': 'PE' },
    { Day: 'Thursday',  'Period 1': 'Science',        'Period 2': 'English',        'Period 3': 'Social Science', 'Period 4': 'Math',           'Period 5': 'Tamil',          'Period 6': 'Hindi' },
    { Day: 'Friday',    'Period 1': 'Hindi',          'Period 2': 'Computer Science','Period 3': 'Tamil',         'Period 4': 'English',        'Period 5': 'Social Science', 'Period 6': 'PE' },
  ],
  '9A': [
    { Day: 'Monday',    'Period 1': 'Math',           'Period 2': 'Tamil',          'Period 3': 'Science',        'Period 4': 'English',        'Period 5': 'Hindi',          'Period 6': 'Computer Science' },
    { Day: 'Tuesday',   'Period 1': 'Tamil',          'Period 2': 'English',        'Period 3': 'Math',           'Period 4': 'Computer Science','Period 5': 'Social Science', 'Period 6': 'Science' },
    { Day: 'Wednesday', 'Period 1': 'Science',        'Period 2': 'Math',           'Period 3': 'English',        'Period 4': 'Tamil',          'Period 5': 'Computer Science','Period 6': 'PE' },
    { Day: 'Thursday',  'Period 1': 'English',        'Period 2': 'Social Science', 'Period 3': 'Tamil',          'Period 4': 'Math',           'Period 5': 'Science',        'Period 6': 'Hindi' },
    { Day: 'Friday',    'Period 1': 'Hindi',          'Period 2': 'Science',        'Period 3': 'Social Science', 'Period 4': 'English',        'Period 5': 'Tamil',          'Period 6': 'PE' },
  ],
  '10A': [
    { Day: 'Monday',    'Period 1': 'Math',           'Period 2': 'Tamil',          'Period 3': 'Science',        'Period 4': 'English',        'Period 5': 'Computer Science','Period 6': 'Hindi' },
    { Day: 'Tuesday',   'Period 1': 'Science',        'Period 2': 'Math',           'Period 3': 'Tamil',          'Period 4': 'Hindi',          'Period 5': 'English',        'Period 6': 'Computer Science' },
    { Day: 'Wednesday', 'Period 1': 'English',        'Period 2': 'Science',        'Period 3': 'Math',           'Period 4': 'Computer Science','Period 5': 'Tamil',          'Period 6': 'PE' },
    { Day: 'Thursday',  'Period 1': 'Tamil',          'Period 2': 'English',        'Period 3': 'Hindi',          'Period 4': 'Math',           'Period 5': 'Science',        'Period 6': 'Computer Science' },
    { Day: 'Friday',    'Period 1': 'Hindi',          'Period 2': 'Computer Science','Period 3': 'English',       'Period 4': 'Tamil',          'Period 5': 'Math',           'Period 6': 'PE' },
  ],
  '10B': [
    { Day: 'Monday',    'Period 1': 'Tamil',          'Period 2': 'Math',           'Period 3': 'English',        'Period 4': 'Science',        'Period 5': 'Hindi',          'Period 6': 'Computer Science' },
    { Day: 'Tuesday',   'Period 1': 'English',        'Period 2': 'Tamil',          'Period 3': 'Science',        'Period 4': 'Computer Science','Period 5': 'Math',           'Period 6': 'Hindi' },
    { Day: 'Wednesday', 'Period 1': 'Math',           'Period 2': 'English',        'Period 3': 'Computer Science','Period 4': 'Tamil',         'Period 5': 'Science',        'Period 6': 'PE' },
    { Day: 'Thursday',  'Period 1': 'Science',        'Period 2': 'Hindi',          'Period 3': 'Tamil',          'Period 4': 'English',        'Period 5': 'Math',           'Period 6': 'Computer Science' },
    { Day: 'Friday',    'Period 1': 'Hindi',          'Period 2': 'Science',        'Period 3': 'Math',           'Period 4': 'Computer Science','Period 5': 'English',        'Period 6': 'PE' },
  ],
};

// Leave requests — future/recent dates relative to 2026-05-21
const LEAVES = [
  { teacher_name: 'Kavitha Ramasamy', start_date: '2026-05-25', end_date: '2026-05-25', leave_type: 'Medical',   reason: 'Doctor appointment',        status: 'Approved',  approved_by: 'admin', approved_date: '2026-05-21 09:00:00' },
  { teacher_name: 'Priya Nair',       start_date: '2026-05-26', end_date: '2026-05-27', leave_type: 'Personal',  reason: 'Family function',           status: 'Approved',  approved_by: 'admin', approved_date: '2026-05-21 09:30:00' },
  { teacher_name: 'Rajesh Kumar',     start_date: '2026-05-28', end_date: '2026-05-29', leave_type: 'Personal',  reason: 'Personal work',             status: 'Pending',   approved_by: null,    approved_date: null },
  { teacher_name: 'Anitha Krishnan',  start_date: '2026-06-02', end_date: '2026-06-03', leave_type: 'Medical',   reason: 'Health check-up',           status: 'Pending',   approved_by: null,    approved_date: null },
  { teacher_name: 'Senthil Kumar',    start_date: '2026-05-22', end_date: '2026-05-22', leave_type: 'Emergency', reason: 'Family emergency',          status: 'Rejected',  approved_by: 'admin', approved_date: '2026-05-21 10:00:00' },
  { teacher_name: 'Divya Murugan',    start_date: '2026-06-05', end_date: '2026-06-06', leave_type: 'Personal',  reason: 'Out of town',               status: 'Pending',   approved_by: null,    approved_date: null },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function dropAndCreate(conn, sql, name) {
  await conn.query(sql);
  console.log(`  ✅ ${name}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seedDemo() {
  console.log('\n🚀 Kagzso High School — Demo Data Seeder\n');

  let conn;
  try {
    conn = await mysql.createConnection({ host: DB.host, user: DB.user, password: DB.password, port: DB.port });
    console.log('✅ Connected to MySQL');
  } catch (err) {
    console.error('❌ Cannot connect to MySQL — check your .env credentials');
    console.error('   ', err.message);
    process.exit(1);
  }

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB.database}\``);
    await conn.query(`USE \`${DB.database}\``);
    console.log(`✅ Using database: ${DB.database}\n`);

    // ── Drop everything ──────────────────────────────────────────────────────
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const [tables] = await conn.query('SHOW TABLES');
    const key = `Tables_in_${DB.database}`;
    for (const t of tables) {
      const tname = t[key] || t[Object.keys(t)[0]];
      await conn.query(`DROP TABLE IF EXISTS \`${tname}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🗑️  Cleared all existing tables\n');

    // ── Core tables ──────────────────────────────────────────────────────────
    console.log('🛠️  Creating core tables...');

    await dropAndCreate(conn, `
      CREATE TABLE SchoolConfig (
        id INT PRIMARY KEY,
        school_name VARCHAR(255),
        start_time VARCHAR(50),
        total_periods INT,
        minutes_per_period INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`, 'SchoolConfig');

    await dropAndCreate(conn, `
      CREATE TABLE Teachers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        subject VARCHAR(255),
        classes TEXT,
        contact VARCHAR(255),
        email VARCHAR(255),
        type VARCHAR(50) DEFAULT 'teaching',
        password VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`, 'Teachers');

    await dropAndCreate(conn, `
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
      )`, 'AdminConfig');

    await dropAndCreate(conn, `
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
      )`, 'LeaveRequests');

    await dropAndCreate(conn, `
      CREATE TABLE Versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        version_id VARCHAR(50) NOT NULL,
        published_at DATETIME,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, 'Versions');

    await dropAndCreate(conn, `
      CREATE TABLE db_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`, 'db_config');

    // ── School Config ────────────────────────────────────────────────────────
    console.log('\n🏫 Seeding school configuration...');
    await conn.query(
      `INSERT INTO SchoolConfig (id, school_name, start_time, total_periods, minutes_per_period) VALUES (1, ?, ?, ?, ?)`,
      [SCHOOL.school_name, SCHOOL.start_time, SCHOOL.total_periods, SCHOOL.minutes_per_period]
    );
    console.log(`  ✅ "${SCHOOL.school_name}" | Start: ${SCHOOL.start_time} | ${SCHOOL.total_periods} periods × ${SCHOOL.minutes_per_period} min`);

    // ── Admin ────────────────────────────────────────────────────────────────
    console.log('\n👤 Seeding admin...');
    await conn.query(
      `INSERT INTO AdminConfig (username, password, role, permissions, email) VALUES (?, ?, ?, ?, ?)`,
      [ADMIN.username, ADMIN.password, ADMIN.role, ADMIN.permissions, ADMIN.email]
    );
    console.log(`  ✅ Username: admin | Password: kagzso@123`);

    // ── Teachers ─────────────────────────────────────────────────────────────
    console.log('\n👩‍🏫 Seeding teachers...');
    for (const t of TEACHERS) {
      await conn.query(
        `INSERT INTO Teachers (name, subject, classes, contact, email, type) VALUES (?, ?, ?, ?, ?, ?)`,
        [t.name, t.subject, t.classes, t.contact, t.email, t.type]
      );
      console.log(`  ✅ ${t.name.padEnd(22)} | ${t.subject.padEnd(18)} | Classes: ${t.classes}`);
    }

    // ── Class Timetables ─────────────────────────────────────────────────────
    console.log('\n📅 Seeding class timetables...');
    for (const [className, rows] of Object.entries(CLASS_TIMETABLES)) {
      const tableName = `Class_${className}`;
      const periods = SCHOOL.total_periods;

      const periodCols = [];
      for (let i = 1; i <= periods; i++) periodCols.push(`\`P${i}\` VARCHAR(255)`);

      await conn.query(`
        CREATE TABLE \`${tableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          Days VARCHAR(50) NOT NULL,
          ${periodCols.join(', ')}
        )
      `);

      for (const row of rows) {
        const cols = ['Days'];
        const vals = [row.Day];
        for (let i = 1; i <= periods; i++) {
          cols.push(`P${i}`);
          vals.push(row[`Period ${i}`] || null);
        }
        await conn.query(
          `INSERT INTO \`${tableName}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          vals
        );
      }
      console.log(`  ✅ ${tableName} — ${rows.length} days × ${periods} periods`);
    }

    // ── Leave Requests ───────────────────────────────────────────────────────
    console.log('\n📝 Seeding leave requests...');
    for (const l of LEAVES) {
      await conn.query(
        `INSERT INTO LeaveRequests (teacher_name, start_date, end_date, leave_date, leave_type, reason, status, approved_by, approved_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [l.teacher_name, l.start_date, l.end_date, l.start_date, l.leave_type, l.reason, l.status, l.approved_by, l.approved_date]
      );
      const badge = l.status === 'Approved' ? '✅' : l.status === 'Rejected' ? '❌' : '⏳';
      console.log(`  ${badge} ${l.teacher_name.padEnd(20)} | ${l.start_date} → ${l.end_date} | ${l.status}`);
    }

    // ── Version entry ────────────────────────────────────────────────────────
    console.log('\n📌 Adding initial timetable version...');
    await conn.query(
      `INSERT INTO Versions (version_id, published_at, notes) VALUES (?, ?, ?)`,
      ['v1', '2026-05-21 08:00:00', 'Initial demo timetable — Term 1 2026']
    );
    console.log('  ✅ v1 published');

    console.log(`
╔══════════════════════════════════════════════════════╗
║         DEMO DATA SEEDED SUCCESSFULLY                ║
╠══════════════════════════════════════════════════════╣
║  School  : Kagzso High School                        ║
║  Classes : 6A, 7A, 8A, 9A, 10A, 10B                 ║
║  Teachers: ${String(TEACHERS.length).padEnd(42)}║
║  Leaves  : ${String(LEAVES.length).padEnd(42)}║
╠══════════════════════════════════════════════════════╣
║  Admin Login                                         ║
║    URL      : http://localhost:3000/admin            ║
║    Username : admin                                  ║
║    Password : kagzso@123                             ║
╚══════════════════════════════════════════════════════╝
`);

  } catch (err) {
    console.error('\n❌ Seeding failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

seedDemo();
