// Compress + resize an image File to a small JPEG data URL (max 400px, 80% quality)
// Keeps base64 output under ~100KB regardless of input size
function compressTeacherPhoto(file, maxDim = 400, quality = 0.80) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not load image')); };
    img.src = objectUrl;
  });
}

// ─── Custom Dialog system (replaces browser prompt / confirm / alert) ───────
const Dialog = (() => {
  function _open({ iconHtml, iconStyle, title, message, fields = [], hint = '', confirmLabel = 'OK', confirmStyle = 'primary', cancelLabel = 'Cancel', showCancel = true }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dlg-overlay';

      // Build fields HTML
      let fieldsHtml = '';
      fields.forEach((f, i) => {
        const labelHtml = f.label ? `<label class="dlg-field-label" for="dlg-f-${i}">${f.label}</label>` : '';
        const inputClass = 'dlg-input' + (confirmStyle === 'danger' ? ' dlg-input-danger' : '');
        fieldsHtml += `<div class="dlg-field">${labelHtml}<input id="dlg-f-${i}" class="${inputClass}" type="${f.type || 'text'}" placeholder="${f.placeholder || ''}" autocomplete="off"/></div>`;
        if (f.options && f.options.length) {
          fieldsHtml += `<div class="dlg-options">${f.options.map(o => `<button type="button" class="dlg-option-chip" data-val="${o}">${o}</button>`).join('')}</div>`;
        }
      });
      if (hint) fieldsHtml += `<p class="dlg-hint">${hint}</p>`;

      const cancelBtnHtml = showCancel ? `<button class="dlg-btn dlg-btn-ghost" id="dlg-cancel">${cancelLabel}</button>` : '';
      overlay.innerHTML = `<div class="dlg-box">
        <div class="dlg-header">
          <div class="dlg-icon-wrap ${iconStyle}">${iconHtml}</div>
          <span class="dlg-title">${title}</span>
        </div>
        ${message ? `<div class="dlg-message">${message}</div>` : ''}
        ${fieldsHtml ? `<div class="dlg-body">${fieldsHtml}</div>` : ''}
        <div class="dlg-footer">${cancelBtnHtml}<button class="dlg-btn dlg-btn-${confirmStyle}" id="dlg-confirm">${confirmLabel}</button></div>
      </div>`;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('dlg-visible'));

      const firstInput = overlay.querySelector('.dlg-input');
      if (firstInput) setTimeout(() => firstInput.focus(), 60);

      // Chip click fills input
      overlay.querySelectorAll('.dlg-option-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const inp = overlay.querySelector('#dlg-f-0');
          if (inp) { inp.value = chip.dataset.val; inp.focus(); }
          overlay.querySelectorAll('.dlg-option-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
        });
      });

      function getValues() {
        const vals = fields.map((_, i) => (overlay.querySelector(`#dlg-f-${i}`) || {}).value || '');
        return fields.length === 0 ? true : (fields.length === 1 ? vals[0] : vals);
      }

      function close(value) {
        overlay.classList.remove('dlg-visible');
        overlay.classList.add('dlg-hiding');
        setTimeout(() => { overlay.remove(); resolve(value); }, 230);
      }

      overlay.querySelector('#dlg-confirm').addEventListener('click', () => close(getValues()));
      const cancelEl = overlay.querySelector('#dlg-cancel');
      if (cancelEl) cancelEl.addEventListener('click', () => close(null));
      overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(null); }
        if (e.key === 'Enter' && firstInput && document.activeElement === firstInput) {
          document.removeEventListener('keydown', esc); close(getValues());
        }
      });
    });
  }

  return {
    confirm(title, message, { danger = false, icon = danger ? '🗑️' : '⚠️' } = {}) {
      return _open({ iconHtml: icon, iconStyle: danger ? 'danger' : 'warning', title, message, confirmLabel: danger ? 'Delete' : 'Yes, Confirm', confirmStyle: danger ? 'danger' : 'primary' });
    },
    password(title, message, { placeholder = 'Enter password…', confirmLabel = 'Confirm' } = {}) {
      return _open({ iconHtml: '🔒', iconStyle: 'primary', title, message, fields: [{ type: 'password', placeholder }], confirmLabel });
    },
    input(title, message, { placeholder = '', label = '', icon = '✏️', confirmLabel = 'OK', danger = false, options = [], hint = '' } = {}) {
      return _open({ iconHtml: icon, iconStyle: danger ? 'danger' : 'primary', title, message, fields: [{ type: 'text', placeholder, label, options }], confirmLabel, confirmStyle: danger ? 'danger' : 'primary', hint });
    }
  };
})();

// Safely escape a string for use inside HTML attribute values or innerHTML
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) {
    const text = await r.text().catch(() => r.statusText);
    throw new Error(`API error ${r.status}: ${text}`);
  }
  return r.json();
}

document.addEventListener('DOMContentLoaded', () => {
  initAdmin();    
});

async function initAdmin() {
  const modal = document.getElementById('loginModal');
  const leaveSection = document.querySelector('section.card.refined');

  // hide leave section initially
  if (leaveSection) leaveSection.style.display = 'none';

  // Restore session if the same tab was refreshed (sessionStorage survives refresh, NOT tab close)
  const saved = sessionStorage.getItem('adminSession');
  if (saved) {
    try {
      const { user } = JSON.parse(saved);
      if (user) {
        modal.style.display = 'none';
        window.loggedInAdmin = user;
        loadInitial();
        return;
      }
    } catch (_) { /* corrupted, fall through to login */ }
  }

  modal.style.display = 'flex';

 document.getElementById("loginBtn").addEventListener("click", async () => {
  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value.trim();

  if (!u || !p) {
    Toast.warning("Please enter username and password");
    return;
  }

  Loading.show("Logging in...");
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });

    const data = await res.json();

    if (data.success) {
      modal.style.display = "none";
      // hide hero overlay if it exists (user dismissed login then came back)
      const existingOverlay = document.querySelector('.blur-overlay');
      if (existingOverlay) existingOverlay.remove();
      Toast.success(`Welcome, ${u}!`);
      // Store admin username globally for use in leave approval
      window.loggedInAdmin = u;
      // Persist login for this tab only — sessionStorage clears on tab close
      sessionStorage.setItem('adminSession', JSON.stringify({ user: u, at: Date.now() }));
      // Broadcast to any open user-portal tabs that admin is active
      localStorage.setItem('adminActive', '1');
      loadInitial();
    } else {
      Toast.error("Invalid username or password");
    }
  } catch (_err) {
    Toast.error("Server error, please try again");
  } finally {
    Loading.hide();
  }
});


  // Home button - show admin dashboard
  document.getElementById('homeBtn').addEventListener('click', () => {
    // Hide all panels and show main content
    const leavePanel = document.getElementById('leavePanel');
    const reportsPanel = document.getElementById('reportsPanel');
    const configCard = document.getElementById('configCard');
    const teachersSection = document.querySelector('section#configCard + section.card');
    const classEditorSection = document.querySelector('section#configCard + section.card + section.card');
    const draftPublishSection = document.getElementById('publishConfirm')?.closest('section.card');
    
    if (leavePanel) leavePanel.style.display = 'none';
    if (reportsPanel) reportsPanel.style.display = 'none';
    if (configCard) configCard.style.display = 'block';
    if (teachersSection) teachersSection.style.display = 'block';
    if (classEditorSection) classEditorSection.style.display = 'block';
    if (draftPublishSection) draftPublishSection.style.display = 'block';
  });

  document
    .getElementById('openUser')
    .addEventListener('click', () => window.open('/user/index.html', '_blank'));

  document.getElementById('genBtn').addEventListener('click', async () => {
    Loading.show('Generating timetable...');
    try {
      const r = await api('/generate');
      const count = r.timetable ? r.timetable.length : 0;
      Toast.success(`Timetable generated successfully! (${count} entries)`);
    } catch (err) {
      Toast.error('Failed to generate timetable');
    } finally {
      Loading.hide();
    }
  });

  document.getElementById('publishBtn').addEventListener('click', async () => {
    const pwd = await Dialog.password('Publish Timetable', 'Enter admin password to publish the timetable to all users.', { placeholder: 'Admin password…', confirmLabel: '🚀 Publish' });
    if (!pwd) return;
    Loading.show('Publishing timetable...');
    try {
      const r = await api('/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      if (r.success) {
        Toast.success('Timetable published successfully!');
      } else {
        Toast.error('Publish failed: ' + (r.error || 'Unknown error'));
      }
    } catch (err) {
      Toast.error('Failed to publish timetable');
    } finally {
      Loading.hide();
    }
  });

  document
    .getElementById('loadTeachers')
    .addEventListener('click', loadTeachers);
  document
    .getElementById('addTeacher')
    .addEventListener('click', () => addTeacherForm());
  document.getElementById('saveConfig').addEventListener('click', saveConfig);
  document.getElementById('runMigration').addEventListener('click', async () => {
    Loading.show('Running DB migration…');
    try {
      const r = await api('/admin/run-migration', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      Toast.success(r.message || 'Done! Photo uploads and username saves are now enabled.');
    } catch (e) {
      Toast.error('Migration failed: ' + e.message);
    } finally {
      Loading.hide();
    }
  });
  document
    .getElementById('selectClass')
    .addEventListener('change', () =>
      loadClassEditor(document.getElementById('selectClass').value)
    );
  document.getElementById('saveClass').addEventListener('click', saveClass);

  document.getElementById('publishConfirm').addEventListener('click', async () => {
    const pwd = await Dialog.password('Publish Timetable', 'Enter admin password to publish the substitution timetable to all users.', { placeholder: 'Admin password…', confirmLabel: '🚀 Publish' });
    if (!pwd) return;
    Loading.show('Publishing timetable...');
    try {
      const r = await api('/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      if (r.success) {
        Toast.success('Timetable published successfully!');
      } else {
        Toast.error('Publish failed');
      }
    } catch (err) {
      Toast.error('Failed to publish timetable');
    } finally {
      Loading.hide();
    }
  });
}

