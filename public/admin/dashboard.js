/**
 * 📊 Admin Dashboard & Analytics
 * Interactive dashboard for reports, analytics, and historical data
 */

// Dashboard initialization
let dashboardInitialized = false;

// Toggle Reports Panel
function initReportsPanel() {
  // Tab switching - only initialize tab buttons
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    // Remove existing listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', () => {
      const tabName = newBtn.dataset.tab;
      if (tabName) {
        switchTab(tabName);
      }
    });
  });

  // Wire up new rpt-tab pill buttons
  document.querySelectorAll('.rpt-tab').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.rpt-tab').forEach(b => b.classList.remove('active'));
      newBtn.classList.add('active');
      const tabId = newBtn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(t => {
        if (t.id !== 'tab-' + tabId) {
          t.classList.remove('active');
          t.style.display = 'none';
        }
      });
      const target = document.getElementById('tab-' + tabId);
      if (target) {
        target.classList.add('active');
        target.style.display = 'block';
      }
      // Also sync legacy tab-btn active state
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tabId);
      });
      // Load data for the activated tab
      if (tabId === 'overview') loadOverviewData();
      else if (tabId === 'leaves') loadLeaveHistory();
      else if (tabId === 'attendance') loadAttendanceData();
      else if (tabId === 'salary') loadSalaryData();
      else if (tabId === 'substitutes') loadSubstituteData();
    });
  });

  // Initialize dashboard if not already done
  if (!dashboardInitialized) {
    initDashboard();
    dashboardInitialized = true;
  }
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
  
  // Load data for active tab
  if (tabName === 'overview') {
    loadOverviewData();
  } else if (tabName === 'leaves') {
    loadLeaveHistory();
  } else if (tabName === 'attendance') {
    loadAttendanceData();
  } else if (tabName === 'salary') {
    loadSalaryData();
  } else if (tabName === 'substitutes') {
    loadSubstituteData();
  }
}

