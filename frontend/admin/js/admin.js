/* ═══════════════════════════════════════════════════════════
   AERIS CONTROL CENTER — Admin Portal JavaScript  (FIXED)
   ═══════════════════════════════════════════════════════════ */

/* ── CONFIG: Change port here if your backend is on a different port ── */
const ADMIN_API_BASE = 'http://localhost:8000/api';

/* ── Admin credentials ─────────────────────────────────────── */
const ADMIN_CREDENTIALS = { email: 'admin@aeris.gov', password: 'admin2025' };

/* ── Admin Session ─────────────────────────────────────────── */
const AdminSession = {
  get()    { try { return JSON.parse(sessionStorage.getItem('aeris_admin')); } catch { return null; } },
  set(v)   { sessionStorage.setItem('aeris_admin', JSON.stringify(v)); },
  clear()  { sessionStorage.removeItem('aeris_admin'); },
  isAuth() { return !!this.get(); },
};

/* ── API Layer ─────────────────────────────────────────────── */
const AdminAPI = {
  async req(method, path, body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(ADMIN_API_BASE + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  },
  getAllUsers:       ()    => AdminAPI.req('GET', '/users'),
  getRiskStats:     ()    => AdminAPI.req('GET', '/risk/stats'),
  getReportsByLevel:(lv)  => AdminAPI.req('GET', `/risk/level/${lv}`),
  getCityAnalysis:  (loc) => AdminAPI.req('GET', `/pollution/city-analysis?location=${encodeURIComponent(loc)}`),
  getAllRecs:        ()    => AdminAPI.req('GET', '/recommendations'),
};

/* ── Safe fallback for all API calls ───────────────────────── */
const safe = fn => fn.catch(() => ({ data: [] }));
const safeObj = fn => fn.catch(() => ({ data: {} }));

/* ── Helpers ───────────────────────────────────────────────── */
function aToast(msg, type = 'info') {
  const c = document.getElementById('a-toasts');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `a-toast ${type}`;
  const icons = { success: 'check-circle', error: 'circle-xmark', info: 'circle-info' };
  el.innerHTML = `<i class="fa-solid fa-${icons[type] || 'circle-info'}"></i>&nbsp; ${msg}`;
  c.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 4300);
}

function aLoading(show, msg = 'LOADING DATA...') {
  const el = document.getElementById('a-loading');
  if (!el) return;
  if (show) {
    el.classList.remove('hidden');
    const tx = el.querySelector('.a-loading-text');
    if (tx) tx.textContent = msg;
  } else {
    el.classList.add('hidden');
  }
}

function aSetEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = (val !== null && val !== undefined) ? val : '—';
}

function aCounter(el, target, dur = 1000) {
  if (!el) return;
  const s = performance.now();
  (function tick(now) {
    const p = Math.min((now - s) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * e);
    if (p < 1) requestAnimationFrame(tick);
  })(s);
}

function aRiskColor(level) {
  return { LOW: '#00ff88', MODERATE: '#ffaa00', HIGH: '#ff6600', CRITICAL: '#ff3366' }[level] || '#6b82a0';
}

function aBadgeCls(level) {
  return { LOW: 'a-badge-low', MODERATE: 'a-badge-moderate', HIGH: 'a-badge-high', CRITICAL: 'a-badge-critical' }[level] || 'a-badge-low';
}

function aAqiColor(aqi) {
  if (!aqi || aqi <= 50)  return '#00ff88';
  if (aqi <= 100) return '#ffaa00';
  if (aqi <= 150) return '#ff6600';
  if (aqi <= 200) return '#ff3366';
  if (aqi <= 300) return '#8b5cf6';
  return '#ff0000';
}

function aProgressBar(name, value, max, color, unit = '') {
  const safe_val = isNaN(value) ? 0 : value;
  const pct      = Math.min((safe_val / max) * 100, 100).toFixed(1);
  return `<div class="a-progress-row">
    <div class="a-progress-hdr">
      <span class="a-progress-name">${name}</span>
      <span class="a-progress-val">${safe_val}${unit}</span>
    </div>
    <div class="a-progress-track">
      <div class="a-progress-fill" style="width:0%;background:${color}" data-t="${pct}"></div>
    </div>
  </div>`;
}

function aAnimateBars(el) {
  if (!el) return;
  el.querySelectorAll('.a-progress-fill[data-t]').forEach(b =>
    setTimeout(() => { b.style.width = b.dataset.t + '%'; }, 100));
}

function safeArr(val) {
  return Array.isArray(val) ? val : [];
}

/* ── Particles ─────────────────────────────────────────────── */
function initAdminParticles() {
  const canvas = document.getElementById('a-particles');
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    });
    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.2 + 0.3,
      dx: (Math.random() - 0.5) * 0.22,
      dy: (Math.random() - 0.5) * 0.22,
      a: Math.random() * 0.35 + 0.08,
      col: Math.random() > 0.6 ? '#00ff88' : '#00d4ff',
    }));
    (function draw() {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > W) p.dx *= -1;
        if (p.y < 0 || p.y > H) p.dy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.col; ctx.globalAlpha = p.a; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 80) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = '#00ff88'; ctx.globalAlpha = (1 - d / 80) * 0.06;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    })();
  } catch (e) { /* canvas not supported */ }
}