async function loadInitial() {
  Loading.show("Loading dashboard...");
  try {
    //loadLeaveRequests(); 
    await Promise.all([
      loadConfig(),
      loadTeachers(),
      loadClassesList(),
      loadSubSummary()
    ]);
    // Load pending leaves only if leave panel exists
    const leavePanel = document.getElementById('leavePanel');
    if (leavePanel && leavePanel.style.display !== 'none') {
      // Only load if panel is visible
      if (typeof loadPendingOnly === 'function') {
        await loadPendingOnly();
      }
    }
  } catch (err) {
    Toast.error("Failed to load some data");
  } finally {
    Loading.hide();
  }
}

/* ---------------- LEAVE PANEL ---------------- */

/* ---------------- DYNAMIC LEAVE PANEL (FRONTEND LOGIC) ---------------- */

// Temporary in-memory data (simulating backend)
async function loadLeaveRequests() {
  const container = document.querySelector(".leave-requests");
  if (!container) return;
  container.innerHTML = `<p>Loading...</p>`;

  try {
    const data = await api("/leave/list");
    const leaves = data.leaves || [];
    // ✅ Sort so Pending cards appear first
leaves.sort((a, b) => {
  const order = { "Pending": 0, "Approved": 1, "Rejected": 2 };
  return (order[a.Status || "Pending"] ?? 0) - (order[b.Status || "Pending"] ?? 0);
});


    if (leaves.length === 0) {
      container.innerHTML = `<p>No leave requests found.</p>`;
      return;
    }

    container.innerHTML = ""; // Clear loading text

    leaves.forEach((leave) => {
      const card = createLeaveCard(leave);
      container.appendChild(card);
    });
  } catch (err) {
    const errP = document.createElement('p');
    errP.style.color = 'red';
    errP.textContent = `Failed to load leaves: ${err.message}`;
    container.innerHTML = '';
    container.appendChild(errP);
  }
}

// --- Create a leave card element (uses DOM API to prevent XSS) ---
function createLeaveCard(leave) {
  const { id, Teacher, StartDate, EndDate, Reason, Status } = leave;

  const card = document.createElement("div");
  card.className = "leave-card";
  card.dataset.id = id;
  card.dataset.status = Status || "Pending";

  const h3 = document.createElement("h3");
  h3.textContent = Teacher;

  const pStart = document.createElement("p");
  pStart.innerHTML = "<strong>Start:</strong> ";
  pStart.appendChild(document.createTextNode(StartDate));

  const pEnd = document.createElement("p");
  pEnd.innerHTML = "<strong>End:</strong> ";
  pEnd.appendChild(document.createTextNode(EndDate));

  const pReason = document.createElement("p");
  pReason.innerHTML = "<strong>Reason:</strong> ";
  pReason.appendChild(document.createTextNode(Reason));

  const pStatus = document.createElement("p");
  pStatus.className = "status";
  pStatus.innerHTML = "<strong>Status:</strong> ";
  const statusSpan = document.createElement("span");
  statusSpan.textContent = Status || "Pending";
  pStatus.appendChild(statusSpan);

  const actions = document.createElement("div");
  actions.className = "actions";
  const approveBtn = document.createElement("button");
  approveBtn.className = "approve";
  approveBtn.textContent = "Approve";
  const rejectBtn = document.createElement("button");
  rejectBtn.className = "reject";
  rejectBtn.textContent = "Reject";
  actions.appendChild(approveBtn);
  actions.appendChild(rejectBtn);

  card.appendChild(h3);
  card.appendChild(pStart);
  card.appendChild(pEnd);
  card.appendChild(pReason);
  card.appendChild(pStatus);
  card.appendChild(actions);

  styleCardByStatus(card, Status);

  approveBtn.addEventListener("click", () => handleStatusChange(card, "Approved"));
  rejectBtn.addEventListener("click", () => handleStatusChange(card, "Rejected"));

  return card;
}

// --- Handle Approve/Reject click ---
async function handleStatusChange(card, newStatus) {
  const id = card.dataset.id;
  const prevStatus = card.dataset.status;

  // Optimistic UI update
  card.querySelector(".status span").textContent = newStatus;
  styleCardByStatus(card, newStatus);
    card.querySelector(".approve").disabled = true;
    card.querySelector(".reject").disabled = true;
    card.querySelector(".approve").style.opacity = "0.5";
  
card.querySelector(".reject").style.opacity = "0.5";
  

  Loading.show(`${newStatus === 'Approved' ? 'Approving' : 'Rejecting'} leave...`);
  try {
    // Get admin username from global variable or default to 'Admin'
    const approvedBy = window.loggedInAdmin || 'Admin';
    await api("/leave/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus, approvedBy }),
    });

    card.dataset.status = newStatus;
    Toast.success(`Leave ${newStatus.toLowerCase()} successfully!`);
    // Auto-close the leave panel after approve/reject
    setTimeout(() => {
      closeLeavePanel();
      if (newStatus === 'Approved') loadSubSummary();
    }, 500);
  } catch (err) {
    // Revert UI on failure
    Toast.error(`Failed to update status: ${err.message}`);
    card.querySelector(".status span").textContent = prevStatus;
    styleCardByStatus(card, prevStatus);
    card.querySelector(".approve").disabled = false;
    card.querySelector(".reject").disabled = false;
    card.querySelector(".approve").style.opacity = "1";
    card.querySelector(".reject").style.opacity = "1";
  } finally {
    Loading.hide();
  }
}

// --- Apply color style based on status ---
function styleCardByStatus(card, status) {
  card.classList.remove("approved", "rejected", "pending");
  const statusText = card.querySelector(".status span");
  if (!statusText) return;

  switch (status) {
    case "Approved":
      card.classList.add("approved");
      statusText.style.color = "green";
      break;
    case "Rejected":
      card.classList.add("rejected");
      statusText.style.color = "red";
      break;
    default:
      card.classList.add("pending");
      statusText.style.color = "orange";
      break;
  }
}



/* ---------------- CONFIG ---------------- */


// 🟢 Auto-load Config on page load



