"use strict";

// ============================================================
// ndp-app.js — Next Day Plan page controller
// Handles: tab switching, loader dialog, toolbar state
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  // --- Tab switching ---
  var tabs = document.querySelectorAll(".tabs__tab");
  var panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var target = tab.getAttribute("data-tab");
      tabs.forEach(function (t) {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      panels.forEach(function (p) {
        p.classList.toggle("is-active", p.id === "panel-" + target);
      });
      // Re-render tabs from live plan data on switch
      if (target === "risk" && NdpData.state.planRows.length) {
        NdpRisk.init();
      }
      if (target === "demand" && NdpData.state.taskforceRows.length) {
        NdpDemand.init();
      }
    });
  });

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
    state.enrich = true;
    markStep("ndpStepEnrich", true);
    checkReady();
    // TODO: Phase 2+ — BTTW/Autofix enrichment parsing
  });

  // --- Load Plan action ---
  loaderGo.addEventListener("click", function () {
    if (loaderGo.disabled) return;
    var count = NdpData.buildPlan();
    closeModal("ndpLoaderModal");
    activateToolbar();

    // If de-risk gate filtered everything out, load ALL tasks as the plan instead
    if (count === 0 && NdpData.state.taskforceRows.length > 0) {
      buildUnfilteredPlan();
    }

    initTabs();
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

  // --- Export button ---
  exportBtn.addEventListener("click", function () {
    if (exportBtn.disabled) return;
    exportToExcel();
  });

  function exportToExcel() {
    if (typeof XLSX === "undefined") return;
    var headers = NdpData.state.planHeaders;
    var rows = NdpData.state.planRows;
    if (!headers.length || !rows.length) return;

    var wb = XLSX.utils.book_new();
    var border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    var hdrS = { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: border, fill: { fgColor: { rgb: "142032" } }, font: { bold: true, color: { rgb: "FFFFFF" } } };
    var cellS = { alignment: { horizontal: "center", vertical: "center" }, border: border };

    // Sheet 1: Plan assignments
    var s1 = [headers];
    rows.forEach(function (row) { s1.push(row); });
    var ws1 = XLSX.utils.aoa_to_sheet(s1);
    ws1["!cols"] = headers.map(function (h) { return { wch: Math.max(h.length + 2, 10) }; });
    styleSheet(ws1, hdrS, cellS);
    XLSX.utils.book_append_sheet(wb, ws1, "Plan");

    var d = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, "NDP_Export_" + d + ".xlsx");
  }

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
    hideEmptyStates();
  }

  function deactivateToolbar() {
    clearBtn.disabled = true;
    clearBtn.style.opacity = "0.38";
    exportBtn.disabled = true;
    exportBtn.style.opacity = "0.38";
  }

  function hideEmptyStates() {
    document.querySelectorAll(".ndp-empty").forEach(function (el) {
      el.style.display = "none";
    });
  }

  function showEmptyStates() {
    document.querySelectorAll(".ndp-empty").forEach(function (el) {
      el.style.display = "";
    });
  }

  // --- Restore session (if data already loaded) ---
  if (NdpData.restore()) {
    activateToolbar();
    hideEmptyStates();
    initTabs();
  }

  // --- Init all tab renderers ---
  function initTabs() {
    hideEmptyStates();
    NdpPlan.init();
    NdpDemand.init();
    NdpRisk.init();
  }
});
