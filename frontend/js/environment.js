/* ═══════════════════════════════════════════════════
   AERIS HEALTH — Live Environment Engine (frontend)
   Handles browser geolocation and calls the backend's
   GET /api/environment/live endpoint. This file only fetches and
   caches data - it never invents a value itself. If the backend says a
   field is unavailable, that is passed through as-is.
   ═══════════════════════════════════════════════════ */
const Environment = (() => {
  const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes - avoids re-fetching on every question

  let coords = null;          // { latitude, longitude }
  let lastSnapshot = null;    // last successful /environment/live response
  let lastFetchedAt = 0;

  function getCoords() {
    return coords;
  }

  function getCachedSnapshot() {
    return lastSnapshot;
  }

  /**
   * Asks the browser for the user's location. Never called automatically -
   * only in response to an explicit user action (e.g. tapping
   * "Use My Location"), so the permission prompt only appears when the
   * person has asked for it.
   */
  function requestLocation() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject({ code: 'UNSUPPORTED', message: 'Your browser does not support location services.' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          resolve(coords);
        },
        (err) => {
          const messages = {
            1: { code: 'DENIED', message: 'Location permission was denied.' },
            2: { code: 'UNAVAILABLE', message: 'Your location is currently unavailable.' },
            3: { code: 'TIMEOUT', message: 'Getting your location timed out.' },
          };
          reject(messages[err.code] || { code: 'ERROR', message: 'Could not get your location.' });
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  /**
   * Fetches (or returns a recent cached copy of) the live environment
   * snapshot for the last known coordinates. Throws if location hasn't
   * been shared yet.
   */
  async function fetchSnapshot(forceRefresh = false) {
    if (!coords) {
      throw { code: 'NO_LOCATION', message: 'Location has not been shared yet.' };
    }

    const isFresh = lastSnapshot && (Date.now() - lastFetchedAt < CACHE_TTL_MS);
    if (isFresh && !forceRefresh) return lastSnapshot;

    const user = Session.user;
    const res = await API.getLiveEnvironment(coords.latitude, coords.longitude, user ? user.id : null);
    lastSnapshot = res.data;
    lastFetchedAt = Date.now();
    return lastSnapshot;
  }

  return { requestLocation, fetchSnapshot, getCoords, getCachedSnapshot };
})();