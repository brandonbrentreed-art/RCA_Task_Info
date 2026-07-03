"use strict";

// ============================================================
// powData.js — Pool of Work API data layer
// Centralises BigQuery API calls for live task data.
// Uses apiCall() from auth.js for authenticated requests.
// ============================================================

var PowData = (function () {
  var STORE_KEY = "pow_last_query";
  var _lastResult = null;

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

    var params = { zone_code: zoneCode.trim().toUpperCase() };
    if (targetDate) params.target_date = targetDate;

    return apiCall("pool_of_work", params).then(function (result) {
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

  /**
   * Get cached result from last API call.
   */
  function getLastResult() {
    return _lastResult;
  }

  /**
   * Convert API response rows to CSV text for DataLoader compatibility.
   * This bridges the live API data into the existing timeline engine.
   */
  function toCSV(rows) {
    if (!rows || !rows.length) return "";
    var headers = Object.keys(rows[0]);
    var lines = [headers.join(",")];
    for (var i = 0; i < rows.length; i++) {
      var vals = [];
      for (var j = 0; j < headers.length; j++) {
        var v = rows[i][headers[j]];
        vals.push(v == null ? "" : String(v));
      }
      lines.push(vals.join(","));
    }
    return lines.join("\n");
  }

  /**
   * Restore last query metadata from session.
   */
  function restoreLastQuery() {
    try {
      var stored = sessionStorage.getItem(STORE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    _lastResult = null;
    try { sessionStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  return {
    fetchPoolOfWork: fetchPoolOfWork,
    getLastResult: getLastResult,
    toCSV: toCSV,
    restoreLastQuery: restoreLastQuery,
    clear: clear
  };
})();