async function saveConfig() {
  const configData = {
    SchoolName: document.getElementById('confName').value.trim(),
    StartTime: document.getElementById('confStart').value.trim(),
    TotalPeriods: document.getElementById('confPeriods').value.trim(),
    MinutesPerPeriod: document.getElementById('confMins').value.trim() + ' Minutes',
  };

  if (!configData.SchoolName) {
    Toast.warning('Please enter School Name.');
    return;
  }
  if (!configData.StartTime) {
    Toast.warning('Please enter Start Time.');
    return;
  }
  if (!configData.TotalPeriods) {
    Toast.warning('Please enter total periods.');
    return;
  }
  if (!configData.MinutesPerPeriod || configData.MinutesPerPeriod === ' Minutes') {
    Toast.warning('Please enter minutes per period.');
    return;
  }

  Loading.show('Saving configuration...');
  try {
    const res = await api('/config/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData),
    });

    if (res.success) {
      Toast.success('Configuration saved successfully!');
      // Update school name in header immediately
      const schoolNameEl = document.getElementById('schoolName');
      if (schoolNameEl) schoolNameEl.textContent = configData.SchoolName;
      // Automatically refresh the active class editor table if a class is currently selected
      const selectClass = document.getElementById('selectClass');
      if (selectClass && selectClass.value) {
        loadClassEditor(selectClass.value);
      }
    } else {
      Toast.error('Failed to save configuration: ' + (res.message || 'Unknown error'));
    }
  } catch (err) {
    Toast.error('Failed to save configuration');
  } finally {
    Loading.hide();
  }
}
async function loadConfig() {
  try {
    const r = await api('/config/get');
    if (r.success && r.config) {
      document.getElementById('confName').value = r.config.SchoolName || '';
      document.getElementById('confStart').value = r.config.StartTime || '';
      document.getElementById('confPeriods').value = r.config.TotalPeriods || '';
      document.getElementById('confMins').value = (r.config.MinutesPerPeriod || '').match(/\d+/)?.[0] || '';
      
      // Update school name in header
      const schoolNameElement = document.getElementById('schoolName');
      if (schoolNameElement) {
        schoolNameElement.textContent = r.config.SchoolName || 'Kagzso School';
      }
    }
  } catch (_err) {
    // Silent — don't toast on initial config load
  }
}

// Load school name on page load (before login) to populate the header
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const r = await api('/config');
    if (r.school && r.school.length > 0) {
      const schoolName = r.school[0]['School Name'] || r.school[0].SchoolName || 'Kagzso School';
      const schoolNameElement = document.getElementById('schoolName');
      if (schoolNameElement) {
        schoolNameElement.textContent = schoolName;
      }
    }
  } catch (_err) {
    // Keep default school name if load fails
  }
});

// ── Auto-logout when tab/browser is closed ─────────────────────────────────
// pagehide fires on tab close AND on page refresh.
// We intentionally do NOT clear adminSession here — the browser destroys
// sessionStorage automatically when the tab is truly closed, and NOT on refresh,
// which is the exact behaviour we want (close = logout, refresh = stay logged in).
// The only job here is to broadcast to open user-portal tabs.
window.addEventListener('pagehide', () => {
  // Broadcast logout signal to all open user-portal tabs via localStorage.
  // localStorage storage events fire in other tabs but NOT in this one.
  localStorage.setItem('adminLogout', Date.now().toString());
  localStorage.removeItem('adminActive');
});



/* ---------------- TEACHERS ---------------- */

