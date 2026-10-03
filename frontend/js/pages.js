/* ═══════════════════════════════════════════════════
   AERIS HEALTH  —  All Page Logic
   ═══════════════════════════════════════════════════ */

/* ══════════════════════════════════════════
   AUTH — Register
   ══════════════════════════════════════════ */
async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const btn  = form.querySelector('[type=submit]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';

  try {
    const res = await API.registerUser({
      name:            form.reg_name.value.trim(),
      email:           form.reg_email.value.trim(),
      password:        form.reg_pass.value,
      age:             parseInt(form.reg_age.value),
      gender:          form.reg_gender.value,
      healthCondition: form.reg_condition.value,
    });
    Session.user = res.data;
    updateUserChip(res.data);
    toast(`Welcome, ${res.data.name}! Account created.`, 'success');
    Router.go('dashboard');
  } catch (err) {
    toast(err.message || 'Registration failed', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
  }
}

/* ══════════════════════════════════════════
   AUTH — Login
   ══════════════════════════════════════════ */
async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const btn  = form.querySelector('[type=submit]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';

  try {
    const res = await API.loginUser({
      email:    form.log_email.value.trim(),
      password: form.log_pass.value,
    });
    console.log(res);
    Session.user = res.data;
    updateUserChip(res.data);
    toast(`Welcome back, ${res.data.name}!`, 'success');
    Router.go('dashboard');
  } catch (err) {
    toast(err.message || 'Invalid credentials', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
  }
}

/* ══════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════ */
let _dashChart = null;

async function initDashboard() {
  const user = Session.user;
  if (!user) return;

  const greetEl = document.getElementById('dash-greet');
  if (greetEl) {
    const hour = new Date().getHours();
    const period = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    greetEl.textContent = `${period}, ${user.name.split(' ')[0]} 👋`;
  }

  try {
    const [statsRes, reportsRes] = await Promise.all([
      API.getRiskStats().catch(() => ({ data: {} })),
      API.getReportsByUser(user.id).catch(() => ({ data: [] })),
    ]);

    const stats   = statsRes.data  || {};
    const reports = reportsRes.data || [];

    animateCounter(document.getElementById('dash-total'),    reports.length || stats.totalReports || 0);
    animateCounter(document.getElementById('dash-high'),     (stats.highRiskCount || 0) + (stats.criticalCount || 0));
    animateCounter(document.getElementById('dash-moderate'), stats.moderateCount  || 0);
    animateCounter(document.getElementById('dash-low'),      stats.lowRiskCount   || 0);

    _renderDashTable(reports.slice(0, 5));
    _renderDashChart(reports.slice(0, 7).reverse());
    if (reports.length) _renderLastReportCard(reports[0]);

  } catch (err) {
    console.warn('Dashboard load error:', err.message);
  }
}

function _renderDashTable(reports) {
  const tbody = document.getElementById('dash-table-body');
  if (!tbody) return;
  if (!reports.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-dim" style="padding:24px">
      No reports yet. <span style="color:var(--accent-lime);cursor:pointer" onclick="Router.go('submit')">Submit your first data →</span>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = reports.map(r => `
    <tr>
      <td><span class="font-mono" style="font-size:11px;color:var(--accent-cyan)">#${r.id}</span></td>
      <td>${r.location || '—'}</td>
      <td><span class="font-mono" style="color:${aqiColor(r.aqi || 0)}">${r.aqi || '—'}</span></td>
      <td><span class="badge ${riskBadgeClass(r.riskLevel)}"><span class="badge-dot"></span> ${r.riskLevel || '—'}</span></td>
      <td><button class="btn btn-sm btn-outline" onclick="viewReport(${r.id})">View</button></td>
    </tr>`).join('');
}

function _renderLastReportCard(r) {
  const el = document.getElementById('last-report-card');
  if (!el || !r) return;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="flex-shrink:0">
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;letter-spacing:1px;font-weight:600">LATEST RISK SCORE</div>
        <div class="font-display" style="font-size:44px;font-weight:800;color:${riskColor(r.riskLevel)};line-height:1">
          ${r.riskPercentage?.toFixed(1) || 0}<span style="font-size:20px">%</span>
        </div>
        <div style="margin-top:10px"><span class="badge ${riskBadgeClass(r.riskLevel)}"><span class="badge-dot"></span> ${r.riskLevel}</span></div>
      </div>
      <div style="flex:1;min-width:160px">
        <div style="font-weight:600;font-size:14px;margin-bottom:4px">${r.location || '—'}</div>
        <div style="font-size:12px;color:var(--text-secondary)">${r.aqiCategory || ''} &nbsp;·&nbsp; AQI ${r.aqi || '—'}</div>
        ${r.affectedOrgans && r.affectedOrgans !== 'None'
          ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Organs: ${r.affectedOrgans}</div>` : ''}
      </div>
      <button class="btn btn-primary btn-sm" onclick="viewReport(${r.id})">
        <i class="fa-solid fa-arrow-right"></i> Full Report
      </button>
    </div>`;
}

function _renderDashChart(reports) {
  const ctx = document.getElementById('dash-aqi-chart');
  if (!ctx || !reports.length) return;
  if (_dashChart) _dashChart.destroy();

  const labels = reports.map(r => (r.location || '').split(',')[0].trim().slice(0, 10));
  const values = reports.map(r => r.aqi || 0);
  const colors = values.map(v => aqiColor(v));

  _dashChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'AQI',
        data: values,
        backgroundColor: colors.map(c => c + '28'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8A8578', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8A8578', font: { size: 10 } }, min: 0, max: 500 },
      },
    },
  });
}

