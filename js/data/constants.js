"use strict";

// ============================================================
// constants.js — NDP shared constants
// Single source of truth for Next Day Plan values.
// Loaded before all NDP modules.
// ============================================================

var NDP = (function () {
  // --- Magic Numbers ---
  var JOBS_PER_TECH = 3;
  var MAX_CELL = 500;
  var SKIP_ROWS = 6;
  var DRILL_PAGE_SIZE = 30;

  // --- Export Theme (static colours for clipboard/screenshot/xlsx — cannot use CSS vars) ---
  var EXPORT = {
    font: "Calibri, sans-serif",
    fontReport: "Roboto, Segoe UI, sans-serif",
    fontSize: "11px",
    headerBg: "#142032",
    headerColor: "#fff",
    headerRgb: "142032",
    textRgb: "FFFFFF",
    rowEven: "#fff",
    rowOdd: "#F9FAFB",
    border: "#E5E7EB",
    borderLight: "#e0e0e0",
    stripedBg: "#f5f5f5",
    muted: "#57606A",
    body: "#0D1117",
    critical: { bg: "#FEE2E2", text: "#D32F2F", label: "#7F1D1D" },
    high: { bg: "#FEF3C7", text: "#D97706", label: "#78350F" },
    medium: { bg: "#F3F4F6", text: "inherit", label: "#57606A" },
    low: { bg: "#D1FAE5", text: "#059669", label: "#064E3B" },
    success: "#059669"
  };

  // --- Workstack Types ---
  var WS_COPPER = "copper";
  var WS_FIBRE = "fibre";

  // --- Commit Tags ---
  var TAGS = {
    TAIL: "Tail",
    TODAY: "Today",
    TOMORROW: "Tomorrow",
    FUTURE: "Future",
    MANUAL: "Manual Add"
  };
  var KNOWN_TAGS = [TAGS.TAIL, TAGS.TODAY, TAGS.TOMORROW, TAGS.FUTURE, TAGS.MANUAL];

  // --- Appointment Slots ---
  var SLOTS = { AM: "AM", PM: "PM", ALL_DAY: "All Day" };
  var SLOT_ALIASES = {
    "AM": SLOTS.AM,
    "PM": SLOTS.PM,
    "ALL DAY": SLOTS.ALL_DAY,
    "ALLDAY": SLOTS.ALL_DAY,
    "AD": SLOTS.ALL_DAY
  };

  function normaliseSlot(raw) {
    if (!raw) return "";
    return SLOT_ALIASES[raw.trim().toUpperCase()] || "";
  }

  // --- Risk Levels ---
  var RISK = { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

  function riskLevel(alternatives) {
    if (alternatives === 0) return RISK.CRITICAL;
    if (alternatives === 1) return RISK.HIGH;
    if (alternatives <= 3) return RISK.MEDIUM;
    return RISK.LOW;
  }

  // --- Session Storage Keys ---
  var STORE = {
    PLAN_STATE: "ndp_plan_state",
    WS_TYPE: "ndp_ws_type",
    TECHS: "ndp_techs",
    TASKFORCE: "ndp_taskforce",
    ENRICH: "ndp_enrich"
  };

  // --- Derive TAG from date string ---
  function deriveTag(dueDateStr) {
    if (!dueDateStr || !String(dueDateStr).trim()) return "";
    var s = String(dueDateStr).trim();
    var d = null;
    var m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    if (!d || isNaN(d.getTime())) {
      var m2 = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (m2) d = new Date(parseInt(m2[1], 10), parseInt(m2[2], 10) - 1, parseInt(m2[3], 10));
    }
    if (!d || isNaN(d.getTime())) return "";
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    var diff = Math.round((d - today) / 86400000);
    if (diff < 0) return "Tail";
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return "Future";
  }

  // --- Derive appointment slot from time ---
  function deriveApptSlot(dateStr) {
    if (!dateStr || !String(dateStr).trim()) return "";
    var m = String(dateStr).trim().match(/(\d{1,2}):(\d{2})/);
    if (!m) return "All Day";
    var hour = parseInt(m[1], 10);
    if (hour < 8) return "All Day";
    if (hour < 13) return "AM";
    return "PM";
  }

  // --- HTML escape ---
  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // --- Canonical key (strip prefix) ---
  function canonicalKey(v) {
    if (!v) return "";
    var s = String(v);
    var last = s.lastIndexOf("-");
    if (last !== -1) s = s.substring(last + 1);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c !== 32 && c !== 95) out += s.charAt(i);
    }
    return out.toUpperCase();
  }

  // --- Resolve Tech PIN to { pin, name, title } ---
  function resolveTech(rawPin) {
    var pin = String(rawPin || "").replace(/[\s\-]/g, "").toUpperCase();
    if (!pin) return { pin: "", name: "", title: "" };
    var name = "";
    var title = "";
    if (typeof _techDB !== "undefined") {
      var r = _techDB.lookup(pin);
      if (r) { name = r.n; title = r.t || ""; }
    }
    return { pin: pin, name: name, title: title };
  }

  return {
    JOBS_PER_TECH: JOBS_PER_TECH,
    MAX_CELL: MAX_CELL,
    SKIP_ROWS: SKIP_ROWS,
    DRILL_PAGE_SIZE: DRILL_PAGE_SIZE,
    EXPORT: EXPORT,
    WS_COPPER: WS_COPPER,
    WS_FIBRE: WS_FIBRE,
    TAGS: TAGS,
    KNOWN_TAGS: KNOWN_TAGS,
    SLOTS: SLOTS,
    normaliseSlot: normaliseSlot,
    RISK: RISK,
    riskLevel: riskLevel,
    STORE: STORE,
    deriveTag: deriveTag,
    deriveApptSlot: deriveApptSlot,
    escapeHtml: escapeHtml,
    canonicalKey: canonicalKey,
    resolveTech: resolveTech
  };
})();
