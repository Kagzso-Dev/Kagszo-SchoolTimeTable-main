// user portal

/* ==============================================
   UserDialog — custom modal system for user portal
   replaces native prompt() / confirm() / alert()
   ============================================== */
const UserDialog = (() => {
  function _injectStyles() {
    if (document.getElementById('udlg-styles')) return;
    const s = document.createElement('style');
    s.id = 'udlg-styles';
    s.textContent = `
.udlg-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;animation:udlg-in .18s ease}
@keyframes udlg-in{from{opacity:0}to{opacity:1}}
.udlg-box{background:#fff;border-radius:20px;width:100%;max-width:420px;box-shadow:0 24px 64px rgba(0,0,0,.22);overflow:hidden;animation:udlg-slide .22s cubic-bezier(.4,0,.2,1)}
@keyframes udlg-slide{from{transform:translateY(24px) scale(.96);opacity:0}to{transform:none;opacity:1}}
.udlg-header{padding:28px 28px 20px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);text-align:center}
.udlg-icon{font-size:36px;margin-bottom:10px;display:block}
.udlg-title{color:#fff;font-size:18px;font-weight:700;font-family:Poppins,sans-serif;margin:0}
.udlg-sub{color:rgba(255,255,255,.8);font-size:13px;margin:4px 0 0;font-family:Poppins,sans-serif}
.udlg-body{padding:24px 28px 8px}
.udlg-label{display:block;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;font-family:Poppins,sans-serif}
.udlg-field{position:relative;margin-bottom:16px}
.udlg-input{width:100%;padding:12px 14px 12px 42px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:Poppins,sans-serif;color:#1f2937;background:#f9fafb;outline:none;transition:border .18s,box-shadow .18s}
.udlg-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15);background:#fff}
.udlg-input-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none}
.udlg-msg{font-size:13.5px;color:#6b7280;text-align:center;margin-bottom:18px;font-family:Poppins,sans-serif;line-height:1.5}
.udlg-footer{padding:8px 28px 24px;display:flex;gap:10px;flex-direction:column}
.udlg-footer.row{flex-direction:row}
.udlg-btn{flex:1;padding:13px 20px;border:none;border-radius:12px;font-size:14px;font-weight:600;font-family:Poppins,sans-serif;cursor:pointer;transition:all .18s}
.udlg-btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
.udlg-btn-primary:hover{background:linear-gradient(135deg,#4f46e5,#7c3aed);transform:translateY(-1px)}
.udlg-btn-cancel{background:#f3f4f6;color:#374151}
.udlg-btn-cancel:hover{background:#e5e7eb}
.udlg-btn-danger{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff}
.udlg-btn-danger:hover{background:linear-gradient(135deg,#dc2626,#b91c1c);transform:translateY(-1px)}
.udlg-divider{height:1px;background:#f1f5f9;margin:0 28px 0}
`;
    document.head.appendChild(s);
  }

  function _open(opts) {
    _injectStyles();
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'udlg-overlay';

      const fieldsHtml = (opts.fields || []).map(f => `
        <div class="udlg-field">
          <label class="udlg-label">${f.label}</label>
          <div style="position:relative">
            <span class="udlg-input-icon">${f.icon || ''}</span>
            <input class="udlg-input" type="${f.type || 'text'}" placeholder="${f.placeholder || ''}" autocomplete="${f.autocomplete || 'off'}" id="udlg-f-${f.key}" />
          </div>
        </div>`).join('');

      overlay.innerHTML = `
        <div class="udlg-box">
          <div class="udlg-header">
            <span class="udlg-icon">${opts.icon || '🔐'}</span>
            <p class="udlg-title">${opts.title}</p>
            ${opts.sub ? `<p class="udlg-sub">${opts.sub}</p>` : ''}
          </div>
          <div class="udlg-body">
            ${opts.message ? `<p class="udlg-msg">${opts.message}</p>` : ''}
            ${fieldsHtml}
          </div>
          <div class="udlg-footer ${opts.rowBtns ? 'row' : ''}">
            <button class="udlg-btn ${opts.danger ? 'udlg-btn-danger' : 'udlg-btn-primary'}" id="udlg-ok">${opts.confirmLabel || 'OK'}</button>
            ${opts.showCancel !== false ? `<button class="udlg-btn udlg-btn-cancel" id="udlg-cancel">${opts.cancelLabel || 'Cancel'}</button>` : ''}
          </div>
        </div>`;

      document.body.appendChild(overlay);

      const firstInput = overlay.querySelector('.udlg-input');
      if (firstInput) setTimeout(() => firstInput.focus(), 60);

      const finish = (val) => { overlay.remove(); resolve(val); };

      overlay.querySelector('#udlg-ok').onclick = () => {
        const result = {};
        (opts.fields || []).forEach(f => {
          result[f.key] = (overlay.querySelector(`#udlg-f-${f.key}`) || {}).value || '';
        });
        finish(opts.fields ? result : true);
      };

      const cancelBtn = overlay.querySelector('#udlg-cancel');
      if (cancelBtn) cancelBtn.onclick = () => finish(null);

      overlay.addEventListener('keydown', e => {
        if (e.key === 'Enter') overlay.querySelector('#udlg-ok').click();
        if (e.key === 'Escape') finish(null);
      });
    });
  }

  return {
    login(title = 'Teacher Login', sub = 'Enter your credentials to continue') {
      return _open({
        icon: '👩‍🏫', title, sub,
        fields: [
          { key: 'username', label: 'Username', icon: '👤', type: 'text', placeholder: 'e.g. arjun.kumar', autocomplete: 'username' },
          { key: 'password', label: 'Password',  icon: '🔒', type: 'password', placeholder: 'Your password', autocomplete: 'current-password' }
        ],
        confirmLabel: 'Login', cancelLabel: 'Cancel', rowBtns: false
      });
    },
    password(title, message, { placeholder = 'Enter password', teacher = '' } = {}) {
      return _open({
        icon: '🔒', title,
        sub: teacher ? `Confirming for ${teacher}` : '',
        message,
        fields: [{ key: 'password', label: 'Password', icon: '🔒', type: 'password', placeholder }],
        confirmLabel: 'Confirm', rowBtns: false
      }).then(r => r ? r.password : null);
    },
    confirm(title, message, { danger = false, icon = '⚠️' } = {}) {
      return _open({
        icon, title, message,
        showCancel: true, rowBtns: true,
        confirmLabel: danger ? 'Yes, Cancel' : 'Confirm',
        cancelLabel: 'No, Keep It',
        danger, fields: []
      }).then(r => r === true);
    }
  };
})();

