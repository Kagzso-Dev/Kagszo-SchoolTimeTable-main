# 📊 Database Schema Documentation

This document describes the complete database schema for the School Timetable Management System using MySQL.

## 🗄️ Database Overview

The system uses **MySQL** as the primary database. Tables are automatically verified and created if missing during server startup by the `db-mysql.js` module.

## 📋 Table List

1. **db_config** - Database connection configuration
2. **SchoolConfig** - School-wide configuration settings
3. **Teachers** - Teacher information and credentials
4. **AdminConfig** - Administrator accounts and email/SMTP settings
5. **LeaveRequests** - Leave applications and approval status
6. **Versions** - Timetable version history
7. **Class_*** - Dynamic class timetable tables (e.g., Class_9A, Class_10B)

---

## 📝 Table Schemas

### 1. db_config

Stores database connection configuration.

```sql
CREATE TABLE IF NOT EXISTS db_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `config_key` - Key identifier (e.g. "host", "port")
- `config_value` - Configuration value
- `updated_at` - Automatic timestamp of the last update

---

### 2. SchoolConfig

Stores school-wide settings.

```sql
CREATE TABLE IF NOT EXISTS SchoolConfig (
  id INT PRIMARY KEY,
  school_name VARCHAR(255),
  start_time VARCHAR(50),
  total_periods INT,
  minutes_per_period INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Primary key (usually 1, representing the single active config)
- `school_name` - Name of the school
- `start_time` - School start time (e.g., "08.30AM")
- `total_periods` - Total periods per day (e.g., 6)
- `minutes_per_period` - Period duration in minutes (e.g., 45)
- `updated_at` - Automatic timestamp of the last update

---

### 3. Teachers

Stores details of registered teachers.

```sql
CREATE TABLE IF NOT EXISTS Teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  subject VARCHAR(255),
  classes TEXT,
  contact VARCHAR(255),
  email VARCHAR(255),
  type VARCHAR(50) DEFAULT 'teaching',
  password VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `name` - Teacher's name (unique)
- `subject` - Primary subject taught
- `classes` - Assigned classes (comma-separated, e.g. "10A,10B")
- `contact` - Contact phone number
- `email` - Email address (used for auto-substitutions notifications)
- `type` - Teacher type (e.g. "teaching", "non-teaching")
- `password` - Login password
- `updated_at` - Automatic timestamp of the last update

---

### 4. AdminConfig

Stores admin credentials and SMTP server settings for emails.

```sql
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
);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `username` - Admin username (unique, defaults to 'admin')
- `password` - Plaintext login password
- `role` - Access role (e.g., "Super Admin")
- `permissions` - Access capabilities (e.g., "all")
- `email` - Outgoing SMTP email address
- `email_password` - Outgoing SMTP email app password
- `smtp_host` - SMTP server host (e.g., "smtp.gmail.com")
- `smtp_port` - SMTP server port (e.g., 587)
- `updated_at` - Automatic timestamp of the last update

---

### 5. LeaveRequests

Tracks applied teacher leaves and approval status.

```sql
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
);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `teacher_name` - Reference to Teacher's name
- `start_date` - Start date of the leave
- `end_date` - End date of the leave
- `leave_date` - Single date leave fallback
- `leave_type` - Type of leave (e.g. "Personal", "Sick")
- `reason` - Detailed reason for leave
- `status` - Status ("Pending", "Approved", "Rejected")
- `approved_by` - Username of the admin who processed the request
- `approved_date` - Date/time when the request was approved/rejected
- `applied_date` - Automatic timestamp when the leave was created
- `updated_at` - Automatic timestamp of the last update

---

### 6. Versions

Tracks published timetable versions.

```sql
CREATE TABLE IF NOT EXISTS Versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_id VARCHAR(50) NOT NULL,
  published_at DATETIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `version_id` - Unique identifier for the version
- `published_at` - Date/time when the version was published
- `notes` - Optional release notes
- `created_at` - Automatic creation timestamp

---

### 7. Class Timetables (Dynamic Tables)

Each class has its own table created dynamically upon first save. Table names follow the format: `Class_<ClassName>` (e.g. `Class_10A`).

```sql
CREATE TABLE `Class_10A` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  Days VARCHAR(50) NOT NULL,
  P1 VARCHAR(255),
  P2 VARCHAR(255),
  P3 VARCHAR(255),
  P4 VARCHAR(255),
  P5 VARCHAR(255)
  -- Additional periods like P6, P7 can be added dynamically by the system
);
```

**Columns:**
- `id` - Auto-incrementing primary key
- `Days` - Day of the week (e.g. "Monday")
- `P1`, `P2`, ... `Pn` - Content of each period (format: `Subject - Teacher Name`)
