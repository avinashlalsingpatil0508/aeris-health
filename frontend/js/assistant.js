/* ═══════════════════════════════════════════════════
   AERIS HEALTH — AERIS Assistant (chat UI)
   Talks to POST /api/assistant/ask. All the actual reasoning (intent
   detection, the existing risk engine, the reply text) happens on the
   backend - this file just renders it and handles the location/typing UI.
   ═══════════════════════════════════════════════════ */

function appendAssistantMessage(text, sender) {
  const container = document.getElementById('assistant-messages');
  if (!container) return;
  const row = document.createElement('div');
  row.className = `assistant-msg assistant-msg-${sender === 'user' ? 'user' : 'bot'}`;
  const bubble = document.createElement('div');
  bubble.className = 'assistant-msg-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function showAssistantTyping() {
  const el = document.getElementById('assistant-typing');
  if (el) el.classList.remove('hidden');
  const container = document.getElementById('assistant-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

function hideAssistantTyping() {
  const el = document.getElementById('assistant-typing');
  if (el) el.classList.add('hidden');
}

function renderEnvironmentCard(snapshot) {
  if (!snapshot) return;
  const empty = document.getElementById('assistant-env-empty');
  const grid  = document.getElementById('assistant-env-grid');
  if (empty) empty.classList.add('hidden');
  if (grid)  grid.classList.remove('hidden');

  setEl('env-aqi-value', snapshot.aqiAvailable ? snapshot.aqi : 'Unavailable');
  setEl('env-aqi-cat',   snapshot.aqiAvailable ? (snapshot.aqiCategory || '—') : 'Live AQI unavailable');
  setEl('env-risk-value', snapshot.riskAvailable ? `${snapshot.riskPercentage.toFixed(1)}%` : 'Unavailable');
  setEl('env-risk-level', snapshot.riskAvailable ? snapshot.riskLevel : (snapshot.riskUnavailableReason || '—'));
  setEl('env-temp-value', (snapshot.weatherAvailable && snapshot.temperature != null) ? `${snapshot.temperature}°C` : 'Unavailable');
  setEl('env-weather-cond', snapshot.weatherCondition || '—');
  setEl('env-humidity-value', (snapshot.weatherAvailable && snapshot.humidity != null) ? `${snapshot.humidity}%` : 'Unavailable');
  setEl('env-location-name', snapshot.location || '—');

  const aqiValEl = document.getElementById('env-aqi-value');
  if (aqiValEl) aqiValEl.style.color = snapshot.aqiAvailable ? aqiColor(snapshot.aqi) : '';

  const riskValEl = document.getElementById('env-risk-value');
  if (riskValEl) riskValEl.style.color = snapshot.riskAvailable ? riskColor(snapshot.riskLevel) : '';
}

async function handleAssistantAsk(question) {
  question = (question || '').trim();
  if (!question) return;

  appendAssistantMessage(question, 'user');
  const input = document.getElementById('assistant-input');
  if (input) input.value = '';

  const coords = Environment.getCoords();
  if (!coords) {
    appendAssistantMessage('I need your location first — tap "Use My Location" above so I can fetch live conditions.', 'bot');
    return;
  }

  showAssistantTyping();
  try {
    const user = Session.user;
    const res = await API.askAssistant({
      question,
      latitude: coords.latitude,
      longitude: coords.longitude,
      userId: user ? user.id : null,
    });
    const data = res.data;
    appendAssistantMessage(data.reply, 'bot');
    renderEnvironmentCard(data.context); // keep the mini-card in sync with what was just used
  } catch (err) {
    appendAssistantMessage(`Sorry, I couldn't get an answer: ${err.message}`, 'bot');
  } finally {
    hideAssistantTyping();
  }
}

/**
 * Binds all AERIS Assistant event listeners ONCE. Called from pages.js's
 * existing DOMContentLoaded handler, not on every page navigation, so
 * repeated visits to the Assistant page never register duplicate listeners.
 */
function initAssistantForm() {
  const locateBtn   = document.getElementById('assistant-locate-btn');
  const refreshBtn  = document.getElementById('assistant-refresh-btn');
  const form        = document.getElementById('assistant-form');
  const suggestions = document.getElementById('assistant-suggestions');

  if (locateBtn) {
    locateBtn.addEventListener('click', async () => {
      locateBtn.disabled = true;
      locateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Getting location...';
      try {
        await Environment.requestLocation();
        const statusEl = document.getElementById('assistant-location-status');
        if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Location shared';
        showLoading('Fetching live environment...');
        const snapshot = await Environment.fetchSnapshot(true);
        renderEnvironmentCard(snapshot);
        toast('Live environment loaded', 'success');
      } catch (err) {
        toast(err.message || 'Could not get your location', 'error');
      } finally {
        hideLoading();
        locateBtn.disabled = false;
        locateBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use My Location';
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (!Environment.getCoords()) { toast('Share your location first', 'info'); return; }
      refreshBtn.disabled = true;
      try {
        const snapshot = await Environment.fetchSnapshot(true);
        renderEnvironmentCard(snapshot);
        toast('Environment refreshed', 'success');
      } catch (err) {
        toast(err.message || 'Could not refresh environment', 'error');
      } finally {
        refreshBtn.disabled = false;
      }
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('assistant-input');
      handleAssistantAsk(input ? input.value : '');
    });
  }

  if (suggestions) {
    suggestions.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) handleAssistantAsk(chip.dataset.q);
    });
  }
}