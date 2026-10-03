/* ═══════════════════════════════════════════════════
   AERIS HEALTH  —  Core Application
   ═══════════════════════════════════════════════════ */

/* ── Session ──────────────────────────────────────── */
const Session = {
  get user()      { try { return JSON.parse(sessionStorage.getItem('aeris_user'));   } catch { return null; } },
  set user(v)     { sessionStorage.setItem('aeris_user', JSON.stringify(v)); },
  clear()         { sessionStorage.removeItem('aeris_user'); sessionStorage.removeItem('aeris_report'); },
  get lastReport(){ try { return JSON.parse(sessionStorage.getItem('aeris_report')); } catch { return null; } },
  set lastReport(v){ sessionStorage.setItem('aeris_report', JSON.stringify(v)); },
};

/* ── Router ───────────────────────────────────────── */
const Router = {
  AUTH_PAGES: ['landing', 'login', 'register'],

  go(pageId) {
    // Deactivate all pages + nav items
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById('page-' + pageId);
    if (page) { page.classList.add('active'); window.scrollTo(0, 0); }

    document.querySelectorAll(`[data-page="${pageId}"]`).forEach(n => n.classList.add('active'));

    const isAuth = this.AUTH_PAGES.includes(pageId);
    const sidebar = document.getElementById('app-sidebar');
    const topbar  = document.getElementById('app-topbar');
    const wrap    = document.getElementById('main-content-wrap');
    const bottomNav = document.getElementById('mobile-bottom-nav');

    if (sidebar) sidebar.classList.toggle('hidden', isAuth);
    if (topbar)  topbar.classList.toggle('hidden',  isAuth);
    if (wrap)    wrap.style.marginLeft = isAuth ? '0' : 'var(--sidebar-w)';

    // Mobile bottom nav only shows on app pages (not landing/login/register)
    if (bottomNav) {
      bottomNav.classList.toggle('hidden', isAuth);
      bottomNav.classList.toggle('app-active', !isAuth);
      document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.bottomPage === pageId);
      });
    }
    if (wrap) wrap.classList.toggle('has-bottom-nav', !isAuth);

    // Update topbar title
    const titles = {
      dashboard: 'Dashboard',         submit:    'Submit Pollution Data',
      result:    'Health Risk Analysis', history: 'My Health History',
      recommend: 'Protection Advice',  city:    'City Pollution Monitor',
      admin:     'Admin Analytics',    assistant: 'AERIS Assistant',
    };
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = titles[pageId] || 'AERIS Health';

    // Page-specific init
    switch (pageId) {
      case 'dashboard':  initDashboard(); break;
      case 'history':    initHistory();   break;
      case 'recommend':  initRecommend(); break;
      case 'city':       /* search on demand */ break;
      case 'admin':      initAdmin();     break;
      case 'assistant':  initAssistant(); break;
      case 'result':
        if (Session.lastReport) renderResult(Session.lastReport);
        break;
    }
  },
};