async function api(path, opts) {
  const r = await fetch(path, opts);
  return r.json();
}

/* ---------------------------
   State
   --------------------------- */
let publishedMeta = null;
let publishedData = []; // merged/published timetable (substituted when published)
let originalData = [];  // generated timetable (timetable.json)
let classesList = [];
let preferSubstitute = false; // Regular Timetable is default
let currentClass = null;
let currentTeacher = null;

function getActiveTimetableSource() {
  if (preferSubstitute && publishedData && publishedData.length > 0) return publishedData;
  return originalData || [];
}
/* ---------------------------
   Simple prompt-based login
   --------------------------- */
let isAuthenticated = false;
let loggedInUser = null;

function updateAuthUI() {
  const homeBtn = document.getElementById('homeBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const mobileHomeItem = document.getElementById('mobileHomeItem');
  const mobileLogoutItem = document.getElementById('mobileLogoutItem');
  if (isAuthenticated) {
    if (homeBtn) homeBtn.style.display = 'none';
    if (logoutBtn) {
      logoutBtn.style.display = '';
      logoutBtn.textContent = `🚪 Logout (${loggedInUser})`;
    }
    if (mobileHomeItem) mobileHomeItem.style.display = 'none';
    if (mobileLogoutItem) mobileLogoutItem.style.display = '';
  } else {
    if (homeBtn) homeBtn.style.display = '';
    if (logoutBtn) {
      logoutBtn.style.display = 'none';
      logoutBtn.textContent = '🚪 Logout';
    }
    if (mobileHomeItem) mobileHomeItem.style.display = '';
    if (mobileLogoutItem) mobileLogoutItem.style.display = 'none';
  }
}

async function ensureLogin() {
  if (isAuthenticated) return true;

  const creds = await UserDialog.login('Teacher Login', 'Enter your credentials to continue');
  if (!creds) { Toast.info("Login cancelled."); return false; }
  const username = (creds.username || '').trim();
  const password = (creds.password || '').trim();
  if (!username) { Toast.warning("Username cannot be empty."); return false; }
  if (!password) { Toast.warning("Password cannot be empty."); return false; }

  Loading.show("Verifying credentials...");
  try {
    const cfg = await api('/config');
    const teachers = cfg.teachers || [];

    const found = teachers.find(t => {
      const teacherUsername = (t["Username"] || t.username || t["Teachers Name"] || t.name || "").toLowerCase();
      const teacherPassword = (t["Password"] || t.password || "").toString();
      return teacherUsername === username.toLowerCase() && teacherPassword === password;
    });

    if (found) {
      isAuthenticated = true;
      loggedInUser = found["Teachers Name"];
      // Store globally for leave application
      window.loggedInTeacherName = loggedInUser;
      // Persist in sessionStorage — survives refresh but clears when tab is closed
      sessionStorage.setItem('teacherSession', JSON.stringify({ name: loggedInUser, at: Date.now() }));
      updateAuthUI();
      Toast.success(`Welcome, ${loggedInUser}!`);
      return true;
    } else {
      Toast.error("Invalid username or password.");
      return false;
    }
  } catch (_err) {
    Toast.error("Login failed. Please try again.");
    return false;
  } finally {
    Loading.hide();
  }
}


/* ---------------------------
   Init
   --------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  await initAdmin();

  // Restore teacher session if same tab was refreshed
  const saved = sessionStorage.getItem('teacherSession');
  if (saved) {
    try {
      const { name } = JSON.parse(saved);
      if (name) {
        isAuthenticated = true;
        loggedInUser = name;
        window.loggedInTeacherName = name;
        updateAuthUI();
      }
    } catch (_) { sessionStorage.removeItem('teacherSession'); }
  }

  // NOTE: sessionStorage is automatically destroyed by the browser when the tab is
  // closed — no manual cleanup needed. Clearing it in pagehide would also fire on
  // refresh and break the session-restore above, so we intentionally do NOT remove
  // it here. The browser handles tab-close cleanup correctly on its own.

  // Listen for admin logout broadcast — when admin closes their portal,
  // force all teacher sessions out immediately
  window.addEventListener('storage', (e) => {
    if (e.key === 'adminLogout' && e.newValue) {
      if (isAuthenticated) {
        const name = loggedInUser;
        isAuthenticated = false;
        loggedInUser = null;
        window.loggedInTeacherName = null;
        sessionStorage.removeItem('teacherSession');
        if (window._teacherPicker) window._teacherPicker.reset();
        updateAuthUI();
        // Hide teacher view, go back to classes list
        const viewArea = document.getElementById('viewArea');
        if (viewArea) viewArea.style.display = 'none';
        const leaveSection = document.getElementById('leaveSection');
        if (leaveSection) leaveSection.style.display = 'none';
        const classes = document.getElementById('classes');
        if (classes) { classes.style.display = 'grid'; }
        Toast.info(name ? `Session ended for ${name} — admin portal closed` : 'Session ended');
      }
    }
  });
});

async function initAdmin() {
  // load config & published initially
  Loading.show("Loading timetable...");
  try {
    await loadPublished();
    const cfg = await api('/config');
    classesList = Object.keys(cfg.classes || {});
    renderClassButtons();
    
    // Update school name from config
    const schoolName = cfg.school?.['School Name'] || cfg.school?.SchoolName || 'Kagzso School';
    const schoolElement = document.getElementById('school');
    if (schoolElement) {
      schoolElement.textContent = schoolName;
    }
  } catch (_err) {
    Toast.error("Failed to load timetable data");
  } finally {
    Loading.hide();
  }

  // wire up search
  const s = document.getElementById('search');
  if (s) s.addEventListener('input', e => filterGlobal(e.target.value));

  // tab buttons
  const tabC = document.getElementById('tabClass');
  const tabT = document.getElementById('tabTeacher');
  if (tabT) tabT.addEventListener('click', async () => {
    if (window._teacherPicker) window._teacherPicker.reset();
    currentTeacher = null;
    await switchTab('teacher');
  });

  if (tabC) tabC.addEventListener('click', async () => {
    if (window._teacherPicker) window._teacherPicker.reset();
    currentTeacher = null;
    await switchTab('class');
  });



  // add substitute toggle UI
  setTimeout(() => addToggleControl(), 200);

  // initial poll for updates
  pollForUpdates();
}
/* ---------------------------
   ADD-ON: Teacher dropdown integration (fixed)
   --------------------------- */
/* -------------------------------------------------------
   Custom Teacher Picker
   ------------------------------------------------------- */
function avatarColor(name) {
  const palette = [
    ['#6366f1','#4f46e5'], ['#8b5cf6','#7c3aed'], ['#ec4899','#db2777'],
    ['#10b981','#059669'], ['#f59e0b','#d97706'], ['#3b82f6','#2563eb'],
    ['#ef4444','#dc2626'], ['#14b8a6','#0d9488'], ['#f97316','#ea580c'],
    ['#a855f7','#9333ea'],
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % palette.length;
  return palette[Math.abs(h)];
}
function avatarInitials(name) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function createTeacherPicker(teachers, onSelect) {
  let selected = '';

  const picker = document.createElement('div');
  picker.className = 'teacher-picker';
  picker.id = 'teacherPicker';

  // ── Trigger button ──────────────────────────────────────
  const trigger = document.createElement('div');
  trigger.className = 'tp-trigger';

  const trigAvatar = document.createElement('div');
  trigAvatar.className = 'tp-avatar placeholder';
  trigAvatar.textContent = '👤';

  const trigLabel = document.createElement('span');
  trigLabel.className = 'tp-label placeholder-text';
  trigLabel.textContent = 'Select Teacher';

  const chevron = document.createElement('span');
  chevron.className = 'tp-chevron';
  chevron.textContent = '▼';

  trigger.appendChild(trigAvatar);
  trigger.appendChild(trigLabel);
  trigger.appendChild(chevron);

  // ── Panel ───────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.className = 'tp-panel';

  const searchWrap = document.createElement('div');
  searchWrap.className = 'tp-search-wrap';

  const searchInput = document.createElement('input');
  searchInput.className = 'tp-search';
  searchInput.type = 'text';
  searchInput.placeholder = '🔍 Search teacher...';
  searchWrap.appendChild(searchInput);

  const list = document.createElement('div');
  list.className = 'tp-list';

  panel.appendChild(searchWrap);
  panel.appendChild(list);
  picker.appendChild(trigger);
  picker.appendChild(panel);

  // ── Render list items ───────────────────────────────────
  function renderList(query) {
    list.innerHTML = '';
    const q = (query || '').toLowerCase();
    const filtered = teachers.filter(t => {
      const n = (t['Teachers Name'] || t.name || '').toLowerCase();
      return !q || n.includes(q);
    });
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'tp-empty';
      empty.textContent = 'No teachers found';
      list.appendChild(empty);
      return;
    }
    filtered.forEach(t => {
      const name = t['Teachers Name'] || t.name || '';
      const [bg, fg] = avatarColor(name);
      const item = document.createElement('div');
      item.className = 'tp-item' + (name === selected ? ' selected' : '');
      item.innerHTML = `
        <div class="tp-item-avatar" style="background:linear-gradient(135deg,${bg},${fg})">${avatarInitials(name)}</div>
        <span class="tp-item-name">${name}</span>
        <span class="tp-check">✓</span>`;
      item.addEventListener('click', () => {
        selected = name;
        close();
        updateTrigger(name);
        onSelect(name);
      });
      list.appendChild(item);
    });
  }

  // ── Update trigger appearance ───────────────────────────
  function updateTrigger(name) {
    if (name) {
      const [bg, fg] = avatarColor(name);
      trigAvatar.className = 'tp-avatar';
      trigAvatar.textContent = avatarInitials(name);
      trigAvatar.style.background = `linear-gradient(135deg,${bg},${fg})`;
      trigLabel.className = 'tp-label';
      trigLabel.textContent = name;
    } else {
      trigAvatar.className = 'tp-avatar placeholder';
      trigAvatar.textContent = '👤';
      trigAvatar.style.background = '';
      trigLabel.className = 'tp-label placeholder-text';
      trigLabel.textContent = 'Select Teacher';
    }
  }

  // ── Open / close ────────────────────────────────────────
  function open() {
    picker.classList.add('open');
    trigger.classList.add('open');
    renderList('');
    searchInput.value = '';
    setTimeout(() => searchInput.focus(), 50);
  }
  function close() {
    picker.classList.remove('open');
    trigger.classList.remove('open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.contains('open') ? close() : open();
  });

  searchInput.addEventListener('input', () => renderList(searchInput.value));
  searchInput.addEventListener('click', e => e.stopPropagation());

  document.addEventListener('click', (e) => {
    if (!picker.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // Public reset
  picker.reset = () => { selected = ''; updateTrigger(''); };
  // Public setValue (used to sync from openTeacher)
  picker.setValue = (name) => { selected = name || ''; updateTrigger(selected); };

  renderList('');
  return picker;
}

const _origInitAdmin = initAdmin;

initAdmin = async function () {
  await _origInitAdmin();

  try {
    const configRes = await fetch('/config');
    const config = await configRes.json();
    const teachers = config.teachers || [];

    if (!document.getElementById('teacherPicker') && teachers.length > 0) {
      const picker = createTeacherPicker(teachers, async (teacherName) => {
        if (!teacherName) return;
        const ok = await ensureLogin();
        if (!ok) { picker.reset(); return; }
        currentTeacher = teacherName;
        openTeacher(teacherName);
        const teacherTab = document.getElementById('tabTeacher');
        if (teacherTab && !teacherTab.classList.contains('active')) teacherTab.click();
      });

      // store ref so openTeacher can sync the picker label
      window._teacherPicker = picker;

      const teacherBtn = document.getElementById('tabTeacher');
      const toggleWrapper = document.getElementById('subToggleWrapper');
      if (teacherBtn && teacherBtn.parentNode) {
        teacherBtn.parentNode.insertBefore(picker, teacherBtn.nextSibling);
      } else if (toggleWrapper && toggleWrapper.parentNode) {
        toggleWrapper.parentNode.insertBefore(picker, toggleWrapper);
      } else {
        (document.querySelector('.view-header') || document.body).appendChild(picker);
      }
    }
  } catch (_err) {
    // Silent — teacher picker is optional enhancement
  }
};

// Keep a shim so existing code that does getElementById('teacherDropdown') doesn't crash
Object.defineProperty(document, '_teacherDropdownShim', { value: true, configurable: true });


/* ---------------------------
   UI: Class buttons
   --------------------------- */
function renderClassButtons() {
  const container = document.getElementById('classes');
  if (!container) return;

  // Inject section header just before the container (once)
  let header = document.getElementById('classesHeader');
  if (!header) {
    header = document.createElement('div');
    header.id = 'classesHeader';
    header.className = 'classes-header';
    header.innerHTML = '📚 Select a Class';
    container.parentNode.insertBefore(header, container);
  }

  const gradients = [
    'linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)',
    'linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%)',
    'linear-gradient(135deg,#ec4899 0%,#db2777 100%)',
    'linear-gradient(135deg,#10b981 0%,#059669 100%)',
    'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
    'linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)',
    'linear-gradient(135deg,#ef4444 0%,#dc2626 100%)',
    'linear-gradient(135deg,#14b8a6 0%,#0d9488 100%)',
    'linear-gradient(135deg,#f97316 0%,#ea580c 100%)',
    'linear-gradient(135deg,#a855f7 0%,#9333ea 100%)',
  ];

  container.innerHTML = '';
  classesList.forEach((c, idx) => {
    const b = document.createElement('button');
    b.className = 'class-btn';
    b.style.background = gradients[idx % gradients.length];
    b.innerHTML = `<div class="class-btn-inner">
      <span class="class-btn-label">${c.toUpperCase()}</span>
      <span class="class-btn-sub">View Timetable</span>
    </div>`;
    b.onclick = () => {
      currentClass = c;
      openClass(c);
    };
    container.appendChild(b);
  });
}

/* ---------------------------
   Load published/original data
   --------------------------- */
async function loadPublished(forceFetch = false) {
  // If not forcing a fetch and we already have published data, re-render from cache quickly
  if (!forceFetch && publishedData && publishedData.length > 0) {
    // No loading needed for cached data
    // update published info UI if we already have meta
    const el = document.getElementById('publishedInfo');
    if (el && publishedMeta && publishedMeta.published_at) {
      el.innerText = 'Published: ' + publishedMeta.published_at + (publishedMeta.version ? (' • ' + publishedMeta.version) : '');
    } else if (el) {
      el.innerText = '';
    }

    // re-render whatever view is currently visible
    const mode = document.getElementById('matrixArea')?.getAttribute('data-mode');
    if (mode === 'teacher' && currentTeacher) openTeacher(currentTeacher);
    else if (mode === 'class' && currentClass) openClass(currentClass);
    return;
  }

  // Fetch published (and update publishedMeta/publishedData)
  try {
    if (forceFetch) Loading.show("Refreshing timetable...");
    const p = await api('/published');
    publishedMeta = p || {};
    publishedData = (p && p.timetable) || [];

    const el = document.getElementById('publishedInfo');
    if (el) {
      el.innerText = publishedMeta && publishedMeta.published_at
        ? 'Published: ' + publishedMeta.published_at + (publishedMeta.version ? (' • ' + publishedMeta.version) : '')
        : '';
    }
  } catch (_err) {
    Toast.error("Failed to load published timetable");
    // keep previous publishedMeta/publishedData if any
    publishedMeta = publishedMeta || {};
    publishedData = publishedData || [];
  } finally {
    if (forceFetch) Loading.hide();
  }

  // Fetch published regular timetable so user sees last published regular data.
  try {
    const g = await api('/published_regular');
    originalData = (g && g.timetable) || [];
  } catch (_err) {
    // fallback to existing timetable.json if available
    try {
      const t = await api('/timetable');
      originalData = (t && t.timetable) || originalData || [];
    } catch (e) {
      originalData = originalData || [];
    }
  }

  // Re-render current view based on current mode (teacher/class)
  const mode = document.getElementById('matrixArea')?.getAttribute('data-mode');
  if (mode === 'teacher' && currentTeacher) openTeacher(currentTeacher);
  else if (mode === 'class' && currentClass) openClass(currentClass);
}


/* ---------------------------
   Open class (entry point)
   --------------------------- */
function openClass(className) {
  document.getElementById('viewArea').style.display = 'block';
  document.getElementById('viewTitle').innerText = className + ' — Class Timetable';
  if (window._teacherPicker) window._teacherPicker.reset();
  currentTeacher = null;
  currentClass = className;

  // which source to use (published merged substitutes vs original)
  const source = getActiveTimetableSource();
  const classKey = (className || '').toUpperCase();
  const rows = source.filter(r => (r.class || '').toUpperCase() === classKey);
  if (!rows || rows.length === 0) {
    document.getElementById('matrixArea').innerHTML = '<p style="padding:16px">No timetable available for this class.</p>';
    // update currentClass and reset mode attributes
    currentClass = className;
    currentTeacher = null;
    setMatrixAttributes(className, 'class');
    highlightTabs('class');
    return;
  }
  // store current class and reset currentTeacher (class view active)
  currentClass = className;
  currentTeacher = null;
  renderClassGridFromData(rows, className);
  highlightTabs('class');
}

/* Sort days Mon→Fri regardless of insertion order */
function sortDaysByWeekday(days) {
  const order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  return [...days].sort((a, b) => {
    const ai = order.findIndex(d => d.toLowerCase() === (a||'').toLowerCase());
    const bi = order.findIndex(d => d.toLowerCase() === (b||'').toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/* Helper to render class grid for arbitrary data rows */
function renderClassGridFromData(classRows, className) {
  document.getElementById('viewArea').style.display = 'block';
  document.getElementById('viewTitle').innerText = className + ' — Class Timetable';
  if (!classRows || classRows.length === 0) { document.getElementById('matrixArea').innerHTML = '<p style="padding:16px">No timetable available for this class.</p>'; return; }

  const days = sortDaysByWeekday([...new Set(classRows.map(r => r.day))]);
  const maxPeriod = Math.max(...classRows.map(r => r.period));
  let html = '<div class="matrix"><table><thead><tr><th>Day</th>';
  for (let i = 1; i <= maxPeriod; i++) html += '<th>Period ' + i + '</th>';
  html += '</tr></thead><tbody>';

  days.forEach(day => {
    html += '<tr><td class="day">' + day + '</td>';
    for (let p = 1; p <= maxPeriod; p++) {
      const cell = classRows.find(r => r.day === day && r.period === p);
      if (cell) html += renderCell(cell);
      else html += '<td></td>';
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  const matrixArea = document.getElementById('matrixArea');
  matrixArea.innerHTML = html;

  // make teacher chips clickable to open teacher view
  matrixArea.querySelectorAll('.chip.teacher').forEach(el => {
    el.style.cursor = 'pointer';
   el.addEventListener('click', async (e) => {
  const teacherName = e.currentTarget.innerText.split('\n')[0].trim();
  if (!teacherName) return;

  const ok = await ensureLogin();
  if (!ok) return;

  currentTeacher = teacherName;
  openTeacher(teacherName);
  highlightTabs('teacher');
});

  });

  setMatrixAttributes(className, 'class');
}

/* ---------------------------
   Build/view for both class & teacher (alternate approach)
   - Note: teacher view should be based on filtering by teacher,
     not just re-ordering class data. We'll use a dedicated openTeacher below.
   --------------------------- */

/* renderCell reused (keeps colors/substitute info identical) */
const subjectColorMap = {};
function subjectKey(subj) {
  return subj.toString().trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}
function colorFor(subject) {
  const key = subjectKey(subject);
  if (subjectColorMap[key]) return subjectColorMap[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  const bg = `hsl(${h} 85% 92%)`;
  const fg = `hsl(${h} 65% 30%)`;
  subjectColorMap[key] = { bg, fg };
  return subjectColorMap[key];
}
function renderCell(cell) {
  const subj = cell.subject || '';
  const teacher = cell.teacher || 'Not Assigned';
  const colors = colorFor(subj || 'other');

  // Identify cell state
  const isPreview = cell._preview;
  const isSubstituted = cell._substituted;

  // Define background color by state
  const bgColor = isSubstituted
    ? '#fff7e0' // yellow for actual substitution
    : isPreview
    ? '#e6f4ff' // blue for suggested (pending)
    : '#fff';   // white otherwise

  // Substitution / Suggestion note
  const note = cell._orig_teacher
    ? `<br/><small class="subnote">
        (${isPreview ? 'Suggested' : 'Substitute'} for ${cell._orig_teacher} - ${cell.sub_reason || 'Leave'})
      </small>`
    : '';

  // Add CSS classes for styling (optional)
  const previewClass = isPreview ? 'preview-substitute' : '';
  const substitutedClass = isSubstituted ? 'substituted' : '';

  // Render cell
  return `
    <td class="${substitutedClass} ${previewClass}" style="background:${bgColor}">
      <div class="chip subj" 
           style="background:${colors.bg};color:${colors.fg};
                  border-radius:8px;padding:6px 8px;
                  display:inline-block;font-weight:700">
        ${subj}
      </div>
      <div class="chip teacher" style="margin-top:6px;color:#444;font-weight:500">
        ${teacher}${note}
      </div>
    </td>`;
}



/* ---------------------------
   Teacher view: filter by teacher name and render a matrix across classes/days/periods
   --------------------------- */
function openTeacher(teacherName) {
  document.getElementById('viewArea').style.display = 'block';
  document.getElementById('viewTitle').innerText = teacherName + ' — Teacher Login';
  if (window._teacherPicker) window._teacherPicker.setValue(teacherName || '');
  currentTeacher = teacherName;


  // choose published vs original data based on preferSubstitute
  const source = getActiveTimetableSource();
  const rows = (source || []).filter(r => (r.teacher || '').toString().toLowerCase() === teacherName.toString().toLowerCase());
  if (!rows || rows.length === 0) {
    document.getElementById('matrixArea').innerHTML = '<p style="padding:16px">No timetable for this teacher.</p>';
    currentTeacher = teacherName;
    setMatrixAttributes(teacherName, 'teacher');
    highlightTabs('teacher');
    return;
  }

  // build days and periods for this teacher
  const days = sortDaysByWeekday([...new Set(rows.map(r => r.day))]);
  const maxPeriod = Math.max(...rows.map(r => r.period));
  // But teacher may have classes across multiple class names; we'll render periods with class label inside
  let html = '<div class="matrix"><table><thead><tr><th>Day</th>';
  for (let p = 1; p <= maxPeriod; p++) html += `<th>Period ${p}</th>`;
  html += '</tr></thead><tbody>';

  days.forEach(day => {
    html += `<tr><td class="day">${day}</td>`;
    for (let p = 1; p <= maxPeriod; p++) {
      // find the row for this teacher at this day+period
      const cell = rows.find(r => r.day === day && r.period === p);
      if (cell) {
        // to make it obvious this is teacher view, show teacher first & class/subject below
        const subj = cell.subject || '';
        const cls = cell.class || '';
        const colors = colorFor(subj || 'other');
        const substitute_note = cell.substitute_for ? `<br/><small class="subnote">(${cell.class} - Substitute for ${cell.substitute_for} - ${cell.sub_reason||'Leave'})</small>` : '';
        html += `<td style="background:${cell._substituted ? '#fff7e0' : '#fff'}">
          <div class="chip teacher" style="margin-bottom:6px;color:#111;font-weight:700;cursor:default">${cell.teacher}</div>
          <div class="chip subj" style="background:${colors.bg};color:${colors.fg};border-radius:6px;padding:4px 6px;display:inline-block">${subj} <small style="display:block;color:#666">(${cls})</small>${substitute_note}</div>
        </td>`;
      } else {
        html += '<td></td>';
      }
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  document.getElementById('matrixArea').innerHTML = html;

  // allow clicking a class label inside a teacher view to jump to that class
  document.querySelectorAll('.chip.subj').forEach(el => {
    // try to parse class from the small text inside if available
    el.addEventListener('click', () => {
      const small = el.querySelector('small');
      if (small) {
        const cls = small.innerText.replace(/[()]/g, '').trim();
        if (cls) {
          currentClass = cls;
          openClass(cls);
          highlightTabs('class');
        }
      }
    });
  });

  currentTeacher = teacherName;
  setMatrixAttributes(teacherName, 'teacher');
  highlightTabs('teacher');
}

/* ---------------------------
   Tab switching helpers
   --------------------------- */
async function switchTab(mode) {
  const tabClassBtn = document.getElementById('tabClass');
  const tabTeacherBtn = document.getElementById('tabTeacher');

  // If trying to open teacher tab, ensure login first
  if (mode === 'teacher') {
    const ok = await ensureLogin();
    if (!ok) {
      // revert UI toggle to class tab if login failed/cancelled
      if (tabClassBtn && tabTeacherBtn) {
        tabClassBtn.classList.add('active');
        tabTeacherBtn.classList.remove('active');
      }
      return; // stop here, don't open teacher timetable
    }
  }

  // update UI highlight normally
  if (tabClassBtn) tabClassBtn.classList.toggle('active', mode === 'class');
  if (tabTeacherBtn) tabTeacherBtn.classList.toggle('active', mode === 'teacher');

  if (mode === 'class') {
    if (currentClass) openClass(currentClass);
    else if (classesList.length > 0) {
      currentClass = classesList[0];
      openClass(currentClass);
    }
  } else if (mode === 'teacher') {
    if (window._teacherPicker) window._teacherPicker.reset();
    currentTeacher = null;
    
    // Show empty state or message instead of auto-selecting a teacher
    document.getElementById('viewArea').style.display = 'block';
    document.getElementById('viewTitle').innerText = 'Teacher Login';
    document.getElementById('matrixArea').innerHTML = '<p style="padding:16px;text-align:center;color:#666;">Please select a teacher from the dropdown above to view their timetable.</p>';
    setMatrixAttributes('', 'teacher');
  }
}



function highlightTabs(mode) {
  const tabClassBtn = document.getElementById('tabClass');
  const tabTeacherBtn = document.getElementById('tabTeacher');
  if (tabClassBtn) tabClassBtn.classList.toggle('active', mode === 'class');
  if (tabTeacherBtn) tabTeacherBtn.classList.toggle('active', mode === 'teacher');
}

function setMatrixAttributes(name, mode) {
  const el = document.getElementById('matrixArea');
  if (!el) return;
  el.setAttribute('data-current', name);
  el.setAttribute('data-mode', mode);
}

/* ---------------------------
   Regular <-> Substitute toggle (keeps original behavior)
   --------------------------- */
function addToggleControl() {
  const header = document.querySelector('.view-header');
  if (!header || document.getElementById('subToggleWrapper')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'subToggleWrapper';
  wrapper.className = 'show-toggle';

  const lbl = document.createElement('span');
  lbl.className = 'show-label';
  lbl.innerText = 'Show:';

  const opt1 = document.createElement('button');
  opt1.id = 'btnRegular';
  opt1.className = 'tab active';   // Regular is default active
  opt1.innerText = 'Regular Timetable';

  const opt2 = document.createElement('button');
  opt2.id = 'btnSubstitute';
  opt2.className = 'tab';
  opt2.innerText = 'Substitute Timetable';

  function rerender() {
    const mode = document.getElementById('matrixArea')?.getAttribute('data-mode');
    if (mode === 'teacher' && currentTeacher) openTeacher(currentTeacher);
    else if (mode === 'class' && currentClass) openClass(currentClass);
    else if (currentClass) openClass(currentClass);
    else if (currentTeacher) openTeacher(currentTeacher);
  }

  opt1.onclick = () => {
    preferSubstitute = false;
    opt1.classList.add('active');
    opt2.classList.remove('active');
    rerender();
  };

  opt2.onclick = async () => {
    preferSubstitute = true;
    opt2.classList.add('active');
    opt1.classList.remove('active');
    if (!publishedData || publishedData.length === 0) {
      await loadPublished(true);
    }
    rerender();
  };

  wrapper.appendChild(lbl);
  wrapper.appendChild(opt1);
  wrapper.appendChild(opt2);
  header.appendChild(wrapper);
}

/* ---------------------------
   Substitute banner (keeps existing behavior)
   --------------------------- */
function showSubstituteBanner(audit) {
  let banner = document.getElementById('subBanner');
  if (!banner) {
    banner = document.createElement('div'); banner.id = 'subBanner';
    banner.style.position = 'fixed'; banner.style.left = '0'; banner.style.right = '0'; banner.style.bottom = '0';
    banner.style.background = '#004aad'; banner.style.color = '#fff'; banner.style.padding = '10px 16px'; banner.style.fontWeight = '600';
    banner.style.zIndex = 9999; banner.style.overflow = 'hidden';
    const inner = document.createElement('div'); inner.id = 'subBannerInner';
    inner.style.whiteSpace = 'nowrap'; inner.style.display = 'inline-block'; inner.style.paddingLeft = '100%';
    inner.style.animation = 'scroll 20s linear infinite';
    banner.appendChild(inner);
    document.body.appendChild(banner);
    const s = document.createElement('style');
    s.innerHTML = '@keyframes scroll{0%{transform:translateX(0%)}100%{transform:translateX(-100%)}}';
    document.head.appendChild(s);
  }
  const inner = document.getElementById('subBannerInner');
  if (!audit || audit.length === 0) { banner.style.display = 'none'; return; }
  banner.style.display = 'block';
  inner.innerHTML = audit.map(x => `${x.class} - ${x.original} → ${x.substitute || 'UNASSIGNED'} (${x.reason || 'Leave'})`).join(' • ');
}

/* ---------------------------
   Global filter (keeps your original behavior)
   --------------------------- */
function filterGlobal(q) {
  q = (q || '').toString().toLowerCase();
  if (!q) return;
  const filtered = getActiveTimetableSource().filter(r =>
    (r.class || '').toString().toLowerCase().includes(q) ||
    (r.teacher || '').toString().toLowerCase().includes(q) ||
    (r.subject || '').toString().toLowerCase().includes(q) ||
    (r.day || '').toString().toLowerCase().includes(q)
  );
  let html = '<div class="matrix"><table><thead><tr><th>Class</th><th>Day</th><th>Period</th><th>Time</th><th>Subject</th><th>Teacher</th></tr></thead><tbody>';
  filtered.forEach(r => {
    html += `<tr><td>${r.class}</td><td>${r.day}</td><td>${r.period}</td><td>${r.time}</td><td>${r.subject}</td><td>${r.teacher}</td></tr>`;
  });
  html += '</tbody></table></div>';
  document.getElementById('matrixArea').innerHTML = html;
  document.getElementById('viewArea').style.display = 'block';
}

/* ---------------------------
   Poll for updates (keeps original behavior)
   --------------------------- */
function pollForUpdates() {
  setInterval(async () => {
    try {
      const p = await api('/published');
      if (!publishedMeta || p.published_at !== publishedMeta.published_at) {
        // update published metadata then refresh both published + live generated timetable
        // Skip refresh if Leave Section is visible to avoid interfering with leave application
        const leaveSection = document.getElementById('leaveSection');
        if (leaveSection && leaveSection.style.display === 'block') {
          publishedMeta = p;
          publishedData = p.timetable || [];
          if (document.getElementById('publishedInfo'))
            document.getElementById('publishedInfo').innerText = 'Published: ' + (p.published_at || '');
          return;
        }

        // Force a fresh load which will call /generate to pick up DB changes
        await loadPublished(true);
      }
    } catch (_err) {
      // Silent polling failure — will retry next interval
    }
  }, 15000);
}



/* ---------------------------
   Expose a small API for admin login action (keeps your existing route)
   Example usage in admin UI: call api('/api/login', {method:'POST', headers:{...}, body: JSON.stringify({...})})
   --------------------------- */

// end of file

// --- FIX: make tab buttons actually work ---
// function switchTab(mode) {
//   const tabClassBtn = document.getElementById('tabClass');
//   const tabTeacherBtn = document.getElementById('tabTeacher');

//   // visually toggle active color
//   tabClassBtn.classList.toggle('active', mode === 'class');
//   tabTeacherBtn.classList.toggle('active', mode === 'teacher');

//   // functional logic
//   if (mode === 'class') {
//     if (currentClass) {
//       openClass(currentClass);
//     } else if (publishedData.length > 0) {
//       currentClass = publishedData[0].class;
//       openClass(currentClass);
//     }
//   } else if (mode === 'teacher') {
//     if (currentTeacher) {
//       openTeacher(currentTeacher);
//     } else if (publishedData.length > 0) {
//       currentTeacher = publishedData[0].teacher;
//       openTeacher(currentTeacher);
//     }
//   }
// }
// ===============================
// HOME BUTTON
// ===============================
document.getElementById('homeBtn').addEventListener('click', () => {
  // Hide leave section
  const leaveSection = document.getElementById('leaveSection');
  if (leaveSection) {
    leaveSection.style.display = 'none';
  }
  
  // Hide view area (timetable view)
  const viewArea = document.getElementById('viewArea');
  if (viewArea) {
    viewArea.style.display = 'none';
  }
  
  // Show main classes list with proper spacing
  const classes = document.getElementById('classes');
  if (classes) {
    classes.style.display = 'flex'; // Use flex to maintain proper layout
    classes.style.marginTop = '16px'; // Ensure proper gap from search bar
  }
  
  // Show search bar if hidden
  const search = document.querySelector('.search');
  if (search) {
    search.style.display = 'block';
  }
  
  // Reset search
  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.value = '';
  }
});

// ===============================
// LOGOUT BUTTON
// ===============================
document.getElementById('logoutBtn').addEventListener('click', () => {
  const name = loggedInUser;
  isAuthenticated = false;
  loggedInUser = null;
  window.loggedInTeacherName = null;
  sessionStorage.removeItem('teacherSession');

  // Reset teacher tab label
  const tabTeacher = document.getElementById('tabTeacher');
  if (tabTeacher) tabTeacher.textContent = 'Teacher Login';

  // Reset teacher picker selection
  if (window._teacherPicker) window._teacherPicker.reset();
  currentTeacher = null;

  // Go back to home (classes list)
  const leaveSection = document.getElementById('leaveSection');
  if (leaveSection) leaveSection.style.display = 'none';
  const viewArea = document.getElementById('viewArea');
  if (viewArea) viewArea.style.display = 'none';
  const classes = document.getElementById('classes');
  if (classes) { classes.style.display = 'flex'; classes.style.marginTop = '16px'; }
  const search = document.querySelector('.search');
  if (search) search.style.display = 'block';
  const searchInput = document.getElementById('search');
  if (searchInput) searchInput.value = '';

  updateAuthUI();
  Toast.info(name ? `Logged out from ${name}` : 'Logged out');
});

// ===============================
// LEAVE APPLY SECTION
// ===============================
document.getElementById('leaveApplyBtn').addEventListener('click', async () => {
  const ok = await ensureLogin();
  if (!ok) return;

  // Hide main view
  const viewArea = document.getElementById('viewArea');
  const classes = document.getElementById('classes');
  if (viewArea) {
    viewArea.style.display = 'none';
  }
  if (classes) {
    classes.style.display = 'none';
  }

  // Show leave section
  document.getElementById('leaveSection').style.display = 'block';
  await initLeaveSection();
});


async function initLeaveSection() {
  // Get logged-in teacher name from ensureLogin
  const loggedInTeacher = window.loggedInTeacherName || null;
  
  const teacherSelect = document.getElementById('leaveTeacher');
  
  if (loggedInTeacher) {
    // User is logged in - only show their name, pre-select it, and disable dropdown
    teacherSelect.innerHTML = `<option value="${loggedInTeacher}" selected>${loggedInTeacher}</option>`;
    teacherSelect.disabled = true;
    teacherSelect.style.backgroundColor = '#f3f4f6';
    teacherSelect.style.cursor = 'not-allowed';
    
    // Add a note that they can only apply for themselves
    const label = teacherSelect.previousElementSibling;
    if (label && label.tagName === 'LABEL') {
      label.textContent = `Teacher (Logged in as: ${loggedInTeacher})`;
    }
  } else {
    // No login - show all teachers (fallback for backward compatibility)
    const res = await fetch('/config');
    const data = await res.json();
    teacherSelect.innerHTML = `<option value="">Select Teacher</option>`;
    (data.teachers || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t['Teachers Name'];
      opt.textContent = t['Teachers Name'];
      teacherSelect.appendChild(opt);
    });
  }

  // Load existing leaves
  loadLeaveCards();
}

// Load teacher-specific cards
async function loadLeaveCards() {
  const selected = document.getElementById('leaveTeacher').value;
  const container = document.getElementById('leaveCards');
  container.innerHTML = '<p style="padding:10px;color:#555;">Loading leaves...</p>';
  
  try {
    const res = await fetch('/leave/list');
    const data = await res.json();

  const today = new Date();

  // 🧩 Filter logic
  const filteredLeaves = (data.leaves || []).filter(l => {
    if (selected) {
      // ✅ When teacher is selected — show ALL leaves (past + present + future)
      return l.Teacher === selected;
    } else {
      // ✅ Default view — only show ongoing or upcoming leaves (any status)
      // start date checked implicitly via end >= today
      const end = new Date(l.EndDate || l.StartDate);
      return end >= today; // includes ongoing and future
    }
  });

  // 🧩 Sort logic
  // Try to use CreatedAt if available; otherwise fall back to StartDate.
  filteredLeaves.sort((a, b) => {
    const aTime = new Date(a.CreatedAt || a.StartDate).getTime();
    const bTime = new Date(b.CreatedAt || b.StartDate).getTime();
    return bTime - aTime; // latest applied first
  });

  // 🧩 Render cards
  if (filteredLeaves.length === 0) {
    container.innerHTML = `<p style="padding:10px;color:#555;">No upcoming or ongoing leaves.</p>`;
    return;
  }

  const statusIcon = { pending: '⏳', approved: '✅', rejected: '❌', cancelled: '🚫' };
  filteredLeaves.forEach(l => {
    const status = (l.Status || '').toLowerCase();
    const card = document.createElement('div');
    card.className = `leave-card status-${status}`;
    card.innerHTML = `
      <div class="leave-card-teacher">${l.Teacher}</div>
      <div class="leave-card-row"><span class="row-icon">📅</span> <span><strong>From:</strong> ${l.StartDate}</span></div>
      <div class="leave-card-row"><span class="row-icon">📅</span> <span><strong>To:</strong> ${l.EndDate}</span></div>
      <div class="leave-card-row"><span class="row-icon">💬</span> <span>${l.Reason || '—'}</span></div>
      <span class="status ${status}">${statusIcon[status] || ''} ${l.Status}</span>
      <button class="cancel-btn" ${status !== 'pending' ? 'disabled' : ''}>Cancel Leave</button>
    `;
    card.querySelector('.cancel-btn').addEventListener('click', () => cancelLeave(l.id));
    container.appendChild(card);
  });

    // smooth scroll to top after refresh
    container.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    container.innerHTML = '<p style="padding:10px;color:red;">Failed to load leaves. Please try again.</p>';
    Toast.error("Failed to load leave cards");
  }
}



async function cancelLeave(id) {

  // Confirm delete first
  const confirmed = await UserDialog.confirm('Cancel Leave', 'Are you sure you want to cancel this leave request?', { danger: true, icon: '🗑️' });
  if (!confirmed) return;

  Loading.show("Loading leave details...");
  try {
    // 🧩 Fetch leave details to know which teacher applied
    const resList = await fetch('/leave/list');
    const dataList = await resList.json();
    const leave = (dataList.leaves || []).find(l => l.id === id);

    if (!leave) {
      Toast.error("Leave not found!");
      Loading.hide();
      return;
    }

    const teacherName = leave.Teacher;
    const cfg = await api('/config');
    const teachers = cfg.teachers || [];
    const teacherObj = teachers.find(t =>
      (t["Teachers Name"] || "").toLowerCase() === teacherName.toLowerCase()
    );

    if (!teacherObj) {
      Toast.error("Teacher not found in config!");
      Loading.hide();
      return;
    }

    Loading.hide();
    const enteredPassword = await UserDialog.password('Confirm Cancellation', null, { placeholder: 'Enter your password', teacher: teacherName });
    if (!enteredPassword) {
      Toast.info("Cancellation cancelled — password required.");
      return;
    }

    const teacherPassword = teacherObj["Password"] || teacherObj.password || "";
    if (!teacherPassword) {
      Toast.error("No password set for this teacher. Please set a password in the admin panel first.");
      return;
    }
    
    if (enteredPassword.toString() !== teacherPassword.toString()) {
      Toast.error("Incorrect password. Leave not cancelled.");
      return;
    }

    // ✅ Password verified, proceed with deletion
    Loading.show("Cancelling leave...");
    const res = await fetch('/leave/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });

    const data = await res.json();
    if (data.success) {
      Toast.success('Leave cancelled successfully!');
      loadLeaveCards();
    } else {
      Toast.error('Error cancelling leave: ' + (data.message || 'Unknown error'));
    }
  } catch (_err) {
    Toast.error("Something went wrong while cancelling leave.");
  } finally {
    Loading.hide();
  }
}
  



// Handle form submit
// Handle form submit with teacher password verification
document.getElementById('leaveForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const Teacher = document.getElementById('leaveTeacher').value;
  const StartDate = document.getElementById('leaveStart').value;
  const EndDate = document.getElementById('leaveEnd').value;
  const Reason = document.getElementById('leaveReason').value.trim();

  if (!Teacher || !StartDate || !EndDate || !Reason) {
    Toast.warning('Please fill all fields!');
    return;
  }

  Loading.show("Validating teacher...");
  try {
    // 🧩 Fetch config to validate teacher password
    const cfg = await api('/config');
    const teachers = cfg.teachers || [];
    const teacherObj = teachers.find(t => (t["Teachers Name"] || "").toLowerCase() === Teacher.toLowerCase());

    if (!teacherObj) {
      Toast.error("Teacher not found in configuration!");
      Loading.hide();
      return;
    }

    Loading.hide();
    
    // Check if user is logged in and trying to apply for themselves
    const loggedInTeacher = window.loggedInTeacherName || null;
    if (loggedInTeacher && Teacher.toLowerCase() !== loggedInTeacher.toLowerCase()) {
      Toast.error(`You can only apply leave for yourself (${loggedInTeacher}).`);
      return;
    }
    
    // If not logged in, prompt for password
    if (!loggedInTeacher) {
      const enteredPassword = await UserDialog.password('Verify Identity', null, { placeholder: 'Enter your password', teacher: Teacher });
      if (!enteredPassword) {
        Toast.info("Leave not applied — password required.");
        return;
      }

      const teacherPassword = teacherObj["Password"] || teacherObj.password || "";
      if (!teacherPassword) {
        Toast.error("No password set for this teacher. Please set a password in the admin panel first.");
        return;
      }
      
      if (enteredPassword.toString() !== teacherPassword.toString()) {
        Toast.error("Incorrect password! Leave not applied.");
        return;
      }
    }

    // ✅ Password validated — proceed to apply leave
    Loading.show("Applying for leave...");
    const res = await fetch('/leave/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Teacher, StartDate, EndDate, Reason })
    });

    const data = await res.json();
    if (data.success) {
      Toast.success('Leave applied successfully!');
      document.getElementById('leaveForm').reset();
      loadLeaveCards();
    } else {
      Toast.error('Error applying leave: ' + (data.message || 'Unknown error'));
    }

  } catch (_err) {
    Toast.error("Something went wrong while applying leave.");
  } finally {
    Loading.hide();
  }
});


// Reload cards when teacher changes
document.getElementById('leaveTeacher').addEventListener('change', loadLeaveCards);

/* ============================================================
   User portal auto-polling — refreshes timetable & leave status
   Polls /api/poll every 7 seconds, reacts only to real changes
   ============================================================ */
(function startUserPolling() {
  let _last = null;

  async function poll() {
    try {
      const status = await fetch('/api/poll').then(r => r.json());
      if (!_last) { _last = status; return; }

      if (status.timetable !== _last.timetable) {
        // Reload timetable data silently, then refresh current view
        try {
          const tRes = await fetch('/timetable');
          const tData = tRes.ok ? await tRes.json() : null;
          if (tData) originalData = tData;
          const pRes = await fetch('/published');
          const pData = pRes.ok ? await pRes.json() : null;
          if (pData) publishedData = pData;
          if (currentClass) openClass(currentClass);
          else if (currentTeacher) openTeacher(currentTeacher);
        } catch (_) {}
        Toast.success('Timetable updated!');
      }

      if (status.leaves !== _last.leaves) {
        const leaveSection = document.getElementById('leaveSection');
        const isVisible = leaveSection && leaveSection.style.display !== 'none';
        if (isVisible && typeof loadLeaveCards === 'function') loadLeaveCards();
        else Toast.info('Leave status updated');
      }

      _last = status;
    } catch (_) { /* silent */ }
  }

  setTimeout(() => { poll(); setInterval(poll, 7000); }, 3000);
})();



