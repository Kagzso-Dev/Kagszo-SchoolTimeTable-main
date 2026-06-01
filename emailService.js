/**
 * 📧 Email Service for Timetable System
 * Handles email notifications for leave and substitution
 */

const nodemailer = require('nodemailer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const CONFIG_XLSX = path.join(__dirname, 'config', 'config.xlsx');
const OUTPUT_JSON = path.join(__dirname, 'output', 'timetable.json');
const PUBLISHED_JSON = path.join(__dirname, 'output', 'published.json');

// Load environment variables (if using dotenv)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, continue without it
}

/**
 * Read email configuration from AdminConfig sheet
 */
function getEmailConfigFromExcel() {
  try {
    const wb = XLSX.readFile(CONFIG_XLSX);
    const admins = XLSX.utils.sheet_to_json(wb.Sheets['AdminConfig'] || [], { raw: false });
    if (admins.length > 0) {
      const admin = admins[0];
      
      // Debug: log all keys to see what's available
      console.log('AdminConfig keys:', Object.keys(admin));
      
      // Try different column name variations for Email
      let emailUser = admin['Email'] || admin['email'] || admin['EMAIL'] || admin['E-mail'] || admin['Email Address'] || '';
      
      // Handle Excel hyperlinks - if email is a hyperlink, extract the text
      if (emailUser && typeof emailUser === 'object') {
        emailUser = emailUser.text || emailUser.h || emailUser.toString();
      }
      
      // Try different column name variations for Email Password
      let emailPass = admin['Email Password'] || admin['email password'] || admin['EMAIL_PASSWORD'] || admin['EmailPassword'] || '';
      
      // Handle Excel hyperlinks for password (unlikely but just in case)
      if (emailPass && typeof emailPass === 'object') {
        emailPass = emailPass.text || emailPass.h || emailPass.toString();
      }
      
      // Remove spaces from password (Gmail App Passwords sometimes have spaces)
      if (emailPass) {
        emailPass = emailPass.toString().replace(/\s+/g, '');
      }
      
      const smtpHost = admin['SMTP Host'] || admin['smtp host'] || admin['SMTP_HOST'] || admin['SmtpHost'] || admin['Email Host'] || '';
      const smtpPort = admin['SMTP Port'] || admin['smtp port'] || admin['SMTP_PORT'] || admin['SmtpPort'] || admin['Email Port'] || '';
      
      return {
        user: emailUser ? emailUser.toString().trim() : '',
        pass: emailPass ? emailPass.toString().trim() : '',
        host: smtpHost ? smtpHost.toString().trim() : '',
        port: smtpPort ? parseInt(smtpPort.toString()) : null
      };
    }
  } catch (err) {
    console.error('Error reading email config from Excel:', err);
  }
  return { user: '', pass: '', host: '', port: null };
}

/**
 * Get email configuration (from Excel first, then environment variables, then defaults)
 */
function getEmailConfig() {
  // First, try to read from Excel
  const excelConfig = getEmailConfigFromExcel();
  
  // Use Excel config if available, otherwise fall back to environment variables
  const user = excelConfig.user || process.env.EMAIL_USER || '';
  const pass = excelConfig.pass || process.env.EMAIL_PASSWORD || '';
  const host = excelConfig.host || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = excelConfig.port || parseInt(process.env.EMAIL_PORT || '587');
  
  return {
    host: host,
    port: port,
    secure: false, // true for 465, false for other ports
    auth: {
      user: user,
      pass: pass
    }
  };
}

// Check if email is configured
let transporter = null;
let emailEnabled = false;
let currentEmailConfig = null;

