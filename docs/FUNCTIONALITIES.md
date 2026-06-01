# 🎯 Functionalities Documentation

This document provides a comprehensive overview of all features and functionalities available in the School Timetable Management System.

---

## 📑 Table of Contents

1. [Admin Portal Features](#admin-portal-features)
2. [User Portal Features](#user-portal-features)
3. [Leave Management System](#leave-management-system)
4. [Timetable Management](#timetable-management)
5. [Reports & Analytics](#reports--analytics)
6. [Email Notifications](#email-notifications)
7. [Substitute Teacher Management](#substitute-teacher-management)
8. [API Endpoints](#api-endpoints)

---

## 👨‍💼 Admin Portal Features

### 1. Authentication & Access Control

**Location:** `/admin/index.html`

- **Login System**
  - Secure admin login with username and password
  - Session management
  - Auto-logout on browser close
  - Password visibility toggle

- **Access Levels**
  - Administrator role
  - Permission-based access (future enhancement)

### 2. School Configuration

**Features:**
- **School Information**
  - School name management
  - School-wide settings configuration
  
- **Timetable Settings**
  - Number of periods per day
  - Days per week
  - Start time and end time
  - Break time configuration
  - Minutes per period

**How to Use:**
1. Navigate to Admin Portal
2. Find "School Configuration" section
3. Update settings
4. Click "Save Configuration"

### 3. Teacher Management

**Features:**
- **Add Teachers**
  - Teacher name
  - Subject(s) taught
  - Assigned classes
  - Contact information
  - Email address
  - Login password
  - Teacher type (Full-time/Part-time)

- **Edit Teachers**
  - Inline editing of teacher information
  - Update any field directly
  - Save changes instantly

- **Delete Teachers**
  - Remove teachers from the system
  - Confirmation before deletion

**How to Use:**
1. Go to "Teachers" section
2. Click "Add Teacher" to create new teacher
3. Click on any cell to edit inline
4. Click "Delete" button to remove teacher

### 4. Class Timetable Editor

**Features:**
- **Create Class Timetables**
  - Support for multiple classes (9A, 9B, 10A, 10B, etc.)
  - Dynamic period support (P1, P2, P3, ... P8, etc.)
  - Days of the week management

- **Edit Timetables**
  - Add new rows (days)
  - Delete rows
  - Edit period assignments
  - Format: "Subject - Teacher Name"

- **Save & Publish**
  - Save draft timetables
  - Publish timetables for public viewing
  - Version control

**How to Use:**
1. Select class from dropdown
2. Edit timetable cells
3. Click "Add Row" to add new day
4. Click "Delete" to remove row
5. Click "Save Class" to save changes
6. Click "Publish" to make it public

### 5. Leave Request Management

**Features:**
- **View All Leave Requests**
  - Automatic display of all pending leaves
  - No dropdown selection needed
  - Real-time updates

- **Approve/Reject Leaves**
  - One-click approval
  - One-click rejection
  - Automatic card removal after action
  - Smooth fade-out animation

- **Leave History**
  - View all leave requests
  - Filter by teacher
  - Filter by status (Pending/Approved/Rejected)

**How to Use:**
1. Click "Toggle Leave Panel" button
2. View all pending leaves automatically
3. Click "Approve" or "Reject" on any card
4. Card disappears automatically after action

### 6. Reports & Analytics Dashboard

**Features:**
- **Overview Tab**
  - Total teachers count
  - Pending leaves count
  - Approved leaves (this month)
  - Top leave taker card
  - Clickable stat cards with details

- **Leave Trends Chart**
  - Cumulative wave area chart
  - Glassy violet color design
  - Date filter (start date and end date)
  - Interactive and modern UI
  - Shows leave trends over time

- **Leave History Tab**
  - Complete leave history table
  - Filter by date range
  - Sort by various columns
  - Export functionality (future)

- **Attendance & Visits Tab**
  - Teacher attendance tracking
  - Visit records
  - Horizontal card layout
  - Modern, attractive design
  - Clickable cards with popup details

- **Salary & Working Days Tab**
  - Calculate working days
  - Track overtime
  - Track substitutes taken
  - Useful for salary processing

- **Substitutes & Overtime Tab**
  - View all substitute assignments
  - Track overtime hours
  - Audit trail

**How to Use:**
1. Click "📊 Reports & Analytics" button
2. Navigate between tabs
3. Click on stat cards for details
4. Use date filters for charts
5. View detailed information in popups

### 7. Timetable Generation

**Features:**
- **Auto-Generate Timetables**
  - Generate timetables based on:
    - Teacher availability
    - Subject requirements
    - Class schedules
    - Period constraints

- **Draft Management**
  - Save as draft before publishing
  - Review and edit before publishing
  - Multiple draft versions

**How to Use:**
1. Configure teachers and classes
2. Click "Generate" button
3. Review generated timetable
4. Edit if needed
5. Click "Publish" to make it public

### 8. Navigation Features

**Features:**
- **Home Button**
  - Return to main dashboard
  - Hide all panels
  - Show configuration sections

- **Panel Toggle**
  - Toggle Leave Panel on/off
  - Toggle Reports Panel on/off
  - Smart panel management

- **Mobile Responsive**
  - Hamburger menu for mobile
  - Touch-optimized buttons
  - Responsive layout

---

## 👥 User Portal Features

### 1. Teacher Authentication

**Features:**
- **Login System**
  - Username (teacher name)
  - Password authentication
  - Session management
  - Auto-logout on browser close

**How to Use:**
1. Navigate to User Portal
2. Select teacher from dropdown (for timetable view)
3. Enter credentials when prompted
4. Access granted

### 2. Timetable Viewing

**Features:**
- **Class Timetable View**
  - View timetable by class
  - Search functionality
  - Filter by class name
  - Responsive table layout

- **Teacher Timetable View**
  - View personal timetable
  - See all assigned classes
  - See all periods
  - Highlight own classes

- **Substitute View**
  - Toggle between regular and substitute timetable
  - See substitute assignments
  - View substitution reasons

**How to Use:**
1. Click on class button (e.g., "9A", "10B")
2. View class timetable
3. Switch to "Teacher Timetable" tab
4. Select teacher to view their schedule
5. Toggle "Substitute Timetable" to see substitutions

### 3. Leave Application

**Features:**
- **Apply for Leave**
  - Restricted to logged-in teacher only
  - Pre-filled teacher name (disabled dropdown)
  - Date range selection (start date and end date)
  - Reason field (max 200 characters)
  - Password validation (if not logged in)

- **View Leave Status**
  - View all own leave requests
  - See approval status
  - View leave history
  - Cancel pending leaves

- **Leave Cards**
  - Visual cards showing leave details
  - Color-coded by status:
    - Orange: Pending
    - Green: Approved
    - Red: Rejected
  - Cancel button for pending leaves

**How to Use:**
1. Click "Leave Apply" button
2. Login if not already logged in
3. Select start and end dates
4. Enter reason
5. Click "Submit"
6. View leave cards with status

### 4. Search Functionality

**Features:**
- **Global Search**
  - Search by class name
  - Search by teacher name
  - Search by subject
  - Real-time filtering

**How to Use:**
1. Type in search box
2. Results filter automatically
3. Clear search to show all

### 5. Navigation Features

**Features:**
- **Home Button**
  - Return to main timetable view
  - Show class buttons
  - Hide leave section
  - Proper spacing maintained

- **Mobile Responsive**
  - Hamburger menu
  - Touch-optimized
  - Responsive design

---

## 📅 Leave Management System

### 1. Leave Application Flow

**Process:**
1. Teacher logs in to User Portal
2. Clicks "Leave Apply"
3. Fills leave form (dates, reason)
4. Submits leave request
5. Admin receives email notification
6. Leave appears in Admin Leave Panel
7. Admin approves/rejects
8. Teacher receives email notification
9. Leave status updated

### 2. Leave Approval Flow

**Process:**
1. Admin clicks "Toggle Leave Panel"
2. All pending leaves displayed automatically
3. Admin reviews leave details
4. Clicks "Approve" or "Reject"
5. Card disappears with animation
6. Email sent to teacher
7. Substitute timetable generated (if approved)
8. Database updated with approval details

### 3. Leave Status Tracking

**Statuses:**
- **Pending** - Awaiting admin approval
- **Approved** - Leave approved, substitutes assigned
- **Rejected** - Leave rejected by admin

### 4. Multi-Day Leave Support

**Features:**
- Support for single-day leaves
- Support for multi-day leaves (date range)
- Automatic calculation of leave days
- Proper date handling in IST timezone

---

## 📚 Timetable Management

### 1. Timetable Creation

**Methods:**
- **Manual Creation**
  - Use Class Timetable Editor
  - Add rows for each day
  - Assign subjects and teachers to periods

- **Auto-Generation**
  - Click "Generate" button
  - System creates timetable based on:
    - Teacher assignments
    - Subject requirements
    - Period constraints

### 2. Timetable Editing

**Features:**
- Inline editing
- Add/remove rows
- Add/remove periods dynamically
- Save as draft
- Publish when ready

### 3. Timetable Publishing

**Process:**
1. Create or edit timetable
2. Save as draft
3. Review timetable
4. Click "Publish" button
5. Enter admin password
6. Timetable becomes public
7. Version saved in database

### 4. Version Control

**Features:**
- Track timetable versions
b- Version history
- Version descriptions
- Publish timestamps

---

## 📊 Reports & Analytics

### 1. Overview Dashboard

**Metrics:**
- Total teachers count
- Pending leaves count
- Approved leaves (current month)
- Top leave taker

**Interactivity:**
- Clickable stat cards
- Popup with detailed information
- Real-time data updates

### 2. Leave Trends Chart

**Features:**
- Cumulative wave area chart
- Glassy violet color scheme
- Date range filter
- Interactive tooltips
- Modern, stunning design

### 3. Attendance & Visits

**Features:**
- Teacher attendance tracking
- Visit records
- Horizontal card layout
- Modern design
- Clickable for details

### 4. Salary & Working Days

**Features:**
- Calculate working days
- Track overtime hours
- Track substitutes taken
- Useful for payroll processing

### 5. Substitutes & Overtime

**Features:**
- View all substitute assignments
- Track overtime hours
- Audit trail
- Export functionality (future)

---

## 📧 Email Notifications

### 1. Leave Application Notification

**Recipients:**
- Admin (when teacher applies for leave)

**Content:**
- Teacher name
- Leave dates
- Reason
- Leave type

### 2. Leave Approval Notification

**Recipients:**
- Teacher (when leave is approved)

**Content:**
- Approval confirmation
- Leave dates
- Substitute teacher details (if assigned)
- Timetable view

### 3. Leave Rejection Notification

**Recipients:**
- Teacher (when leave is rejected)

**Content:**
- Rejection notice
- Leave dates
- Reason (if provided by admin)

### 4. Email Configuration

**Settings:**
- SMTP host
- SMTP port
- Email address
- Email password
- Stored in AdminConfig table

---

## 🔄 Substitute Teacher Management

### 1. Automatic Substitute Assignment

**Process:**
1. Leave is approved
2. System identifies affected periods
3. Applies substitute rules
4. Assigns substitute teachers
5. Generates substitute timetable
6. Updates published timetable

### 2. Substitute Rules

**Rule Types:**
- Same subject priority
- Free period priority
- Custom rules (configurable)

### 3. Substitute Audit Trail

**Features:**
- Track all substitutions
- View substitution history
- See substitution reasons
- Export substitution data

---

## 🔌 API Endpoints

### Authentication

- `POST /api/login` - Admin login
  - Body: `{ username, password }`
  - Returns: `{ success, role }`

### Configuration

- `GET /config` - Get school configuration
  - Returns: `{ school, teachers, classes, ... }`

- `POST /config/save` - Save school configuration
  - Body: `{ school, teachers, ... }`
  - Returns: `{ success }`

### Timetable

- `GET /published` - Get published timetable
  - Returns: `{ timetable, meta, leaves, ... }`

- `POST /generate` - Generate timetable
  - Returns: `{ timetable, count }`

- `POST /publish` - Publish timetable
  - Body: `{ password }`
  - Returns: `{ success }`

### Leave Management

- `GET /leave/list` - Get all leave requests
  - Returns: `{ leaves: [...] }`

- `POST /leave/apply` - Apply for leave
  - Body: `{ Teacher, StartDate, EndDate, Reason }`
  - Returns: `{ success, id }`

- `POST /leave/update` - Update leave status
  - Body: `{ id, status, approvedBy }`
  - Returns: `{ success }`

- `POST /leave/delete` - Cancel leave
  - Body: `{ id }`
  - Returns: `{ success }`

### Class Timetables

- `GET /classes/:className` - Get class timetable
  - Returns: `{ rows: [...] }`

- `POST /classes/save` - Save class timetable
  - Body: `{ className, rows }`
  - Returns: `{ success }`

### Email

- `POST /email/test` - Test email configuration
  - Body: `{ to, subject, message }`
  - Returns: `{ success }`

---

## 🎨 UI/UX Features

### 1. Modern Design

- Glassmorphism effects
- Smooth animations
- Gradient backgrounds
- Responsive layout

### 2. Mobile Optimization

- Touch-friendly buttons
- Hamburger menu
- Responsive tables
- Mobile-first design

### 3. User Feedback

- Toast notifications
- Loading indicators
- Success/error messages
- Smooth transitions

### 4. Accessibility

- Keyboard navigation
- Screen reader support
- High contrast mode
- Focus indicators

---

## 🔐 Security Features

### 1. Authentication

- Password-based login
- Session management
- Auto-logout

### 2. Authorization

- Role-based access
- Permission checks
- Secure API endpoints

### 3. Data Protection

- Input validation
- SQL injection prevention
- XSS protection

---

## 🚀 Future Enhancements

### Planned Features

1. **Password Hashing**
   - Bcrypt password hashing
   - Secure password storage

2. **Advanced Reports**
   - PDF export
   - Excel export
   - Custom report builder

3. **Calendar Integration**
   - Google Calendar sync
   - Outlook integration

4. **Mobile App**
   - Native mobile app
   - Push notifications

5. **Multi-School Support**
   - Support for multiple schools
   - School switching

6. **Advanced Analytics**
   - Machine learning insights
   - Predictive analytics

---

## 📝 Notes

- All dates are handled in IST (Indian Standard Time)
- Database uses PostgreSQL (Supabase)
- Email service uses Nodemailer
- Frontend uses vanilla JavaScript (no frameworks)
- Responsive design for all screen sizes

---

**Last Updated:** 2024
**Version:** 5.3


