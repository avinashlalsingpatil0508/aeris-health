/* ═══════════════════════════════════════════════════
   AERIS HEALTH  —  API Service Layer
   const BASE_URL = "http://localhost:8000";
   ═══════════════════════════════════════════════════ */
const API = (() => {
  // BASE can be overridden per-deployment via the <meta name="aeris-api-base">
  // tag in index.html, so this file doesn't need editing to point at a
  // different backend host/port in production.
  const metaBase = document.querySelector('meta[name="aeris-api-base"]');
  const BASE = (metaBase && metaBase.content) || 'http://localhost:8000/api';

  async function request(method, path, body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(BASE + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }

  return {
    // User
    registerUser:     (dto)       => request('POST',   '/users/register',  dto),
    loginUser:        (dto)       => request('POST',   '/users/login',     dto),
    getUserById:      (id)        => request('GET',    `/users/${id}`),
    getAllUsers:       ()          => request('GET',    '/users'),
    updateUser:       (id, dto)   => request('PUT',    `/users/${id}`,     dto),
    deleteUser:       (id)        => request('DELETE', `/users/${id}`),

    // Pollution
    submitPollution:  (dto)       => request('POST',   '/pollution/submit',  dto),
    getRecordById:    (id)        => request('GET',    `/pollution/${id}`),
    getRecordsByUser: (uid)       => request('GET',    `/pollution/user/${uid}`),
    searchByLocation: (loc)       => request('GET',    `/pollution/search?location=${encodeURIComponent(loc)}`),
    getAqiInfo:       (aqi)       => request('GET',    `/pollution/aqi-info?aqi=${aqi}`),
    getCityAnalysis:  (loc)       => request('GET',    `/pollution/city-analysis?location=${encodeURIComponent(loc)}`),
    getLivePollution: (loc)       => request('GET',    `/pollution/live?location=${encodeURIComponent(loc)}`),
    deleteRecord:     (id)        => request('DELETE', `/pollution/${id}`),

    // Risk Reports
    getReportById:    (id)        => request('GET', `/risk/${id}`),
    getReportByRecord:(rid)       => request('GET', `/risk/record/${rid}`),
    getReportsByUser: (uid)       => request('GET', `/risk/user/${uid}`),
    getReportsByLevel:(lv)        => request('GET', `/risk/level/${lv}`),
    getRiskStats:     ()          => request('GET', `/risk/stats`),

    // Recommendations
    getAllRecs:        ()          => request('GET', '/recommendations'),
    getRecsByLevel:   (lv)        => request('GET', `/recommendations/level/${lv}`),
    getDynamicAdvice: (params)    => {
      const q = new URLSearchParams(params).toString();
      return request('GET', `/recommendations/dynamic?${q}`);
    },
    addRec:           (dto)       => request('POST',   '/recommendations', dto),
    deleteRec:        (id)        => request('DELETE', `/recommendations/${id}`),

    // Environment (live weather + AQI + risk snapshot for a location)
    getLiveEnvironment: (lat, lon, userId) => {
      const params = new URLSearchParams({ latitude: lat, longitude: lon });
      if (userId) params.set('userId', userId);
      return request('GET', `/environment/live?${params.toString()}`);
    },

    // AERIS Assistant
    askAssistant: (dto) => request('POST', '/assistant/ask', dto),
  };
})();