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
        // Remove surrounding quotes if present
        const cleanedValue = value.replace(/^['"]|['"]$/g, '');
        process.env[key] = cleanedValue;
      }
    });
    console.log('✅ Manually loaded environment variables from .env');
  }
} catch (e) {
  console.warn('⚠️ Could not parse .env file:', e.message);
}

const db = require('./db-mysql');

async function runTests() {
  console.log('🧪 Starting MySQL Database Parity and Functionality Tests...\n');

  try {
    // 1. Test Database Initialization
    console.log('1. Testing initDatabase()...');
    const initResult = await db.initPromise;
    console.log('   ✅ Initialization Success!\n');

    // 2. Test SchoolConfig Operations
    console.log('2. Testing SchoolConfig Operations...');
    const config = await db.getSchoolConfig();
    console.log('   - getSchoolConfig() output:', config);
    if (!config) {
      throw new Error('SchoolConfig is empty but should have been seeded.');
    }

    const testConfig = {
      SchoolName: 'Test Academy',
      StartTime: '09.00AM',
      TotalPeriods: 8,
      MinutesPerPeriod: 40
    };
    await db.saveSchoolConfig(testConfig);
    const updatedConfig = await db.getSchoolConfig();
    console.log('   - After saveSchoolConfig():', updatedConfig);
    if (updatedConfig['School Name'] !== 'Test Academy') {
      throw new Error('Failed to update SchoolConfig name');
    }
    // Restore seeded configuration for consistency
    await db.saveSchoolConfig({
      SchoolName: 'Sample High School',
      StartTime: '08.30AM',
      TotalPeriods: 6,
      MinutesPerPeriod: 45
    });
    console.log('   ✅ SchoolConfig Operations Passed!\n');

    // 3. Test Teachers Operations
    console.log('3. Testing Teachers Operations...');
    const teachers = await db.getTeachers();
    console.log(`   - Seeded teachers count: ${teachers.length}`);
    if (teachers.length === 0) {
      throw new Error('Teachers list is empty but should have been seeded.');
    }

    // Add a new teacher
    const newTeacherId = await db.addTeacher({
      name: 'Test Teacher',
      subject: 'Computer Science',
      classes: '11A,11B',
      contact: '9999999999',
      email: 'testteacher@example.com',
      type: 'teaching'
    });
    console.log(`   - addTeacher() success! ID: ${newTeacherId}`);

    // Retrieve teacher
    const fetchedTeacher = await db.getTeacherByName('Test Teacher');
    console.log('   - getTeacherByName() output:', fetchedTeacher.name, '-', fetchedTeacher.subject);
    if (!fetchedTeacher || fetchedTeacher.subject !== 'Computer Science') {
      throw new Error('Failed to fetch added teacher or subject mismatch');
    }

    // Update teacher
    const updateResult = await db.updateTeacher('Test Teacher', {
      subject: 'Advanced Robotics',
      contact: '8888888888'
    });
    console.log(`   - updateTeacher() result: ${updateResult}`);
    const updatedTeacher = await db.getTeacherByName('Test Teacher');
    if (updatedTeacher.subject !== 'Advanced Robotics') {
      throw new Error('Failed to update teacher subject');
    }

    // Format for Excel helper test
    const excelFormat = db.formatTeachersForExcel([updatedTeacher]);
    console.log('   - formatTeachersForExcel() sample:', excelFormat[0]);

    // Delete teacher
    const deleteResult = await db.deleteTeacher('Test Teacher');
    console.log(`   - deleteTeacher() result: ${deleteResult}`);
    const deletedTeacher = await db.getTeacherByName('Test Teacher');
    if (deletedTeacher) {
      throw new Error('Teacher was not deleted successfully');
    }
    console.log('   ✅ Teachers Operations Passed!\n');

    // 4. Test Admin Operations
    console.log('4. Testing Admin Operations...');
    const admins = await db.getAdmins();
    console.log(`   - Admins count: ${admins.length}`);
    const seededAdmin = await db.getAdminByUsername('admin');
    console.log('   - getAdminByUsername("admin") found password:', seededAdmin ? 'YES' : 'NO');
    if (!seededAdmin || !db.verifyPassword('kagzso@123', seededAdmin.password)) {
      throw new Error('Default admin credential missing or incorrect');
    }

    // Add another admin
    await db.addAdmin({
      username: 'testadmin',
      password: 'testpassword',
      role: 'Staff Admin',
      permissions: 'read-only',
      email: 'testadmin@example.com'
    });
    const fetchedAdmin = await db.getAdminByUsername('testadmin');
    if (!fetchedAdmin || fetchedAdmin.role !== 'Staff Admin' || !db.verifyPassword('testpassword', fetchedAdmin.password)) {
      throw new Error('Failed to add or fetch custom admin');
    }
    console.log('   ✅ Admin Operations Passed!\n');

    // 5. Test Leave Requests Operations
    console.log('5. Testing Leave Requests Operations...');
    const originalLeaves = await db.getLeaveRequests();
    console.log(`   - Active leave requests count: ${originalLeaves.length}`);

    // Add a leave
    const newLeaveId = await db.addLeaveRequest({
      Teacher: 'Jane Smith',
      StartDate: '2026-06-01',
      EndDate: '2026-06-03',
      Reason: 'Family Event',
      Status: 'Pending',
      LeaveType: 'Personal'
    });
    console.log(`   - addLeaveRequest() ID: ${newLeaveId}`);

    const leave = await db.getLeaveRequestById(newLeaveId);
    console.log('   - getLeaveRequestById() output:', leave.teacher_name, '-', leave.reason, '-', leave.status);
    if (!leave || leave.teacher_name !== 'Jane Smith') {
      throw new Error('Leave request fetch failed');
    }

    // Update leave request
    const leaveUpdateResult = await db.updateLeaveRequest(newLeaveId, {
      status: 'Approved',
      approved_by: 'admin',
      approved_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
    console.log(`   - updateLeaveRequest() result: ${leaveUpdateResult}`);
    const updatedLeave = await db.getLeaveRequestById(newLeaveId);
    if (updatedLeave.status !== 'Approved') {
      throw new Error('Leave status was not updated to Approved');
    }

    // Format for Excel helper test
    const formattedLeaves = db.formatLeavesForExcel([updatedLeave]);
    console.log('   - formatLeavesForExcel() sample:', formattedLeaves[0]);

    // Delete leave request
    const leaveDeleteResult = await db.deleteLeaveRequest(newLeaveId);
    console.log(`   - deleteLeaveRequest() result: ${leaveDeleteResult}`);
    const deletedLeave = await db.getLeaveRequestById(newLeaveId);
    if (deletedLeave) {
      throw new Error('Leave request was not deleted successfully');
    }
    console.log('   ✅ Leave Requests Operations Passed!\n');

    // 6. Test Class Timetables Operations (Dynamic Tables)
    console.log('6. Testing Class Timetable Operations (Dynamic Tables)...');
    
    const sampleTimetable = [
      { Day: 'Monday', 'Period 1': 'Math - John Doe', 'Period 2': 'English - Robert Johnson' },
      { Day: 'Tuesday', 'Period 1': 'Science - Jane Smith', 'Period 2': 'Math - John Doe' }
    ];

    console.log('   - Saving dynamic class timetable for Class "Test9X"...');
    await db.saveClassTimetable('Test9X', sampleTimetable);

    const fetchedTimetable = await db.getClassTimetable('Test9X');
    console.log(`   - getClassTimetable("Test9X") returned ${fetchedTimetable.length} rows:`, fetchedTimetable);
    if (fetchedTimetable.length !== 2 || fetchedTimetable[0]['Period 1'] !== 'Math - John Doe') {
      throw new Error('Dynamic Class timetable save or retrieval mismatch');
    }

    const allTimetables = await db.getClassTimetables();
    console.log('   - getClassTimetables() returned classes:', Object.keys(allTimetables));
    const matchedKey = Object.keys(allTimetables).find(k => k.toLowerCase() === 'test9x');
    if (!matchedKey) {
      throw new Error('Timetable not found in bulk list');
    }

    // Cleanup class table
    console.log('   - Cleaning up dynamic table for "Test9X"...');
    await db.deleteClassTimetable('Test9X');
    const postCleanupTimetable = await db.getClassTimetable('Test9X');
    if (postCleanupTimetable.length > 0) {
      throw new Error('Dynamic table cleanup failed');
    }
    console.log('   ✅ Class Timetable Operations Passed!\n');

    // 7. Test Version Operations
    console.log('7. Testing Version Operations...');
    const originalVersions = await db.getVersions();
    console.log(`   - Versions count: ${originalVersions.length}`);

    await db.addVersion({
      version_id: 'vTest',
      notes: 'Test execution log'
    });
    const updatedVersions = await db.getVersions();
    console.log(`   - After addVersion(), count: ${updatedVersions.length}`);
    if (updatedVersions.length === 0 || updatedVersions[0].version_id !== 'vTest') {
      throw new Error('Version tracking insert or retrieve failure');
    }
    console.log('   ✅ Version Operations Passed!\n');

    console.log('💯 ALL MYSQL TESTS PASSED SUCCESSFULLY! Parity is completely verified.');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
  } finally {
    if (db.pool) {
      await db.pool.end();
      console.log('👋 Database connection pool closed.');
    }
  }
}

runTests();
