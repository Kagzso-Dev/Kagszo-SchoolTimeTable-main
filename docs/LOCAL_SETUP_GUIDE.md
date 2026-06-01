# 🚀 Local Setup Guide

This guide will help you set up and run the School Timetable Management System on your local machine using a MySQL database.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (version 14.x or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`
   - Verify npm: `npm --version`

2. **MySQL Database** (Local MySQL Server, phpMyAdmin, or Cloud MySQL)
   - Install MySQL Server: https://dev.mysql.com/downloads/installer/
   - Or install XAMPP/WampServer (which includes MySQL/MariaDB and phpMyAdmin)

3. **Git** (optional, for version control)
   - Download from: https://git-scm.com/

## 🔧 Installation Steps

### Step 1: Clone or Navigate to the Project

Navigate to the project directory:
```bash
cd Kagszo-SchoolTimeTable-main
```

### Step 2: Install Dependencies

Install all required Node.js packages:
```bash
npm install
```

This will install the following packages:
- `express` - Web server framework
- `mysql2` - MySQL database driver
- `xlsx` - Excel file reading/writing
- `nodemailer` - Email sending functionality
- `moment-timezone` - Date/time handling
- `body-parser` - Request body parsing
- And other dependencies

### Step 3: Set Up Database

1. **Start your MySQL server** (e.g. start MySQL service using XAMPP or Windows Services).
2. **Create a new database**:
   - Open your MySQL CLI or phpMyAdmin.
   - Run the following command:
     ```sql
     CREATE DATABASE timetable_db;
     ```

*Note: The application will automatically create all required tables (`db_config`, `SchoolConfig`, `Teachers`, `AdminConfig`, `LeaveRequests`, `Versions`) and insert default seed data when it first connects!*

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=timetable_db
DB_PORT=3306

# Email Configuration (Optional - for leave notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Step 5: Default Credentials (Seeded Automatically)

Upon starting the server, the database will be seeded with default credentials automatically:
- **Admin Username**: `admin`
- **Admin Password**: `kagzso@123`
- **Sample School Config**: "Sample High School"
- **Sample Teachers**: John Doe, Jane Smith, Robert Johnson, Emily Davis

---

## 🏃 Running the Application

### Start the Server

```bash
npm start
```
*Alternatively:*
```bash
node server.js
```

Once the server is running, you should see:
```
✅ Connected to MySQL database
🌱 Seeded SchoolConfig table
🌱 Seeded AdminConfig table with default admin
🌱 Seeded Teachers table with sample teachers
✅ All tables created/verified
✅ MySQL Database initialized
🚀 Server running on http://localhost:3000
```

### Access the Application

- **Admin Portal:** http://localhost:3000/admin/index.html
  - Default credentials: `admin` / `kagzso@123`
- **User Portal:** http://localhost:3000/user/index.html
  - Teachers can login with their credentials (e.g. `John Doe`)

---

## 🔍 Troubleshooting

### Issue: "Access denied for user..." (ER_ACCESS_DENIED_ERROR)

**Solutions:**
1. Check your `.env` file credentials.
2. Verify if the database user (`root` or other) has a password. Leave `DB_PASSWORD` empty in `.env` if no password is set.

### Issue: "Port 3000 already in use"

**Solutions:**
1. Stop any other Node.js processes running on port 3000:
   - **Windows**: `taskkill /F /IM node.exe`
   - **Linux/Mac**: `killall node`

### Issue: "Database 'timetable_db' not found"

**Solutions:**
1. Manually create the database using phpMyAdmin or MySQL client:
   ```sql
   CREATE DATABASE timetable_db;
   ```

---

## 📦 Project Structure

```
Kagszo-SchoolTimeTable-main/
├── server.js                 # Main server file
├── db-mysql.js              # MySQL Database operations
├── emailService.js          # Email functionality
├── substitutionEngine.js    # Substitute teacher logic
├── utils/
│   └── dateUtils.js         # Date/time utilities
├── public/
│   ├── admin/               # Admin portal files
│   └── user/                # User portal files
├── package.json             # Dependencies
├── .env                     # Database config variables (ignored in git)
└── README.md               # Project overview
```

## ✅ Checklist

Before running the application, ensure:
- [ ] Node.js is installed
- [ ] Dependencies are installed (`npm install`)
- [ ] MySQL database `timetable_db` is created
- [ ] `.env` file is configured with the correct MySQL credentials
- [ ] MySQL Server is actively running