function initEmailService() {
  // Get config (from Excel or env) - always fresh
  const config = getEmailConfig();
  currentEmailConfig = config; // Cache for reference, but getEmailConfig() returns fresh
  
  if (config.auth.user && config.auth.pass) {
    try {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass
        }
      });
      
      // Verify connection (async, but don't block)
      transporter.verify(function(error, success) {
        if (error) {
          console.error('❌ Email service verification failed:', error.message);
          console.error('   Error code:', error.code);
          console.error('   This usually means wrong password or Gmail App Password not set');
          emailEnabled = false;
          transporter = null;
        } else {
          emailEnabled = true;
          console.log('✅ Email service initialized and verified');
          console.log(`   Host: ${config.host}:${config.port}`);
          console.log(`   User: ${config.auth.user}`);
        }
      });
      
      // Set timeout - if verification doesn't complete in 5 seconds, assume it's working
      setTimeout(() => {
        if (transporter && !emailEnabled) {
          // Verification still in progress, set enabled anyway
          emailEnabled = true;
          console.log('✅ Email service initialized (verification in progress)');
          console.log(`   Host: ${config.host}:${config.port}`);
          console.log(`   User: ${config.auth.user}`);
        }
      }, 5000);
      
    } catch (err) {
      console.warn('⚠️ Email service not configured:', err.message);
      emailEnabled = false;
      transporter = null;
    }
  } else {
    console.warn('⚠️ Email credentials not set. Email notifications disabled.');
    console.warn('   Add Email and Email Password columns to AdminConfig sheet in Excel');
    emailEnabled = false;
    transporter = null;
  }
}

// Initialize on module load
initEmailService();

// Re-initialize function (call this after updating Excel)
function reinitEmailService() {
  initEmailService();
}

/**
 * Get admin email from config
 */
function getAdminEmail() {
  try {
    const wb = XLSX.readFile(CONFIG_XLSX);
    const admins = XLSX.utils.sheet_to_json(wb.Sheets['AdminConfig'] || [], { raw: false });
    if (admins.length > 0) {
      // Try different column name variations
      let email = admins[0]['Email'] || admins[0]['email'] || admins[0]['EMAIL'] || admins[0]['E-mail'] || admins[0]['Email Address'];
      
      // Handle Excel hyperlinks
      if (email && typeof email === 'object') {
        email = email.text || email.h || email.toString();
      }
      
      if (email && email.toString().trim() !== '') {
        return email.toString().trim();
      }
    }
    return null;
  } catch (err) {
    console.error('Error reading admin email:', err);
    return null;
  }
}

/**
 * Get teacher email from database (or Excel fallback)
 */