async function loadTeachers() {
  try {
    const r = await api('/config');
    const t = r.teachers || [];
    const wrap = document.getElementById('teachersTable');
    if (t.length === 0) {
      wrap.innerHTML = '<div>No teachers found.</div>';
      return;
    }
    let html = `<table class="table editable-table">
      <thead><tr>
        <th>Photo</th><th>Name</th><th>Subject</th><th>Class</th>
        <th>Contact</th><th>Email</th>
        <th>Username</th><th>Password</th>
        <th>Actions</th>
      </tr></thead><tbody>`;

    t.forEach((x, i) => {
      const safeName = escHtml(x['Teachers Name'] || '');
      const username = escHtml(x['Username'] || (x['Teachers Name'] || '').toLowerCase().trim());
      const hasPassword = !!(x['Password'] || '').trim();
      const photo = x['Photo'] || '';
      const initials = (x['Teachers Name'] || '?').trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const avatarHtml = photo
        ? `<img src="${photo}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #6366f1;display:block"/>`
        : `<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;letter-spacing:-0.5px">${initials}</div>`;
      html += `<tr data-teacher-index="${i}" data-teacher-name="${safeName}">
        <td style="text-align:center">
          <div class="teacher-avatar-cell" data-index="${i}" data-name="${safeName}" title="Click to upload photo" style="cursor:pointer;display:inline-block;position:relative">
            ${avatarHtml}
            <span style="position:absolute;bottom:-2px;right:-2px;background:#6366f1;color:#fff;border-radius:50%;width:16px;height:16px;font-size:9px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff">📷</span>
            <input type="file" accept="image/*" style="display:none" class="photo-file-input" data-index="${i}" data-name="${safeName}"/>
          </div>
        </td>
        <td contenteditable="true" data-field="Teachers Name" class="editable-cell">${safeName}</td>
        <td contenteditable="true" data-field="Subject" class="editable-cell">${escHtml(x.Subject || '')}</td>
        <td contenteditable="true" data-field="Class" class="editable-cell">${escHtml(x.Class || '')}</td>
        <td contenteditable="true" data-field="Contact number" class="editable-cell">${escHtml(x['Contact number'] || '')}</td>
        <td contenteditable="true" data-field="Email" class="editable-cell">${escHtml(x['Email'] || '')}</td>
        <td contenteditable="true" data-field="Username" class="editable-cell" style="color:#6366f1;font-weight:600;font-size:13px">${username}</td>
        <td>
          <span class="pw-status" style="font-size:13px;color:${hasPassword ? '#10b981' : '#9ca3af'}">
            ${hasPassword ? '●●●●●● <span style="font-size:11px">(set)</span>' : 'Not set'}
          </span>
        </td>
        <td class="action-buttons" style="white-space:nowrap">
          <button data-action="edit" data-index="${i}" class="btn primary small" title="Save Changes">💾 Save</button>
          <button data-action="setpw" data-index="${i}" class="btn ghost small" title="Set Password" style="border-color:#6366f1;color:#6366f1">🔑 Password</button>
          <button data-action="delete" class="btn ghost small" title="Delete Teacher">🗑️ Delete</button>
        </td>
      </tr>
      <tr class="pw-row" id="pw-row-${i}" style="display:none">
        <td colspan="10">
          <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#f5f3ff;border-radius:8px;flex-wrap:wrap">
            <span style="font-weight:600;color:#4f46e5;font-size:13px">🔑 Set password for <strong>${safeName}</strong></span>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="position:relative">
                <input id="pw-input-${i}" type="password" placeholder="New password" autocomplete="new-password"
                  style="padding:8px 36px 8px 12px;border:1.5px solid #c4b5fd;border-radius:8px;font-size:13px;width:180px;outline:none"/>
                <button type="button" data-eye="pw-input-${i}" title="Show/hide password"
                  style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;padding:0;color:#6366f1">👁</button>
              </div>
              <div style="position:relative">
                <input id="pw-confirm-${i}" type="password" placeholder="Confirm password" autocomplete="new-password"
                  style="padding:8px 36px 8px 12px;border:1.5px solid #c4b5fd;border-radius:8px;font-size:13px;width:180px;outline:none"/>
                <button type="button" data-eye="pw-confirm-${i}" title="Show/hide password"
                  style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:15px;padding:0;color:#6366f1">👁</button>
              </div>
              <span id="pw-match-${i}" style="font-size:13px;font-weight:600;min-width:80px"></span>
            </div>
            <button data-action="savepw" data-index="${i}" data-name="${safeName}" class="btn primary small">✅ Save Password</button>
            <button data-action="cancelpw" data-index="${i}" class="btn ghost small">Cancel</button>
          </div>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

    // Wire up all action buttons
    wrap.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const row = btn.closest('tr');
        editTeacher(idx, row.dataset.teacherName);
      });
    });
    wrap.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        deleteTeacher(row.dataset.teacherName);
      });
    });
    wrap.querySelectorAll('[data-action="setpw"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const pwRow = document.getElementById(`pw-row-${idx}`);
        if (pwRow) {
          pwRow.style.display = pwRow.style.display === 'none' ? '' : 'none';
          const inp = document.getElementById(`pw-input-${idx}`);
          if (inp && pwRow.style.display !== 'none') inp.focus();
        }
      });
    });
    wrap.querySelectorAll('[data-action="savepw"]').forEach(btn => {
      btn.addEventListener('click', () => saveTeacherPassword(btn.dataset.index, btn.dataset.name));
    });
    wrap.querySelectorAll('[data-action="cancelpw"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.index;
        const pwRow = document.getElementById(`pw-row-${idx}`);
        if (pwRow) pwRow.style.display = 'none';
      });
    });

    // Photo upload via avatar click
    wrap.querySelectorAll('.teacher-avatar-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const inp = cell.querySelector('.photo-file-input');
        if (inp) inp.click();
      });
    });
    wrap.querySelectorAll('.photo-file-input').forEach(inp => {
      inp.addEventListener('change', async () => {
        const file = inp.files[0];
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) { Toast.warning('Image too large (max 15MB)'); return; }
        Loading.show('Processing photo...');
        try {
          const dataUrl = await compressTeacherPhoto(file);
          const res = await api('/teachers/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalName: inp.dataset.name, updates: { photo: dataUrl } })
          });
          if (res.success) {
            Toast.success('Photo updated!');
            loadTeachers();
          } else {
            Toast.error('Failed to save photo: ' + (res.message || 'Unknown error'));
          }
        } catch (_e) {
          Toast.error('Upload failed: ' + (_e.message || 'Unknown error'));
        } finally {
          Loading.hide();
        }
      });
    });

    // Eye icon toggle
    wrap.querySelectorAll('[data-eye]').forEach(btn => {
      btn.addEventListener('click', () => {
        const inp = document.getElementById(btn.dataset.eye);
        if (!inp) return;
        if (inp.type === 'password') {
          inp.type = 'text';
          btn.textContent = '🙈';
        } else {
          inp.type = 'password';
          btn.textContent = '👁';
        }
      });
    });

    // Password match indicator
    t.forEach((_, i) => {
      const pwInp = document.getElementById(`pw-input-${i}`);
      const pwConf = document.getElementById(`pw-confirm-${i}`);
      const matchEl = document.getElementById(`pw-match-${i}`);
      if (!pwInp || !pwConf || !matchEl) return;
      const checkMatch = () => {
        const v1 = pwInp.value, v2 = pwConf.value;
        if (!v1 && !v2) { matchEl.textContent = ''; return; }
        if (!v2) { matchEl.textContent = ''; return; }
        if (v1 === v2) {
          matchEl.textContent = '✅ Match';
          matchEl.style.color = '#10b981';
          pwConf.style.borderColor = '#10b981';
        } else {
          matchEl.textContent = '❌ No match';
          matchEl.style.color = '#ef4444';
          pwConf.style.borderColor = '#ef4444';
        }
      };
      pwInp.addEventListener('input', checkMatch);
      pwConf.addEventListener('input', checkMatch);
    });

    // Visual feedback on cell edit
    wrap.querySelectorAll('.editable-cell').forEach(cell => {
      cell.addEventListener('blur', function() {
        this.style.background = '#fff3cd';
        setTimeout(() => { this.style.background = ''; }, 500);
      });
    });
  } catch (_err) {
    const wrap = document.getElementById('teachersTable');
    if (wrap) wrap.innerHTML = '<div style="color:red;">Failed to load teachers.</div>';
    Toast.error('Failed to load teachers');
  }
}

async function saveTeacherPassword(index, teacherName) {
  const pw = (document.getElementById(`pw-input-${index}`) || {}).value || '';
  const confirm = (document.getElementById(`pw-confirm-${index}`) || {}).value || '';
  if (!pw) { Toast.warning('Please enter a password'); return; }
  if (pw !== confirm) { Toast.error('Passwords do not match'); return; }

  Loading.show('Saving password...');
  try {
    const res = await api('/teachers/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalName: teacherName, updates: { password: pw } })
    });
    if (res.success) {
      Toast.success(`Password set for ${teacherName}`);
      loadTeachers();
    } else {
      Toast.error('Failed to set password: ' + (res.message || 'Unknown error'));
    }
  } catch (_err) {
    Toast.error('Failed to set password');
  } finally {
    Loading.hide();
  }
}

function addTeacherForm() {
  const wrap = document.getElementById('teachersTable');
  const form = `
    <div class="card" style="padding: 24px; border: 1px solid rgba(226, 232, 240, 0.8); background: #ffffff; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02); max-width: 800px; margin: 16px auto;">
      <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 1.25rem; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
        👤 Add New Teacher
      </h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 0.875rem; font-weight: 500; color: #475569;">Teacher Name <span style="color: #ef4444;">*</span></label>
          <input id="t_name" placeholder="e.g. Kavitha" style="padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; outline: none; transition: all 0.2s;" onfocus="this.style.borderColor='#4f46e5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.15)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'"/>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 0.875rem; font-weight: 500; color: #475569;">Subject <span style="color: #ef4444;">*</span></label>
          <input id="t_sub" placeholder="e.g. English" style="padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; outline: none; transition: all 0.2s;" onfocus="this.style.borderColor='#4f46e5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.15)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'"/>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 0.875rem; font-weight: 500; color: #475569;">Classes (comma-separated) <span style="color: #ef4444;">*</span></label>
          <input id="t_class" placeholder="e.g. 8A,9A,10B" style="padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; outline: none; transition: all 0.2s;" onfocus="this.style.borderColor='#4f46e5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.15)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'"/>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 0.875rem; font-weight: 500; color: #475569;">Contact Number</label>
          <input id="t_contact" placeholder="e.g. 9876543210" style="padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; outline: none; transition: all 0.2s;" onfocus="this.style.borderColor='#4f46e5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.15)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'"/>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 0.875rem; font-weight: 500; color: #475569;">Email Address</label>
          <input id="t_email" type="email" placeholder="teacher@school.com" style="padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; outline: none; transition: all 0.2s;" onfocus="this.style.borderColor='#4f46e5'; this.style.boxShadow='0 0 0 3px rgba(79, 70, 229, 0.15)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'"/>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 0.875rem; font-weight: 500; color: #475569;">Password <span style="color:#9ca3af;font-weight:400">(for teacher login)</span></label>
          <input id="t_password" type="password" autocomplete="new-password" placeholder="Set login password" style="padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; outline: none; transition: all 0.2s;" onfocus="this.style.borderColor='#6366f1'; this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.15)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'"/>
          <span style="font-size:11px;color:#6366f1;margin-top:2px">Username will be the teacher's name in lowercase</span>
        </div>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button onclick="loadTeachers()" class="btn ghost" style="padding: 10px 20px; font-size: 0.875rem;">Cancel</button>
        <button id="saveT" class="btn primary" style="padding: 10px 24px; font-size: 0.875rem;">💾 Save Teacher</button>
      </div>
    </div>
  `;
  wrap.innerHTML = form;
  document.getElementById('saveT').addEventListener('click', async () => {
    const name = document.getElementById('t_name').value.trim(),
      sub = document.getElementById('t_sub').value.trim(),
      cls = document.getElementById('t_class').value.trim(),
      contact = document.getElementById('t_contact').value.trim(),
      email = document.getElementById('t_email').value.trim(),
      password = document.getElementById('t_password').value.trim();

    if (!name || !sub || !cls) {
      Toast.warning('Please fill all required fields (Name, Subject, Classes)');
      return;
    }

    Loading.show('Adding teacher...');
    try {
      const res = await api('/teachers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject: sub, classes: cls, contact, email, password }),
      });
      if (res.success) {
        Toast.success('Teacher added successfully!');
        loadTeachers();
        loadClassesList();
      } else {
        Toast.error('Failed to add teacher: ' + (res.message || 'Unknown error'));
      }
    } catch (_err) {
      Toast.error('Failed to add teacher');
    } finally {
      Loading.hide();
    }
  });
}

async function deleteTeacher(name) {
  const ok = await Dialog.confirm('Delete Teacher', `Are you sure you want to permanently delete <strong>${name}</strong>? This cannot be undone.`, { danger: true });
  if (!ok) return;

  Loading.show('Deleting teacher...');
  try {
    const res = await fetch('/teachers/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    if (data.success) {
      Toast.success(`Teacher "${name}" deleted successfully!`);
      loadTeachers();
      loadClassesList();
    } else {
      Toast.error(`Failed to delete: ${data.message || 'Unknown error'}`);
    }
  } catch (_err) {
    Toast.error('Error deleting teacher. Please try again.');
  } finally {
    Loading.hide();
  }
}

// Edit teacher function
async function editTeacher(index, originalName) {
  const row = document.querySelector(`tr[data-teacher-index="${index}"]`);
  if (!row) {
    Toast.error('Teacher row not found');
    return;
  }
  
  const cells = row.querySelectorAll('.editable-cell');
  const updates = {};
  
  cells.forEach(cell => {
    const field = cell.dataset.field;
    const value = cell.textContent.trim();
    updates[field] = value;
  });
  
  if (!updates['Teachers Name']) {
    Toast.warning('Teacher name cannot be empty');
    return;
  }
  if (!updates['Username']) {
    updates['Username'] = updates['Teachers Name'].toLowerCase().trim();
  }
  
  Loading.show('Updating teacher...');
  try {
    const res = await api('/teachers/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalName: originalName,
        updates: updates
      }),
    });
    
    if (res.success) {
      Toast.success('Teacher updated successfully!');
      loadTeachers();
      loadClassesList();
    } else {
      Toast.error('Failed to update teacher: ' + (res.message || 'Unknown error'));
    }
  } catch (_err) {
    Toast.error('Failed to update teacher');
  } finally {
    Loading.hide();
  }
}

// Make editTeacher available globally
window.editTeacher = editTeacher;
window.deleteTeacher = deleteTeacher;



/* ---------------- CLASS EDITOR ---------------- */

async function loadClassesList() {
  try {
    const r = await api('/config');
    const classes = Object.keys(r.classes || {})
      .filter((c) => c && c.trim() !== '')
      .sort();
    const sel = document.getElementById('selectClass');
    sel.innerHTML = '';
    classes.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.innerText = c.toUpperCase();
      sel.appendChild(opt);
    });
    if (classes.length > 0) loadClassEditor(classes[0]);
  } catch (_err) {
    // Silent on initial load
  }
}

async function loadClassEditor(className) {
  try {
    const r = await api('/config');
    const rows = (r.classes || {})[className] || [];
    const wrap = document.getElementById('classEditor');
    
    // Set title in uppercase with the active class
    const title = document.getElementById('classEditorTitle');
    if (title) {
      title.textContent = `Class ${className.toUpperCase()} Timetable Editor`;
    }
    
    if (rows.length === 0) {
      wrap.innerHTML = '<div>No class rows</div>';
      return;
    }
    
    // Dynamically pad periods based on SchoolConfig Total Periods
    const totalPeriods = parseInt(r.school && r.school['Total Periods']) || 0;
    
    // Scan for max existing period index that actually has text/data in at least one row
    let maxExistingNum = 0;
    rows.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key.toLowerCase().startsWith('period') && row[key] && row[key].trim() !== '') {
          const match = key.match(/\d+/);
          if (match) {
            const num = parseInt(match[0]);
            if (num > maxExistingNum) maxExistingNum = num;
          }
        }
      });
    });
    
    const limit = Math.max(totalPeriods, maxExistingNum, 5);
    const periods = [];
    for (let i = 1; i <= limit; i++) {
      periods.push(`Period ${i}`);
    }
    
    let html = '<table class="table"><thead><tr><th>Day</th>';
    periods.forEach((p) => (html += `<th>${p}</th>`));
    html += '<th>Actions</th></tr></thead><tbody>';
    rows.forEach((row, i) => {
      html += `<tr data-row-index="${i}"><td contenteditable="true">${row.Day}</td>`;
      periods.forEach(
        (p) =>
          (html += `<td contenteditable="true" data-field="${p}" data-row="${i}">${
            row[p] || ''
          }</td>`)
      );
      html += `<td><button onclick="deleteClassRowByIndex(${i})" class="btn ghost">Delete</button></td></tr>`;
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  } catch (_err) {
    const wrap = document.getElementById('classEditor');
    if (wrap) wrap.innerHTML = '<div style="color:red;">Failed to load class timetable.</div>';
    Toast.error('Failed to load class timetable');
  }
}

function deleteClassRowByIndex(index) {
  Dialog.confirm('Delete Row', 'Are you sure you want to remove this row from the timetable?', { danger: true }).then(ok => {
    if (!ok) return;
    const table = document.querySelector('#classEditor table tbody');
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows[index]) {
      rows[index].remove();
      rows.forEach((row, i) => {
        if (i >= index) {
          const btn = row.querySelector('button');
          if (btn) {
            btn.setAttribute('onclick', `deleteClassRowByIndex(${i})`);
            row.setAttribute('data-row-index', i);
          }
        }
      });
      Toast.success('Row deleted. Click "Save Class Timetable" to save changes.');
    }
  });
}

function addClassRow() {
  const table = document.querySelector('#classEditor table tbody');
  if (!table) {
    Toast.error('Please select a class first');
    return;
  }
  
  // Get existing periods from first row
  const firstRow = table.querySelector('tr');
  if (!firstRow) {
    Toast.error('No existing rows to copy structure from');
    return;
  }
  
  const periods = [];
  firstRow.querySelectorAll('td[data-field]').forEach(td => {
    periods.push(td.dataset.field);
  });
  
  // Get current row count for index
  const currentRowCount = table.querySelectorAll('tr').length;
  
  // Create new row
  const newRow = document.createElement('tr');
  newRow.setAttribute('data-row-index', currentRowCount);
  newRow.innerHTML = `
    <td contenteditable="true">Monday</td>
    ${periods.map(p => `<td contenteditable="true" data-field="${p}" data-row="${currentRowCount}"></td>`).join('')}
    <td><button onclick="deleteClassRowByIndex(${currentRowCount})" class="btn ghost">Delete</button></td>
  `;
  
  table.appendChild(newRow);
  Toast.success('New row added. Click "Save Class Timetable" to save changes.');
}

async function saveClass() {
  const sel = document.getElementById('selectClass');
  const className = sel.value;
  const table = document.querySelector('#classEditor table');

  if (!table) {
    Toast.warning('No timetable to save!');
    return;
  }

  // 🔹 Build JSON array of all timetable rows (skip empty rows)
  const rows = [];
  table.querySelectorAll('tbody tr').forEach((tr) => {
    const dayCell = tr.querySelector('td:first-child');
    if (!dayCell) return;
    
    const day = dayCell.innerText.trim();
    if (!day) return; // Skip rows without day
    
    const row = {};
    row['Day'] = day;

    tr.querySelectorAll('td[data-field]').forEach((td) => {
      const value = td.innerText.trim();
      if (value) { // Only include non-empty values
        row[td.dataset.field] = value;
      }
    });

    rows.push(row);
  });
  
  if (rows.length === 0) {
    Toast.warning('No rows to save. Please add at least one row.');
    return;
  }

  Loading.show(`Saving class "${className}"...`);
  try {
    const resp = await fetch('/classes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ className, rows }),
    });

    const result = await resp.json();
    if (result.success) {
      Toast.success(`Class "${className}" saved successfully!`);
    } else {
      Toast.error(`Failed to save class: ${result.message || 'Unknown error'}`);
    }
  } catch (_err) {
    Toast.error('Failed to connect to server.');
  } finally {
    Loading.hide();
  }
}

function addClassColumn() {
  const table = document.querySelector('#classEditor table');
  if (!table) {
    Toast.error('Please select a class first');
    return;
  }
  
  const theadTr = table.querySelector('thead tr');
  const tbodyTrs = table.querySelectorAll('tbody tr');
  if (!theadTr) return;
  
  const ths = Array.from(theadTr.querySelectorAll('th'));
  let maxPeriodNum = 0;
  ths.forEach(th => {
    const text = th.textContent.trim();
    const match = text.match(/Period\s*(\d+)/i);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxPeriodNum) maxPeriodNum = num;
    }
  });
  
  const nextPeriodNum = maxPeriodNum + 1;
  const nextPeriodName = `Period ${nextPeriodNum}`;
  
  // 1. Add th to thead before the last th ("Actions")
  const newTh = document.createElement('th');
  newTh.textContent = nextPeriodName;
  const actionsTh = ths[ths.length - 1];
  theadTr.insertBefore(newTh, actionsTh);
  
  // 2. Add td to each tbody row before the last td ("Actions")
  tbodyTrs.forEach((tr, rowIndex) => {
    const tds = Array.from(tr.querySelectorAll('td'));
    const newTd = document.createElement('td');
    newTd.contentEditable = 'true';
    newTd.dataset.field = nextPeriodName;
    newTd.dataset.row = rowIndex;
    
    const actionsTd = tds[tds.length - 1];
    tr.insertBefore(newTd, actionsTd);
  });
  
  Toast.success(`Added ${nextPeriodName} column. Click "Save Class Timetable" to save changes.`);
}

window.addClassColumn = addClassColumn;

async function deleteClassColumn() {
  const table = document.querySelector('#classEditor table');
  if (!table) {
    Toast.error('Please select a class first');
    return;
  }
  
  const theadTr = table.querySelector('thead tr');
  if (!theadTr) return;
  
  const ths = Array.from(theadTr.querySelectorAll('th'));
  const periodThs = ths.filter(th => th.textContent.trim().match(/Period\s*\d+/i));
  
  if (periodThs.length === 0) {
    Toast.warning('No period columns to delete.');
    return;
  }
  
  // Prompt the user to enter the period number or name they want to delete
  const periodNumbers = periodThs.map(th => {
    const match = th.textContent.trim().match(/\d+/);
    return match ? match[0] : null;
  }).filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));
  
  const targetPeriodInput = await Dialog.input(
    'Delete Period Column',
    'Select the period number you want to remove from this class timetable.',
    { placeholder: 'e.g. 1', icon: '🗑️', confirmLabel: 'Delete Period', danger: true, options: periodNumbers }
  );

  if (targetPeriodInput === null) return;

  const periodNum = parseInt(String(targetPeriodInput).trim());
  if (isNaN(periodNum)) {
    Toast.error('Invalid period number. Please enter a valid number.');
    return;
  }

  const targetPeriodName = `Period ${periodNum}`;

  const thToDelete = periodThs.find(th => th.textContent.trim().toLowerCase() === targetPeriodName.toLowerCase());

  if (!thToDelete) {
    Toast.error(`Period column "${targetPeriodName}" not found.`);
    return;
  }

  const ok = await Dialog.confirm(`Delete "${targetPeriodName}"?`, `All data in this column will be permanently removed. This cannot be undone.`, { danger: true });
  if (!ok) return;

  const columnIndex = ths.indexOf(thToDelete);
  thToDelete.remove();

  const tbodyTrs = table.querySelectorAll('tbody tr');
  tbodyTrs.forEach((tr) => {
    const tds = Array.from(tr.querySelectorAll('td'));
    const tdToRemove = tr.querySelector(`td[data-field="${targetPeriodName}"]`) ||
                       tr.querySelector(`td[data-field="Period ${periodNum}"]`) ||
                       tr.querySelector(`td[data-field="Period${periodNum}"]`);
    if (tdToRemove) {
      tdToRemove.remove();
    } else if (tds[columnIndex]) {
      tds[columnIndex].remove();
    }
  });

  Toast.success(`Deleted column "${targetPeriodName}". Click "Save Class Timetable" to save changes.`);
}

window.deleteClassColumn = deleteClassColumn;

async function createNewClassPrompt() {
  const classNameInput = await Dialog.input('New Class', 'Enter a class name to create a new timetable section.', { placeholder: 'e.g. 11A, 10B', icon: '🏫', confirmLabel: '➕ Create Class' });
  if (!classNameInput) return;
  
  const className = classNameInput.trim().toUpperCase().replace(/[^A-Z0-9]/ig, '');
  if (!className) {
    Toast.error('Invalid class name. Use only letters and numbers.');
    return;
  }
  
  // Verify it doesn't already exist
  const sel = document.getElementById('selectClass');
  const existingOptions = Array.from(sel.options).map(o => o.value.toUpperCase());
  if (existingOptions.includes(className)) {
    Toast.error(`Class "${className}" already exists.`);
    return;
  }
  
  Loading.show(`Creating class "${className}"...`);
  try {
    const defaultDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const rows = defaultDays.map(d => ({ Day: d }));
    
    const res = await api('/classes/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ className, rows })
    });
    
    if (res.success || !res.error) {
      Toast.success(`Class "${className}" created successfully!`);
      // Reload class list
      await loadClassesList();
      // Select the new class
      sel.value = className;
      loadClassEditor(className);
    } else {
      Toast.error('Failed to create class: ' + (res.message || res.error || 'Unknown error'));
    }
  } catch (err) {
    Toast.error('Failed to create class');
  } finally {
    Loading.hide();
  }
}

async function deleteCurrentClassPrompt() {
  const sel = document.getElementById('selectClass');
  if (!sel || !sel.value) {
    Toast.error('No class selected');
    return;
  }
  
  const className = sel.value;
  const confirmInput = await Dialog.input(
    `Delete Class ${className.toUpperCase()}`,
    `This will <strong>permanently delete all timetable data</strong> for <strong>${className.toUpperCase()}</strong>. Type the class name to confirm.`,
    { placeholder: className.toUpperCase(), icon: '🗑️', confirmLabel: 'Delete Forever', danger: true, hint: `Type "${className.toUpperCase()}" exactly to confirm deletion.` }
  );

  if (confirmInput === null) return;

  if (String(confirmInput).trim().toUpperCase() !== className.toUpperCase()) {
    Toast.error('Class name did not match. Deletion cancelled.');
    return;
  }
  
  Loading.show(`Deleting class "${className}"...`);
  try {
    const res = await api('/classes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ className })
    });
    
    if (res.success || !res.error) {
      Toast.success(`Class "${className.toUpperCase()}" deleted successfully.`);
      await loadClassesList();
    } else {
      Toast.error('Failed to delete class: ' + (res.message || res.error || 'Unknown error'));
    }
  } catch (err) {
    Toast.error('Failed to delete class');
  } finally {
    Loading.hide();
  }
}

window.createNewClassPrompt = createNewClassPrompt;
window.deleteCurrentClassPrompt = deleteCurrentClassPrompt;


/* ---------------- SUBSTITUTION SUMMARY ---------------- */

async function loadSubSummary() {
  const box = document.getElementById('subSummary');
  if (!box) return;
  try {
    const resp = await fetch('/output/substitute_audit.json');
    if (!resp.ok) {
      box.innerHTML = '<span class="sub-summary-empty">No substitutions yet. Approve a leave to auto-assign substitutes.</span>';
      return;
    }
    const a = await resp.json();
    if (!a || a.length === 0) {
      box.innerHTML = '<span class="sub-summary-empty">No substitutions yet. Approve a leave to auto-assign substitutes.</span>';
      return;
    }
    let rows = '';
    a.forEach(x => {
      const subName = x.substitute || 'UNASSIGNED';
      const subClass = subName === 'UNASSIGNED' ? 'unassigned' : '';
      rows += `<tr>
        <td><span class="sub-summary-badge class">${x.class}</span></td>
        <td>${x.day}</td>
        <td><span class="sub-summary-badge period">P${x.period}</span></td>
        <td><span class="sub-summary-absent-name">${x.original}</span></td>
        <td><span class="sub-summary-sub-name ${subClass}">${subName}</span>
            <br><span class="sub-summary-rule-tag">${x.rule || ''}</span></td>
      </tr>`;
    });
    box.innerHTML = `<table class="sub-summary-table">
      <thead><tr><th>Class</th><th>Day</th><th>Period</th><th>Absent Teacher</th><th>Substitute</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  } catch (e) {
    box.innerHTML = '<span class="sub-summary-empty">No substitutions yet. Approve a leave to auto-assign substitutes.</span>';
  }
}

/* ---------------- SUBSTITUTION PREVIEW MODAL ---------------- */

function buildSubPreviewContent(preview) {
  if (!preview || preview.length === 0) {
    return `<div class="sub-preview-empty-state">
      <div class="sub-preview-empty-icon">✅</div>
      <div class="sub-preview-empty-text">No timetable conflicts</div>
      <div class="sub-preview-empty-sub">This teacher has no scheduled classes during the leave period.</div>
    </div>`;
  }
  let cards = '';
  preview.forEach(x => {
    const subName = x.substitute || 'UNASSIGNED';
    const subClass = subName === 'UNASSIGNED' ? 'unassigned' : '';
    cards += `<div class="sub-assign-card">
      <div class="sub-assign-card-header">
        <span class="sub-assign-class-badge">${x.class}</span>
        <span class="sub-assign-day-label">${x.day}</span>
        <span class="sub-assign-period-badge">Period ${x.period}</span>
      </div>
      <div class="sub-assign-card-body">
        <div class="sub-assign-absent">
          <div class="sub-assign-absent-label">Absent</div>
          <div class="sub-assign-absent-name">${x.original}</div>
        </div>
        <div class="sub-assign-arrow">→</div>
        <div class="sub-assign-sub">
          <div class="sub-assign-sub-label">Substitute</div>
          <div class="sub-assign-sub-name ${subClass}">${subName}</div>
          ${x.rule ? `<div class="sub-assign-rule">${x.rule}</div>` : ''}
        </div>
      </div>
    </div>`;
  });
  return `<div class="sub-assign-grid">${cards}</div>`;
}

function showSubPreview(leaveId, onConfirm) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('subPreviewModal');
    const teacherLine = document.getElementById('subPreviewTeacherLine');
    const content = document.getElementById('subPreviewContent');
    const confirmBtn = document.getElementById('subPreviewConfirmBtn');
    const cancelBtn = document.getElementById('subPreviewCancelBtn');
    const closeBtn = document.getElementById('subPreviewClose');

    teacherLine.textContent = 'Loading substitution plan…';
    content.innerHTML = '<div style="text-align:center;padding:30px;color:#9ca3af;">Calculating assignments…</div>';
    overlay.style.display = 'flex';
    confirmBtn.disabled = true;

    fetch('/leave/preview-substitution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leaveId })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          teacherLine.textContent = `Absent: ${data.teacher}  •  ${data.dayNames && data.dayNames.length ? data.dayNames.join(', ') : 'Leave period'}`;
          content.innerHTML = buildSubPreviewContent(data.preview);
        } else {
          teacherLine.textContent = 'Could not load preview';
          content.innerHTML = buildSubPreviewContent([]);
        }
        confirmBtn.disabled = false;
      })
      .catch(() => {
        teacherLine.textContent = 'Preview unavailable';
        content.innerHTML = buildSubPreviewContent([]);
        confirmBtn.disabled = false;
      });

    function closeModal() {
      overlay.style.display = 'none';
      resolve(false);
    }

    confirmBtn.onclick = async () => {
      overlay.style.display = 'none';
      resolve(true);
      if (typeof onConfirm === 'function') await onConfirm();
    };
    cancelBtn.onclick = closeModal;
    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  });
}
/* ---------------- LEAVE PANEL CLOSE ---------------- */

