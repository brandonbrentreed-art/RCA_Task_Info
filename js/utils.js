"use strict";

// ============================================================
// utils.js — Shared formatting utilities
// Loaded before timelineEngine.js and timelineRenderer.js
// ============================================================

const Utils = (() => {
  const SENTINEL_DATE = "31/12/9999 00:00";

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function formatTime(date) {
    return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  function formatDate(date) {
    return pad2(date.getDate()) + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
  }

  function fmtHeaderDate(dt) {
    return pad2(dt.getDate()) + " " + MONTHS[dt.getMonth()];
  }

  function fmtHeaderTime(dt) {
    return pad2(dt.getHours()) + ":" + pad2(dt.getMinutes());
  }

  return { MONTHS, SENTINEL_DATE, pad2, formatTime, formatDate, fmtHeaderDate, fmtHeaderTime };
})();
