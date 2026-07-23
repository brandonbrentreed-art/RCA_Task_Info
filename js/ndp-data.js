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
    planRows: [],
    enrichHeaders: [],
    enrichRows: [],
    enrichIdIdx: -1,
    enrichSlaIdx: -1,
    enrichDwellIdx: -1,
    enrichAgeIdx: -1
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
      setTimeout(function () {
        try { sessionStorage.setItem(STORE.TECHS, JSON.stringify({ headers: state.techHeaders, rows: state.techRows })); } catch (e) {}
      }, 0);
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
    // Defer sessionStorage write — JSON serialisation of large datasets is slow
    setTimeout(function () {
      try { sessionStorage.setItem(STORE.TASKFORCE, JSON.stringify({ headers: state.taskforceHeaders, rows: state.taskforceRows })); } catch (e) {}
    }, 0);
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

    // Enrich plan with ageing data from enrichment file
    enrichPlanWithAgeing();

    setTimeout(function () {
      try { sessionStorage.setItem(STORE.PLAN_STATE, JSON.stringify({ headers: outHeaders, rows: outRows })); } catch (e) {}
    }, 0);
    return outRows.length;
  }

  // Backfill AGEING column from enrichment data (matched via Work ID / Service ID)
  function enrichPlanWithAgeing() {
    if (!state.enrichRows.length || state.enrichAgeIdx === -1) return;
    var ageIdx = state.enrichAgeIdx;
    var enrichIdIdx = state.enrichIdIdx;
    var planWorkIdx = state.planHeaders.indexOf("WORK ID");
    var planAgeIdx = state.planHeaders.indexOf("AGEING");
    if (planWorkIdx === -1 || planAgeIdx === -1 || enrichIdIdx === -1) return;

    // Build enrichment ID → ageing lookup
    var idToAge = {};
    state.enrichRows.forEach(function (row) {
      var id = String(row[enrichIdIdx] || "").trim();
      var age = String(row[ageIdx] || "").trim();
      if (id && age) {
        idToAge[id] = age;
        idToAge[id.toUpperCase()] = age;
      }
    });

    // Apply to plan rows
    state.planRows.forEach(function (row) {
      if (row[planAgeIdx]) return; // Already set
      var workId = (row[planWorkIdx] || "").trim();
      if (workId) {
        row[planAgeIdx] = idToAge[workId] || idToAge[workId.toUpperCase()] || "";
      }
    });
  }

  // --- Restore from session ---
  function restore() {
    try {
      var ws = sessionStorage.getItem(STORE.WS_TYPE) || localStorage.getItem(STORE.WS_TYPE);
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
      }

      var enrich = sessionStorage.getItem(STORE.ENRICH);
      if (enrich) {
        var en = JSON.parse(enrich);
        state.enrichHeaders = en.headers;
        state.enrichRows = en.rows;
        // Re-resolve column indices
        for (var ei = 0; ei < state.enrichHeaders.length; ei++) {
          var eh = String(state.enrichHeaders[ei] || "").toLowerCase().trim();
          if (eh === "wm jin" || eh === "unique task id" || eh === "job no" || eh === "jin" || eh === "css jin") state.enrichIdIdx = ei;
          if (state.enrichSlaIdx === -1 && (eh === "sla" || eh.indexOf("sla outcome") !== -1)) state.enrichSlaIdx = ei;
          if (state.enrichDwellIdx === -1 && (eh === "fault dwell" || eh === "fault_dwell" || eh === "dwell")) state.enrichDwellIdx = ei;
          if (state.enrichAgeIdx === -1 && (eh === "ageing" || eh === "aging" || eh === "age" || eh === "order_age_cat" || eh === "crd_tail_age_group")) state.enrichAgeIdx = ei;
        }
      }

      return !!plan;
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
    try {
      sessionStorage.setItem(STORE.WS_TYPE, ws);
      localStorage.setItem(STORE.WS_TYPE, ws);
    } catch (e) {}
  }

  // --- Load enrichment file (workstack-aware) ---
  function loadEnrichment(file, cb) {
    var isExcel = file.name.match(/\.xlsx?$/i);

    if (isExcel && typeof XLSX !== "undefined") {
      var reader = new FileReader();
      reader.onload = function (evt) {
        var data = new Uint8Array(evt.target.result);
        var wb;
        try {
          var _warn = console.warn; console.warn = function () {};
          var _error = console.error; console.error = function () {};
          wb = XLSX.read(data, { type: "array", cellDates: true });
          console.warn = _warn;
          console.error = _error;
        }
        catch (e) { console.warn = _warn; console.error = _error; cb(false, "Failed to parse file"); return; }

        if (state.workstack === "fibre") {
          // Fibre: look for BTTW_Data or KCI2_DATA_NEW sheets
          var bttwSheets = ["BTTW_Data", "KCI2_DATA_NEW", "BTTW", "KCI2"];
          var found = false;
          for (var si = 0; si < bttwSheets.length; si++) {
            var ws = wb.Sheets[bttwSheets[si]];
            if (!ws) continue;
            var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
            if (rows.length >= 2 && rows[0].length > 2) {
              processEnrichRows(rows[0], rows.slice(1), cb);
              found = true;
              break;
            }
          }
          // Fallback: try any sheet with usable headers
          if (!found) {
            for (var fi = 0; fi < wb.SheetNames.length; fi++) {
              var fws = wb.Sheets[wb.SheetNames[fi]];
              var frows = XLSX.utils.sheet_to_json(fws, { header: 1, defval: "", raw: true });
              if (frows.length >= 2 && frows[0].length > 2) {
                processEnrichRows(frows[0], frows.slice(1), cb);
                found = true;
                break;
              }
            }
          }
          if (!found) cb(false, "No BTTW/KCI2 sheet found");
        } else {
          // Copper: find sheet with recognisable headers (TailsReport)
          var found2 = false;
          for (var ci = 0; ci < wb.SheetNames.length; ci++) {
            var cws = wb.Sheets[wb.SheetNames[ci]];
            var crows = XLSX.utils.sheet_to_json(cws, { header: 1, defval: "", raw: false });
            if (crows.length < 2) continue;
            var testHeaders = crows[0].map(function (h) { return String(h || "").toLowerCase().trim(); });
            var hasId = testHeaders.some(function (h) { return h === "wm jin" || h === "serviceid" || h === "unique task id" || h === "job no" || h === "jin"; });
            var hasAge = testHeaders.some(function (h) { return h === "ageing" || h === "aging"; });
            if (hasId || hasAge) {
              processEnrichRows(crows[0], crows.slice(1), cb);
              found2 = true;
              break;
            }
          }
          if (!found2) {
            // Fallback: first sheet with enough columns
            for (var di = 0; di < wb.SheetNames.length; di++) {
              var dws = wb.Sheets[wb.SheetNames[di]];
              var drows = XLSX.utils.sheet_to_json(dws, { header: 1, defval: "", raw: false });
              if (drows.length >= 2 && drows[0].length > 2) {
                processEnrichRows(drows[0], drows.slice(1), cb);
                found2 = true;
                break;
              }
            }
          }
          if (!found2) cb(false, "No usable sheet found");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Parse CSV
      file.text().then(function (text) {
        var rows = parseCsv(text);
        if (rows.length < 2) { cb(false, "File appears empty"); return; }
        processEnrichRows(rows[0], rows.slice(1), cb);
      });
    }
  }

  function processEnrichRows(headers, dataRows, cb) {
    if (state.workstack === "fibre") {
      return processEnrichFibre(headers, dataRows, cb);
    }
    return processEnrichCopper(headers, dataRows, cb);
  }

  // --- Copper: TailsReport (Ageing, SLA, Dwell) ---
  function processEnrichCopper(headers, dataRows, cb) {
    // Find ID column — check in priority order (JIN > task ID > service ID)
    var idIdx = -1;
    var idPatterns = ["serviceid", "service id", "wm jin", "css jin", "unique task id", "job no", "job_no", "jin", "task_id", "task id"];
    var headersLower = headers.map(function (h) { return String(h || "").toLowerCase().trim(); });
    for (var pi = 0; pi < idPatterns.length; pi++) {
      var found = headersLower.indexOf(idPatterns[pi]);
      if (found !== -1) { idIdx = found; break; }
    }

    // Find SLA, Fault Dwell, and Ageing columns
    var slaIdx = -1, dwellIdx = -1, ageIdx = -1;
    for (var j = 0; j < headers.length; j++) {
      var hdr = String(headers[j] || "").toLowerCase().trim();
      if (slaIdx === -1 && (hdr === "sla" || hdr.indexOf("sla outcome") !== -1)) slaIdx = j;
      if (dwellIdx === -1 && (hdr === "fault dwell" || hdr === "fault_dwell" || hdr === "dwell")) dwellIdx = j;
      if (ageIdx === -1 && (hdr === "ageing" || hdr === "aging" || hdr === "age" || hdr === "order_age_cat" || hdr === "crd_tail_age_group")) ageIdx = j;
    }

    state.enrichHeaders = headers;
    state.enrichRows = dataRows;
    state.enrichIdIdx = idIdx;
    state.enrichSlaIdx = slaIdx;
    state.enrichDwellIdx = dwellIdx;
    state.enrichAgeIdx = ageIdx;

    try { sessionStorage.setItem(STORE.ENRICH, JSON.stringify({ headers: headers, rows: dataRows })); } catch (e) {}
    cb(true, dataRows.length + " records loaded (ID col: " + (idIdx !== -1 ? headers[idIdx] : "not found") + ")");
  }

  // --- Fibre: BTTW/KCI2 (commitType + ORDER_AGE enrichment) ---
  function processEnrichFibre(headers, dataRows, cb) {
    var headersLower = headers.map(function (h) { return String(h || "").toLowerCase().trim(); });

    var jobIdx = headersLower.indexOf("jin");
    if (jobIdx === -1) jobIdx = headersLower.indexOf("job_no");
    var ctIdx = headersLower.indexOf("resource_type");
    if (ctIdx === -1) ctIdx = headersLower.indexOf("owner");
    var ageIdx = headersLower.indexOf("order_age");
    if (ageIdx === -1) ageIdx = headersLower.indexOf("priority");
    var ageCatIdx = headersLower.indexOf("order_age_cat");

    if (jobIdx === -1) { cb(false, "No JIN/job_no column found"); return; }

    // Build lookup using Object.create(null) for fast key access
    var lookup = Object.create(null);
    for (var i = 0; i < dataRows.length; i++) {
      var row = dataRows[i];
      var jobNo = String(row[jobIdx] || "").trim();
      if (!jobNo) continue;
      var key = NDP.canonicalKey(jobNo);
      if (!key) continue;
      lookup[key] = {
        commitType: ctIdx !== -1 ? String(row[ctIdx] || "").trim() : "",
        age: ageIdx !== -1 ? String(row[ageIdx] || "").trim() : "",
        ageCat: ageCatIdx !== -1 ? String(row[ageCatIdx] || "").trim() : ""
      };
    }

    // Enrich taskforce rows
    var tfHeaders = state.taskforceHeaders;
    var tfRows = state.taskforceRows;
    var tfIdIdx = tfHeaders.indexOf("Unique Task ID");
    if (tfIdIdx === -1) tfIdIdx = tfHeaders.indexOf("JOB NO");
    var tagIdx = tfHeaders.indexOf("TAG");
    if (tagIdx === -1) { tfHeaders.push("TAG"); tagIdx = tfHeaders.length - 1; }

    var colCount = tfHeaders.length;
    var matched = 0;
    for (var j = 0; j < tfRows.length; j++) {
      var tfRow = tfRows[j];
      if (tfRow.length < colCount) tfRow.length = colCount;
      if (tfIdIdx === -1) continue;
      var id = NDP.canonicalKey(tfRow[tfIdIdx] || "");
      if (!id) continue;
      var match = lookup[id];
      if (!match) continue;
      if (match.commitType) tfRow[tagIdx] = match.commitType;
      matched++;
    }

    // Store only the columns we need for ageing backfill (not the full dataset)
    state.enrichHeaders = headers;
    state.enrichRows = dataRows;
    state.enrichIdIdx = jobIdx;
    state.enrichSlaIdx = -1;
    state.enrichDwellIdx = -1;
    state.enrichAgeIdx = ageCatIdx !== -1 ? ageCatIdx : ageIdx;

    try {
      // Store compact enrichment (only id + age columns)
      var compactRows = [];
      var compactAgeIdx = state.enrichAgeIdx;
      if (jobIdx !== -1 && compactAgeIdx !== -1) {
        for (var k = 0; k < dataRows.length; k++) {
          var cr = dataRows[k];
          compactRows.push([cr[jobIdx] || "", cr[compactAgeIdx] || ""]);
        }
        sessionStorage.setItem(STORE.ENRICH, JSON.stringify({ headers: [headers[jobIdx], headers[compactAgeIdx]], rows: compactRows, origIdIdx: 0, origAgeIdx: 1 }));
      } else {
        sessionStorage.setItem(STORE.ENRICH, JSON.stringify({ headers: headers, rows: dataRows }));
      }
      sessionStorage.setItem(STORE.TASKFORCE, JSON.stringify({ headers: tfHeaders, rows: tfRows }));
    } catch (e) {}

    cb(true, matched + " of " + dataRows.length + " tasks enriched");
  }

  return {
    state: state,
    parseCsv: parseCsv,
    loadTechSheet: loadTechSheet,
    loadTaskforce: loadTaskforce,
    enrichAndStore: enrichAndStore,
    loadEnrichment: loadEnrichment,
    buildPlan: buildPlan,
    savePlan: function () {
      try { sessionStorage.setItem(STORE.PLAN_STATE, JSON.stringify({ headers: state.planHeaders, rows: state.planRows })); } catch (e) {}
    },
    restore: restore,
    clear: clear,
    setWorkstack: setWorkstack
  };
})();