// Overview Tab
async function loadOverviewData() {
  if (typeof Loading === 'undefined') {
    return;
  }
  
  Loading.show('Loading dashboard data...');
  try {
    const [configRes, leavesRes] = await Promise.all([
      api('/config'),
      api('/leave/list')
    ]);
    
    const teachers = configRes.teachers || [];
    const leaves = leavesRes.leaves || [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Calculate stats
    const totalTeachers = teachers.length;
    const pendingLeaves = leaves.filter(l => (l.Status || 'Pending') === 'Pending').length;
    const approvedThisMonth = leaves.filter(l => {
      if (l.Status !== 'Approved') return false;
      const leaveDate = new Date(l.StartDate || l.EndDate);
      return leaveDate.getMonth() === currentMonth && leaveDate.getFullYear() === currentYear;
    }).length;
    
    // Calculate top leave taker
    const leaveCounts = {};
    leaves.filter(l => l.Status === 'Approved').forEach(leave => {
      const teacher = leave.Teacher;
      if (!leaveCounts[teacher]) leaveCounts[teacher] = 0;
      const start = new Date(leave.StartDate);
      const end = new Date(leave.EndDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      leaveCounts[teacher] += days;
    });
    
    const topLeaveTaker = Object.entries(leaveCounts).sort((a, b) => b[1] - a[1])[0];
    
    // Update stat cards
    document.getElementById('statTotalTeachers').textContent = totalTeachers;
    document.getElementById('statPendingLeaves').textContent = pendingLeaves;
    document.getElementById('statApprovedLeaves').textContent = approvedThisMonth;
    
    // Update top leave taker card
    if (topLeaveTaker) {
      const card = document.getElementById('topLeaveTakerCard');
      const value = document.getElementById('topLeaveTakerValue');
      const label = document.getElementById('topLeaveTakerLabel');
      if (card && value && label) {
        card.style.display = 'block';
        value.textContent = topLeaveTaker[1];
        label.textContent = `Top Leave Taker: ${topLeaveTaker[0]}`;
        // Store data for popup
        card.dataset.teacherName = topLeaveTaker[0];
        card.dataset.leaveDays = topLeaveTaker[1];
      }
    }
    
    // Store data for popups
    window.dashboardData = {
      totalTeachers,
      pendingLeaves,
      approvedThisMonth,
      leaves,
      teachers
    };
    
    // Make cards clickable
    setTimeout(() => {
      initClickableCards();
    }, 100);
    
    // Load leave trends chart
    setTimeout(() => {
      loadLeaveTrendsChart(leaves);
    }, 200);
    
  } catch (err) {
    Toast.error('Failed to load dashboard data');

  } finally {
    Loading.hide();
  }
}

// Leave Trends Chart - Cumulative Wave Area Chart with Glassy Violet Design (Like Screenshot)
function loadLeaveTrendsChart(leaves, startDate = null, endDate = null) {
  const canvas = document.getElementById('leaveTrendChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth || 800;
  const height = canvas.height = 350;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Determine date range
  let dateStart, dateEnd;
  if (startDate && endDate) {
    dateStart = new Date(startDate);
    dateEnd = new Date(endDate);
  } else {
    // Default: last 6 months
    dateEnd = new Date();
    dateStart = new Date();
    dateStart.setMonth(dateStart.getMonth() - 6);
  }
  
  // Group leaves by teacher for multiple series
  const teachers = [...new Set(leaves.map(l => l.Teacher))];
  const seriesData = {};
  
  teachers.forEach(teacher => {
    const teacherLeaves = leaves.filter(l => l.Teacher === teacher && l.Status === 'Approved');
    let cumulative = 0;
    seriesData[teacher] = [];
    
    for (let d = new Date(dateStart); d <= dateEnd; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      const dayLeaves = teacherLeaves.filter(l => {
        const leaveDate = new Date(l.StartDate || l.EndDate);
        return leaveDate.toISOString().split('T')[0] === dayStr;
      }).length;
      cumulative += dayLeaves;
      seriesData[teacher].push({ date: dayStr, value: cumulative });
    }
  });
  
  if (Object.keys(seriesData).length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No data available for selected date range', width / 2, height / 2);
    return;
  }
  
  const dataLength = Object.values(seriesData)[0]?.length || 0;
  
  if (dataLength === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No data available for selected date range', width / 2, height / 2);
    return;
  }
  
  // Calculate max value across all series
  let maxValue = 1;
  Object.values(seriesData).forEach(series => {
    series.forEach(point => {
      if (point.value > maxValue) maxValue = point.value;
    });
  });
  
  const padding = { top: 30, right: 40, bottom: 50, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Draw smooth area charts for each teacher (overlapping series) - Modern Interactive Design
  const colors = [
    { fill: 'rgba(139, 92, 246, 0.5)', stroke: 'rgba(139, 92, 246, 0.9)', glow: 'rgba(139, 92, 246, 0.3)' },
    { fill: 'rgba(124, 58, 237, 0.4)', stroke: 'rgba(124, 58, 237, 0.8)', glow: 'rgba(124, 58, 237, 0.25)' },
    { fill: 'rgba(168, 85, 247, 0.4)', stroke: 'rgba(168, 85, 247, 0.8)', glow: 'rgba(168, 85, 247, 0.25)' },
    { fill: 'rgba(196, 181, 253, 0.35)', stroke: 'rgba(196, 181, 253, 0.75)', glow: 'rgba(196, 181, 253, 0.2)' },
    { fill: 'rgba(99, 102, 241, 0.4)', stroke: 'rgba(99, 102, 241, 0.8)', glow: 'rgba(99, 102, 241, 0.25)' },
    { fill: 'rgba(129, 140, 248, 0.35)', stroke: 'rgba(129, 140, 248, 0.75)', glow: 'rgba(129, 140, 248, 0.2)' }
  ];
  
  // Store points for interactivity
  const interactivePoints = [];
  
  let colorIndex = 0;
  Object.entries(seriesData).forEach(([teacher, points]) => {
    if (points.length === 0) return;
    
    const colorScheme = colors[colorIndex % colors.length];
    
    // Create smooth bezier curve points
    const smoothPoints = [];
    points.forEach((point, i) => {
      const x = padding.left + (i / (points.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - (point.value / maxValue) * chartHeight;
      smoothPoints.push({ x, y, value: point.value, date: point.date, teacher });
    });
    
    // Draw area with beautiful gradient fill
    ctx.beginPath();
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, colorScheme.fill);
    gradient.addColorStop(0.5, colorScheme.fill.replace('0.5', '0.25').replace('0.4', '0.2').replace('0.35', '0.15'));
    gradient.addColorStop(1, colorScheme.fill.replace('0.5', '0.05').replace('0.4', '0.04').replace('0.35', '0.03'));
    
    // Draw smooth bezier curves
    smoothPoints.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        const prev = smoothPoints[i - 1];
        const cp1x = prev.x + (point.x - prev.x) * 0.3;
        const cp1y = prev.y;
        const cp2x = prev.x + (point.x - prev.x) * 0.7;
        const cp2y = point.y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, point.x, point.y);
      }
    });
    
    // Complete the area path
    ctx.lineTo(padding.left + chartWidth, height - padding.bottom);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.closePath();
    
    // Fill with gradient
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw line with enhanced glow effect
    ctx.beginPath();
    smoothPoints.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        const prev = smoothPoints[i - 1];
        const cp1x = prev.x + (point.x - prev.x) * 0.3;
        const cp1y = prev.y;
        const cp2x = prev.x + (point.x - prev.x) * 0.7;
        const cp2y = point.y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, point.x, point.y);
      }
    });
    
    ctx.strokeStyle = colorScheme.stroke;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    // Draw line without glow effect
    ctx.stroke();
    
    // Draw interactive data points without glow
    smoothPoints.forEach((point, i) => {
      if (i % Math.max(1, Math.floor(smoothPoints.length / 12)) === 0 || i === smoothPoints.length - 1) {
        // Main point
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = colorScheme.stroke;
        ctx.fill();
        
        // White border
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        interactivePoints.push(point);
      }
    });
    
    colorIndex++;
  });
  
  // Add interactivity - tooltip on hover
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find nearest point
    let nearest = null;
    let minDist = Infinity;
    interactivePoints.forEach(point => {
      const dist = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
      if (dist < 20 && dist < minDist) {
        minDist = dist;
        nearest = point;
      }
    });
    
    if (nearest) {
        canvas.style.cursor = 'pointer';
        canvas.title = `${nearest.teacher}: ${nearest.value} leaves (${nearest.date})`;
    } else {
        canvas.style.cursor = 'default';
        canvas.title = '';
    }
  });
  
  // Draw X-axis labels with clear text
  const labelInterval = Math.max(1, Math.floor(dataLength / 8));
  Object.values(seriesData)[0]?.forEach((point, i) => {
    if (i % labelInterval === 0 || i === dataLength - 1) {
      const x = padding.left + (i / (dataLength - 1)) * chartWidth;
      const date = new Date(point.date);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      // Clear text with background for better readability
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      // Add text background for clarity
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(x - textWidth / 2 - 4, height - padding.bottom + 2, textWidth + 8, 16);
      
      ctx.fillStyle = '#374151';
      ctx.fillText(label, x, height - padding.bottom + 4);
    }
  });
}

