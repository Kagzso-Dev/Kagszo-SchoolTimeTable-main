const express = require('express');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const moment = require('moment');
const { generateSubstituteTimetable } = require('./substitutionEngine');
const {
  notifyAdminLeaveApplication,
  notifyTeacherLeaveApproval,
  notifyTeacherLeaveRejection,
  notifySubstituteTeacher,
  notifyAdminLeaveCancellation,
  notifyBulkSubstitutions,
  emailEnabled
} = require('./emailService');
// Using MySQL database
const dbModule = require('./db-mysql');
const {
  ensureTeacherColumns,
  getSchoolConfig,
  saveSchoolConfig,
  getTeachers,
  addTeacher,
  updateTeacher,
  deleteTeacher,
  formatTeachersForExcel,
  getAdmins,
  getAdminByUsername,
  getLeaveRequests,
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
  verifyPassword
} = dbModule;

// Import IST date utilities
const { getISTTimestamp, toIST, formatISTDate } = require('./utils/dateUtils');

dbModule.initPromise
  .then(() => { console.log('✅ Database ready'); })
  .catch(err => {
    console.error('❌ Database initialization error:', err);
    process.exit(1);
  });

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

// ── Change tracker for real-time polling ──────────────────────────────────────
// Clients poll /api/poll every few seconds and compare these timestamps.
// Call changed('leaves'), changed('timetable'), changed('teachers') after mutations.
const _pollState = { leaves: Date.now(), timetable: Date.now(), teachers: Date.now() };
function changed(key) { _pollState[key] = Date.now(); }
// ─────────────────────────────────────────────────────────────────────────────

// Serve static files
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Middleware to ensure database is initialized before processing API requests
app.use('/api/*', async (req, res, next) => {
  try {
    await dbModule.initPromise;
    next();
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database not ready', error: err.message });
  }
});

// Also protect config routes
app.use('/config/*', async (req, res, next) => {
  try {
    await dbModule.initPromise;
    next();
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database not ready', error: err.message });
  }
});

// Serve static files with proper MIME types - use absolute paths
app.use('/user', express.static(path.join(__dirname, 'public', 'user')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use('/common', express.static(path.join(__dirname, 'public', 'common')));

const CONFIG_XLSX = path.join(__dirname, 'config', 'config.xlsx');
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'timetable.json');
const PUBLISHED_JSON = path.join(OUTPUT_DIR, 'published.json');
const SUB_DRAFT = path.join(OUTPUT_DIR, 'timetable_substitute.json');
const SUB_PUB = path.join(OUTPUT_DIR, 'published_substitute.json');

// ===============================
// ✅ Helper functions
// ===============================
async function readWorkbook() {
  const school = await getSchoolConfig() || {};
  const teachers = formatTeachersForExcel(await getTeachers());
  const admins = await getAdmins();
  const versions = await getVersions();
  const classes = await getClassTimetables();
  return { school, teachers, admins, versions, classes };
}

function writeTeachersSheet(wb, teachers) {
  wb.Sheets['Teachers'] = XLSX.utils.json_to_sheet(teachers);
}

function writeClassSheet(wb, className, rows) {
  const sheetName = 'Class_' + className;
  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
}

function removeClassSheet(wb, className) {
  const sheetName = 'Class_' + className;
  if (wb.Sheets[sheetName]) delete wb.Sheets[sheetName];
}

function generatePeriods(school) {
  const start = moment(school['School Start time'], 'h.mmA');
  const total = parseInt(school['Total Periods'] || 0);
  const mins = parseInt((school['Time/periods'] || '').match(/\d+/) || 30);
  const periods = [];
  let curr = start.clone();
  for (let i = 1; i <= total; i++) {
    const sstr = curr.format('h.mmA');
    const estr = curr.clone().add(mins, 'minutes').format('h.mmA');
    periods.push({ period: i, time: sstr + '-' + estr, start: sstr, end: estr });
    curr.add(mins, 'minutes');
  }
  return periods;
}

function buildClassTimetable(data) {
  const periods = generatePeriods(data.school);
  const teacherMap = {};
  data.teachers.forEach(t => {
    const subj = (t['Subject'] || '').toString().trim().toLowerCase();
    const classes = (t['Class'] || '').toString().split(',').map(x => x.trim());
    classes.forEach(c => {
      const key = c.toUpperCase();
      if (!teacherMap[key]) teacherMap[key] = {};
      teacherMap[key][subj] = t['Teachers Name'];
    });
  });

  const out = [];
  Object.entries(data.classes).forEach(([className, rows]) => {
    const classKey = className.toUpperCase();
    rows.forEach(row => {
      periods.forEach(p => {
        const subj = row['Period ' + p.period] || row['Period ' + p.period.toString()];
        if (subj && subj.toString().trim() !== '') {
          const sub = subj.toString().trim();
          const teacher =
            (teacherMap[classKey] && teacherMap[classKey][sub.toLowerCase()]) || 'Not Assigned';
          out.push({ class: className, day: row['Day'], period: p.period, subject: sub, teacher, time: p.time });
        }
      });
    });
  });
  return out;
}

function ensureOutput() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
// ✅ Helper to check if a date is today or in the future
function isFutureOrToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d >= today;
}