async function getTeacherEmail(teacherName) {
  try {
    if (!teacherName || !teacherName.trim()) {
      console.warn('⚠️ Empty teacher name provided to getTeacherEmail');
      return null;
    }
    
    const searchName = (teacherName || '').toString().trim().toLowerCase();
    console.log(`📧 Looking up email for teacher: "${teacherName}" (normalized: "${searchName}")`);
    
    // Try to get from database first
    try {
      const dbModule = require('./db-mysql');
        
        const teachers = await dbModule.getTeachers();
        console.log(`📧 Found ${teachers.length} teachers in database`);
        
        // Log first few teachers for debugging
        if (teachers.length > 0) {
          console.log('📧 Sample teachers:', teachers.slice(0, 3).map(t => ({
            name: t.name || t['Teachers Name'],
            email: t.email || t.Email || t['Email']
          })));
        }
        
        // Try exact match first
        let teacher = teachers.find(t => {
          const dbName = (t.name || t['Teachers Name'] || '').toString().trim().toLowerCase();
          return dbName === searchName;
        });
        
        // If not found, try partial match (in case of extra spaces or slight variations)
        if (!teacher) {
          teacher = teachers.find(t => {
            const dbName = (t.name || t['Teachers Name'] || '').toString().trim().toLowerCase();
            // Remove extra spaces and compare
            const normalizedDbName = dbName.replace(/\s+/g, ' ').trim();
            const normalizedSearchName = searchName.replace(/\s+/g, ' ').trim();
            return normalizedDbName === normalizedSearchName;
          });
        }
        
        if (teacher) {
          const email = teacher.email || teacher.Email || teacher['Email'] || '';
          if (email && email.trim() !== '') {
            console.log(`✅ Found teacher email from database: "${teacherName}" -> "${email}"`);
            console.log(`📧 Teacher details: name="${teacher.name || teacher['Teachers Name']}", email="${email}"`);
            return email.trim();
          } else {
            console.warn(`⚠️ Teacher "${teacherName}" found but email is empty`);
            console.warn(`📧 Teacher object:`, JSON.stringify(teacher, null, 2));
          }
        } else {
          console.warn(`⚠️ Teacher "${teacherName}" not found in database.`);
          console.warn(`📧 Available teachers:`, teachers.map(t => ({
            name: t.name || t['Teachers Name'],
            email: t.email || t.Email || t['Email'] || 'NO EMAIL'
          })));
        }
      } catch (dbErr) {
        console.error('❌ Error getting teacher email from database:', dbErr);
        console.warn('⚠️ Could not get teacher email from database, trying Excel:', dbErr.message);
        // Fall through to Excel fallback
      }
    
    // Fallback to Excel if database not available or failed
    try {
      const wb = XLSX.readFile(CONFIG_XLSX);
      const teachers = XLSX.utils.sheet_to_json(wb.Sheets['Teachers'] || []);
      const teacher = teachers.find(t => 
        (t['Teachers Name'] || '').toString().trim().toLowerCase() === 
        (teacherName || '').toString().trim().toLowerCase()
      );
      if (teacher) {
        // Try different column name variations
        const email = teacher['Email'] || teacher['email'] || teacher['EMAIL'] || teacher['E-mail'];
        if (email && email.trim() !== '') {
          console.log(`📧 Found teacher email from Excel: ${teacherName} -> ${email}`);
          return email.trim();
        }
      }
    } catch (excelErr) {
      console.warn('⚠️ Could not read Excel file:', excelErr.message);
    }
    
    console.warn(`⚠️ No email found for teacher: ${teacherName}`);
    return null;
  } catch (err) {
    console.error('❌ Error reading teacher email:', err);
    return null;
  }
}

/**
 * Get all admin emails
 */
function getAllAdminEmails() {
  try {
    const wb = XLSX.readFile(CONFIG_XLSX);
    const admins = XLSX.utils.sheet_to_json(wb.Sheets['AdminConfig'] || []);
    return admins
      .map(a => a['Email'])
      .filter(email => email && email.trim() !== '');
  } catch (err) {
    console.error('Error reading admin emails:', err);
    return [];
  }
}

/**
 * Generate HTML timetable view for a teacher
 */