/* ── Router ────────────────────────────────────────────────── */
const ARouter = {
  go(pageId) {
    try {
      document.querySelectorAll('.a-page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.a-nav-item').forEach(n => n.classList.remove('active'));

      const page = document.getElementById('ap-' + pageId);
      if (page) {
        page.classList.add('active');
        const main = document.querySelector('.a-main');
        if (main) main.scrollTop = 0;
      }

      document.querySelectorAll(`[data-page="${pageId}"]`).forEach(n => n.classList.add('active'));

      const titles = {
        overview: 'System Overview',   users:    'User Management',
        pollution:'Pollution Monitoring', city:  'City AQI Monitor',
        trends:   'AQI Trends',        alerts:   'Emergency Alerts',
        reports:  'Report Management', recs:     'Recommendations',
        zones:    'High Risk Zones',
      };
      aSetEl('a-topbar-title', titles[pageId] || 'Admin Control Center');
      this._onNav(pageId);
    } catch (err) {
      console.error('Router error:', err);
    }
  },
  _onNav(id) {
    switch (id) {
      case 'overview':  initOverview();  break;
      case 'users':     initUsers();     break;
      case 'pollution': initPollution(); break;
      case 'city':      /* on-demand */  break;
      case 'trends':    initTrends();    break;
      case 'alerts':    initAlerts();    break;
      case 'reports':   initReports();   break;
      case 'zones':     initZones();     break;
      case 'recs':      initRecs();      break;
    }
  },
};