// Global helper — called from both handleStatusChange (global) and renderLeaves (DOMContentLoaded scope)
function closeLeavePanel() {
  const leavePanelSec = document.getElementById('leavePanel');
  if (!leavePanelSec || leavePanelSec.style.display === 'none') return;

  leavePanelSec.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  leavePanelSec.style.opacity = '0';
  leavePanelSec.style.transform = 'translateY(-10px)';

  setTimeout(() => {
    leavePanelSec.style.display = 'none';

    const configCard = document.getElementById('configCard');
    const teachersSection = document.querySelector('section#configCard + section.card');
    const classEditorSection = document.querySelector('section#configCard + section.card + section.card');
    const draftPublishSection = document.getElementById('publishConfirm')?.closest('section.card');
    const reportsPanel = document.getElementById('reportsPanel');

    if (configCard) configCard.style.display = 'block';
    if (teachersSection) teachersSection.style.display = 'block';
    if (classEditorSection) classEditorSection.style.display = 'block';
    if (draftPublishSection) draftPublishSection.style.display = 'block';
    if (reportsPanel) reportsPanel.style.display = 'none';

    leavePanelSec.style.opacity = '1';
    leavePanelSec.style.transform = 'translateY(0)';
    leavePanelSec.style.transition = '';
  }, 500);
}