function generateTeacherTimetableHTML(teacherName) {
  try {
    // Try to load published timetable first, fallback to regular
    let timetable = [];
    if (fs.existsSync(PUBLISHED_JSON)) {
      timetable = JSON.parse(fs.readFileSync(PUBLISHED_JSON, 'utf8'));
    } else if (fs.existsSync(OUTPUT_JSON)) {
      timetable = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
    }
    
    // Filter timetable for this teacher
    const teacherClasses = timetable.filter(t => 
      (t.teacher || '').toString().trim().toLowerCase() === 
      (teacherName || '').toString().trim().toLowerCase()
    );
    
    if (teacherClasses.length === 0) {
      return '<p style="color: #666;">No timetable found for this teacher.</p>';
    }
    
    // Group by day
    const byDay = {};
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    teacherClasses.forEach(item => {
      const day = item.day || 'Unknown';
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(item);
    });
    
    // Sort periods within each day
    days.forEach(day => {
      if (byDay[day]) {
        byDay[day].sort((a, b) => (a.period || 0) - (b.period || 0));
      }
    });
    
    // Generate HTML table
    let html = `
      <div style="margin-top: 20px; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
        <h3 style="background: #f3f4f6; padding: 15px; margin: 0; color: #1f2937; font-size: 16px;">
          📅 Timetable for ${teacherName}
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Day</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Period</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Time</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Subject</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Class</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    days.forEach(day => {
      if (byDay[day] && byDay[day].length > 0) {
        byDay[day].forEach((item, idx) => {
          const isSubstitute = item.substitute || item._orig_teacher;
          const bgColor = isSubstitute ? '#fff7e0' : (idx % 2 === 0 ? '#ffffff' : '#f9fafb');
          html += `
            <tr style="background: ${bgColor};">
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; ${idx === 0 ? 'font-weight: bold;' : ''}">${idx === 0 ? day : ''}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.period || 'N/A'}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${item.time || 'N/A'}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
                ${item.subject || 'N/A'}
                ${isSubstitute ? '<br/><small style="color: #f59e0b;">(Substitute)</small>' : ''}
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.class || 'N/A'}</td>
            </tr>
          `;
        });
      }
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    return html;
  } catch (err) {
    console.error('Error generating teacher timetable HTML:', err);
    return '<p style="color: #666;">Unable to load timetable.</p>';
  }
}

/**
 * Generate HTML timetable view for a class
 */
function generateClassTimetableHTML(className) {
  try {
    // Try to load published timetable first, fallback to regular
    let timetable = [];
    if (fs.existsSync(PUBLISHED_JSON)) {
      timetable = JSON.parse(fs.readFileSync(PUBLISHED_JSON, 'utf8'));
    } else if (fs.existsSync(OUTPUT_JSON)) {
      timetable = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
    }
    
    // Filter timetable for this class
    const classSchedule = timetable.filter(t => 
      (t.class || '').toString().trim() === (className || '').toString().trim()
    );
    
    if (classSchedule.length === 0) {
      return '<p style="color: #666;">No timetable found for this class.</p>';
    }
    
    // Group by day
    const byDay = {};
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    classSchedule.forEach(item => {
      const day = item.day || 'Unknown';
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(item);
    });
    
    // Sort periods within each day
    days.forEach(day => {
      if (byDay[day]) {
        byDay[day].sort((a, b) => (a.period || 0) - (b.period || 0));
      }
    });
    
    // Generate HTML table
    let html = `
      <div style="margin-top: 20px; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
        <h3 style="background: #f3f4f6; padding: 15px; margin: 0; color: #1f2937; font-size: 16px;">
          📅 Class ${className} Timetable
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Day</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Period</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Time</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Subject</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151;">Teacher</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    days.forEach(day => {
      if (byDay[day] && byDay[day].length > 0) {
        byDay[day].forEach((item, idx) => {
          const isSubstitute = item.substitute || item._orig_teacher;
          const bgColor = isSubstitute ? '#fff7e0' : (idx % 2 === 0 ? '#ffffff' : '#f9fafb');
          html += `
            <tr style="background: ${bgColor};">
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; ${idx === 0 ? 'font-weight: bold;' : ''}">${idx === 0 ? day : ''}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.period || 'N/A'}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${item.time || 'N/A'}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.subject || 'N/A'}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
                ${item.teacher || item.substitute || 'N/A'}
                ${isSubstitute ? '<br/><small style="color: #f59e0b;">(Substitute)</small>' : ''}
              </td>
            </tr>
          `;
        });
      }
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    return html;
  } catch (err) {
    console.error('Error generating class timetable HTML:', err);
    return '<p style="color: #666;">Unable to load timetable.</p>';
  }
}

/**
 * Send email (generic function)
 */
