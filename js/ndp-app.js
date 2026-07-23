"use strict";

// ============================================================
// ndp-app.js — Next Day Plan page controller
// Handles: tab switching, loader dialog, toolbar state
// ============================================================

// Safe DOM-based loader overlay (avoids insertAdjacentHTML with strings)
function createLoaderOverlay(text) {
  var overlay = document.createElement("div");
  overlay.className = "loader-overlay";
  var spinner = document.createElement("div");
  spinner.className = "loader-spinner";
  var span = document.createElement("span");
  span.className = "loader-text";
  span.textContent = text || "Loading...";
  overlay.appendChild(spinner);
  overlay.appendChild(span);
  return overlay;
}

document.addEventListener("DOMContentLoaded", function () {
  // --- Tab switching ---
  var tabs = document.querySelectorAll(".tabs__tab");
  var panels = document.querySelectorAll(".tab-panel");
  var ACTIVE_TAB_KEY = "ndp_active_tab";

  function switchTab(target) {
    tabs.forEach(function (t) {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    panels.forEach(function (p) {
      p.classList.toggle("is-active", p.id === "panel-" + target);
    });
    var activeTab = document.querySelector('.tabs__tab[data-tab="' + target + '"]');
    if (activeTab) {
      activeTab.classList.add("is-active");
      activeTab.setAttribute("aria-selected", "true");
    }
    try { sessionStorage.setItem(ACTIVE_TAB_KEY, target); } catch (e) {}
    if (target === "risk" && NdpData.state.planRows.length) NdpRisk.init();
    if (target === "demand" && NdpData.state.taskforceRows.length) NdpDemand.init();
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      switchTab(tab.getAttribute("data-tab"));
    });
  });

  // Restore last active tab
  var savedTab = sessionStorage.getItem(ACTIVE_TAB_KEY);
  if (savedTab && document.querySelector('.tabs__tab[data-tab="' + savedTab + '"]')) {
    switchTab(savedTab);
  }

  // --- Central search (shared component) ---
  initSearch({
    onInput: function (query) {
      var q = query.toUpperCase();
      NdpPlan.setSearch(q);
      NdpDemand.setSearch(q);
      NdpRisk.setSearch(q);
    }
  });

  // --- Loader dialog ---
  var loadBtn = document.getElementById("ndpLoadBtn");
  var clearBtn = document.getElementById("ndpClearBtn");
  var exportBtn = document.getElementById("ndpExportBtn");
  var searchToggle = document.getElementById("ndpSearchToggle");
  var loaderCancel = document.getElementById("ndpLoaderCancel");
  var loaderGo = document.getElementById("ndpLoaderGo");

  loadBtn.addEventListener("click", function () {
    openModal("ndpLoaderModal");
    // Reset paste area state when reopening
    if (pasteArea && !state.taskforce) {
      pasteArea.value = "";
      pasteArea.style.color = "";
    }
  });

  loaderCancel.addEventListener("click", function () {
    closeModal("ndpLoaderModal");
  });

  // --- Workstack toggle ---
  var wsBtns = document.querySelectorAll(".ndp-ws-toggle__btn");
  var currentWs = "copper";

  wsBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var newWs = btn.getAttribute("data-ws");
      if (newWs === currentWs) return;
      wsBtns.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      currentWs = newWs;
      NdpData.setWorkstack(currentWs);
      updateEnrichLabel();

      // Clear all loaded data — workstack change invalidates everything
      NdpData.clear();
      state.techs = false;
      state.taskforce = false;
      state.enrich = false;
      markStep("ndpStepTechs", false);
      markStep("ndpStepTaskforce", false);
      markStep("ndpStepEnrich", false);
      techFile.value = "";
      enrichFile.value = "";
      pasteArea.value = "";
      pasteArea.style.color = "";
      checkReady();
    });
  });

  function updateEnrichLabel() {
    var desc = document.getElementById("ndpEnrichDesc");
    desc.textContent = currentWs === "fibre"
      ? "Upload BTTW report (.xlsx)"
      : "Upload Autofix report (.csv)";
  }

  // --- Step completion tracking ---
  var state = {
    ws: "copper",
    techs: false,
    taskforce: false,
    enrich: false
  };

  function markStep(stepId, done) {
    var el = document.getElementById(stepId);
    if (el) el.classList.toggle("is-done", done);
  }

  function checkReady() {
    state.ws = currentWs;
    var ready = state.techs && state.taskforce;
    loaderGo.disabled = !ready;
    loaderGo.style.opacity = ready ? "1" : "0.38";
  }

  // --- Tech sheet upload ---
  var techFile = document.getElementById("ndpTechFile");
  techFile.addEventListener("change", function (e) {
    if (!e.target.files.length) return;
    NdpData.loadTechSheet(e.target.files[0], function (ok) {
      if (ok) {
        state.techs = true;
        markStep("ndpStepTechs", true);
        checkReady();
      }
    });
  });

  // --- Taskforce paste (via paste event — uses TF_PARSER exactly like WMS project) ---
  var pasteArea = document.getElementById("ndpPasteArea");
  pasteArea.addEventListener("paste", function (e) {
    e.preventDefault();

    var result = TF_PARSER.parseFromPaste(e);

    if (result && result.headers && result.rows.length) {
      NdpData.state.taskforceHeaders = result.headers;
      NdpData.state.taskforceRows = result.rows;
      if (typeof COL_MAP !== "undefined") COL_MAP.resolvePositional(NdpData.state.taskforceHeaders);
      NdpData.enrichAndStore();
      state.taskforce = true;
      markStep("ndpStepTaskforce", true);
      pasteArea.value = result.rows.length + " tasks loaded \u2714";
      pasteArea.style.color = "var(--color-green)";
      checkReady();
    } else {
      pasteArea.value = "No Taskforce data found — copy from Taskforce and try again";
      pasteArea.style.color = "var(--color-error)";
    }
  });

  // --- Enrichment upload ---
  var enrichFile = document.getElementById("ndpEnrichFile");
  enrichFile.addEventListener("change", function (e) {
    if (!e.target.files.length) return;
    NdpData.loadEnrichment(e.target.files[0], function (ok) {
      if (ok) {
        state.enrich = true;
        markStep("ndpStepEnrich", true);
        checkReady();
      }
    });
  });

  // --- Load Plan action ---
  loaderGo.addEventListener("click", function () {
    if (loaderGo.disabled) return;

    // Show loading spinner
    hideEmptyStates();
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      if (!p.querySelector(".loader-overlay")) {
        p.insertBefore(createLoaderOverlay("Building plan..."), p.firstChild);
      }
    });
    closeModal("ndpLoaderModal");

    // Process async to allow spinner to render
    setTimeout(function () {
      var count = NdpData.buildPlan();
      if (count === 0 && NdpData.state.taskforceRows.length > 0) {
        buildUnfilteredPlan();
      }
      // Remove spinners
      document.querySelectorAll(".tab-panel .loader-overlay").forEach(function (el) { el.remove(); });
      activateToolbar();
      initTabs();
    }, 50);
  });

  // Fallback: build plan from all taskforce rows without de-risk gating
  function buildUnfilteredPlan() {
    var tfHeaders = NdpData.state.taskforceHeaders;
    var tfRows = NdpData.state.taskforceRows;
    var outHeaders = DERISK_COLUMNS.map(function (c) { return c.name; });
    var outRows = [];

    tfRows.forEach(function (row) {
      var mapped = mapTaskforceRowToDerisk(row, tfHeaders, outHeaders);
      if (!mapped) return;
      var srcIdx = outHeaders.indexOf("SOURCE");
      if (srcIdx !== -1 && !mapped[srcIdx]) mapped[srcIdx] = "All";
      outRows.push(mapped);
    });

    // If mapping produced nothing, create a simple pass-through using raw taskforce data
    if (!outRows.length && tfRows.length) {
      outHeaders = tfHeaders.slice();
      outRows = tfRows.map(function (row) { return row.slice(); });
    }

    NdpData.state.planHeaders = outHeaders;
    NdpData.state.planRows = outRows;
    NdpData.savePlan();
  }

  // --- Clear all ---
  clearBtn.addEventListener("click", function () {
    state.techs = false;
    state.taskforce = false;
    state.enrich = false;
    markStep("ndpStepTechs", false);
    markStep("ndpStepTaskforce", false);
    markStep("ndpStepEnrich", false);
    checkReady();
    NdpData.clear();
    deactivateToolbar();

    // Reset file inputs so they fire change again on re-select
    techFile.value = "";
    enrichFile.value = "";

    // Reset paste area
    pasteArea.value = "";
    pasteArea.style.color = "";

    // Reset tab panels to empty state
    ["panel-plan", "panel-demand", "panel-risk"].forEach(function (id) {
      var p = document.getElementById(id);
      if (!p) return;
      var empty = p.querySelector(".ndp-empty");
      // Remove everything except the empty state
      Array.from(p.children).forEach(function (child) {
        if (!child.classList.contains("ndp-empty")) child.remove();
      });
      if (empty) empty.style.display = "";
    });
  });

  // --- Export button (page-aware — exports active tab's table) ---
  exportBtn.addEventListener("click", function () {
    if (exportBtn.disabled) return;
    if (typeof XLSX === "undefined") return;

    var activeTab = document.querySelector(".tabs__tab.is-active");
    var target = activeTab ? activeTab.getAttribute("data-tab") : "plan";

    var wb = XLSX.utils.book_new();
    var headers, rows, sheetName;

    if (target === "plan") {
      headers = NdpData.state.planHeaders;
      rows = NdpData.state.planRows;
      sheetName = "Plan";
    } else if (target === "demand") {
      headers = NdpData.state.taskforceHeaders;
      rows = NdpData.state.taskforceRows;
      sheetName = "Demand";
    } else if (target === "risk") {
      // Multi-sheet risk export (matches WMS pattern)
      var riskHeaders = NdpData.state.planHeaders;
      var riskRows = NdpData.state.planRows;
      if (!riskHeaders || !riskRows || !riskRows.length) return;

      var border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      var hdrS = { font: { bold: true, color: { rgb: NDP.EXPORT.textRgb } }, alignment: { horizontal: "center", vertical: "center" }, border: border, fill: { fgColor: { rgb: NDP.EXPORT.headerRgb } } };
      var cellS = { alignment: { horizontal: "center", vertical: "center" }, border: border };

      // Sheet 1: Assignments (Task ID + Tech Pin)
      var jobIdx = riskHeaders.indexOf("JOB NO");
      var pinIdx = riskHeaders.indexOf("TECH PIN");
      var s1 = [["Task ID", "Tech Pin"]];
      riskRows.forEach(function (row) {
        s1.push([
          jobIdx !== -1 ? (row[jobIdx] || "") : "",
          pinIdx !== -1 ? (row[pinIdx] || "") : ""
        ]);
      });
      var ws1 = XLSX.utils.aoa_to_sheet(s1);
      ws1["!cols"] = [{ wch: 16 }, { wch: 12 }];
      styleSheet(ws1, hdrS, cellS);
      XLSX.utils.book_append_sheet(wb, ws1, "Assignments");

      // Sheet 2: Risk Summary (scored table)
      var RISK_COLS = ["Risk", "Task ID", "OUC", "PWA", "De-Risk", "Tech", "Name", "Response Code", "Alts"];
      var RISK_KEYS = ["_RISK", "JOB NO", "OUC", "PWA ID", "DERISK REASON", "TECH PIN", "TECH NAME", "CARE LEVEL", "_ALTS"];
      var oucI = riskHeaders.indexOf("OUC");
      var pinI = riskHeaders.indexOf("TECH PIN");
      var skillI = riskHeaders.indexOf("DERISK REASON");
      var oucSkill = {};
      riskRows.forEach(function (row) {
        var o = oucI !== -1 ? (row[oucI] || "").trim() : "";
        var p = pinI !== -1 ? (row[pinI] || "").trim() : "";
        var sk = skillI !== -1 ? (row[skillI] || "").trim() : "";
        if (!o || !p || !sk) return;
        if (!oucSkill[o]) oucSkill[o] = {};
        if (!oucSkill[o][sk]) oucSkill[o][sk] = {};
        oucSkill[o][sk][p] = true;
      });
      var s2 = [RISK_COLS];
      riskRows.forEach(function (row) {
        var o = oucI !== -1 ? (row[oucI] || "").trim() : "";
        var sk = skillI !== -1 ? (row[skillI] || "").trim() : "";
        var alts = (o && sk && oucSkill[o] && oucSkill[o][sk]) ? Object.keys(oucSkill[o][sk]).length : 0;
        var r = RISK_KEYS.map(function (key) {
          if (key === "_RISK") return NDP.riskLevel(alts);
          if (key === "_ALTS") return alts;
          var ci = riskHeaders.indexOf(key);
          return ci !== -1 ? (row[ci] || "") : "";
        });
        s2.push(r);
      });
      var ws2 = XLSX.utils.aoa_to_sheet(s2);
      ws2["!cols"] = RISK_COLS.map(function (h) { return { wch: Math.max(h.length + 3, 10) }; });
      styleSheet(ws2, hdrS, cellS);
      XLSX.utils.book_append_sheet(wb, ws2, "Risk Summary");

      var d = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, "NDP_Risk_" + d + ".xlsx");
      Notify.success("Risk exported", 2000);
      return;
    }

    if (!headers || !rows || !rows.length) return;

    var border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    var hdrS = { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, border: border, fill: { fgColor: { rgb: "142032" } } };
    var cellS = { alignment: { horizontal: "center", vertical: "center" }, border: border };

    var data = [headers];
    rows.forEach(function (row) { data.push(row); });
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = headers.map(function (h) { return { wch: Math.max((h || "").length + 2, 10) }; });
    styleSheet(ws, hdrS, cellS);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    var d = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, "NDP_" + sheetName + "_" + d + ".xlsx");
    Notify.success(sheetName + " exported", 2000);
  });

  function styleSheet(ws, hdrS, cellS) {
    var range = XLSX.utils.decode_range(ws["!ref"]);
    for (var R = range.s.r; R <= range.e.r; R++) {
      for (var C = range.s.c; C <= range.e.c; C++) {
        var a = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[a]) ws[a].s = R === 0 ? hdrS : cellS;
      }
    }
  }
  function activateToolbar() {
    clearBtn.disabled = false;
    clearBtn.style.opacity = "1";
    exportBtn.disabled = false;
    exportBtn.style.opacity = "1";
    searchToggle.disabled = false;
    searchToggle.style.opacity = "1";
    searchToggle.style.pointerEvents = "auto";
    hideEmptyStates();
  }

  function deactivateToolbar() {
    clearBtn.disabled = true;
    clearBtn.style.opacity = "0.38";
    exportBtn.disabled = true;
    exportBtn.style.opacity = "0.38";
    searchToggle.disabled = true;
    searchToggle.style.opacity = "0.38";
    searchToggle.style.pointerEvents = "none";
  }

  function hideEmptyStates() {
    document.querySelectorAll(".ndp-empty").forEach(function (el) {
      el.style.display = "none";
    });
  }

  // --- Restore session (if data already loaded) ---
  // Always sync workstack toggle from persisted preference
  var savedWs = localStorage.getItem(NDP.STORE.WS_TYPE);
  if (savedWs && savedWs !== currentWs) {
    currentWs = savedWs;
    NdpData.setWorkstack(currentWs);
    wsBtns.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-ws") === currentWs);
    });
    updateEnrichLabel();
  }

  if (NdpData.restore()) {
    // Sync workstack toggle to restored state
    currentWs = NdpData.state.workstack;
    wsBtns.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-ws") === currentWs);
    });
    updateEnrichLabel();

    hideEmptyStates();
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      p.insertBefore(createLoaderOverlay("Loading..."), p.firstChild);
    });
    setTimeout(function () {
      document.querySelectorAll(".tab-panel .loader-overlay").forEach(function (el) { el.remove(); });
      activateToolbar();
      initTabs();
    }, 600);
  }

  // --- Init all tab renderers ---
  function initTabs() {
    hideEmptyStates();
    NdpPlan.init();
    NdpDemand.init();
    NdpRisk.init();
  }
});