/* ---------------- LEAVE FILTER + CARD LOGIC ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
  const teacherSelect = document.getElementById("teacherSelect");
  const leaveCardPanel = document.getElementById("leaveCardPanel");

  if (!teacherSelect || !leaveCardPanel) return;

  // Load teacher names into dropdown
  const conf = await api("/config");
  teacherSelect.innerHTML = `<option value="">-- Select Teacher --</option>`;
  (conf.teachers || []).forEach(t => {
    const opt = document.createElement("option");
    opt.value = t["Teachers Name"];
    opt.textContent = t["Teachers Name"];
    teacherSelect.appendChild(opt);
  });

  // Ensure dropdown is reset to default
  teacherSelect.value = "";

  // Load cards initially only if panel is visible
  const leavePanelSection = document.getElementById('leavePanel');
  if (leavePanelSection && leavePanelSection.style.display !== 'none') {
    loadPendingOnly();
  }

  teacherSelect.addEventListener("change", (e) => {
    const selectedValue = e.target.value;
    const leaveCardPanel = document.getElementById('leaveCardPanel');
    
    // Clear the panel first
    if (leaveCardPanel) {
      leaveCardPanel.innerHTML = '<p style="padding: 20px; text-align: center;">Loading...</p>';
    }
    
    // Small delay to ensure UI updates
    setTimeout(() => {
      if (selectedValue === "" || selectedValue === null || selectedValue === undefined) {
        loadPendingOnly();
      } else {
        loadFilteredLeaves(selectedValue);
      }
    }, 50);
  });

// --- Show all applied leaves (prepopulated) when panel opens ---
async function loadPendingOnly() {
  const leavePanel = document.getElementById('leaveCardPanel');
  const noTeacherMessage = document.getElementById('noTeacherSelectedMessage');
  const leavePanelSection = document.getElementById('leavePanel');
  
  if (!leavePanel) return;

  if (leavePanelSection) {
    const inlineDisplay = leavePanelSection.style.display;
    const computedDisplay = window.getComputedStyle(leavePanelSection).display;
    if (inlineDisplay === 'none' || computedDisplay === 'none') return;
  }
  
  // Hide "no teacher selected" message - we show all leaves now
  if (noTeacherMessage) {
    noTeacherMessage.style.display = 'none';
  }
  
  // Show panel and load all leaves
  leavePanel.style.display = '';
  leavePanel.innerHTML = `<p style="padding: 20px; text-align: center;">Loading leaves...</p>`;

  try {
    const res = await api("/leave/list");
    const allLeaves = res.leaves || [];
    const today = new Date();

    if (allLeaves.length === 0) {
      leavePanel.innerHTML = `<p style="padding: 20px; text-align: center; color: #666;">No leave requests found.</p>`;
      return;
    }

    renderLeaves(allLeaves, today);

    // Default to showing Pending chip active
    const chips = document.querySelectorAll('.lv-chip');
    chips.forEach(c => c.classList.remove('active'));
    const pendingChip = document.querySelector('.lv-chip[data-filter="Pending"]');
    if (pendingChip) {
      pendingChip.classList.add('active');
      document.querySelectorAll('.lv-card').forEach(c => {
        c.style.display = c.dataset.status === 'Pending' ? '' : 'none';
      });
    }
  } catch (err) {
    leavePanel.innerHTML = '';
    const errP = document.createElement('p');
    errP.style.cssText = 'color:red; padding:20px; text-align:center;';
    errP.textContent = 'Failed to load leaves. Please try again.';
    leavePanel.appendChild(errP);
    Toast.error("Failed to load leaves");
  }
}

// --- Show all leaves for selected teacher ---
async function loadFilteredLeaves(teacherName) {
  const leavePanel = document.getElementById('leaveCardPanel');
  if (!leavePanel) return;

  const loadingP = document.createElement('p');
  loadingP.style.cssText = 'padding:20px; text-align:center;';
  loadingP.textContent = `Loading ${teacherName}'s leaves...`;
  leavePanel.innerHTML = '';
  leavePanel.appendChild(loadingP);

  try {
    const res = await api("/leave/list");
    const allLeaves = res.leaves || [];
    const today = new Date();

    // Filter by exact teacher name match
    const leaves = allLeaves.filter(l => {
      const teacher = (l.Teacher || '').toString().trim();
      return teacher === teacherName;
    });

    if (leaves.length === 0) {
      leavePanel.innerHTML = '';
      const noP = document.createElement('p');
      noP.style.cssText = 'padding:20px; text-align:center; color:#666;';
      noP.textContent = `No leaves found for ${teacherName}.`;
      leavePanel.appendChild(noP);
      return;
    }

    renderLeaves(leaves, today);
    // Default to All when viewing a specific teacher
    const chips = document.querySelectorAll('.lv-chip');
    chips.forEach(c => c.classList.remove('active'));
    const allChip = document.querySelector('.lv-chip[data-filter="all"]');
    if (allChip) allChip.classList.add('active');
  } catch (err) {
    leavePanel.innerHTML = '';
    const errP = document.createElement('p');
    errP.style.cssText = 'color:red; padding:20px; text-align:center;';
    errP.textContent = 'Failed to load leaves. Please try again.';
    leavePanel.appendChild(errP);
    Toast.error("Failed to load leaves");
  }
}

// --- Common rendering logic for both cases ---
function renderLeaves(leaves, today) {
  const leavePanel = document.getElementById('leaveCardPanel');
  if (!leavePanel) return;

  // Clear panel completely first
  leavePanel.innerHTML = "";

  // Wire up filter chips (idempotent)
  const chips = document.querySelectorAll('.lv-chip');
  chips.forEach(chip => {
    chip.onclick = () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const f = chip.dataset.filter;
      document.querySelectorAll('.lv-card').forEach(c => {
        c.style.display = (f === 'all' || c.dataset.status === f) ? '' : 'none';
      });
    };
  });

  if (!leaves || leaves.length === 0) {
    leavePanel.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No leaves found.</p>';
    return;
  }
  
  // sort by status
  leaves.sort((a, b) => {
    const order = { "Pending": 0, "Approved": 1, "Rejected": 2 };
    return (order[a.Status || "Pending"] ?? 0) - (order[b.Status || "Pending"] ?? 0);
  });

  const flexOrder = { "Pending": 0, "Approved": 1, "Rejected": 2 };

  leaves.forEach(l => {
    const status = l.Status || "Pending";
    const card = document.createElement("div");
    card.className = `leave-card lv-card lv-card-${status.toLowerCase()}`;
    card.dataset.id = l.id;
    card.dataset.status = status;
    card.style.order = (flexOrder[status] ?? 0);

    const leaveEnd = new Date(l.EndDate || l.StartDate);
    const isPast = leaveEnd <= today;

    const initials = (l.Teacher || '?').trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const statusIcon = status === 'Approved' ? '✅' : status === 'Rejected' ? '❌' : '⏳';
    const statusClass = status === 'Approved' ? 'lv-badge-approved' : status === 'Rejected' ? 'lv-badge-rejected' : 'lv-badge-pending';
    const days = Math.max(1, Math.round((new Date(l.EndDate) - new Date(l.StartDate)) / 86400000) + 1);

    card.innerHTML = `
      <div class="lv-card-stripe"></div>
      <div class="lv-card-top">
        <div class="lv-avatar">${initials}</div>
        <div class="lv-card-info">
          <div class="lv-teacher-name">${escHtml(l.Teacher)}</div>
          <div class="lv-dates">
            <span class="lv-date-chip">📅 ${escHtml(l.StartDate)}</span>
            <span class="lv-arrow">→</span>
            <span class="lv-date-chip">📅 ${escHtml(l.EndDate)}</span>
            <span class="lv-days-badge">${days}d</span>
          </div>
        </div>
        <span class="lv-status-badge ${statusClass}">${statusIcon} ${status}</span>
      </div>
      <div class="lv-card-reason">
        <span class="lv-reason-label">Reason</span>
        <span class="lv-reason-text">${escHtml(l.Reason || '—')}</span>
      </div>
      <div class="lv-card-actions"></div>
    `;

    const approveBtn = document.createElement("button");
    approveBtn.className = "lv-btn lv-btn-approve";
    approveBtn.textContent = "✅ Approve";
    const rejectBtn = document.createElement("button");
    rejectBtn.className = "lv-btn lv-btn-reject";
    rejectBtn.textContent = "❌ Reject";
    card.querySelector(".lv-card-actions").append(approveBtn, rejectBtn);

    card.classList.add(
      status === "Approved" ? "approved" : status === "Rejected" ? "rejected" : "pending"
    );

    // --- Disable logic: Disable both buttons if already approved or rejected ---
    if (l.Status === "Approved" || l.Status === "Rejected") {
      approveBtn.disabled = true;
      rejectBtn.disabled = true;
      approveBtn.style.opacity = "0.5";
      rejectBtn.style.opacity = "0.5";
      approveBtn.style.cursor = "not-allowed";
      rejectBtn.style.cursor = "not-allowed";
      card.style.opacity = "0.8";
    } else if (isPast) {
      approveBtn.disabled = true;
      rejectBtn.disabled = true;
      approveBtn.style.opacity = "0.5";
      rejectBtn.style.opacity = "0.5";
      card.style.opacity = "0.7";
    } else {
      approveBtn.disabled = false;
      rejectBtn.disabled = false;
      approveBtn.style.opacity = "1";
      rejectBtn.style.opacity = "1";
    }

    // --- Event logic: Only allow status change if pending ---
    if (l.Status === "Pending" && !isPast) {
      approveBtn.addEventListener("click", async () => {
        if (approveBtn.disabled) return;
        // Show substitution preview modal before confirming approval
        await showSubPreview(l.id, async () => {
          try {
            await updateLeave(l.id, "Approved");
            card.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
            card.style.opacity = "0";
            card.style.transform = "scale(0.9) translateY(10px)";
            setTimeout(() => {
              card.remove();
              closeLeavePanel();
            }, 400);
          } catch (err) {
            // Keep card if failure
          }
        });
      });

      rejectBtn.addEventListener("click", async () => {
        if (rejectBtn.disabled) return;
        try {
          await updateLeave(l.id, "Rejected");
          
          // Card fade-out animation
          card.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
          card.style.opacity = "0";
          card.style.transform = "scale(0.9) translateY(10px)";
          
          setTimeout(() => {
            card.remove();
            // Automatically close the panel with smooth fade
            closeLeavePanel();
          }, 400);
        } catch (err) {
          // Keep card if failure
        }
      });
    }

    leavePanel.appendChild(card);
  });
}

// Initialize Reports Panel after page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof initReportsPanel === 'function') {
      setTimeout(() => initReportsPanel(), 1000);
    }
  });
} else {
  if (typeof initReportsPanel === 'function') {
    setTimeout(() => initReportsPanel(), 1000);
  }
}








  async function updateLeave(id, status) {
    Loading.show(`${status === 'Approved' ? 'Approving' : 'Rejecting'} leave...`);
    try {
      // Get admin username from global variable or default to 'Admin'
      const approvedBy = window.loggedInAdmin || 'Admin';
      await api("/leave/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, approvedBy })
      });
      
      // Exact match for requested toast message
      Toast.success(`Leave ${status.toLowerCase()} successfully!`);

      // Reload data to stay synced
      setTimeout(() => {
        loadSubSummary();
      }, 500);
    } catch (err) {
      Toast.error(`Failed to ${status.toLowerCase()} leave`);
      throw err; // Re-throw to prevent animations on failure
    } finally {
      Loading.hide();
    }
  }
});

/* ============================================================
   Admin auto-polling — refreshes panels when data changes
   Polls /api/poll every 7 seconds, reacts only to real changes
   ============================================================ */
(function startAdminPolling() {
  let _last = null;

  async function poll() {
    try {
      const status = await fetch('/api/poll').then(r => r.json());
      if (!_last) { _last = status; return; }

      const leavePanelVisible = (() => {
        const el = document.getElementById('leavePanel');
        return el && el.style.display !== 'none' && window.getComputedStyle(el).display !== 'none';
      })();

      if (status.leaves !== _last.leaves) {
        if (leavePanelVisible && typeof loadPendingOnly === 'function') {
          loadPendingOnly();
        }
        if (typeof loadSubSummary === 'function') loadSubSummary();
        Toast.info('Leave data updated');
      }

      if (status.timetable !== _last.timetable) {
        Toast.success('Timetable published — reloading...');
        setTimeout(() => location.reload(), 3000);
      }

      if (status.teachers !== _last.teachers) {
        if (typeof loadTeachers === 'function') loadTeachers();
      }

      _last = status;
    } catch (_) { /* silent */ }
  }

  setTimeout(() => { poll(); setInterval(poll, 7000); }, 3000);
})();