async function sendEmail(to, subject, html, text = '') {
  if (!emailEnabled || !transporter) {
    console.log('📧 Email not sent (service disabled):', { to, subject });
    return { success: false, message: 'Email service not configured' };
  }

  if (!to || !to.trim()) {
    console.log('📧 Email not sent (no recipient):', { to, subject });
    return { success: false, message: 'No recipient email' };
  }

  try {
    // Get fresh config in case it was updated
    const config = getEmailConfig();
    
    // Verify transporter is still valid, recreate if needed
    if (!transporter || !emailEnabled) {
      console.log('📧 Reinitializing email service...');
      initEmailService();
      if (!emailEnabled || !transporter) {
        return { success: false, message: 'Email service initialization failed' };
      }
    }

    const info = await transporter.sendMail({
      from: `"Timetable System" <${config.auth.user}>`,
      to: to,
      subject: subject,
      text: text || html.replace(/<[^>]*>/g, ''), // Plain text version
      html: html
    });

    console.log('✅ Email sent successfully:', { 
      to, 
      subject, 
      messageId: info.messageId,
      response: info.response 
    });
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    console.error('❌ Email send error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    return { 
      success: false, 
      message: error.message,
      code: error.code,
      details: error.response || error.toString()
    };
  }
}

/**
 * Send leave application notification to admin
 */
async function notifyAdminLeaveApplication(leaveData) {
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    console.log('⚠️ No admin email found, skipping notification');
    return { success: false, message: 'No admin email configured' };
  }

  const subject = `New Leave Application - ${leaveData.Teacher}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #6366f1; }
        .button { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>📅 New Leave Application</h2>
        </div>
        <div class="content">
          <p>Dear Admin,</p>
          <p>A new leave application has been submitted:</p>
          
          <div class="info-row">
            <span class="label">Teacher:</span> ${leaveData.Teacher}
          </div>
          <div class="info-row">
            <span class="label">Start Date:</span> ${leaveData.StartDate}
          </div>
          <div class="info-row">
            <span class="label">End Date:</span> ${leaveData.EndDate}
          </div>
          <div class="info-row">
            <span class="label">Reason:</span> ${leaveData.Reason || 'Not specified'}
          </div>
          <div class="info-row">
            <span class="label">Leave ID:</span> ${leaveData.id || 'N/A'}
          </div>
          
          <p style="margin-top: 20px;">Please review and approve/reject this leave request in the admin portal.</p>
          
          ${generateTeacherTimetableHTML(leaveData.Teacher)}
          
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            This is an automated notification from the Timetable Management System.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(adminEmail, subject, html);
}

/**
 * Send leave approval notification to teacher
 */
async function notifyTeacherLeaveApproval(leaveData) {
  // Handle both field name formats (Teacher vs teacher_name, StartDate vs start_date, etc.)
  const teacherName = leaveData.Teacher || leaveData.teacher_name || leaveData.teacher || '';
  const startDate = leaveData.StartDate || leaveData.start_date || '';
  const endDate = leaveData.EndDate || leaveData.end_date || '';
  const reason = leaveData.Reason || leaveData.reason || '';
  
  console.log(`📧 Looking up email for teacher: ${teacherName}`);
  const teacherEmail = await getTeacherEmail(teacherName);
  if (!teacherEmail) {
    console.log(`⚠️ No email found for teacher ${teacherName}, skipping notification`);
    return { success: false, message: 'No teacher email configured' };
  }
  
  console.log(`📧 Sending approval email to: ${teacherEmail} (${teacherName})`);

  const subject = `Leave Approved - ${startDate} to ${endDate}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #10b981; }
        .status { background: #d1fae5; color: #065f46; padding: 8px 12px; border-radius: 6px; display: inline-block; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✅ Leave Application Approved</h2>
        </div>
        <div class="content">
          <p>Dear ${teacherName},</p>
          <p>Your leave application has been <strong>approved</strong>.</p>
          
          <div class="status">✅ APPROVED</div>
          
          <div class="info-row">
            <span class="label">Start Date:</span> ${startDate}
          </div>
          <div class="info-row">
            <span class="label">End Date:</span> ${endDate}
          </div>
          <div class="info-row">
            <span class="label">Reason:</span> ${reason || 'Not specified'}
          </div>
          
          <p style="margin-top: 20px;">A substitute teacher will be assigned for your classes during this period.</p>
          
          ${generateTeacherTimetableHTML(teacherName)}
          
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            This is an automated notification from the Timetable Management System.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(teacherEmail, subject, html);
}