/* ── Login ─────────────────────────────────────────────────── */
function initAdminLogin() {
  const form = document.getElementById('admin-login-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = form.al_email.value.trim();
    const pass  = form.al_pass.value;
    const errEl = document.getElementById('login-err');
    const btn   = form.querySelector('[type=submit]');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
    if (errEl) errEl.classList.remove('show');

    await new Promise(r => setTimeout(r, 500));

    if (email === ADMIN_CREDENTIALS.email && pass === ADMIN_CREDENTIALS.password) {
      AdminSession.set({ email, name: 'System Admin', role: 'SUPER_ADMIN', loginAt: new Date().toISOString() });
      _showAdminApp();
    } else {
      if (errEl) {
        errEl.classList.add('show');
        errEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>&nbsp; Invalid credentials. Access denied.';
      }
      aToast('Authentication failed', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Access Control Center';
  });
}

/* ── FIX: Use style.display directly, never fight inline style ── */
function _showAdminApp() {
  const loginScreen = document.getElementById('admin-login-screen');
  const app         = document.getElementById('admin-app');
  if (loginScreen) loginScreen.style.display = 'none';
  if (app) {
    app.style.display    = 'flex';
    app.style.minHeight  = '100vh';
  }
  updateAdminChip();
  startClock();
  ARouter.go('overview');
  setTimeout(() => aToast('Access granted. Welcome, Admin.', 'success'), 100);
}

function adminLogout() {
  AdminSession.clear();
  const loginScreen = document.getElementById('admin-login-screen');
  const app         = document.getElementById('admin-app');
  if (app)         app.style.display         = 'none';
  if (loginScreen) loginScreen.style.display = '';
  aToast('Signed out of Admin Portal', 'info');
}

function updateAdminChip() {
  const s = AdminSession.get();
  if (!s) return;
  aSetEl('a-admin-name-chip', s.name || 'Admin');
}

function startClock() {
  function tick() {
    const now = new Date();
    const str = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    aSetEl('a-clock', str);
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Sidebar toggle ────────────────────────────────────────── */
function initAdminSidebar() {
  const btn = document.getElementById('a-hamburger');
  const sb  = document.getElementById('a-sidebar');
  const ov  = document.getElementById('a-overlay');
  if (btn) btn.addEventListener('click', () => {
    if (sb) sb.classList.toggle('open');
    if (ov) ov.style.display = ov.style.display === 'block' ? 'none' : 'block';
  });
  if (ov) ov.addEventListener('click', () => {
    if (sb) sb.classList.remove('open');
    ov.style.display = 'none';
  });
}

/* ═══════════════════════════════════════════════════════════
   PAGE: SYSTEM OVERVIEW
   ═══════════════════════════════════════════════════════════ */
let _ovCharts = {};

async function initOverview() {
  try {
    aLoading(true, 'LOADING OVERVIEW...');

    const [statsRes, usersRes, critRes, highRes, modRes, lowRes] = await Promise.all([
      safeObj(AdminAPI.getRiskStats()),
      safe(AdminAPI.getAllUsers()),
      safe(AdminAPI.getReportsByLevel('CRITICAL')),
      safe(AdminAPI.getReportsByLevel('HIGH')),
      safe(AdminAPI.getReportsByLevel('MODERATE')),
      safe(AdminAPI.getReportsByLevel('LOW')),
    ]);

    const stats    = statsRes.data  || {};
    const users    = safeArr(usersRes.data);
    const critical = safeArr(critRes.data);
    const high     = safeArr(highRes.data);
    const moderate = safeArr(modRes.data);
    const low      = safeArr(lowRes.data);

    aCounter(document.getElementById('ov-users'),    users.length);
    aCounter(document.getElementById('ov-reports'),  stats.totalReports || 0);
    aCounter(document.getElementById('ov-critical'), stats.criticalCount || 0);
    aCounter(document.getElementById('ov-highrisk'), (stats.highRiskCount || 0) + (stats.criticalCount || 0));

    try { _renderSparklines(low, moderate, high, critical); } catch(e) { console.warn('sparklines:', e); }
    try { _renderOvPie(stats, low.length); } catch(e) { console.warn('pie:', e); }
    try { _renderOvAlerts([...critical, ...high].slice(0, 8)); } catch(e) { console.warn('alerts:', e); }
    try { _renderSystemStatus(users.length, stats.totalReports || 0); } catch(e) { console.warn('status:', e); }
    try { _renderRecentActivity([...critical, ...high, ...moderate].slice(0, 5)); } catch(e) { console.warn('activity:', e); }

  } catch (err) {
    console.error('initOverview error:', err);
    aToast('Failed to load overview: ' + err.message, 'error');
  } finally {
    aLoading(false);
  }
}

function _renderSparklines(low, mod, high, crit) {
  const sets = [
    { id: 'spark-low',      data: low,  color: '#00ff88' },
    { id: 'spark-moderate', data: mod,  color: '#ffaa00' },
    { id: 'spark-high',     data: high, color: '#ff6600' },
    { id: 'spark-critical', data: crit, color: '#ff3366' },
  ];
  sets.forEach(({ id, data, color }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const bars = el.querySelectorAll('.a-spark-bar');
    bars.forEach((b, i) => {
      const h = 8 + Math.round(Math.random() * 28);
      b.style.background = color;
      b.style.opacity    = 0.3 + (i / Math.max(bars.length, 1)) * 0.7;
      setTimeout(() => { b.style.height = h + 'px'; }, 80 + i * 25);
    });
  });
}

function _renderOvPie(stats, lowCount) {
  const ctx = document.getElementById('ov-pie');
  if (!ctx) return;
  if (_ovCharts.pie) { try { _ovCharts.pie.destroy(); } catch(e) {} }
  _ovCharts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
      datasets: [{
        data: [
          lowCount             || 0,
          stats.moderateCount  || 0,
          stats.highRiskCount  || 0,
          stats.criticalCount  || 0,
        ],
        backgroundColor: ['rgba(0,255,136,0.7)', 'rgba(255,170,0,0.7)', 'rgba(255,102,0,0.7)', 'rgba(255,51,102,0.7)'],
        borderColor:     ['#00ff88', '#ffaa00', '#ff6600', '#ff3366'],
        borderWidth: 2, hoverOffset: 10,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#6b82a0', font: { size: 10 }, padding: 10 } } },
      cutout: '62%',
    },
  });
}

function _renderOvAlerts(reports) {
  const el = document.getElementById('ov-alerts');
  if (!el) return;
  if (!reports.length) {
    el.innerHTML = `<div class="a-empty" style="padding:28px"><i class="fa-solid fa-shield-check"></i><h3>No high-risk alerts</h3><p>System is clear.</p></div>`;
    return;
  }
  el.innerHTML = reports.map(r => `
    <div class="a-alert-row">
      <div class="a-alert-icon a-si-rose"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${r.userName || 'User #' + r.userId}
          </span>
          <span class="a-badge ${aBadgeCls(r.riskLevel)}" style="flex-shrink:0">
            <span class="a-badge-dot"></span> ${r.riskLevel || '—'}
          </span>
        </div>
        <div style="font-size:11px;color:var(--a-muted);margin-top:3px">
          ${r.location || '—'} &nbsp;·&nbsp; AQI ${r.aqi || '—'} &nbsp;·&nbsp; Risk: ${(r.riskPercentage || 0).toFixed(1)}%
        </div>
      </div>
    </div>`).join('');
}

function _renderSystemStatus(userCount, reportCount) {
  const el = document.getElementById('ov-sys-status');
  if (!el) return;
  const items = [
    { label: 'API Server',       status: 'online',                          val: 'OPERATIONAL'               },
    { label: 'MySQL Database',   status: 'online',                          val: 'CONNECTED'                 },
    { label: 'Analysis Engine',  status: 'online',                          val: 'ACTIVE'                    },
    { label: 'Alert System',     status: reportCount > 0 ? 'warning' : 'online', val: reportCount > 0 ? 'MONITORING' : 'STANDBY' },
    { label: 'Registered Users', status: 'online',                          val: userCount + ' USERS'        },
    { label: 'Total Reports',    status: 'online',                          val: reportCount + ' RECORDS'    },
  ];
  el.innerHTML = items.map(i => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--a-border2)">
      <span style="font-size:12px;color:var(--a-muted)">${i.label}</span>
      <span class="a-status-dot ${i.status} a-mono" style="font-size:10px">${i.val}</span>
    </div>`).join('');
}

function _renderRecentActivity(reports) {
  const el = document.getElementById('ov-activity');
  if (!el) return;
  if (!reports.length) {
    el.innerHTML = `<div class="a-empty" style="padding:24px"><i class="fa-solid fa-clock"></i><h3>No recent activity</h3></div>`;
    return;
  }
  el.innerHTML = reports.map(r => `
    <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--a-border2)">
      <div style="width:8px;height:8px;border-radius:50%;background:${aRiskColor(r.riskLevel)};box-shadow:0 0 6px ${aRiskColor(r.riskLevel)};margin-top:4px;flex-shrink:0"></div>
      <div>
        <div style="font-size:12px;font-weight:500">${r.userName || 'Unknown'} — ${r.location || '—'}</div>
        <div style="font-size:10px;color:var(--a-muted);margin-top:2px">
          AQI ${r.aqi || '—'} · Risk ${(r.riskPercentage || 0).toFixed(1)}% ·
          <span class="a-badge ${aBadgeCls(r.riskLevel)}" style="font-size:9px">${r.riskLevel || '—'}</span>
        </div>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════════
   PAGE: USER MANAGEMENT
   ═══════════════════════════════════════════════════════════ */
async function initUsers() {
  const tbody = document.getElementById('users-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--a-muted)"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>`;

  try {
    aLoading(true, 'LOADING USERS...');
    const [usersRes, highRes, critRes] = await Promise.all([
      safe(AdminAPI.getAllUsers()),
      safe(AdminAPI.getReportsByLevel('HIGH')),
      safe(AdminAPI.getReportsByLevel('CRITICAL')),
    ]);
    const users   = safeArr(usersRes.data);
    const highIDs = new Set([...safeArr(highRes.data), ...safeArr(critRes.data)].map(r => r.userId));

    aCounter(document.getElementById('um-total'),    users.length);
    aCounter(document.getElementById('um-highrisk'), highIDs.size);
    aCounter(document.getElementById('um-asthma'),   users.filter(u => u.healthCondition === 'ASTHMA').length);
    aCounter(document.getElementById('um-copd'),     users.filter(u => u.healthCondition === 'COPD').length);

    window._allUsers = users;
    window._highIDs  = highIDs;
    _renderUsersTable(users, highIDs);

  } catch (err) {
    console.error('initUsers:', err);
    const tbody = document.getElementById('users-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="color:var(--a-rose);text-align:center;padding:24px">${err.message}</td></tr>`;
  } finally {
    aLoading(false);
  }
}

function _renderUsersTable(users, highIDs) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="a-empty"><i class="fa-solid fa-users-slash"></i><h3>No users found</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => {
    const atRisk  = highIDs && highIDs.has(u.id);
    const condCls = u.healthCondition === 'NORMAL' ? 'a-badge-low' : 'a-badge-high';
    return `<tr>
      <td><span class="a-mono" style="font-size:10px;color:var(--a-cyan)">#${u.id}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:9px">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--a-green),var(--a-cyan));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--a-bg0);flex-shrink:0">
            ${(u.name || 'U').charAt(0).toUpperCase()}
          </div>
          <span style="font-weight:500">${u.name || '—'}</span>
          ${atRisk ? '<span class="a-badge a-badge-high" style="font-size:9px;margin-left:4px">AT RISK</span>' : ''}
        </div>
      </td>
      <td style="color:var(--a-muted);font-size:12px">${u.email || '—'}</td>
      <td>${u.age || '—'} / ${u.gender || '—'}</td>
      <td><span class="a-badge ${condCls}">${u.healthCondition || 'NORMAL'}</span></td>
      <td><span class="a-status-dot ${atRisk ? 'warning' : 'online'}" style="font-size:10px">${atRisk ? 'HIGH RISK' : 'NORMAL'}</span></td>
    </tr>`;
  }).join('');
}

function filterUsers(val) {
  const users   = window._allUsers || [];
  const highIDs = window._highIDs;
  const q       = val.toLowerCase();
  const filtered = q
    ? users.filter(u =>
        (u.name  || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.healthCondition || '').toLowerCase().includes(q))
    : users;
  _renderUsersTable(filtered, highIDs);
}

/* ═══════════════════════════════════════════════════════════
   PAGE: POLLUTION MONITORING
   ═══════════════════════════════════════════════════════════ */
let _pollCharts = {};

async function initPollution() {
  try {
    aLoading(true, 'LOADING POLLUTION DATA...');
    const [critRes, highRes, modRes, lowRes] = await Promise.all([
      safe(AdminAPI.getReportsByLevel('CRITICAL')),
      safe(AdminAPI.getReportsByLevel('HIGH')),
      safe(AdminAPI.getReportsByLevel('MODERATE')),
      safe(AdminAPI.getReportsByLevel('LOW')),
    ]);

    const crit = safeArr(critRes.data);
    const high = safeArr(highRes.data);
    const mod  = safeArr(modRes.data);
    const low  = safeArr(lowRes.data);
    const all  = [...crit, ...high, ...mod, ...low];

    aCounter(document.getElementById('pm-total'),    all.length);
    aCounter(document.getElementById('pm-critical'), crit.length);

    if (all.length) {
      const validAqi = all.filter(r => r.aqi);
      if (validAqi.length) {
        const avgAqi = (validAqi.reduce((s, r) => s + r.aqi, 0) / validAqi.length).toFixed(1);
        aSetEl('pm-avg-aqi', avgAqi);
        const avgEl = document.getElementById('pm-avg-aqi');
        if (avgEl) avgEl.style.color = aAqiColor(parseFloat(avgAqi));
      }
      const maxReport = [...all].sort((a, b) => (b.aqi || 0) - (a.aqi || 0))[0];
      if (maxReport) {
        aSetEl('pm-max-aqi', maxReport.aqi);
        const mEl = document.getElementById('pm-max-aqi');
        if (mEl) mEl.style.color = aAqiColor(maxReport.aqi || 0);
      }
    }

    try { _renderPollutionStats(all); }        catch(e) { console.warn('pollStats:', e); }
    try { _renderPollutionTable(all.slice(0, 20)); } catch(e) { console.warn('pollTable:', e); }
    try { _renderAqiDistChart(low, mod, high, crit); } catch(e) { console.warn('distChart:', e); }

  } catch (err) {
    console.error('initPollution:', err);
    aToast('Failed to load pollution data: ' + err.message, 'error');
  } finally {
    aLoading(false);
  }
}

function _renderPollutionStats(reports) {
  const el = document.getElementById('pm-avg-bars');
  if (!el) return;
  if (!reports.length) {
    el.innerHTML = '<div class="a-empty" style="padding:16px"><p>No data available.</p></div>';
    return;
  }
  // Use only aqi and riskPercentage which exist on RiskReportResponseDTO
  const avgAqi  = (reports.reduce((s, r) => s + (r.aqi || 0), 0) / reports.length).toFixed(1);
  const avgRisk = (reports.reduce((s, r) => s + (r.riskPercentage || 0), 0) / reports.length).toFixed(1);
  const maxAqi  = Math.max(...reports.map(r => r.aqi || 0)).toFixed(0);
  const maxRisk = Math.max(...reports.map(r => r.riskPercentage || 0)).toFixed(1);

  el.innerHTML =
    aProgressBar('Average AQI',   avgAqi,  500, aAqiColor(parseFloat(avgAqi))) +
    aProgressBar('Average Risk %', avgRisk, 100, '#ff3366', '%') +
    aProgressBar('Highest AQI',   maxAqi,  500, aAqiColor(parseFloat(maxAqi))) +
    aProgressBar('Highest Risk %', maxRisk, 100, '#ff6600', '%');
  aAnimateBars(el);
}

function _renderPollutionTable(reports) {
  const tbody = document.getElementById('pm-tbody');
  if (!tbody) return;
  if (!reports.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="a-empty"><i class="fa-solid fa-smog"></i><h3>No records</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = reports.map(r => `
    <tr>
      <td><span class="a-mono" style="font-size:10px;color:var(--a-cyan)">#${r.id || '—'}</span></td>
      <td style="font-weight:500">${r.location || '—'}</td>
      <td><span class="a-mono" style="color:${aAqiColor(r.aqi || 0)}">${r.aqi || '—'}</span></td>
      <td><span class="a-badge ${aBadgeCls(r.riskLevel)}"><span class="a-badge-dot"></span>${r.riskLevel || '—'}</span></td>
      <td><span class="a-mono" style="color:${aRiskColor(r.riskLevel)}">${(r.riskPercentage || 0).toFixed(1)}%</span></td>
      <td style="color:var(--a-muted);font-size:11px">${r.userName || 'User #' + r.userId}</td>
      <td style="color:var(--a-muted);font-size:11px">${r.affectedOrgans || '—'}</td>
    </tr>`).join('');
}

function _renderAqiDistChart(low, mod, high, crit) {
  const ctx = document.getElementById('pm-dist-chart');
  if (!ctx) return;
  if (_pollCharts.dist) { try { _pollCharts.dist.destroy(); } catch(e) {} }
  _pollCharts.dist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
      datasets: [{
        label: 'Reports',
        data: [low.length, mod.length, high.length, crit.length],
        backgroundColor: ['rgba(0,255,136,0.5)', 'rgba(255,170,0,0.5)', 'rgba(255,102,0,0.5)', 'rgba(255,51,102,0.5)'],
        borderColor:     ['#00ff88', '#ffaa00', '#ff6600', '#ff3366'],
        borderWidth: 2, borderRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b82a0', font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b82a0', font: { size: 11 } }, beginAtZero: true },
      },
    },
  });
}