/* ── Toast ────────────────────────────────────────── */
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: 'check-circle', error: 'circle-xmark', info: 'circle-info' };
  el.innerHTML = `<i class="fa-solid fa-${icons[type] || 'circle-info'}"></i>&nbsp; ${message}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

/* ── Loading ──────────────────────────────────────── */
function showLoading(msg = 'Analysing...') {
  const ov = document.getElementById('loading-overlay');
  const tx = document.getElementById('loading-text');
  if (ov) ov.classList.remove('hidden');
  if (tx) tx.textContent = msg.toUpperCase();
}
function hideLoading() {
  const ov = document.getElementById('loading-overlay');
  if (ov) ov.classList.add('hidden');
}

/* ── Background canvas (particle engine removed per AERIS Health
   professional redesign — no distracting animated network graph) ── */
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (canvas) canvas.remove(); // no longer used; background is now a static image + overlay
}

/* ── Animated Counter ─────────────────────────────── */
function animateCounter(el, target, duration = 1100, suffix = '') {
  if (!el) return;
  const start = performance.now();
  const isFloat = target % 1 !== 0;
  (function tick(now) {
    const pct  = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - pct, 3);
    el.textContent = (isFloat ? (target * ease).toFixed(1) : Math.round(target * ease)) + suffix;
    if (pct < 1) requestAnimationFrame(tick);
  })(start);
}

/* ── Colour helpers (AERIS Health earth palette) ──── */
function aqiColor(aqi) {
  if (aqi <= 50)  return '#3F8F4A';   // Good — Natural Green
  if (aqi <= 100) return '#D99A2B';   // Moderate — Warning Amber
  if (aqi <= 150) return '#CC7A35';   // Unhealthy for Sensitive Groups — Orange
  if (aqi <= 200) return '#C2652A';   // Unhealthy — deeper Orange
  if (aqi <= 300) return '#C94A45';   // Very Unhealthy — Danger Red
  return '#8B3230';                   // Hazardous — deep Red
}

function riskColor(level) {
  return { LOW: '#3F8F4A', MODERATE: '#D99A2B', HIGH: '#CC7A35', CRITICAL: '#C94A45' }[level] || '#8A8578';
}

function riskBadgeClass(level) {
  return { LOW: 'badge-low', MODERATE: 'badge-moderate', HIGH: 'badge-high', CRITICAL: 'badge-critical' }[level] || 'badge-low';
}

/* ── Rec card icon helpers ────────────────────────── */
function categoryIcon(cat) {
  return { OUTDOOR: 'fa-wind', INDOOR: 'fa-house', MEDICAL: 'fa-kit-medical', DIETARY: 'fa-apple-whole', GENERAL: 'fa-shield-halved' }[cat] || 'fa-shield-halved';
}

function categoryClass(cat) {
  return { OUTDOOR: 'outdoor', INDOOR: 'indoor', MEDICAL: 'medical', DIETARY: 'dietary', GENERAL: 'general' }[cat] || 'general';
}

/* ── Progress bar HTML builder ────────────────────── */
function buildProgress(name, value, max, color, unit = '') {
  const pct = Math.min((value / max) * 100, 100).toFixed(1);
  return `
    <div class="progress-row">
      <div class="progress-header">
        <span class="progress-name">${name}</span>
        <span class="progress-value">${value}${unit}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:0%;background:${color}" data-target="${pct}"></div>
      </div>
    </div>`;
}

function animateProgressBars(container) {
  container.querySelectorAll('.progress-fill[data-target]').forEach(el => {
    setTimeout(() => { el.style.width = el.dataset.target + '%'; }, 80);
  });
}

/* ── Recommendation card HTML builder ────────────── */
function buildRecCard(rec) {
  const cat  = (typeof rec === 'object' ? rec.category : 'GENERAL') || 'GENERAL';
  const text = typeof rec === 'string'  ? rec : rec.recommendationText;
  return `
    <div class="rec-card">
      <div class="rec-icon ${categoryClass(cat)}">
        <i class="fa-solid ${categoryIcon(cat)}"></i>
      </div>
      <div>
        <div class="rec-cat">${cat}</div>
        <div class="rec-text">${text}</div>
      </div>
    </div>`;
}

/* ── Half-circle SVG gauge ────────────────────────── */
function renderGauge(svgId, value, max, color) {
  const svg  = document.getElementById(svgId);
  if (!svg) return;
  const fill = svg.querySelector('.gauge-fill');
  if (!fill) return;
  const r    = 80;
  const circ = Math.PI * r;       // half-circle = πr
  const pct  = Math.min(value / max, 1);
  fill.setAttribute('stroke', color);
  fill.setAttribute('stroke-dasharray',  circ);
  fill.setAttribute('stroke-dashoffset', circ);        // start empty
  setTimeout(() => fill.setAttribute('stroke-dashoffset', circ - pct * circ), 100);
}

/* ── Sidebar mobile toggle ────────────────────────── */
function toggleMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.toggle('open');
  overlay.classList.toggle('visible');
}

function initSidebar() {
  const sidebar  = document.getElementById('app-sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const btn      = document.getElementById('hamburger-btn');
  if (btn) btn.addEventListener('click', toggleMobileSidebar);
  if (overlay) overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
}

/* ── Landing page: smooth scroll to a section ─────── */
function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Landing page: simple fade-in-on-scroll ───────── */
function initFadeUpAnimations() {
  const items = document.querySelectorAll('.fade-up');
  if (!items.length || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in-view'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(el => observer.observe(el));
}

/* ── setEl helper ─────────────────────────────────── */
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = (val !== undefined && val !== null) ? val : '—';
}

/* ── Update user chip in sidebar ──────────────────── */
function updateUserChip(user) {
  const nameEl   = document.getElementById('user-chip-name');
  const avatarEl = document.getElementById('user-chip-avatar');
  const topbarAv = document.getElementById('topbar-avatar');
  const initial  = user.name?.charAt(0).toUpperCase() || 'U';
  if (nameEl)   nameEl.textContent   = user.name || 'User';
  if (avatarEl) avatarEl.textContent = initial;
  if (topbarAv) topbarAv.textContent = initial;
}

/* ── Logout ───────────────────────────────────────── */
function handleLogout() {
  Session.clear();
  toast('Signed out successfully', 'info');
  Router.go('landing');
}

/* ── App boot ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initSidebar();
  initFadeUpAnimations();

  const user = Session.user;
  if (user) {
    updateUserChip(user);
    Router.go('dashboard');
  } else {
    Router.go('landing');
  }
});