/**
 * Send leave rejection notification to teacher
 */
async function notifyTeacherLeaveRejection(leaveData) {
  // Handle both field name formats (Teacher vs teacher_name, StartDate vs start_date, etc.)
  const teacherName = leaveData.Teacher || leaveData.teacher_name || leaveData.teacher || '';
  const startDate = leaveData.StartDate || leaveData.start_date || '';
  const endDate = leaveData.EndDate || leaveData.end_date || '';
  const reason = leaveData.Reason || leaveData.reason || '';
  
  console.log(`📧 Looking up email for teacher: ${teacherName}`);
  const teacherEmail = await getTeacherEmail(teacherName);
  if (!teacherEmail) {
    console.log(`⚠️ No email found for teacher ${teacherName}, skipping notification`);
    return { success: false, message: 'No teacher email configured' };
  }
  
  console.log(`📧 Sending rejection email to: ${teacherEmail} (${teacherName})`);

  const subject = `Leave Application Status - ${startDate} to ${endDate}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #ef4444; }
        .status { background: #fee2e2; color: #991b1b; padding: 8px 12px; border-radius: 6px; display: inline-block; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>❌ Leave Application Status</h2>
        </div>
        <div class="content">
          <p>Dear ${teacherName},</p>
          <p>Your leave application has been <strong>rejected</strong>.</p>
          
          <div class="status">❌ REJECTED</div>
          
          <div class="info-row">
            <span class="label">Start Date:</span> ${startDate}
          </div>
          <div class="info-row">
            <span class="label">End Date:</span> ${endDate}
          </div>
          <div class="info-row">
            <span class="label">Reason:</span> ${reason || 'Not specified'}
          </div>
          
          <p style="margin-top: 20px;">Please contact the administration for more details.</p>
          
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            This is an automated notification from the Timetable Management System.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(teacherEmail, subject, html);
}

/**
 * Send substitution assignment notification to substitute teacher
 */
async function notifySubstituteTeacher(substitutionData) {
  console.log(`📧 Looking up email for substitute teacher: ${substitutionData.substitute}`);
  const substituteEmail = await getTeacherEmail(substitutionData.substitute);
  if (!substituteEmail) {
    console.log(`⚠️ No email found for substitute teacher ${substitutionData.substitute}, skipping notification`);
    return { success: false, message: 'No substitute teacher email configured' };
  }
  
  console.log(`📧 Sending substitution email to: ${substituteEmail} (${substitutionData.substitute})`);

  const subject = `Substitution Assignment - ${substitutionData.class} - ${substitutionData.day} Period ${substitutionData.period}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #f59e0b; }
        .assignment-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🔄 Substitution Assignment</h2>
        </div>
        <div class="content">
          <p>Dear ${substitutionData.substitute},</p>
          <p>You have been assigned as a substitute teacher for the following class:</p>
          
          <div class="assignment-box">
            <div class="info-row">
              <span class="label">Class:</span> ${substitutionData.class}
            </div>
            <div class="info-row">
              <span class="label">Day:</span> ${substitutionData.day}
            </div>
            <div class="info-row">
              <span class="label">Period:</span> ${substitutionData.period}
            </div>
            <div class="info-row">
              <span class="label">Subject:</span> ${substitutionData.subject || 'N/A'}
            </div>
            <div class="info-row">
              <span class="label">Substituting for:</span> ${substitutionData.original}
            </div>
            <div class="info-row">
              <span class="label">Reason:</span> ${substitutionData.sub_reason || 'Leave'}
            </div>
          </div>
          
          <p style="margin-top: 20px;">Please be prepared to take this class as scheduled.</p>
          
          ${generateClassTimetableHTML(substitutionData.class)}
          
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            This is an automated notification from the Timetable Management System.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(substituteEmail, subject, html);
}

/**
 * Send leave cancellation notification to admin
 */