/* ═══════════════════════════════════════════════════════════
   PAGE: CITY AQI MONITOR
   ═══════════════════════════════════════════════════════════ */
let _cityCharts = {};

async function adminCitySearch() {
  const inp  = document.getElementById('admin-city-input');
  const city = inp ? inp.value.trim() : '';
  if (!city) { aToast('Enter a city name', 'info'); return; }

  try {
    aLoading(true, 'ANALYSING ' + city.toUpperCase() + '...');
    const res  = await AdminAPI.getCityAnalysis(city);
    const data = res.data || {};

    const resultEl = document.getElementById('city-result');
    const emptyEl  = document.getElementById('city-empty');
    if (emptyEl)  emptyEl.style.display  = 'none';
    if (resultEl) resultEl.style.display = 'block';
    resultEl.classList.remove('hidden');

    aSetEl('ac-city',     data.location       || city);
    aSetEl('ac-aqi-cat',  data.aqiCategoryLabel || '—');
    aSetEl('ac-records',  data.totalRecords    || 0);
    aSetEl('ac-dominant', data.dominantPollutant || '—');
    aSetEl('ac-pm25',     (data.averagePm25    || 0) + ' µg/m³');
    aSetEl('ac-pm10',     (data.averagePm10    || 0) + ' µg/m³');
    aSetEl('ac-co',       (data.averageCoLevel || 0) + ' ppm');
    aSetEl('ac-no2',      (data.averageNo2Level|| 0) + ' µg/m³');
    aSetEl('ac-so2',      (data.averageSo2Level|| 0) + ' µg/m³');

    const avgAqiEl = document.getElementById('ac-avg-aqi');
    if (avgAqiEl) {
      avgAqiEl.textContent = data.averageAqi || '—';
      avgAqiEl.style.color = aAqiColor(data.averageAqi || 0);
    }

    const riskEl = document.getElementById('ac-risk');
    if (riskEl) {
      riskEl.textContent  = data.overallRiskLevel || '—';
      riskEl.style.color  = aRiskColor(data.overallRiskLevel);
    }

    const barsEl = document.getElementById('ac-bars');
    if (barsEl) {
      barsEl.innerHTML =
        aProgressBar('PM2.5', data.averagePm25    || 0, 250, '#8b5cf6', ' µg/m³') +
        aProgressBar('PM10',  data.averagePm10    || 0, 500, '#00d4ff', ' µg/m³') +
        aProgressBar('CO',    data.averageCoLevel || 0,  30, '#ff6600', ' ppm')   +
        aProgressBar('NO₂',   data.averageNo2Level|| 0, 400, '#ffaa00', ' µg/m³') +
        aProgressBar('SO₂',   data.averageSo2Level|| 0, 500, '#ff3366', ' µg/m³');
      aAnimateBars(barsEl);
    }

    try { _renderCityDoughnut(data); } catch(e) { console.warn('cityDonut:', e); }

  } catch (err) {
    aToast(err.message || 'City not found', 'error');
    const emptyEl = document.getElementById('city-empty');
    if (emptyEl) emptyEl.style.display = '';
  } finally {
    aLoading(false);
  }
}