// Apply chart filter
window.applyChartFilter = function() {
  const startDate = document.getElementById('chartStartDate')?.value;
  const endDate = document.getElementById('chartEndDate')?.value;
  
  if (!startDate || !endDate) {
    Toast.warning('Please select both start and end dates');
    return;
  }
  
  api('/leave/list').then(res => {
    loadLeaveTrendsChart(res.leaves || [], startDate, endDate);
  });
};

// Reset chart filter
window.resetChartFilter = function() {
  document.getElementById('chartStartDate').value = '';
  document.getElementById('chartEndDate').value = '';
  api('/leave/list').then(res => {
    loadLeaveTrendsChart(res.leaves || []);
  });
};

// Leave History Tab
async function loadLeaveHistory() {
  Loading.show('Loading leave history...');
  try {
    const leavesRes = await api('/leave/list');
    const leaves = leavesRes.leaves || [];
    const filter = document.getElementById('leaveHistoryFilter')?.value || 'all';
    const monthFilter = document.getElementById('leaveHistoryMonth')?.value;
    
    let filteredLeaves = leaves;
    
    if (filter !== 'all') {
      filteredLeaves = leaves.filter(l => (l.Status || 'Pending').toLowerCase() === filter.toLowerCase());
    }
    
    if (monthFilter) {
      const [year, month] = monthFilter.split('-');
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      filteredLeaves = filteredLeaves.filter(l => {
        const leaveDate = new Date(l.StartDate || l.EndDate);
        return leaveDate >= monthStart && leaveDate <= monthEnd;
      });
    }
    
    // Sort by date (newest first)
    filteredLeaves.sort((a, b) => {
      const dateA = new Date(a.StartDate || a.EndDate);
      const dateB = new Date(b.StartDate || b.EndDate);
      return dateB - dateA;
    });
    
    renderLeaveHistoryTable(filteredLeaves);
    
  } catch (err) {
    Toast.error('Failed to load leave history');

  } finally {
    Loading.hide();
  }
}