async function notifyAdminLeaveCancellation(leaveData) {
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    console.log('⚠️ No admin email found, skipping notification');
    return { success: false, message: 'No admin email configured' };
  }

  const subject = `Leave Cancelled - ${leaveData.Teacher}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6b7280; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🚫 Leave Cancelled</h2>
        </div>
        <div class="content">
          <p>Dear Admin,</p>
          <p>A leave application has been <strong>cancelled</strong>:</p>
          
          <div class="info-row">
            <span class="label">Teacher:</span> ${leaveData.Teacher}
          </div>
          <div class="info-row">
            <span class="label">Start Date:</span> ${leaveData.StartDate}
          </div>
          <div class="info-row">
            <span class="label">End Date:</span> ${leaveData.EndDate}
          </div>
          <div class="info-row">
            <span class="label">Leave ID:</span> ${leaveData.id || 'N/A'}
          </div>
          
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            This is an automated notification from the Timetable Management System.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(adminEmail, subject, html);
}

/**
 * Send bulk substitution notifications
 */
async function notifyBulkSubstitutions(substitutions) {
  const results = [];
  
  // Group by substitute teacher
  const bySubstitute = {};
  substitutions.forEach(sub => {
    if (!sub.substitute || sub.substitute === 'UNASSIGNED') return;
    if (!bySubstitute[sub.substitute]) {
      bySubstitute[sub.substitute] = [];
    }
    bySubstitute[sub.substitute].push(sub);
  });

  // Send one email per substitute with all their assignments
  for (const [substituteName, assignments] of Object.entries(bySubstitute)) {
    console.log(`📧 Looking up email for substitute teacher: ${substituteName}`);
    const substituteEmail = await getTeacherEmail(substituteName);
    if (!substituteEmail) {
      console.log(`⚠️ No email for ${substituteName}, skipping`);
      continue;
    }
    
    console.log(`📧 Sending bulk substitution email to: ${substituteEmail} (${substituteName})`);

    const subject = `Substitution Assignments - ${assignments.length} class${assignments.length > 1 ? 'es' : ''}`;
    
    let assignmentsHtml = '';
    assignments.forEach(assignment => {
      assignmentsHtml += `
        <div class="assignment-box">
          <div class="info-row">
            <span class="label">Class:</span> ${assignment.class}
          </div>
          <div class="info-row">
            <span class="label">Day:</span> ${assignment.day} | <span class="label">Period:</span> ${assignment.period}
          </div>
          <div class="info-row">
            <span class="label">Substituting for:</span> ${assignment.original}
          </div>
          <div class="info-row">
            <span class="label">Reason:</span> ${assignment.sub_reason || 'Leave'}
          </div>
        </div>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #f59e0b; }
          .assignment-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🔄 Substitution Assignments</h2>
          </div>
          <div class="content">
            <p>Dear ${substituteName},</p>
            <p>You have been assigned as a substitute teacher for the following ${assignments.length} class${assignments.length > 1 ? 'es' : ''}:</p>
            
            ${assignmentsHtml}
            
            <p style="margin-top: 20px;">Please be prepared to take these classes as scheduled.</p>
            
            <p style="margin-top: 20px; color: #666; font-size: 12px;">
              This is an automated notification from the Timetable Management System.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail(substituteEmail, subject, html);
    results.push({ substitute: substituteName, ...result });
  }

  return results;
}

module.exports = {
  initEmailService,
  reinitEmailService,
  sendEmail,
  notifyAdminLeaveApplication,
  notifyTeacherLeaveApproval,
  notifyTeacherLeaveRejection,
  notifySubstituteTeacher,
  notifyAdminLeaveCancellation,
  notifyBulkSubstitutions,
  getAdminEmail,
  getTeacherEmail,
  getEmailConfigFromExcel,
  generateTeacherTimetableHTML,
  generateClassTimetableHTML,
  emailEnabled: () => emailEnabled,
  getEmailConfig: () => {
    // Always return fresh config from Excel, not cached
    return getEmailConfig();
  }
};