function _renderCityDoughnut(d) {
  const ctx = document.getElementById('ac-chart');
  if (!ctx) return;
  if (_cityCharts.donut) { try { _cityCharts.donut.destroy(); } catch(e) {} }
  _cityCharts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['PM2.5', 'PM10', 'CO×10', 'NO₂', 'SO₂'],
      datasets: [{
        data: [
          d.averagePm25     || 0,
          d.averagePm10     || 0,
          (d.averageCoLevel || 0) * 10,
          d.averageNo2Level || 0,
          d.averageSo2Level || 0,
        ],
        backgroundColor: ['rgba(139,92,246,0.6)', 'rgba(0,212,255,0.6)', 'rgba(255,102,0,0.6)', 'rgba(255,170,0,0.6)', 'rgba(255,51,102,0.6)'],
        borderColor:     ['#8b5cf6', '#00d4ff', '#ff6600', '#ffaa00', '#ff3366'],
        borderWidth: 2, hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#6b82a0', font: { size: 10 }, padding: 10 } } },
      cutout: '65%',
    },
  });
}

/* ═══════════════════════════════════════════════════════════
   PAGE: AQI TRENDS
   ═══════════════════════════════════════════════════════════ */
let _trendCharts = {};

async function initTrends() {
  try {
    aLoading(true, 'LOADING TREND DATA...');
    const [critRes, highRes, modRes, lowRes] = await Promise.all([
      safe(AdminAPI.getReportsByLevel('CRITICAL')),
      safe(AdminAPI.getReportsByLevel('HIGH')),
      safe(AdminAPI.getReportsByLevel('MODERATE')),
      safe(AdminAPI.getReportsByLevel('LOW')),
    ]);

    const all = [
      ...safeArr(lowRes.data),
      ...safeArr(modRes.data),
      ...safeArr(highRes.data),
      ...safeArr(critRes.data),
    ];

    try { _renderRiskTrendLine(all); } catch(e) { console.warn('trendLine:', e); }
    try { _renderAqiTrendLine(all);  } catch(e) { console.warn('aqiBar:', e); }
    try { _renderRiskRadar(all);     } catch(e) { console.warn('radar:', e); }
    try {
      _renderHeatMatrix(
        safeArr(lowRes.data).length,
        safeArr(modRes.data).length,
        safeArr(highRes.data).length,
        safeArr(critRes.data).length
      );
    } catch(e) { console.warn('heat:', e); }

  } catch (err) {
    console.error('initTrends:', err);
    aToast('Failed to load trends: ' + err.message, 'error');
  } finally {
    aLoading(false);
  }
}