function renderLeaveHistoryTable(leaves) {
  const container = document.getElementById('leaveHistoryTable');
  if (!container) return;
  
  if (leaves.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No leave records found.</p>';
    return;
  }
  
  let html = `
    <div class="table-responsive-wrapper">
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Teacher</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Days</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Applied On</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  leaves.forEach(leave => {
    const startDate = new Date(leave.StartDate);
    const endDate = new Date(leave.EndDate);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const status = leave.Status || 'Pending';
    const statusColor = status === 'Approved' ? 'green' : status === 'Rejected' ? 'red' : 'orange';
    
    html += `
      <tr>
        <td>${leave.id || 'N/A'}</td>
        <td><strong>${leave.Teacher}</strong></td>
        <td>${leave.StartDate}</td>
        <td>${leave.EndDate}</td>
        <td>${days} day${days > 1 ? 's' : ''}</td>
        <td class="reason-cell">${(leave.Reason || 'N/A').substring(0, 50)}${(leave.Reason || '').length > 50 ? '...' : ''}</td>
        <td><span style="color: ${statusColor}; font-weight: bold;">${status}</span></td>
        <td>${new Date(leave.StartDate).toLocaleDateString()}</td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = html;
}

// Attendance & Visits Tab
async function loadAttendanceData() {
  Loading.show('Loading attendance data...');
  try {
    const [configRes, leavesRes] = await Promise.all([
      api('/config'),
      api('/leave/list')
    ]);
    
    const teachers = configRes.teachers || [];
    const leaves = leavesRes.leaves || [];
    const monthFilter = document.getElementById('attendanceMonth')?.value;
    const teacherFilter = document.getElementById('teacherAttendanceFilter')?.value;
    
    let filteredTeachers = teachers;
    if (teacherFilter !== 'all') {
      filteredTeachers = teachers.filter(t => t['Teachers Name'] === teacherFilter);
    }
    
    renderAttendanceGrid(filteredTeachers, leaves, monthFilter);
    
  } catch (err) {
    Toast.error('Failed to load attendance data');

  } finally {
    Loading.hide();
  }
}

let attendanceViewMode = 'compact'; // 'compact' or 'table'

