"use strict";

// ============================================================
// ndp-data.js — NDP data loading & parsing layer
// Handles: tech sheet CSV, Taskforce clipboard, enrichment,
// OUC/PWA resolution, and sessionStorage persistence.
// Loaded after constants.js, column-map.js, derisk-filters.js, directory-map.js
// ============================================================

var NdpData = (function () {
  var STORE = NDP.STORE;

  // --- Public state ---
  var state = {
    workstack: "copper",
    techHeaders: [],
    techRows: [],
    taskforceHeaders: [],
    taskforceRows: [],
    planHeaders: [],
    planRows: []
  };

  // --- Parse CSV text (auto-detect delimiter) ---
  function parseCsv(text) {
    var lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var delim = ",";
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim()) {
        if (lines[i].indexOf("\t") !== -1) delim = "\t";
        break;
      }
    }
    var rows = [];
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j].trim();
      if (!line) continue;
      rows.push(line.split(delim).map(function (c) { return c.replace(/^"|"$/g, "").trim(); }));
    }
    return rows;
  }

  // --- Load tech sheet from CSV file ---
  function loadTechSheet(file, cb) {
    file.text().then(function (text) {
      var rows = parseCsv(text);
      if (rows.length < 2) { cb(false, "File appears empty"); return; }
      state.techHeaders = rows[0];
      state.techRows = rows.slice(1);
      try { sessionStorage.setItem(STORE.TECHS, JSON.stringify({ headers: state.techHeaders, rows: state.techRows })); } catch (e) {}
      cb(true, state.techRows.length + " techs loaded");
    });
  }

  // --- Parse Taskforce from clipboard text ---
  function loadTaskforce(text, cb) {
    if (!text || text.trim().length < 50) { cb(false, "Clipboard too short"); return; }

    // Use TF_PARSER (same logic as WMS project)
    var result = TF_PARSER.parseText(text);
    if (!result) { cb(false, "No Taskforce headers found"); return; }

    state.taskforceHeaders = result.headers;
    state.taskforceRows = result.rows;

    // Resolve positional columns
    if (typeof COL_MAP !== "undefined") {
      COL_MAP.resolvePositional(state.taskforceHeaders);
    }

    // Enrich and store
    enrichAndStore();
    cb(true, state.taskforceRows.length + " tasks loaded");
  }

  // Enrich taskforce rows and persist to session
  function enrichAndStore() {
    enrichTaskforce();
    try { sessionStorage.setItem(STORE.TASKFORCE, JSON.stringify({ headers: state.taskforceHeaders, rows: state.taskforceRows })); } catch (e) {}
  }

  // --- Enrich taskforce rows with OUC/PWA from directory map ---
  function enrichTaskforce() {
    var headers = state.taskforceHeaders;
    var rows = state.taskforceRows;
    var ws = state.workstack;

    // Ensure enrichment columns exist
    function ensureCol(name) {
      var idx = headers.indexOf(name);
      if (idx === -1) { headers.push(name); idx = headers.length - 1; }
      return idx;
    }

    var oucIdx = ensureCol("OUC");
    var pwaIdx = ensureCol("PWA");
    var tagIdx = ensureCol("TAG");
    var slotIdx = ensureCol("Appt Slot");

    var gcIdx = headers.indexOf("Group Code");
    if (gcIdx === -1 && typeof COL_MAP !== "undefined") gcIdx = COL_MAP.findSourceIdx(headers, "Group Code");

    var startByIdx = headers.indexOf("Start by");
    if (startByIdx === -1 && typeof COL_MAP !== "undefined") startByIdx = COL_MAP.findSourceIdx(headers, "Start by");
    var apptDateIdx = headers.indexOf("Task appointment window start date");
    if (apptDateIdx === -1) {
      for (var ai = 0; ai < headers.length; ai++) {
        if (headers[ai].toLowerCase().indexOf("appointment window start") !== -1) { apptDateIdx = ai; break; }
      }
    }

    rows.forEach(function (row) {
      while (row.length < headers.length) row.push("");

      // OUC/PWA from directory map
      if (gcIdx !== -1 && typeof _dm !== "undefined" && !row[oucIdx]) {
        var gc = (row[gcIdx] || "").trim().toUpperCase();
        if (gc) {
          var info = _dm.lookup(ws, gc);
          if (info) {
            row[oucIdx] = info.ouc;
            row[pwaIdx] = info.pwa;
          }
        }
      }

      // TAG from date
      if (!row[tagIdx]) {
        var dateVal = startByIdx !== -1 ? row[startByIdx] : "";
        if (dateVal) row[tagIdx] = NDP.deriveTag(dateVal);
      }

      // Appt Slot
      if (!row[slotIdx] && apptDateIdx !== -1 && row[apptDateIdx]) {
        row[slotIdx] = NDP.deriveApptSlot(row[apptDateIdx]);
      }
    });
  }

  // --- Build plan from Taskforce using de-risk gate ---
  function buildPlan() {
    var tfHeaders = state.taskforceHeaders;
    var tfRows = state.taskforceRows;
    var outHeaders = DERISK_COLUMNS.map(function (c) { return c.name; });
    var outRows = [];

    // Build lookup keyed by canonical task ID
    var idIdx = tfHeaders.indexOf("Unique Task ID");
    if (idIdx === -1 && typeof COL_MAP !== "undefined") idIdx = COL_MAP.findSourceIdx(tfHeaders, "Unique Task ID");

    tfRows.forEach(function (row) {
      var mapped = mapTaskforceRowToDerisk(row, tfHeaders, outHeaders);
      if (!mapped) return;
      if (!deriskGateRow(mapped, outHeaders)) return;

      // Set DERISK REASON
      var drIdx = outHeaders.indexOf("DERISK REASON");
      var psIdx = outHeaders.indexOf("PRIMARY SKILL");
      var capIdx = outHeaders.indexOf("CAPABILITIES");
      if (drIdx !== -1) {
        mapped[drIdx] = deriskGetMatchedSkill(
          psIdx !== -1 ? mapped[psIdx] : "",
          capIdx !== -1 ? mapped[capIdx] : ""
        );
      }

      // Set SOURCE
      var srcIdx = outHeaders.indexOf("SOURCE");
      if (srcIdx !== -1 && !mapped[srcIdx]) mapped[srcIdx] = "De-Risk";

      outRows.push(mapped);
    });

    state.planHeaders = outHeaders;
    state.planRows = outRows;

    try { sessionStorage.setItem(STORE.PLAN_STATE, JSON.stringify({ headers: outHeaders, rows: outRows })); } catch (e) {}
    return outRows.length;
  }

  // --- Restore from session ---
  function restore() {
    try {
      var ws = sessionStorage.getItem(STORE.WS_TYPE);
      if (ws) state.workstack = ws;

      var techs = sessionStorage.getItem(STORE.TECHS);
      if (techs) {
        var t = JSON.parse(techs);
        state.techHeaders = t.headers;
        state.techRows = t.rows;
      }

      var tf = sessionStorage.getItem(STORE.TASKFORCE);
      if (tf) {
        var d = JSON.parse(tf);
        state.taskforceHeaders = d.headers;
        state.taskforceRows = d.rows;
      }

      var plan = sessionStorage.getItem(STORE.PLAN_STATE);
      if (plan) {
        var p = JSON.parse(plan);
        state.planHeaders = p.headers;
        state.planRows = p.rows;
        return true;
      }
    } catch (e) {}
    return false;
  }

  // --- Clear all ---
  function clear() {
    state.techHeaders = [];
    state.techRows = [];
    state.taskforceHeaders = [];
    state.taskforceRows = [];
    state.planHeaders = [];
    state.planRows = [];
    try {
      sessionStorage.removeItem(STORE.TECHS);
      sessionStorage.removeItem(STORE.TASKFORCE);
      sessionStorage.removeItem(STORE.ENRICH);
      sessionStorage.removeItem(STORE.PLAN_STATE);
      sessionStorage.removeItem(STORE.WS_TYPE);
    } catch (e) {}
  }

  // --- Set workstack ---
  function setWorkstack(ws) {
    state.workstack = ws;
    try { sessionStorage.setItem(STORE.WS_TYPE, ws); } catch (e) {}
  }

  return {
    state: state,
    parseCsv: parseCsv,
    loadTechSheet: loadTechSheet,
    loadTaskforce: loadTaskforce,
    enrichAndStore: enrichAndStore,
    buildPlan: buildPlan,
    savePlan: function () {
      try { sessionStorage.setItem(STORE.PLAN_STATE, JSON.stringify({ headers: state.planHeaders, rows: state.planRows })); } catch (e) {}
    },
    restore: restore,
    clear: clear,
    setWorkstack: setWorkstack
  };
})();