function _renderRiskTrendLine(reports) {
  const ctx = document.getElementById('trend-risk-line');
  if (!ctx || !reports.length) return;
  if (_trendCharts.risk) { try { _trendCharts.risk.destroy(); } catch(e) {} }
  const last = reports.slice(-12);
  _trendCharts.risk = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last.map((r, i) => 'R' + (i + 1)),
      datasets: [
        {
          label: 'Risk %',
          data: last.map(r => r.riskPercentage || 0),
          borderColor: '#ff3366', backgroundColor: 'rgba(255,51,102,0.08)',
          fill: true, tension: 0.4, pointBackgroundColor: '#ff3366', pointRadius: 4,
          yAxisID: 'y',
        },
        {
          label: 'AQI',
          data: last.map(r => r.aqi || 0),
          borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.06)',
          fill: false, tension: 0.4, pointBackgroundColor: '#00ff88', pointRadius: 4,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#6b82a0', font: { size: 11 } } } },
      scales: {
        x:  { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b82a0', font: { size: 10 } } },
        y:  { position: 'left',  min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#ff3366', font: { size: 10 } } },
        y1: { position: 'right', min: 0, max: 500, grid: { drawOnChartArea: false },          ticks: { color: '#00ff88', font: { size: 10 } } },
      },
    },
  });
}

function _renderAqiTrendLine(reports) {
  const ctx = document.getElementById('trend-aqi-bar');
  if (!ctx || !reports.length) return;
  if (_trendCharts.aqi) { try { _trendCharts.aqi.destroy(); } catch(e) {} }
  const last = reports.slice(-10);
  _trendCharts.aqi = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: last.map(r => (r.location || '').split(',')[0].slice(0, 10)),
      datasets: [{
        label: 'AQI',
        data:            last.map(r => r.aqi || 0),
        backgroundColor: last.map(r => aAqiColor(r.aqi || 0) + '55'),
        borderColor:     last.map(r => aAqiColor(r.aqi || 0)),
        borderWidth: 2, borderRadius: 5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b82a0', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b82a0', font: { size: 10 } }, min: 0, max: 500 },
      },
    },
  });
}

function _renderRiskRadar(reports) {
  const ctx = document.getElementById('trend-radar');
  if (!ctx || !reports.length) return;
  if (_trendCharts.radar) { try { _trendCharts.radar.destroy(); } catch(e) {} }
  const norm = (k, max) => {
    const avg = reports.reduce((s, r) => s + (r[k] || 0), 0) / reports.length;
    return Math.min((avg / max) * 100, 100);
  };
  _trendCharts.radar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['AQI', 'Risk%', 'Critical', 'High', 'Moderate', 'Low'],
      datasets: [{
        label: 'Distribution',
        data: [
          norm('aqi', 500),
          norm('riskPercentage', 100),
          reports.filter(r => r.riskLevel === 'CRITICAL').length / reports.length * 100,
          reports.filter(r => r.riskLevel === 'HIGH').length     / reports.length * 100,
          reports.filter(r => r.riskLevel === 'MODERATE').length / reports.length * 100,
          reports.filter(r => r.riskLevel === 'LOW').length      / reports.length * 100,
        ],
        backgroundColor: 'rgba(0,255,136,0.07)',
        borderColor: '#00ff88', borderWidth: 2,
        pointBackgroundColor: '#00ff88', pointRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          grid:        { color: 'rgba(255,255,255,0.06)' },
          angleLines:  { color: 'rgba(255,255,255,0.06)' },
          pointLabels: { color: '#6b82a0', font: { size: 10 } },
          ticks:       { display: false },
        },
      },
    },
  });
}

function _renderHeatMatrix(low, mod, high, crit) {
  const el = document.getElementById('trend-heat');
  if (!el) return;
  const total = (low + mod + high + crit) || 1;
  const rows  = [
    { label: 'LOW',      val: low,  color: '#00ff88', pct: Math.round((low  / total) * 100) },
    { label: 'MODERATE', val: mod,  color: '#ffaa00', pct: Math.round((mod  / total) * 100) },
    { label: 'HIGH',     val: high, color: '#ff6600', pct: Math.round((high / total) * 100) },
    { label: 'CRITICAL', val: crit, color: '#ff3366', pct: Math.round((crit / total) * 100) },
  ];
  el.innerHTML = rows.map(r => `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;font-weight:700;color:${r.color}">${r.label}</span>
        <span style="font-size:10px;color:var(--a-muted)">${r.val} reports (${r.pct}%)</span>
      </div>
      <div style="height:22px;border-radius:4px;background:var(--a-bg4);overflow:hidden">
        <div style="height:100%;width:0%;background:${r.color}33;border-right:2px solid ${r.color};transition:width 1.2s ease;border-radius:4px" data-t="${r.pct}"></div>
      </div>
    </div>`).join('');
  setTimeout(() => el.querySelectorAll('[data-t]').forEach(b => { b.style.width = b.dataset.t + '%'; }), 100);
}