function renderAttendanceGrid(teachers, leaves, monthFilter) {
  const container = document.getElementById('attendanceGrid');
  const tableContainer = document.getElementById('attendanceTableContainer');
  if (!container) return;
  
  const today = new Date();
  const [year, month] = monthFilter ? monthFilter.split('-') : [today.getFullYear(), today.getMonth() + 1];
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const totalDays = monthEnd.getDate();
  
  const attendanceData = teachers.map(teacher => {
    const teacherName = teacher['Teachers Name'];
    const teacherLeaves = leaves.filter(l =>
      l.Teacher === teacherName &&
      new Date(l.StartDate) >= monthStart &&
      new Date(l.EndDate) <= monthEnd &&
      l.Status === 'Approved'
    );

    let leaveDays = 0;
    teacherLeaves.forEach(leave => {
      const start = new Date(leave.StartDate);
      const end = new Date(leave.EndDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      leaveDays += days;
    });

    const workingDays = totalDays - leaveDays;
    const attendancePercent = ((workingDays / totalDays) * 100).toFixed(1);

    return {
      teacher: teacherName,
      photo: teacher['Photo'] || teacher.photo || '',
      workingDays,
      leaveDays,
      totalDays,
      attendancePercent
    };
  });
  
  // Sort by attendance percentage (lowest first)
  attendanceData.sort((a, b) => parseFloat(a.attendancePercent) - parseFloat(b.attendancePercent));
  
  if (attendanceViewMode === 'table') {
    // Compact table view
    let html = `
      <table class="dashboard-table compact-table">
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Working Days</th>
            <th>Leave Days</th>
            <th>Total Days</th>
            <th>Attendance %</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    attendanceData.forEach(data => {
      const color = data.attendancePercent >= 90 ? 'green' : data.attendancePercent >= 75 ? 'orange' : 'red';
      html += `
        <tr>
          <td><strong>${data.teacher}</strong></td>
          <td>${data.workingDays}</td>
          <td>${data.leaveDays}</td>
          <td>${data.totalDays}</td>
          <td style="color: ${color}; font-weight: bold;">${data.attendancePercent}%</td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    tableContainer.innerHTML = html;
    container.style.display = 'none';
    tableContainer.style.display = 'block';
  } else {
    // Modern horizontal card view with attractive design
    let html = '<div class="attendance-horizontal-grid">';
    
    attendanceData.forEach(data => {
      const color = data.attendancePercent >= 90 ? 'green' : data.attendancePercent >= 75 ? 'orange' : 'red';
      const gradientClass = color === 'green' ? 'gradient-green' : color === 'orange' ? 'gradient-orange' : 'gradient-red';
      const icon = color === 'green' ? '✅' : color === 'orange' ? '⚠️' : '❌';
      const initials = data.teacher.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const avatarHtml = data.photo
        ? `<img src="${data.photo}" class="teacher-photo" alt="${data.teacher}"/>`
        : `<div class="teacher-initials">${initials}</div>`;

      html += `
        <div class="attendance-modern-card ${gradientClass}">
          <div class="modern-card-header">
            <div class="teacher-info">
              <div class="teacher-icon">${avatarHtml}</div>
              <div class="teacher-name">${data.teacher}</div>
            </div>
            <div class="attendance-percentage-badge ${color}">
              <span class="percentage-value">${data.attendancePercent}%</span>
              <span class="percentage-icon">${icon}</span>
            </div>
          </div>
          <div class="modern-card-stats">
            <div class="stat-item-modern">
              <div class="stat-icon-modern">💼</div>
              <div class="stat-details">
                <span class="stat-label-modern">Working</span>
                <span class="stat-value-modern">${data.workingDays} days</span>
              </div>
            </div>
            <div class="stat-item-modern">
              <div class="stat-icon-modern">🏖️</div>
              <div class="stat-details">
                <span class="stat-label-modern">Leave</span>
                <span class="stat-value-modern">${data.leaveDays} days</span>
              </div>
            </div>
            <div class="stat-item-modern">
              <div class="stat-icon-modern">📅</div>
              <div class="stat-details">
                <span class="stat-label-modern">Total</span>
                <span class="stat-value-modern">${data.totalDays} days</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'flex';
    tableContainer.style.display = 'none';
  }
}

// Toggle attendance view
window.toggleAttendanceView = function() {
  attendanceViewMode = attendanceViewMode === 'compact' ? 'table' : 'compact';
  const btn = document.getElementById('toggleViewBtn');
  if (btn) {
    btn.textContent = attendanceViewMode === 'compact' ? '📋 Table View' : '📊 Card View';
  }
  
  // Reload data with new view
  loadAttendanceData();
};

// Salary & Working Days Tab
async function loadSalaryData() {
  Loading.show('Calculating salary data...');
  try {
    const [configRes, leavesRes] = await Promise.all([
      api('/config'),
      api('/leave/list')
    ]);
    
    const teachers = configRes.teachers || [];
    const leaves = leavesRes.leaves || [];
    const monthFilter = document.getElementById('salaryMonth')?.value;
    const teacherFilter = document.getElementById('salaryTeacherFilter')?.value;
    
    let filteredTeachers = teachers;
    if (teacherFilter !== 'all') {
      filteredTeachers = teachers.filter(t => t['Teachers Name'] === teacherFilter);
    }
    
    renderSalaryTable(filteredTeachers, leaves, monthFilter);
    
  } catch (err) {
    Toast.error('Failed to load salary data');

  } finally {
    Loading.hide();
  }
}

function renderSalaryTable(teachers, leaves, monthFilter) {
  const container = document.getElementById('salaryTable');
  if (!container) return;
  
  const today = new Date();
  const [year, month] = monthFilter ? monthFilter.split('-') : [today.getFullYear(), today.getMonth() + 1];
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const totalDays = monthEnd.getDate();
  
  if (teachers.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No teachers found.</p>';
    return;
  }
  
  let html = `
    <div class="table-responsive-wrapper">
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Total Days</th>
            <th>Working Days</th>
            <th>Leave Days</th>
            <th>Overtime</th>
            <th>Substitutes Taken</th>
            <th>Attendance %</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  teachers.forEach(teacher => {
    const teacherName = teacher['Teachers Name'];
    const teacherLeaves = leaves.filter(l => 
      l.Teacher === teacherName && 
      new Date(l.StartDate) >= monthStart && 
      new Date(l.EndDate) <= monthEnd &&
      l.Status === 'Approved'
    );
    
    let leaveDays = 0;
    teacherLeaves.forEach(leave => {
      const start = new Date(leave.StartDate);
      const end = new Date(leave.EndDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      leaveDays += days;
    });
    
    const workingDays = totalDays - leaveDays;
    const attendancePercent = ((workingDays / totalDays) * 100).toFixed(1);
    
    // TODO: Calculate overtime and substitutes from substitution data
    const overtime = 0; // Placeholder
    const substitutes = teacherLeaves.length; // Count of approved leaves
    
    html += `
      <tr>
        <td><strong>${teacherName}</strong></td>
        <td>${totalDays}</td>
        <td>${workingDays}</td>
        <td>${leaveDays}</td>
        <td>${overtime}</td>
        <td>${substitutes}</td>
        <td style="color: ${attendancePercent >= 90 ? 'green' : attendancePercent >= 75 ? 'orange' : 'red'}; font-weight: bold;">${attendancePercent}%</td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = html;
}

// Substitutes & Overtime Tab
async function loadSubstituteData() {
  Loading.show('Loading substitute data...');
  try {
    // Load substitution audit if available
    const container = document.getElementById('substituteTable');
    if (!container) return;
    
    // TODO: Load from substitution audit file
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #666;">
        <p>Substitute and overtime tracking will be available here.</p>
        <p style="margin-top: 10px; font-size: 14px;">This feature tracks all substitute assignments and overtime hours.</p>
      </div>
    `;
    
  } catch (err) {
    Toast.error('Failed to load substitute data');

  } finally {
    Loading.hide();
  }
}

// Initialize clickable cards with popups
function initClickableCards() {
  // Remove any existing event listeners by cloning and replacing
  const cards = document.querySelectorAll('.stat-card.clickable');
  cards.forEach(card => {
    // Remove old listeners by cloning
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);
    
    // Add fresh event listener
    newCard.style.cursor = 'pointer';
    newCard.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardType = newCard.dataset.cardType;
      if (cardType === 'pendingLeaves') {
        // Navigate to Toggle Leave Panel instead of showing popup
        const toggleLeaveBtn = document.getElementById('toggleLeavePanel');
        if (toggleLeaveBtn) {
          toggleLeaveBtn.click();
        }
      } else if (cardType) {
        showCardPopup(cardType);
      }
    });
  });
}

// Show popup with card details
function showCardPopup(cardType) {
  // Remove any existing popups first
  const existingModals = document.querySelectorAll('.card-popup-modal');
  existingModals.forEach(modal => modal.remove());
  
  const data = window.dashboardData || {};
  let title = '';
  let content = '';
  
  // Only show popup if we're on the Overview tab
  const overviewTab = document.getElementById('tab-overview');
  if (!overviewTab || !overviewTab.classList.contains('active')) {
    return; // Don't show popup if not on overview tab
  }
  
  switch(cardType) {
    case 'totalTeachers':
      title = 'Total Teachers Details';
      const teachers = data.teachers || [];
      content = `
        <div style="max-height: 400px; overflow-y: auto; padding: 8px;">
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #374151;"><strong>Total Count:</strong> ${teachers.length}</p>
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #1f2937;">All Teachers:</h4>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${teachers.map(t => `<li style="padding: 10px; border-bottom: 1px solid #e5e7eb; margin: 0; color: #374151;">${t['Teachers Name'] || t.name || 'N/A'}</li>`).join('')}
          </ul>
        </div>
      `;
      break;
      
    case 'pendingLeaves':
      title = 'Pending Leaves Details';
      const pending = (data.leaves || []).filter(l => (l.Status || 'Pending') === 'Pending');
      content = `
        <div style="max-height: 400px; overflow-y: auto; padding: 8px;">
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #374151;"><strong>Total Pending:</strong> ${pending.length}</p>
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #1f2937;">Pending Leave Requests:</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${pending.length > 0 ? pending.map(l => `
              <div style="padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 6px; margin: 0;">
                <div style="font-weight: 600; color: #854d0e; margin-bottom: 6px;">${l.Teacher}</div>
                <div style="font-size: 12px; color: #a16207; margin-bottom: 4px;">From: ${l.StartDate} To: ${l.EndDate}</div>
                <div style="font-size: 12px; color: #a16207;">Reason: ${l.Reason || 'N/A'}</div>
              </div>
            `).join('') : '<p style="color: #6b7280; margin: 0;">No pending leaves</p>'}
          </div>
        </div>
      `;
      break;
      
    case 'approvedLeaves':
      title = 'Approved Leaves This Month';
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const approved = (data.leaves || []).filter(l => {
        if (l.Status !== 'Approved') return false;
        const leaveDate = new Date(l.StartDate || l.EndDate);
        return leaveDate.getMonth() === currentMonth && leaveDate.getFullYear() === currentYear;
      });
      content = `
        <div style="max-height: 400px; overflow-y: auto; padding: 8px;">
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #374151;"><strong>Total Approved This Month:</strong> ${approved.length}</p>
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #1f2937;">Approved Leaves:</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${approved.length > 0 ? approved.map(l => {
              const start = new Date(l.StartDate);
              const end = new Date(l.EndDate);
              const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
              return `
                <div style="padding: 12px; background: #d1fae5; border-left: 4px solid #10b981; border-radius: 6px; margin: 0;">
                  <div style="font-weight: 600; color: #065f46; margin-bottom: 6px;">${l.Teacher} - ${days} day${days > 1 ? 's' : ''}</div>
                  <div style="font-size: 12px; color: #047857; margin-bottom: 4px;">From: ${l.StartDate} To: ${l.EndDate}</div>
                  <div style="font-size: 12px; color: #047857;">Reason: ${l.Reason || 'N/A'}</div>
                </div>
              `;
            }).join('') : '<p style="color: #6b7280; margin: 0;">No approved leaves this month</p>'}
          </div>
        </div>
      `;
      break;
      
    case 'substitutes':
      title = 'Active Substitutes';
      content = `
        <div style="max-height: 400px; overflow-y: auto; padding: 8px;">
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #374151;"><strong>Active Substitutes:</strong> ${data.substitutes || 0}</p>
          <p style="margin: 0; color: #6b7280; font-size: 13px;">Substitute assignments are tracked when leaves are approved.</p>
        </div>
      `;
      break;
      
    case 'topLeaveTaker':
      title = 'Top Leave Taker Details';
      const card = document.getElementById('topLeaveTakerCard');
      const teacherName = card?.dataset.teacherName || 'N/A';
      const leaveDays = card?.dataset.leaveDays || '0';
      const teacherLeaves = (data.leaves || []).filter(l => l.Teacher === teacherName && l.Status === 'Approved');
      content = `
        <div style="max-height: 400px; overflow-y: auto; padding: 8px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;"><strong>Teacher:</strong> ${teacherName}</p>
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #374151;"><strong>Total Leave Days:</strong> ${leaveDays}</p>
          <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #1f2937;">Leave History:</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${teacherLeaves.length > 0 ? teacherLeaves.map(l => {
              const start = new Date(l.StartDate);
              const end = new Date(l.EndDate);
              const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
              return `
                <div style="padding: 12px; background: #f3f4f6; border-left: 4px solid #8b5cf6; border-radius: 6px; margin: 0;">
                  <div style="font-weight: 600; color: #6b21a8; margin-bottom: 6px;">${days} day${days > 1 ? 's' : ''}</div>
                  <div style="font-size: 12px; color: #7c3aed; margin-bottom: 4px;">From: ${l.StartDate} To: ${l.EndDate}</div>
                  <div style="font-size: 12px; color: #7c3aed;">Reason: ${l.Reason || 'N/A'}</div>
                </div>
              `;
            }).join('') : '<p style="color: #6b7280; margin: 0;">No leave records</p>'}
          </div>
        </div>
      `;
      break;
  }
  
  // Create and show modal
  const modal = document.createElement('div');
  modal.className = 'card-popup-modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="card-popup-overlay"></div>
    <div class="card-popup-content">
      <div class="card-popup-header">
        <h3>${title}</h3>
        <button class="card-popup-close" onclick="this.closest('.card-popup-modal').remove()">×</button>
      </div>
      <div class="card-popup-body">
        ${content}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close on overlay click
  modal.querySelector('.card-popup-overlay').addEventListener('click', () => {
    modal.remove();
  });
  
  // Close on escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

// Initialize dashboard
function initDashboard() {
  try {
    // Populate teacher filters
    api('/config').then(res => {
      const teachers = res.teachers || [];
      const teacherSelects = ['teacherAttendanceFilter', 'salaryTeacherFilter'];
      
      teacherSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
          // Clear existing options except "All Teachers"
          while (select.children.length > 1) {
            select.removeChild(select.lastChild);
          }
          teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher['Teachers Name'];
            option.textContent = teacher['Teachers Name'];
            select.appendChild(option);
          });
        }
      });
    }).catch(err => {

    });
    
    // Set default month to current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    ['leaveHistoryMonth', 'attendanceMonth', 'salaryMonth', 'substituteMonth'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = currentMonth;
    });
    
    // Load overview data
    if (typeof loadOverviewData === 'function') {
      loadOverviewData();
    }
  } catch (err) {

  }
}

// Export functions
window.initReportsPanel = initReportsPanel;
window.loadLeaveHistory = loadLeaveHistory;
window.loadAttendanceData = loadAttendanceData;
window.loadSalaryData = loadSalaryData;
window.loadSubstituteData = loadSubstituteData;