async function viewReport(reportId) {
  try {
    showLoading('Loading report...');
    const res = await API.getReportById(reportId);
    Session.lastReport = res.data;
    Router.go('result');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ══════════════════════════════════════════
   SUBMIT FORM
   ══════════════════════════════════════════ */
async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const user = Session.user;
  if (!user) { toast('Please log in first', 'error'); return; }

  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analysing data...';
  showLoading('Running health risk analysis...');

  try {
    const dto = {
      userId:               user.id,
      location:             form.location.value.trim(),
      aqi:                  parseFloat(form.aqi.value),
      pm25:                 parseFloat(form.pm25.value)      || 0,
      pm10:                 parseFloat(form.pm10.value)      || 0,
      coLevel:              parseFloat(form.co_level.value)  || 0,
      no2Level:             parseFloat(form.no2_level.value) || 0,
      so2Level:             parseFloat(form.so2_level.value) || 0,
      exposureHours:        parseInt(form.exposure_hours.value),
      smoker:               form.smoker.checked,
      pollutionExposureLevel: form.exposure_level.value,
    };

    const res = await API.submitPollution(dto);
    Session.lastReport = res.data;
    toast('Analysis complete! View your results.', 'success');
    Router.go('result');
  } catch (err) {
    toast(err.message || 'Submission failed', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> Run Health Risk Analysis';
    hideLoading();
  }
}

/* ══════════════════════════════════════════
   LIVE POLLUTION DATA (NEW — auto-fills the
   submit form from the WAQI live AQI API)
   ══════════════════════════════════════════ */
async function handleFetchLiveData() {
  const form = document.getElementById('pollution-form');
  if (!form) return;
  const location = form.location.value.trim();
  if (!location) { toast('Enter a location first', 'error'); return; }

  const btn = document.getElementById('fetch-live-btn');
  const statusEl = document.getElementById('live-fetch-status');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching live data...'; }

  try {
    const res = await API.getLivePollution(location);
    const d = res.data;

    const setIfPresent = (field, value) => {
      if (value !== null && value !== undefined && !isNaN(value)) {
        form[field].value = value;
      }
    };
    setIfPresent('aqi', d.aqi);
    setIfPresent('pm25', d.pm25);
    setIfPresent('pm10', d.pm10);
    setIfPresent('co_level', d.coLevel);
    setIfPresent('no2_level', d.no2Level);
    setIfPresent('so2_level', d.so2Level);

    // Refresh the AQI category preview
    const aqiInput = document.getElementById('aqi-input');
    if (aqiInput) aqiInput.dispatchEvent(new Event('input'));

    if (statusEl) {
      statusEl.textContent = `Live data loaded for "${d.location || location}" (source: ${d.source || 'WAQI'}). Review the values below before running your analysis.`;
      statusEl.style.display = 'block';
    }
    toast('Live pollution data loaded — please review the values.', 'success');
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `Could not fetch live data: ${err.message}. You can still enter readings manually below.`;
      statusEl.style.display = 'block';
    }
    toast(err.message || 'Live data fetch failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Fetch Live Data'; }
  }
}

function initAqiPreview() {
  const input  = document.getElementById('aqi-input');
  const numEl  = document.getElementById('aqi-preview');
  const catEl  = document.getElementById('aqi-cat-preview');
  if (!input) return;

  input.addEventListener('input', () => {
    const val = parseFloat(input.value);
    if (isNaN(val)) return;
    if (numEl) { numEl.textContent = val; numEl.style.color = aqiColor(val); }
    const cats = ['Good', 'Moderate', 'Poor (Unhealthy for Sensitive Groups)',
                  'Very Poor (Unhealthy)', 'Hazardous', 'Severely Hazardous'];
    const idx  = val <= 50 ? 0 : val <= 100 ? 1 : val <= 150 ? 2 : val <= 200 ? 3 : val <= 300 ? 4 : 5;
    if (catEl) catEl.textContent = cats[idx];
  });
}

/* ══════════════════════════════════════════
   RESULT PAGE
   ══════════════════════════════════════════ */
let _resultRadar = null;

function renderResult(report) {
  if (!report) return;

  // Header
  setEl('res-location', report.location || '—');

  // Alert banner
  const alertEl = document.getElementById('res-alert');
  if (alertEl) {
    const cls = {
      LOW: 'alert-low', MODERATE: 'alert-moderate',
      HIGH: 'alert-high', CRITICAL: 'alert-critical',
    }[report.riskLevel] || 'alert-moderate';
    const icon = {
      LOW: 'circle-check', MODERATE: 'circle-exclamation',
            HIGH: 'triangle-exclamation', CRITICAL: 'skull-crossbones',
    }[report.riskLevel] || 'circle-exclamation';
    alertEl.className = `alert ${cls}`;
    alertEl.innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${report.alertMessage || ''}</span>`;
  }

  // Gauge
  const gaugeVal = document.getElementById('gauge-value');
  if (gaugeVal) {
    gaugeVal.textContent = (report.riskPercentage || 0).toFixed(1);
    gaugeVal.style.color = riskColor(report.riskLevel);
  }
  renderGauge('gauge-svg', report.riskPercentage || 0, 100, riskColor(report.riskLevel));

  // Risk level badge
  const lvlEl = document.getElementById('res-risk-level');
  if (lvlEl) {
    lvlEl.className = `badge ${riskBadgeClass(report.riskLevel)}`;
    lvlEl.innerHTML = `<span class="badge-dot"></span> ${report.riskLevel || '—'}`;
  }

  // AQI display
  const aqiEl = document.getElementById('res-aqi');
  if (aqiEl) { aqiEl.textContent = report.aqi || '—'; aqiEl.style.color = aqiColor(report.aqi || 0); }
  setEl('res-aqi-cat',  report.aqiCategory   || '—');
  setEl('res-organs',   report.affectedOrgans || '—');

  // Pollutant progress bars
  const barsEl = document.getElementById('res-pollutant-bars');
  if (barsEl) {
    barsEl.innerHTML =
      buildProgress('AQI',   report.aqi      || 0,  500, aqiColor(report.aqi || 0)) +
      buildProgress('PM2.5', report.pm25     || 0,  250, '#6B5846', ' µg/m³') +
      buildProgress('PM10',  report.pm10     || 0,  500, '#4F6F3A', ' µg/m³') +
      buildProgress('CO',    report.coLevel  || 0,   30, '#CC7A35', ' ppm')   +
      buildProgress('NO₂',   report.no2Level || 0,  400, '#D99A2B', ' µg/m³') +
      buildProgress('SO₂',   report.so2Level || 0,  500, '#C94A45', ' µg/m³');
    animateProgressBars(barsEl);
  }

  // Health impacts
  const impEl = document.getElementById('res-impacts');
  if (impEl) {
    if (report.healthImpacts?.length) {
      impEl.innerHTML = report.healthImpacts.map(imp =>
        `<div class="impact-tag"><i class="fa-solid fa-triangle-exclamation"></i>${imp}</div>`
      ).join('');
    } else {
      impEl.innerHTML = '<div class="text-dim text-sm">No significant impacts detected.</div>';
    }
  }

  // Recommendations
  const recEl = document.getElementById('res-recs');
  if (recEl) {
    if (report.recommendations?.length) {
      recEl.innerHTML = report.recommendations.slice(0, 6).map(r => buildRecCard(r)).join('');
    } else {
      recEl.innerHTML = '<div class="text-dim text-sm text-center">No recommendations loaded.</div>';
    }
  }

  // Radar chart
  _renderResultRadar(report);
}

function _renderResultRadar(r) {
  const ctx = document.getElementById('res-radar-chart');
  if (!ctx) return;
  if (_resultRadar) _resultRadar.destroy();

  const norm = (v, max) => Math.min(((v || 0) / max) * 100, 100);
  _resultRadar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['AQI', 'PM2.5', 'PM10', 'CO', 'NO₂', 'SO₂'],
      datasets: [{
        label: 'Pollution Level %',
        data: [
          norm(r.aqi,      500),
          norm(r.pm25,     250),
          norm(r.pm10,     500),
          norm(r.coLevel,   30),
          norm(r.no2Level, 400),
          norm(r.so2Level, 500),
        ],
        backgroundColor: 'rgba(63,143,74,0.10)',
        borderColor: '#3F8F4A',
        borderWidth: 2,
        pointBackgroundColor: '#3F8F4A',
        pointRadius: 4,
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
          pointLabels: { color: '#8A8578', font: { size: 11 } },
          ticks:       { display: false },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════
   HISTORY
   ══════════════════════════════════════════ */
let _historyChart = null;

async function initHistory() {
  const user  = Session.user;
  if (!user) return;
  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-dim" style="padding:28px">
    <i class="fa-solid fa-spinner fa-spin"></i>&nbsp; Loading history...
  </td></tr>`;

  try {
    const res     = await API.getReportsByUser(user.id);
    const reports = res.data || [];

    if (!reports.length) {
      tbody.innerHTML = `<tr><td colspan="7">
        <div class="empty-state">
          <i class="fa-solid fa-folder-open"></i>
          <h3>No history yet</h3>
          <p>Submit pollution data to start building your health risk history.</p>
        </div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = reports.map(r => `
      <tr>
        <td><span class="font-mono" style="font-size:11px;color:var(--accent-cyan)">#${r.id}</span></td>
        <td>${r.location || '—'}</td>
        <td><span class="font-mono" style="color:${aqiColor(r.aqi || 0)}">${r.aqi || '—'}</span></td>
        <td><span class="font-mono" style="color:${riskColor(r.riskLevel)}">${(r.riskPercentage || 0).toFixed(1)}%</span></td>
        <td><span class="badge ${riskBadgeClass(r.riskLevel)}"><span class="badge-dot"></span> ${r.riskLevel || '—'}</span></td>
        <td style="color:var(--text-secondary);font-size:12px">
          ${new Date(r.calculatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </td>
        <td><button class="btn btn-sm btn-outline" onclick="viewReport(${r.id})">View</button></td>
      </tr>`).join('');

    _renderHistoryTrend(reports.slice(0, 10).reverse());

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--risk-critical);padding:24px">${err.message}</td></tr>`;
  }
}

function _renderHistoryTrend(reports) {
  const ctx = document.getElementById('history-trend-chart');
  if (!ctx || !reports.length) return;
  if (_historyChart) _historyChart.destroy();

  _historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: reports.map(r => (r.location || '').split(',')[0].trim().slice(0, 12)),
      datasets: [
        {
          label: 'Risk %',
          data: reports.map(r => r.riskPercentage || 0),
          borderColor: '#C94A45', backgroundColor: 'rgba(201,74,69,0.08)',
          fill: true, tension: 0.4,
          pointBackgroundColor: '#C94A45', pointRadius: 5, yAxisID: 'y',
        },
        {
          label: 'AQI',
          data: reports.map(r => r.aqi || 0),
          borderColor: '#3F8F4A', backgroundColor: 'rgba(63,143,74,0.06)',
          fill: false, tension: 0.4,
          pointBackgroundColor: '#3F8F4A', pointRadius: 5, yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8A8578', font: { size: 11 } } } },
      scales: {
        x:  { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8A8578', font: { size: 11 } } },
        y:  { position: 'left',  min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#C94A45', font: { size: 11 } } },
        y1: { position: 'right', min: 0, max: 500, grid: { drawOnChartArea: false },           ticks: { color: '#3F8F4A', font: { size: 11 } } },
      },
    },
  });
}

/* ══════════════════════════════════════════
   RECOMMENDATIONS
   ══════════════════════════════════════════ */
async function initRecommend() {
  loadRecsByLevel('MODERATE');
}

async function loadRecsByLevel(level) {
  const container = document.getElementById('rec-container');
  if (!container) return;

  container.innerHTML = `<div class="text-center text-dim" style="padding:24px">
    <i class="fa-solid fa-spinner fa-spin"></i>
  </div>`;

  // Toggle active button styling
  document.querySelectorAll('.rec-level-btn').forEach(b => {
    const active = b.dataset.level === level;
    b.classList.toggle('btn-primary', active);
    b.classList.toggle('btn-outline',  !active);
  });

  try {
    const res  = await API.getRecsByLevel(level);
    const recs = res.data || [];
    if (!recs.length) {
      container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><h3>No recommendations found</h3></div>`;
      return;
    }
    container.innerHTML = recs.map(r => buildRecCard(r)).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:var(--risk-critical);text-align:center;padding:20px">${err.message}</div>`;
  }
}

async function loadDynamicAdvice() {
  const form = document.getElementById('dynamic-advice-form');
  if (!form) return;

  const params = {
    aqi:             parseFloat(form.d_aqi.value)   || 0,
    pm25:            parseFloat(form.d_pm25.value)  || 0,
    coLevel:         parseFloat(form.d_co.value)    || 0,
    age:             parseInt(form.d_age.value)     || 30,
    healthCondition: form.d_condition.value         || 'NORMAL',
    smoker:          form.d_smoker.checked,
    exposureHours:   parseInt(form.d_hours.value)   || 4,
    exposureLevel:   form.d_explevel.value          || 'MEDIUM',
  };

  try {
    showLoading('Generating personalised advice...');
    const res  = await API.getDynamicAdvice(params);
    const data = res.data || {};
    const el   = document.getElementById('dynamic-result');
    if (!el) return;
    el.classList.remove('hidden');

    const alertCls  = { LOW:'alert-low', MODERATE:'alert-moderate', HIGH:'alert-high', CRITICAL:'alert-critical' }[data.riskLevel] || 'alert-moderate';
    const alertIcon = { LOW:'circle-check', MODERATE:'circle-exclamation', HIGH:'triangle-exclamation', CRITICAL:'skull-crossbones' }[data.riskLevel] || 'circle-exclamation';

    el.querySelector('.card-body').innerHTML = `
      <div class="alert ${alertCls}" style="margin-bottom:16px">
        <i class="fa-solid fa-${alertIcon}"></i><span>${data.alertMessage || ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap">
        <div>
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;letter-spacing:1px">RISK SCORE</div>
          <div class="font-display" style="font-size:32px;font-weight:800;color:${riskColor(data.riskLevel)}">
            ${(data.riskPercentage || 0).toFixed(1)}<span style="font-size:16px">%</span>
          </div>
        </div>
        <span class="badge ${riskBadgeClass(data.riskLevel)}" style="font-size:13px">
          <span class="badge-dot"></span> ${data.riskLevel} RISK
        </span>
      </div>
      <div style="font-size:11px;color:var(--text-secondary);letter-spacing:1px;font-weight:600;margin-bottom:10px">
        PROTECTION RECOMMENDATIONS
      </div>
      ${(data.recommendations || []).map(r =>
        `<div class="rec-card">
          <div class="rec-icon general"><i class="fa-solid fa-shield-halved"></i></div>
          <div class="rec-text">${r}</div>
        </div>`
      ).join('')}`;
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

/* ══════════════════════════════════════════
   CITY MONITOR
   ══════════════════════════════════════════ */
let _cityChart = null;

async function searchCity() {
  const input = document.getElementById('city-search-input');
  const city  = input?.value.trim();
  if (!city) { toast('Enter a city name to search', 'info'); return; }

  // Hide empty state
  const emptyEl  = document.getElementById('city-empty');
  const resultEl = document.getElementById('city-result');
  if (emptyEl)  emptyEl.classList.add('hidden');

  try {
    showLoading(`Analysing ${city}...`);
    const res  = await API.getCityAnalysis(city);
    const data = res.data || {};

    if (!data.totalRecords) {
      if (emptyEl) {
        emptyEl.innerHTML = `<div class="empty-state" style="padding:60px">
          <i class="fa-solid fa-city"></i>
          <h3>No data for "${city}"</h3>
          <p>No pollution records found for this location. Submit data for this city first.</p>
        </div>`;
        emptyEl.classList.remove('hidden');
      }
      return;
    }

    if (resultEl) resultEl.classList.remove('hidden');

    setEl('city-name',     data.location || city);
    setEl('city-aqi-cat',  data.aqiCategoryLabel || '—');
    setEl('city-records',  data.totalRecords);
    setEl('city-risk',     data.overallRiskLevel || '—');
    setEl('city-pollutant',data.dominantPollutant || '—');
    setEl('city-pm25',     `${data.averagePm25 || 0} µg/m³`);
    setEl('city-pm10',     `${data.averagePm10 || 0} µg/m³`);
    setEl('city-co',       `${data.averageCoLevel || 0} ppm`);

    const aqiEl = document.getElementById('city-aqi');
    if (aqiEl) {
      aqiEl.textContent = data.averageAqi || '—';
      aqiEl.style.color = aqiColor(data.averageAqi || 0);
    }

    _renderCityChart(data);

  } catch (err) {
    toast(err.message, 'error');
    if (emptyEl) emptyEl.classList.remove('hidden');
  } finally {
    hideLoading();
  }
}

function _renderCityChart(data) {
  const ctx = document.getElementById('city-pollutant-chart');
  if (!ctx) return;
  if (_cityChart) _cityChart.destroy();

  _cityChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['PM2.5', 'PM10', 'CO ×10', 'NO₂', 'SO₂'],
      datasets: [{
        data: [
          data.averagePm25    || 0,
          data.averagePm10    || 0,
          (data.averageCoLevel || 0) * 10,
          data.averageNo2Level || 0,
          data.averageSo2Level || 0,
        ],
        backgroundColor: ['#6B584655','#4F6F3A55','#CC7A3555','#D99A2B55','#C94A4555'],
        borderColor:     ['#6B5846',  '#4F6F3A',  '#CC7A35',  '#D99A2B',  '#C94A45'],
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8A8578', font: { size: 11 }, padding: 12 } },
      },
      cutout: '68%',
    },
  });
}

/* ══════════════════════════════════════════
   ADMIN ANALYTICS
   ══════════════════════════════════════════ */
let _adminCharts = {};

async function initAdmin() {
  try {
    showLoading('Loading admin data...');
    const [statsRes, usersRes, critRes, highRes] = await Promise.all([
      API.getRiskStats().catch(() => ({ data: {} })),
      API.getAllUsers().catch(() => ({ data: [] })),
      API.getReportsByLevel('CRITICAL').catch(() => ({ data: [] })),
      API.getReportsByLevel('HIGH').catch(() => ({ data: [] })),
    ]);

    const stats    = statsRes.data || {};
    const users    = usersRes.data || [];
    const critical = critRes.data  || [];
    const high     = highRes.data  || [];

    animateCounter(document.getElementById('admin-total-users'),   users.length);
    animateCounter(document.getElementById('admin-total-reports'), stats.totalReports || 0);
    animateCounter(document.getElementById('admin-critical'),      stats.criticalCount || 0);
    animateCounter(document.getElementById('admin-high-pct'),      parseInt(stats.highRiskPercent) || 0);

    _renderAdminPie(stats);
    _renderAdminUsersTable(users);
    _renderHighRiskList([...critical, ...high].slice(0, 10));

  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function _renderAdminPie(stats) {
  const ctx = document.getElementById('admin-risk-pie');
  if (!ctx) return;
  if (_adminCharts.pie) _adminCharts.pie.destroy();

  _adminCharts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
      datasets: [{
        data: [
          stats.lowRiskCount  || 0,
          stats.moderateCount || 0,
          stats.highRiskCount || 0,
          stats.criticalCount || 0,
        ],
        backgroundColor: ['rgba(63,143,74,0.65)','rgba(217,154,43,0.65)','rgba(204,122,53,0.65)','rgba(201,74,69,0.65)'],
        borderColor:     ['#3F8F4A','#D99A2B','#CC7A35','#C94A45'],
        borderWidth: 2, hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8A8578', font: { size: 11 }, padding: 12 } },
      },
      cutout: '60%',
    },
  });
}

function _renderAdminUsersTable(users) {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-dim" style="padding:24px">No users found</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => {
    const condCls = u.healthCondition === 'NORMAL' ? 'badge-low' : 'badge-high';
    return `<tr>
      <td><span class="font-mono" style="font-size:11px;color:var(--accent-cyan)">#${u.id}</span></td>
      <td style="font-weight:500">${u.name}</td>
      <td style="color:var(--text-secondary)">${u.email}</td>
      <td>${u.age} / ${u.gender}</td>
      <td><span class="badge ${condCls}">${u.healthCondition}</span></td>
    </tr>`;
  }).join('');
}

function _renderHighRiskList(reports) {
  const el = document.getElementById('admin-high-risk-list');
  if (!el) return;
  if (!reports.length) {
    el.innerHTML = `<div class="empty-state" style="padding:28px">
      <i class="fa-solid fa-circle-check"></i>
      <h3>No high-risk reports</h3>
      <p>Great! No critical or high-risk cases found.</p>
    </div>`;
    return;
  }
  el.innerHTML = reports.map(r => `
    <div class="rec-card" style="margin-bottom:8px">
      <div class="rec-icon medical"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${r.userName || 'User #' + r.userId}
          </span>
          <span class="badge ${riskBadgeClass(r.riskLevel)}" style="flex-shrink:0">
            <span class="badge-dot"></span> ${r.riskLevel}
          </span>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">
          ${r.location || '—'} &nbsp;·&nbsp; AQI ${r.aqi || '—'} &nbsp;·&nbsp;
          Risk: ${(r.riskPercentage || 0).toFixed(1)}%
        </div>
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════════
   AERIS ASSISTANT
   (chat/UI event handling lives in assistant.js and environment.js;
   this is just the page-navigation lifecycle hook, matching the
   initDashboard()/initHistory()/initAdmin() pattern used elsewhere.)
   ══════════════════════════════════════════ */
function initAssistant() {
  const coords = Environment.getCoords();
  const statusEl = document.getElementById('assistant-location-status');
  if (statusEl) {
    statusEl.innerHTML = coords
      ? '<i class="fa-solid fa-location-crosshairs"></i> Location shared'
      : '<i class="fa-solid fa-location-crosshairs"></i> Location not shared';
  }
  const cached = Environment.getCachedSnapshot();
  if (cached) renderEnvironmentCard(cached);
}

/* ══════════════════════════════════════════
   FORM INIT (runs after DOM ready)
   ══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const submitForm = document.getElementById('pollution-form');
  if (submitForm) {
    submitForm.addEventListener('submit', handleSubmit);
    initAqiPreview();
  }

  const fetchLiveBtn = document.getElementById('fetch-live-btn');
  if (fetchLiveBtn) fetchLiveBtn.addEventListener('click', handleFetchLiveData);

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const regForm = document.getElementById('register-form');
  if (regForm) regForm.addEventListener('submit', handleRegister);

  initAssistantForm(); // binds AERIS Assistant listeners once (defined in assistant.js)
});