/* ═══════════════════════════════════════════════════════════
   PAGE: EMERGENCY ALERTS
   ═══════════════════════════════════════════════════════════ */
async function initAlerts() {
  try {
    aLoading(true, 'SCANNING FOR ALERTS...');
    const [critRes, highRes] = await Promise.all([
      safe(AdminAPI.getReportsByLevel('CRITICAL')),
      safe(AdminAPI.getReportsByLevel('HIGH')),
    ]);
    const critical = safeArr(critRes.data);
    const high     = safeArr(highRes.data);

    aCounter(document.getElementById('ea-critical'), critical.length);
    aCounter(document.getElementById('ea-high'),     high.length);
    aCounter(document.getElementById('ea-total'),    critical.length + high.length);

    _renderAlertsFeed('ea-critical-list', critical, true);
    _renderAlertsFeed('ea-high-list',     high,     false);

  } catch (err) {
    console.error('initAlerts:', err);
    aToast('Failed to load alerts: ' + err.message, 'error');
  } finally {
    aLoading(false);
  }
}

function _renderAlertsFeed(elId, reports, isCritical) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!reports.length) {
    el.innerHTML = `<div class="a-empty" style="padding:28px"><i class="fa-solid fa-circle-check"></i><h3>No ${isCritical ? 'critical' : 'high-risk'} alerts</h3></div>`;
    return;
  }
  const borderCol = isCritical ? 'var(--r-critical)' : 'var(--r-high)';
  const bgCol     = isCritical ? 'rgba(255,51,102,0.12)' : 'rgba(255,102,0,0.12)';
  const textCol   = isCritical ? 'var(--r-critical)' : 'var(--r-high)';
  const iconName  = isCritical ? 'skull-crossbones' : 'triangle-exclamation';

  el.innerHTML = reports.map(r => `
    <div class="a-alert-row" style="border-left:3px solid ${borderCol}">
      <div class="a-alert-icon" style="background:${bgCol};color:${textCol}">
        <i class="fa-solid fa-${iconName}"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:600;font-size:13px">${r.userName || 'User #' + r.userId}</span>
          <span style="font-size:10px;color:var(--a-muted);font-family:var(--a-mono)">${r.location || '—'}</span>
        </div>
        <div style="font-size:11px;color:var(--a-muted);margin-top:3px">
          AQI ${r.aqi || '—'} &nbsp;·&nbsp; Risk:
          <strong style="color:${aRiskColor(r.riskLevel)}">${(r.riskPercentage || 0).toFixed(1)}%</strong>
          &nbsp;·&nbsp; Organs: ${r.affectedOrgans || '—'}
        </div>
        ${r.alertMessage
          ? `<div style="font-size:11px;color:var(--a-muted);margin-top:4px;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:2px solid ${borderCol}">${r.alertMessage}</div>`
          : ''}
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════════
   PAGE: REPORT MANAGEMENT
   ═══════════════════════════════════════════════════════════ */
async function initReports() {
  try {
    aLoading(true, 'LOADING REPORTS...');
    const [critRes, highRes, modRes, lowRes] = await Promise.all([
      safe(AdminAPI.getReportsByLevel('CRITICAL')),
      safe(AdminAPI.getReportsByLevel('HIGH')),
      safe(AdminAPI.getReportsByLevel('MODERATE')),
      safe(AdminAPI.getReportsByLevel('LOW')),
    ]);
    const all = [
      ...safeArr(critRes.data),
      ...safeArr(highRes.data),
      ...safeArr(modRes.data),
      ...safeArr(lowRes.data),
    ];
    window._allReports = all;
    aCounter(document.getElementById('rm-total'), all.length);
    _renderReportsTable(all);
  } catch (err) {
    console.error('initReports:', err);
    aToast('Failed to load reports: ' + err.message, 'error');
  } finally {
    aLoading(false);
  }
}

function _renderReportsTable(reports) {
  const tbody = document.getElementById('rm-tbody');
  if (!tbody) return;
  if (!reports.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="a-empty"><i class="fa-solid fa-inbox"></i><h3>No reports found</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = reports.map(r => `
    <tr>
      <td><span class="a-mono" style="font-size:10px;color:var(--a-cyan)">#${r.id || '—'}</span></td>
      <td style="font-weight:500">${r.userName || 'User #' + r.userId}</td>
      <td>${r.location || '—'}</td>
      <td><span class="a-mono" style="color:${aAqiColor(r.aqi || 0)}">${r.aqi || '—'}</span></td>
      <td><span class="a-mono" style="color:${aRiskColor(r.riskLevel)}">${(r.riskPercentage || 0).toFixed(1)}%</span></td>
      <td><span class="a-badge ${aBadgeCls(r.riskLevel)}"><span class="a-badge-dot"></span>${r.riskLevel || '—'}</span></td>
      <td style="color:var(--a-muted);font-size:11px">${r.affectedOrgans || '—'}</td>
    </tr>`).join('');
}

function filterReports(val) {
  const all      = window._allReports || [];
  const fUp      = val.toUpperCase().trim();
  const filtered = fUp
    ? all.filter(r => r.riskLevel === fUp || (r.location || '').toLowerCase().includes(val.toLowerCase()))
    : all;
  _renderReportsTable(filtered);
}

/* ═══════════════════════════════════════════════════════════
   PAGE: HIGH RISK ZONES
   ═══════════════════════════════════════════════════════════ */
let _zoneChart = null;

async function initZones() {
  try {
    aLoading(true, 'SCANNING RISK ZONES...');
    const [critRes, highRes] = await Promise.all([
      safe(AdminAPI.getReportsByLevel('CRITICAL')),
      safe(AdminAPI.getReportsByLevel('HIGH')),
    ]);
    const all = [...safeArr(critRes.data), ...safeArr(highRes.data)];

    const locationMap = {};
    all.forEach(r => {
      const loc = (r.location || 'Unknown').split(',')[0].trim();
      if (!locationMap[loc]) locationMap[loc] = { loc, count: 0, maxRisk: 0, maxAqi: 0 };
      locationMap[loc].count++;
      locationMap[loc].maxRisk = Math.max(locationMap[loc].maxRisk, r.riskPercentage || 0);
      locationMap[loc].maxAqi  = Math.max(locationMap[loc].maxAqi,  r.aqi || 0);
    });

    const zones = Object.values(locationMap).sort((a, b) => b.maxRisk - a.maxRisk);
    aCounter(document.getElementById('hz-zones'),   zones.length);
    aCounter(document.getElementById('hz-reports'), all.length);

    try { _renderZonesList(zones); }            catch(e) { console.warn('zonesList:', e); }
    try { _renderZonesChart(zones.slice(0, 8)); } catch(e) { console.warn('zonesChart:', e); }

  } catch (err) {
    console.error('initZones:', err);
    aToast('Failed to load zones: ' + err.message, 'error');
  } finally {
    aLoading(false);
  }
}

function _renderZonesList(zones) {
  const el = document.getElementById('hz-list');
  if (!el) return;
  if (!zones.length) {
    el.innerHTML = `<div class="a-empty"><i class="fa-solid fa-shield-check"></i><h3>No high-risk zones detected</h3></div>`;
    return;
  }
  el.innerHTML = zones.map((z, idx) => {
    const level = z.maxRisk >= 75 ? 'CRITICAL' : 'HIGH';
    return `<div class="a-zone-card">
      <div style="font-size:11px;font-weight:700;color:var(--a-muted);min-width:22px">#${idx + 1}</div>
      <div class="a-zone-indicator" style="color:${aRiskColor(level)};background:${aRiskColor(level)}"></div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px">${z.loc}</div>
        <div style="font-size:11px;color:var(--a-muted);margin-top:2px">
          ${z.count} alerts &nbsp;·&nbsp; Peak AQI:
          <span style="color:${aAqiColor(z.maxAqi)}">${z.maxAqi.toFixed(0)}</span>
        </div>
      </div>
      <span class="a-badge ${aBadgeCls(level)}" style="font-size:10px;padding:4px 10px">
        ${z.maxRisk.toFixed(0)}%
      </span>
    </div>`;
  }).join('');
}

function _renderZonesChart(zones) {
  const ctx = document.getElementById('hz-chart');
  if (!ctx || !zones.length) return;
  if (_zoneChart) { try { _zoneChart.destroy(); } catch(e) {} }

  _zoneChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: zones.map(z => z.loc.slice(0, 12)),
      datasets: [
        {
          // FIX: bar dataset must use default y axis (no yAxisID)
          label: 'Peak Risk %',
          data:            zones.map(z => parseFloat(z.maxRisk.toFixed(1))),
          backgroundColor: zones.map(z => aRiskColor(z.maxRisk >= 75 ? 'CRITICAL' : 'HIGH') + '55'),
          borderColor:     zones.map(z => aRiskColor(z.maxRisk >= 75 ? 'CRITICAL' : 'HIGH')),
          borderWidth: 2, borderRadius: 6,
          yAxisID: 'y',
        },
        {
          // FIX: line dataset on same scale, divide AQI by 5 to fit 0-100 range
          type: 'line',
          label: 'Peak AQI ÷5',
          data:                 zones.map(z => parseFloat((z.maxAqi / 5).toFixed(1))),
          borderColor:          '#00d4ff',
          backgroundColor:      'rgba(0,212,255,0.05)',
          fill: true, tension: 0.4,
          pointBackgroundColor: '#00d4ff', pointRadius: 4,
          yAxisID: 'y',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#6b82a0', font: { size: 10 } } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b82a0', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b82a0', font: { size: 10 } }, min: 0, max: 100 },
      },
    },
  });
}

/* ═══════════════════════════════════════════════════════════
   PAGE: RECOMMENDATIONS
   ═══════════════════════════════════════════════════════════ */
async function initRecs() {
  const el = document.getElementById('recs-container');
  if (!el) return;
  el.innerHTML = `<div class="a-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

  try {
    aLoading(true, 'LOADING RECOMMENDATIONS...');
    const res  = await AdminAPI.getAllRecs();
    const recs = safeArr(res.data);

    if (!recs.length) {
      el.innerHTML = `<div class="a-empty"><i class="fa-solid fa-inbox"></i><h3>No recommendations found</h3><p>Run the SQL seed to add recommendations.</p></div>`;
      return;
    }

    const grouped = {};
    recs.forEach(r => {
      const key = r.riskLevel || 'GENERAL';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    el.innerHTML = Object.entries(grouped).map(([level, items]) => `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span class="a-badge ${aBadgeCls(level)}" style="font-size:11px">
            <span class="a-badge-dot"></span>${level}
          </span>
          <span style="font-size:11px;color:var(--a-muted)">${items.length} items</span>
        </div>
        ${items.map(r => `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:var(--a-bg3);border:1px solid var(--a-border2);border-radius:10px;margin-bottom:6px">
            <span style="font-size:9px;font-weight:700;letter-spacing:1px;background:rgba(0,255,136,0.1);color:var(--a-green);padding:3px 8px;border-radius:4px;flex-shrink:0;white-space:nowrap;margin-top:2px">
              ${r.category || 'GENERAL'}
            </span>
            <span style="font-size:13px">${r.recommendationText || '—'}</span>
          </div>`).join('')}
      </div>`).join('');

    aCounter(document.getElementById('recs-total'), recs.length);

  } catch (err) {
    console.error('initRecs:', err);
    el.innerHTML = `<div style="color:var(--a-rose);text-align:center;padding:24px">${err.message}</div>`;
  } finally {
    aLoading(false);
  }
}

/* ═══════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initAdminParticles();
  initAdminLogin();
  initAdminSidebar();

  if (AdminSession.isAuth()) {
    _showAdminApp();
  }
});