// ===============================
// ✅ API Routes
// ===============================

// Poll endpoint — clients call this every few seconds to detect changes
app.get('/api/poll', (_req, res) => {
  res.json({ ..._pollState });
});

// Base routes - handle root and HTML files
// Root → redirect to admin portal first
app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.get('/user', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'user', 'index.html'));
  } catch (err) {
    console.error('Error serving /user:', err);
    res.status(500).send('Error loading page');
  }
});

app.get('/user/index.html', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'user', 'index.html'));
  } catch (err) {
    console.error('Error serving /user/index.html:', err);
    res.status(500).send('Error loading page');
  }
});

app.get('/admin', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
  } catch (err) {
    console.error('Error serving /admin:', err);
    res.status(500).send('Error loading page');
  }
});

app.get('/admin/index.html', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
  } catch (err) {
    console.error('Error serving /admin/index.html:', err);
    res.status(500).send('Error loading page');
  }
});

// Config read
app.get('/config', async (req, res) => {
  try {
    const d = await readWorkbook();
    res.json({ school: d.school, teachers: d.teachers, classes: d.classes, versions: d.versions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate timetable
app.get('/generate', async (req, res) => {
  try {
    const data = await readWorkbook();
    const timetable = buildClassTimetable(data);
    ensureOutput();
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(timetable, null, 2));
    res.json({ success: true, timetable });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get generated timetable
app.get('/timetable', (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_JSON)) return res.json({ timetable: [] });
    const t = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
    res.json({ timetable: t });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get published timetable
app.get('/published', async (req, res) => {
  try {
    // 1️⃣ Load published timetable (prefer PUBLISHED_JSON, fallback to OUTPUT_JSON)
    let baseTimetable = [];
    let publishedAt = null;
    
    if (fs.existsSync(PUBLISHED_JSON)) {
      // Use published timetable if it exists
      const fileContent = fs.readFileSync(PUBLISHED_JSON, 'utf8');
      baseTimetable = JSON.parse(fileContent);
      console.log(`✅ Loaded published.json: ${baseTimetable.length} entries`);
      
      // Get published_at from file stats or versions
      const stats = fs.statSync(PUBLISHED_JSON);
      publishedAt = stats.mtime.toISOString();
      
      // Try to get published_at from versions table
      try {
        const versions = await getVersions();
        if (versions.length > 0) {
          const latestVersion = versions[versions.length - 1];
          if (latestVersion.published_at) {
            publishedAt = latestVersion.published_at;
          }
        }
      } catch (e) {
        console.warn('Could not get published_at from versions:', e.message);
      }
    } else if (fs.existsSync(OUTPUT_JSON)) {
      // Fallback to generated timetable if published doesn't exist
      const fileContent = fs.readFileSync(OUTPUT_JSON, 'utf8');
      baseTimetable = JSON.parse(fileContent);
      console.log(`⚠️ Using timetable.json (published.json not found): ${baseTimetable.length} entries`);
    } else {
      console.warn('❌ No timetable files found (neither published.json nor timetable.json)');
      return res.json({ timetable: [], published_at: null });
    }
    
    // Validate timetable structure
    if (!Array.isArray(baseTimetable)) {
      console.error('❌ Timetable is not an array:', typeof baseTimetable);
      return res.status(500).json({ error: 'Invalid timetable format: expected array' });
    }
    
    if (baseTimetable.length === 0) {
      console.warn('⚠️ Timetable is empty');
    }

    // 2️⃣ Load data from database
    let teachers = [];
    let leaves = [];
    try {
      const teachersData = await getTeachers();
      const leavesData = await getLeaveRequests();
      teachers = formatTeachersForExcel(teachersData);
      leaves = formatLeavesForExcel(leavesData);
      console.log(`✅ Loaded ${teachers.length} teachers, ${leaves.length} leaves`);
    } catch (err) {
      console.error('⚠️ Error loading teachers/leaves from database:', err);
      console.error('Error details:', err.message);
      // Continue with empty arrays - timetable will still work without substitutions
      teachers = [];
      leaves = [];
    }

    // 3️⃣ Split leaves into approved & pending
    const approved = leaves.filter(l => (l.Status || '').toLowerCase() === 'approved');
    const pending = leaves.filter(l => (l.Status || '').toLowerCase() === 'pending');

    // Helper to compute DayNames from dates
    function expandDays(leave) {
      // Handle different date field name formats
      const startDate = leave.StartDate || leave.start_date || leave['Start Date'] || leave.leave_date;
      const endDate = leave.EndDate || leave.end_date || leave['End Date'] || leave.leave_date;
      
      if (!startDate || !endDate) {
        console.warn('⚠️ Leave missing dates:', leave);
        return { ...leave, DayNames: [] };
      }
      
      try {
        const s = new Date(startDate);
        const e = new Date(endDate);
        
        if (isNaN(s.getTime()) || isNaN(e.getTime())) {
          console.warn('⚠️ Invalid date format in leave:', leave);
          return { ...leave, DayNames: [] };
        }
        
        const dayNames = [];
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          const day = d.toLocaleString('en-US', { weekday: 'long' });
          if (!dayNames.includes(day)) dayNames.push(day);
        }
        return { ...leave, DayNames: dayNames, StartDate: startDate, EndDate: endDate };
      } catch (err) {
        console.warn('⚠️ Error processing leave dates:', err, leave);
        return { ...leave, DayNames: [] };
      }
    }

   // ✅ Keep only leaves that are ongoing or future
const approvedLeaves = approved
  .map(expandDays)
  .filter(l => {
    const endDate = l.EndDate || l.end_date || l['End Date'] || l.leave_date;
    return endDate && isFutureOrToday(endDate);
  });

const pendingLeaves = pending
  .map(expandDays)
  .filter(l => {
    const endDate = l.EndDate || l.end_date || l['End Date'] || l.leave_date;
    return endDate && isFutureOrToday(endDate);
  });


    // 4️⃣ Apply approved substitutions (final)
    let afterApproved = baseTimetable;
    if (approvedLeaves.length > 0 && typeof generateSubstituteTimetable === 'function') {
      try {
        const result = generateSubstituteTimetable(baseTimetable, teachers, approvedLeaves, false);
        afterApproved = (result && result.draft) ? result.draft : baseTimetable;
      } catch (err) {
        console.error('⚠️ Error applying approved substitutions:', err);
        console.error('Error details:', err.message, err.stack);
        afterApproved = baseTimetable;
      }
    }

    // 5️⃣ Apply pending substitutions (preview)
    let afterPending = afterApproved;
    if (pendingLeaves.length > 0 && typeof generateSubstituteTimetable === 'function') {
      try {
        const result = generateSubstituteTimetable(afterApproved, teachers, pendingLeaves, true);
        afterPending = (result && result.draft) ? result.draft : afterApproved;
      } catch (err) {
        console.error('⚠️ Error applying pending substitutions:', err);
        console.error('Error details:', err.message, err.stack);
        afterPending = afterApproved;
      }
    }

    // 6️⃣ Return combined result
    console.log(`✅ Returning timetable: ${afterPending.length} entries`);
    return res.json({
      success: true,
      timetable: afterPending,
      published_at: publishedAt || new Date().toISOString(),
      version: 'with-previews',
    });

  } catch (e) {
    console.error('❌ Error in /published with previews:', e);
    console.error('Stack:', e.stack);
    res.status(500).json({ error: e.message });
  }
});

// Get pure published regular timetable without substitutions
app.get('/published_regular', (req, res) => {
  try {
    let baseTimetable = [];
    if (fs.existsSync(PUBLISHED_JSON)) {
      const fileContent = fs.readFileSync(PUBLISHED_JSON, 'utf8');
      baseTimetable = JSON.parse(fileContent);
    } else if (fs.existsSync(OUTPUT_JSON)) {
      const fileContent = fs.readFileSync(OUTPUT_JSON, 'utf8');
      baseTimetable = JSON.parse(fileContent);
    }
    res.json({ success: true, timetable: baseTimetable });
  } catch (e) {
    console.error('❌ Error in /published_regular:', e);
    res.status(500).json({ error: e.message });
  }
});


// ===============================
// ✅ Leave Management
// ===============================
app.post('/leave/apply', async (req, res) => {
  try {
    const { Teacher, StartDate, EndDate, Reason } = req.body;
    if (!Teacher || !StartDate || !EndDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // ✅ Add new entry (id will be auto-generated by database)
    const newEntry = {
      Teacher,
      StartDate,
      EndDate,
      Reason,
      Status: 'Pending',
    };

    // Insert leave request and get the auto-generated ID
    const generatedId = await addLeaveRequest(newEntry);
    
    // Format the ID as "LV001" for display (database uses integer, we format for frontend)
    const formattedId = `LV${String(generatedId).padStart(3, '0')}`;

    // Add formatted ID to entry for logging/email
    const entryWithId = { ...newEntry, id: formattedId };
    console.log('✅ Leave applied:', entryWithId);
    
    // 📧 Send email notification to admin (non-blocking)
    notifyAdminLeaveApplication(entryWithId).catch(err => {
      console.error('Email notification failed:', err);
    });
    
    changed('leaves');
    res.json({ success: true, id: formattedId, dbId: generatedId });
  } catch (error) {
    console.error('❌ Error in /leave/apply:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


app.get('/leave/list', async (req, res) => {
  try {
    const leaves = formatLeavesForExcel(await getLeaveRequests());
    res.json({ leaves });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper for publishing substitute
function writePublishedFromDraft(draftPath, publishedPath, audit, leaveObj) {
  try {
    if (!fs.existsSync(draftPath)) return false;
    const raw = fs.readFileSync(draftPath, 'utf8');
    const draft = JSON.parse(raw);
    draft.forEach(c => {
      if (c._orig_teacher) {
        c.substitute_for = c._orig_teacher;
        c.sub_reason = (leaveObj && leaveObj.Reason) ? leaveObj.Reason : 'Leave';
      }
    });
    fs.writeFileSync(publishedPath, JSON.stringify(draft, null, 2));
    const auditPath = path.join(path.dirname(publishedPath), 'substitute_audit.json');
    fs.writeFileSync(auditPath, JSON.stringify(audit || [], null, 2));
    return true;
  } catch (e) {
    console.error('writePublishedFromDraft error', e);
    return false;
  }
}

// ✅ Update leave status (Approve / Reject)
app.post('/leave/update', async (req, res) => {
  try {
    const { id, status, approvedBy } = req.body;
    console.log(`🔄 Leave update request: id=${id} (type: ${typeof id}), status=${status}, approvedBy=${approvedBy}`);
    
    const leaves = await getLeaveRequests();
    console.log(`📋 Total leaves in database: ${leaves.length}`);
    
    // Handle both integer IDs (from database) and formatted IDs (like "LV013")
    // If ID is formatted like "LV013", extract the number part
    let searchId = id;
    if (typeof id === 'string' && id.startsWith('LV')) {
      const numPart = id.replace('LV', '');
      const numericId = parseInt(numPart, 10);
      if (!isNaN(numericId)) {
        searchId = numericId;
        console.log(`📝 Converted formatted ID "${id}" to numeric ID: ${searchId}`);
      }
    }
    
    const leave = leaves.find(l => {
      const dbId = String(l.id);
      const searchIdStr = String(searchId);
      return dbId === searchIdStr;
    });
    if (!leave) {
      console.error(`❌ Leave not found: id=${id}`);
      return res.status(404).json({ success: false, error: 'Leave not found' });
    }

    console.log('📋 Current leave data:', {
      id: leave.id,
      teacher: leave.teacher_name || leave.teacher,
      start_date: leave.start_date,
      end_date: leave.end_date,
      leave_date: leave.leave_date,
      status: leave.status
    });

    // Prepare update object with status and approval info
    const updateData = { status };
    
    // If status is Approved or Rejected, set approved_by and approved_date (in IST)
    if (status === 'Approved' || status === 'Rejected') {
      updateData.approved_by = approvedBy || 'Admin'; // Use provided admin name or default
      updateData.approved_date = getISTTimestamp(); // Current timestamp in IST
      
      // Also update leave_date to start_date if it's NULL (for backward compatibility)
      // Note: leave_date is a single DATE field, so we use start_date
      if (!leave.leave_date && leave.start_date) {
        updateData.leave_date = leave.start_date;
        console.log(`📅 Setting leave_date to start_date: ${leave.start_date}`);
      }
      
      console.log('✅ Update data:', updateData);
    }

    await updateLeaveRequest(id, updateData);
    console.log('✅ Leave updated in database');
    
    // Get updated leave
    const updatedLeaves = await getLeaveRequests();
    const updatedLeave = updatedLeaves.find(l => String(l.id) === String(id));
    
    if (!updatedLeave) {
      console.error(`❌ Could not retrieve updated leave: id=${id}`);
      return res.status(500).json({ success: false, error: 'Could not retrieve updated leave' });
    }
    
    console.log('✅ Updated leave retrieved:', {
      id: updatedLeave.id,
      teacher: updatedLeave.teacher_name || updatedLeave.teacher,
      start_date: updatedLeave.start_date,
      end_date: updatedLeave.end_date,
      leave_date: updatedLeave.leave_date,
      status: updatedLeave.status,
      approved_by: updatedLeave.approved_by,
      approved_date: updatedLeave.approved_date
    });

    // Auto-generate substitute if Approved
    if (status === 'Approved') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const s = new Date(updatedLeave.start_date);
      const e = new Date(updatedLeave.end_date);
      const dayNames = [];

      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const curr = new Date(d);
        curr.setHours(0, 0, 0, 0);
        if (curr >= today) {
          dayNames.push(curr.toLocaleString('en-US', { weekday: 'long' }));
        }
      }
      // ✅ Skip substitute generation if leave already ended
      if (dayNames.length === 0) {
        console.log(`⏩ Skipping substitute generation for past leave: ${updatedLeave.id}`);
        return res.json({
          success: true,
          updated: updatedLeave,
          note: "Leave is entirely in the past — no substitutes generated."
        });
      }

      const timetable = fs.existsSync(OUTPUT_JSON)
        ? JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'))
        : [];
      const teachers = formatTeachersForExcel(await getTeachers());

      // Map database field names to expected format for substitute generation
      const leaveObj = { 
        ...updatedLeave, 
        DayNames: dayNames, 
        Teacher: updatedLeave.teacher_name || updatedLeave.teacher, 
        StartDate: updatedLeave.start_date, 
        EndDate: updatedLeave.end_date, 
        Reason: updatedLeave.reason, 
        Status: updatedLeave.status 
      };
      
      console.log('🔄 Generating substitutes for leave:', {
        teacher: leaveObj.Teacher,
        startDate: leaveObj.StartDate,
        endDate: leaveObj.EndDate,
        days: dayNames
      });

      if (typeof generateSubstituteTimetable === 'function') {
        const { draft, audit } = generateSubstituteTimetable(timetable, teachers, [leaveObj]);
        ensureOutput();
        fs.writeFileSync(SUB_DRAFT, JSON.stringify(draft, null, 2));
        fs.writeFileSync(path.join(OUTPUT_DIR, 'substitute_audit.json'), JSON.stringify(audit, null, 2));
        writePublishedFromDraft(SUB_DRAFT, SUB_PUB, audit, leaveObj);
        
        // 📧 Send email notifications for substitutions (non-blocking)
        if (audit && audit.length > 0) {
          // Send individual emails to each substitute teacher
          audit.forEach(sub => {
            if (sub.substitute && sub.substitute !== 'UNASSIGNED') {
              notifySubstituteTeacher({
                substitute: sub.substitute,
                original: sub.original,
                class: sub.class,
                day: sub.day,
                period: sub.period,
                subject: sub.subject || 'N/A',
                sub_reason: sub.sub_reason || 'Leave'
              }).catch(err => {
                console.error('Substitution email failed:', err);
              });
            }
          });
        }
      } else {
        console.warn('⚠️ Substitute generation helpers not found — skipping auto-generation.');
      }
    }

    // 📧 Send email notification to teacher based on status
    // Map database field names to expected format for email functions
    // Format dates properly (avoid timezone issues)
    let startDateForEmail = updatedLeave.start_date;
    let endDateForEmail = updatedLeave.end_date;
    
    // Ensure dates are in YYYY-MM-DD format (no timezone conversion)
    if (startDateForEmail instanceof Date) {
      const year = startDateForEmail.getFullYear();
      const month = String(startDateForEmail.getMonth() + 1).padStart(2, '0');
      const day = String(startDateForEmail.getDate()).padStart(2, '0');
      startDateForEmail = `${year}-${month}-${day}`;
    } else if (typeof startDateForEmail === 'string') {
      startDateForEmail = startDateForEmail.split('T')[0].split(' ')[0];
    }
    
    if (endDateForEmail instanceof Date) {
      const year = endDateForEmail.getFullYear();
      const month = String(endDateForEmail.getMonth() + 1).padStart(2, '0');
      const day = String(endDateForEmail.getDate()).padStart(2, '0');
      endDateForEmail = `${year}-${month}-${day}`;
    } else if (typeof endDateForEmail === 'string') {
      endDateForEmail = endDateForEmail.split('T')[0].split(' ')[0];
    }
    
    const leaveForEmail = {
      Teacher: updatedLeave.teacher_name || updatedLeave.teacher,
      StartDate: startDateForEmail,
      EndDate: endDateForEmail,
      Reason: updatedLeave.reason,
      Status: updatedLeave.status
    };
    
    console.log('📧 Preparing to send email notification...');
    console.log('📧 Leave data for email:', JSON.stringify(leaveForEmail, null, 2));
    console.log('📧 Teacher name:', leaveForEmail.Teacher);
    console.log('📧 Start date:', leaveForEmail.StartDate);
    console.log('📧 End date:', leaveForEmail.EndDate);
    
    if (status === 'Approved') {
      console.log('📧 Sending approval email to teacher:', leaveForEmail.Teacher);
      notifyTeacherLeaveApproval(leaveForEmail)
        .then(result => {
          console.log('✅ Approval email sent successfully:', JSON.stringify(result, null, 2));
        })
        .catch(err => {
          console.error('❌ Approval email failed:', err);
          console.error('Error details:', err.message);
          if (err.stack) console.error('Stack:', err.stack);
        });
    } else if (status === 'Rejected') {
      console.log('📧 Sending rejection email to teacher:', leaveForEmail.Teacher);
      notifyTeacherLeaveRejection(leaveForEmail)
        .then(result => {
          console.log('✅ Rejection email sent successfully:', JSON.stringify(result, null, 2));
        })
        .catch(err => {
          console.error('❌ Rejection email failed:', err);
          console.error('Error details:', err.message);
          if (err.stack) console.error('Stack:', err.stack);
        });
    }

    changed('leaves');
    return res.json({ success: true, updated: updatedLeave });
  } catch (e) {
    console.error('❌ Error updating leave:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});
// ✅ New route for delete leave
app.post('/leave/delete', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.json({ success: false, message: "Missing leave id" });

    // Find the deleted leave for email notification
    const leaves = await getLeaveRequests();
    const deletedLeave = leaves.find(lv => String(lv.id) === String(id));
    
    if (!(await deleteLeaveRequest(id))) {
      return res.json({ success: false, message: "Leave not found" });
    }
    
    // 📧 Send email notification to admin about cancellation (non-blocking)
    if (deletedLeave) {
      notifyAdminLeaveCancellation(deletedLeave).catch(err => {
        console.error('Cancellation email failed:', err);
      });
    }

    console.log(`🗑️ Deleted leave ID: ${id}`);
    changed('leaves');
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error deleting leave:", err);
    res.json({ success: false, message: "Error deleting leave" });
  }
});


// ✅ Preview substitution (dry-run — no DB writes, no file writes)
app.post('/leave/preview-substitution', async (req, res) => {
  try {
    const { leaveId } = req.body;
    const leaves = await getLeaveRequests();

    let searchId = leaveId;
    if (typeof leaveId === 'string' && leaveId.startsWith('LV')) {
      const numericId = parseInt(leaveId.replace('LV', ''), 10);
      if (!isNaN(numericId)) searchId = numericId;
    }
    const leave = leaves.find(l => String(l.id) === String(searchId));
    if (!leave) return res.status(404).json({ success: false, error: 'Leave not found' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const s = new Date(leave.start_date);
    const e = new Date(leave.end_date);
    const dayNames = [];
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const curr = new Date(d); curr.setHours(0, 0, 0, 0);
      if (curr >= today) dayNames.push(curr.toLocaleString('en-US', { weekday: 'long' }));
    }

    if (dayNames.length === 0) {
      return res.json({ success: true, preview: [], teacher: leave.teacher_name || leave.teacher, dayNames: [], note: 'Past leave.' });
    }

    const timetable = fs.existsSync(OUTPUT_JSON) ? JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8')) : [];
    const teachers = formatTeachersForExcel(await getTeachers());
    const leaveObj = {
      ...leave,
      DayNames: dayNames,
      Teacher: leave.teacher_name || leave.teacher,
      StartDate: leave.start_date,
      EndDate: leave.end_date,
      Reason: leave.reason,
      Status: 'Approved'
    };

    if (typeof generateSubstituteTimetable !== 'function') {
      return res.json({ success: true, preview: [], teacher: leaveObj.Teacher, dayNames, note: 'Engine unavailable.' });
    }

    const { audit } = generateSubstituteTimetable(timetable, teachers, [leaveObj]);
    res.json({ success: true, preview: audit || [], teacher: leaveObj.Teacher, dayNames });
  } catch (err) {
    console.error('Preview substitution error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ===============================
// ✅ Publish (manual)
// ===============================
app.post('/publish', async (req, res) => {
  try {
    const body = req.body || {};
    const pwd = body.password;
    const admins = await getAdmins();
    const admin = admins.find(a => verifyPassword(pwd, a.password));
    if (!admin)
      return res.status(401).json({ success: false, error: 'Invalid password' });

    // Always regenerate fresh so teacher assignments are up to date
    try {
      const data = await readWorkbook();
      const timetable = buildClassTimetable(data);
      ensureOutput();
      fs.writeFileSync(OUTPUT_JSON, JSON.stringify(timetable, null, 2));
    } catch (genErr) {
      return res.status(400).json({ success: false, error: 'Failed to generate timetable: ' + genErr.message });
    }

    fs.copyFileSync(OUTPUT_JSON, PUBLISHED_JSON);
    const versions = await getVersions();
    const vid = (versions.length || 0) + 1;
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    await addVersion({ version_id: 'v' + vid, published_at: now, notes: body.notes || '' });
    changed('timetable');
    res.json({ success: true, published_at: now });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===============================
// ✅ Admin Teacher/Class Management
// ===============================

// Save class timetable
app.post('/classes/save', async (req, res) => {
  try {
    const { className, rows } = req.body;
    if (!className || !rows) {
      return res.status(400).json({ success: false, message: 'Missing className or rows' });
    }
    
    await saveClassTimetable(className, rows);
    console.log(`✅ Saved class timetable: ${className} (${rows.length} rows)`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error saving class timetable:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/teachers/add", async (req, res) => {
  try {
    const { name, subject, classes, contact } = req.body;

    if (!name || !subject || !classes) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newTeacher = {
      name,
      subject,
      classes,
      contact: contact || "",
      email: req.body.email || "",
      type: "teaching",
      password: req.body.password || null
    };

    await addTeacher(newTeacher);

    console.log("✅ Added new teacher:", newTeacher);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error adding teacher:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// Run DB migrations on demand (adds photo/username columns if missing)
app.post('/admin/run-migration', async (_req, res) => {
  try {
    await ensureTeacherColumns();
    res.json({ success: true, message: 'Migration complete — photo and username columns ready.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/teachers/update', async (req, res) => {
  try {
    const { originalName, updates } = req.body;
    if (!originalName || !updates) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    let result;
    try {
      result = await updateTeacher(originalName, updates);
    } catch (dbErr) {
      // Missing column (photo/username not yet added) — migrate and retry once
      if (dbErr.code === 'ER_BAD_FIELD_ERROR' || (dbErr.message && dbErr.message.includes('Unknown column'))) {
        console.log('⚠️ Missing column detected — running auto-migration...');
        await ensureTeacherColumns();
        result = await updateTeacher(originalName, updates);
      } else {
        throw dbErr;
      }
    }

    if (!result) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    console.log(`✅ Updated teacher "${originalName}"`);
    changed('teachers');
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error updating teacher:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/teachers/delete', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Missing teacher name' });

    if (!(await deleteTeacher(name))) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    console.log(`✅ Deleted teacher "${name}"`);
    changed('teachers');
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error deleting teacher:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});


app.post('/classes/add', async (req, res) => {
  try {
    const body = req.body || {};
    const className = body.className;
    const rows = body.rows || [];
    await saveClassTimetable(className, rows);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/classes/delete', async (req, res) => {
  try {
    const body = req.body || {};
    const className = body.className;
    if (!(await deleteClassTimetable(className))) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// ✅ Save (update) class timetable directly from UI
app.post("/classes/save", async (req, res) => {
  try {
    const { className, rows } = req.body;

    if (!className || !Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: "Missing or invalid className/rows" });
    }

    await saveClassTimetable(className, rows);

    console.log(`✅ Saved timetable for class: ${className}`);
    res.json({ success: true, message: `Class ${className} saved successfully.` });
  } catch (err) {
    console.error("❌ Error saving class timetable:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// ✅ Email Test Endpoint
// ===============================
app.post("/email/test", async (req, res) => {
  const { sendEmail } = require('./emailService');
  // Get default email from admin config or use provided email
  let defaultEmail = 'karthickg.3000@gmail.com';
  try {
    const admins = await getAdmins();
    if (admins.length > 0 && admins[0].email) {
      defaultEmail = admins[0].email;
    }
  } catch (e) {
    console.warn('Could not get admin email for default:', e.message);
  }
  const { to = defaultEmail } = req.body;
  
  const subject = 'Test Email - Timetable System';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✅ Test Email</h2>
        </div>
        <div class="content">
          <p>This is a test email from the Timetable Management System.</p>
          <p>If you received this, your email configuration is working correctly!</p>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            Sent at: ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    const result = await sendEmail(to, subject, html);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
// ✅ Analytics & Reports Endpoints
// ===============================
app.get("/analytics/overview", async (req, res) => {
  try {
    const teachers = await getTeachers();
    const leaves = await getLeaveRequests();
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const stats = {
      totalTeachers: teachers.length,
      pendingLeaves: leaves.filter(l => (l.status || 'Pending') === 'Pending').length,
      approvedThisMonth: leaves.filter(l => {
        if (l.status !== 'Approved') return false;
        const leaveDate = new Date(l.start_date || l.end_date);
        return leaveDate.getMonth() === currentMonth && leaveDate.getFullYear() === currentYear;
      }).length,
      totalLeaves: leaves.length
    };
    
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/analytics/leaves", async (req, res) => {
  try {
    const leaves = formatLeavesForExcel(await getLeaveRequests());
    res.json({ success: true, leaves });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/analytics/attendance", async (req, res) => {
  try {
    const { teacher, month } = req.query;
    const teachers = await getTeachers();
    const leaves = await getLeaveRequests();
    
    let filteredTeachers = teachers;
    if (teacher && teacher !== 'all') {
      filteredTeachers = teachers.filter(t => t.name === teacher);
    }
    
    const [year, monthNum] = month ? month.split('-') : [new Date().getFullYear(), new Date().getMonth() + 1];
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);
    const totalDays = monthEnd.getDate();
    
    const attendance = filteredTeachers.map(t => {
      const teacherName = t.name;
      const teacherLeaves = leaves.filter(l => 
        l.teacher === teacherName && 
        new Date(l.start_date) >= monthStart && 
        new Date(l.end_date) <= monthEnd &&
        l.status === 'Approved'
      );
      
      let leaveDays = 0;
      teacherLeaves.forEach(leave => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        leaveDays += days;
      });
      
      return {
        teacher: teacherName,
        totalDays,
        workingDays: totalDays - leaveDays,
        leaveDays,
        attendancePercent: ((totalDays - leaveDays) / totalDays * 100).toFixed(1)
      };
    });
    
    res.json({ success: true, attendance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===============================
// ✅ Email Status Endpoint
// ===============================
app.get("/email/status", async (req, res) => {
  const { getAdminEmail, getTeacherEmail, getEmailConfigFromExcel, getEmailConfig, emailEnabled } = require('./emailService');
  
  // Test reading emails from Excel
  const adminEmail = getAdminEmail();
  const testTeacherEmail = getTeacherEmail('Kavitha'); // Test with a common name
  
  // Get email config from Excel
  const excelEmailConfig = getEmailConfigFromExcel();
  const currentConfig = getEmailConfig();
  
  // Read all teachers to see what's available
  let allTeachers = [];
  try {
    const teachers = await getTeachers();
    allTeachers = teachers.map(t => ({
      name: t.name,
      email: t.email || 'Not set'
    }));
  } catch (e) {
    console.error('Error reading teachers:', e);
  }
  
  // Read admin config (show all columns for debugging)
  let adminConfig = [];
  try {
    const admins = await getAdmins();
    adminConfig = admins.map(a => ({
      username: a.username,
      notificationEmail: a.email || 'Not set',
      emailUser: a.email || 'Not set (for sending emails)',
      emailPassword: a.email_password ? '***set***' : 'Not set',
      smtpHost: a.smtp_host || 'Not set (default: smtp.gmail.com)',
      smtpPort: a.smtp_port || 'Not set (default: 587)'
    }));
  } catch (e) {
    console.error('Error reading admin config:', e);
  }
  
  res.json({ 
    enabled: emailEnabled(),
    adminEmail: adminEmail,
    testTeacherEmail: testTeacherEmail,
    allTeachers: allTeachers,
    adminConfig: adminConfig,
    emailConfigFromExcel: {
      user: excelEmailConfig.user || 'NOT SET',
      password: excelEmailConfig.pass ? '***set***' : 'NOT SET',
      host: excelEmailConfig.host || 'NOT SET (using default: smtp.gmail.com)',
      port: excelEmailConfig.port || 'NOT SET (using default: 587)'
    },
    currentEmailConfig: {
      host: currentConfig.host,
      port: currentConfig.port,
      user: currentConfig.auth.user || 'NOT SET',
      password: currentConfig.auth.pass ? '***set***' : 'NOT SET'
    }
  });
});

//login details
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await getAdminByUsername(username);

    if (admin && verifyPassword(password, admin.password)) {
      res.json({ success: true, role: admin.role, permissions: admin.permissions });
    } else {
      res.json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// ✅ Save School Config
// ✅ Get school configuration
app.get("/config/get", async (req, res) => {
  try {
    const config = await getSchoolConfig();
    if (!config) return res.json({ success: false, message: "SchoolConfig not found" });

    res.json({
      success: true,
      config: {
        SchoolName: config["School Name"] || "",
        StartTime: config["School Start time"] || "",
        TotalPeriods: config["Total Periods"] || "",
        MinutesPerPeriod: (config["Time/periods"] || "").toString().replace(/[^0-9]/g, ""),
      },
    });
  } catch (err) {
    console.error("❌ Error reading config:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// ✅ Save school configuration
app.post("/config/save", async (req, res) => {
  try {
    const { SchoolName, StartTime, TotalPeriods, MinutesPerPeriod } = req.body;

    if (!SchoolName || !StartTime || !TotalPeriods || !MinutesPerPeriod) {
      return res.json({ success: false, message: "Missing required fields" });
    }

    await saveSchoolConfig({
      SchoolName,
      StartTime,
      TotalPeriods,
      MinutesPerPeriod
    });

    console.log("✅ Config saved");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error saving config:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


// ===============================
// ✅ Server start
// ===============================

module.exports = app;

const PORT = process.env.PORT || 3000;

dbModule.initPromise
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Database connection ready`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
        console.error(`💡 Suggestion: Close the app on port ${PORT} or set PORT=3001 npm start.\n`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
        process.exit(1);
      }
    });
  })
  .catch(err => {
    console.error('❌ Failed to initialize database. Server not started.');
    console.error(err);
    process.exit(1);
  });
