"use strict";

// ============================================================
// powData.js — Pool of Work API data layer
// Centralises BigQuery API calls for live task data.
// Uses apiCall() from auth.js for authenticated requests.
// ============================================================

const PowData = (() => {
  const STORE_KEY = "pow_last_query";
  let _lastResult = null;

  /**
   * Fetch pool of work from backend API.
   * @param {string} zoneCode - Required zone_code filter
   * @param {string} targetDate - Optional YYYY-MM-DD (defaults to today on server)
   * @returns {Promise<{data: Array, count: number}>}
   */
  function fetchPoolOfWork(zoneCode, targetDate) {
    if (!zoneCode || !zoneCode.trim()) {
      return Promise.reject(new Error("Zone code is required"));
    }

    const params = { zone_code: zoneCode.trim().toUpperCase() };
    if (targetDate) params.target_date = targetDate;

    return apiCall("pool_of_work", params).then((result) => {
      _lastResult = result;
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify({
          zone_code: params.zone_code,
          target_date: params.target_date || "",
          count: result.count,
          ts: new Date().toISOString()
        }));
      } catch (e) {}
      return result;
    });
  }

  function getLastResult() {
    return _lastResult;
  }

  /**
   * Convert API response rows to CSV text for DataLoader compatibility.
   * Bridges live API data into the existing timeline engine.
   */
  function toCSV(rows) {
    if (!rows || !rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (let i = 0; i < rows.length; i++) {
      const vals = headers.map(h => {
        const v = rows[i][h];
        return v == null ? "" : String(v);
      });
      lines.push(vals.join(","));
    }
    return lines.join("\n");
  }

  function restoreLastQuery() {
    try {
      const stored = sessionStorage.getItem(STORE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    _lastResult = null;
    try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  return { fetchPoolOfWork, getLastResult, toCSV, restoreLastQuery, clear };
})();
