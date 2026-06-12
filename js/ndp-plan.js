"use strict";

// ============================================================
// ndp-plan.js — Plan tab (Builder)
// Renders de-risked tasks table with sort, pagination, filters,
// TECH PIN inline edit, add/delete rows.
// ============================================================

var NdpPlan = (function () {
  var panel = null;
  var st = {
    headers: [],
    rows: [],
    sortCol: -1,
    sortAsc: true,
    page: 0,
    pageSize: 30,
    search: ""
  };

  var PAGE_SIZES = [30, 50, 100];
  var FILTER_COLS = ["OUC", "COMMIT TYPE", "CARE LEVEL", "AGEING", "TASK TYPE"];
  var SEARCH_COLS = []; // empty = search all columns
  var filterSelections = {}; // colName -> [selected values]

  // Column display config
  var COL_CONFIG = {
    "JOB NO": { label: "Task ID", align: "left", bold: true },
    "COMMIT DATE": { label: "Commit", align: "center" },
    "COMMIT TYPE": { label: "Commit Type", align: "center", pill: true },
    "SOURCE": { label: "Source", align: "center", pill: true },
    "DERISK REASON": { label: "De-Risk", align: "left" },
    "APPT SLOT": { label: "Appt", align: "center" },
    "TECH PIN": { label: "Tech", align: "center", bold: true, editable: true },
    "TECH NAME": { label: "Name", align: "left" },
    "PRIMARY SKILL": { label: "Skill", align: "center" },
    "CAPABILITIES": { label: "Skills", align: "center" },
    "CARE LEVEL": { label: "Response Code", align: "center" },
    "TASK TYPE": { label: "Task Type", align: "center" },
    "EXCHANGE NAME": { label: "Exchange", align: "left" },
    "WORK ID": { label: "Service ID", align: "left" },
    "AGEING": { label: "Ageing", align: "center" },
    "PWA ID": { label: "PWA", align: "left" },
    "OUC": { label: "OUC", align: "left" }
  };

  // Visible columns (ordered) — filtered to only those present in headers
  var VISIBLE_COLS_DEFAULT = [
    "JOB NO", "OUC", "PWA ID", "COMMIT TYPE", "AGEING", "DERISK REASON",
    "APPT SLOT", "TECH PIN", "TECH NAME", "CARE LEVEL", "TASK TYPE", "EXCHANGE NAME"
  ];

  function getVisibleCols() {
    var matched = VISIBLE_COLS_DEFAULT.filter(function (col) {
      return st.headers.indexOf(col) !== -1;
    });
    // If none of our preferred cols match, show first 10 headers
    if (matched.length < 3) {
      return st.headers.slice(0, Math.min(st.headers.length, 10));
    }
    return matched;
  }

  function init() {
    panel = document.getElementById("panel-plan");
    if (!panel) return;

    st.headers = NdpData.state.planHeaders;
    st.rows = NdpData.state.planRows;

    if (!st.rows.length) return;

    // Clean previous render if re-initialising
    var existing = document.getElementById("ndpPlanTable");
    if (existing) existing.remove();
    var existingFilters = document.getElementById("ndpPlanFilters");
    if (existingFilters) existingFilters.remove();

    document.getElementById("ndpEmptyPlan").style.display = "none";
    rowSelect = null; // Disconnect old selection before DOM rebuild
    Object.keys(filterSelections).forEach(function(k) { delete filterSelections[k]; });
    st.sortCol = -1;
    st.page = 0;
    st.search = "";
    buildUI();
    initRowSelect();
    initPinDrag();
    render();
  }

  function buildUI() {
    var html =
      '<div class="ndp-filters" id="ndpPlanFilters">' +
        buildFilterDropdowns() +
        '<div style="margin-left:auto;display:flex;gap:var(--spacing-2);align-items:center">' +
          '<button class="btn-outlined" id="ndpPlanAdd" style="font-size:var(--text-caption);padding:var(--spacing-1) var(--spacing-3);border:1px solid var(--color-grey-300);border-radius:var(--radius)">+ Add</button>' +
          '<button class="btn-outlined" id="ndpPlanSelectAll" style="font-size:var(--text-caption);padding:var(--spacing-1) var(--spacing-3);border:1px solid var(--color-grey-300);border-radius:var(--radius)">Select All</button>' +
          '<button class="btn-outlined" id="ndpPlanDelete" disabled style="font-size:var(--text-caption);padding:var(--spacing-1) var(--spacing-3);border:1px solid var(--color-grey-300);border-radius:var(--radius);opacity:0.38">✕ Delete</button>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrapper--flex" id="ndpPlanTable">' +
        '<div class="table-scroll">' +
          '<table class="table" id="ndpPlanTbl">' +
            '<thead id="ndpPlanThead"></thead>' +
            '<tbody id="ndpPlanTbody"></tbody>' +
          '</table>' +
        '</div>' +
        '<div class="table-pagination" id="ndpPlanPager">' +
          '<span class="table-pagination__selected" id="ndpPlanSelected"></span>' +
          '<span style="flex:1"></span>' +
          '<span class="table-pagination__label">Rows per page:</span>' +
          '<div class="table-pagination__size" id="ndpPlanPageSize">' +
            '<span class="table-pagination__size-value">30</span>' +
            '<button class="table-pagination__size-trigger"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg></button>' +
            '<div class="table-pagination__size-dropdown">' +
              '<div class="table-pagination__size-option is-active" data-value="30">30</div>' +
              '<div class="table-pagination__size-option" data-value="50">50</div>' +
              '<div class="table-pagination__size-option" data-value="100">100</div>' +
            '</div>' +
          '</div>' +
          '<span class="table-pagination__range" id="ndpPlanRange"></span>' +
          '<button id="ndpPlanPrev" disabled><svg viewBox="0 0 24 24" fill="currentColor" style="width:var(--size-icon-sm);height:var(--size-icon-sm)"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>' +
          '<button id="ndpPlanNext" disabled><svg viewBox="0 0 24 24" fill="currentColor" style="width:var(--size-icon-sm);height:var(--size-icon-sm)"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>' +
        '</div>' +
      '</div>';

    panel.insertAdjacentHTML("beforeend", html);
    wireEvents();
  }

  function buildFilterDropdowns() {
    var html = "";
    FILTER_COLS.forEach(function (col) {
      var colIdx = st.headers.indexOf(col);
      if (colIdx === -1) return;
      var vals = {};
      st.rows.forEach(function (row) {
        var v = (row[colIdx] || "").trim();
        if (v) vals[v] = true;
      });
      var options = Object.keys(vals).sort();
      if (!options.length) return;

      filterSelections[col] = [];
      var label = COL_CONFIG[col] ? COL_CONFIG[col].label : col;
      html += '<div class="ndp-filter-wrap" data-col="' + col + '">' +
        '<input class="ndp-filter-input" type="text" placeholder="' + NDP.escapeHtml(label) + '" size="' + Math.max(label.length + 2, 10) + '" autocomplete="off" data-col="' + col + '">' +
        '<button class="ndp-filter-clear"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' +
        '<button class="ndp-filter-chevron"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg></button>' +
        '<div class="ndp-filter-dropdown">' +
          options.map(function (o) {
            return '<div class="ndp-filter-option" data-value="' + NDP.escapeHtml(o) + '">' + NDP.escapeHtml(o) + '</div>';
          }).join('') +
        '</div>' +
      '</div>';
    });
    return html;
  }

  function rebuildFilters() {
    var filtersEl = document.getElementById("ndpPlanFilters");
    if (!filtersEl) return;
    // Remove old filter wraps
    filtersEl.querySelectorAll(".ndp-filter-wrap").forEach(function (el) { el.remove(); });
    // Rebuild
    var addBtn = filtersEl.querySelector("[style*='margin-left']");
    var temp = document.createElement("div");
    temp.innerHTML = buildFilterDropdowns();
    var wraps = Array.from(temp.children);
    wraps.forEach(function (wrap) {
      filtersEl.insertBefore(wrap, addBtn);
    });
    // Re-wire events on new elements
    wireFilterDropdowns();
  }

  function wireFilterDropdowns() {
    // Close any open dropdown on scroll within the panel
    panel.addEventListener("scroll", function () {
      panel.querySelectorAll(".ndp-filter-dropdown.is-open").forEach(function (d) {
        d.classList.remove("is-open");
      });
    }, true);

    panel.querySelectorAll(".ndp-filter-wrap").forEach(function (wrap) {
      var input = wrap.querySelector(".ndp-filter-input");
      var dropdown = wrap.querySelector(".ndp-filter-dropdown");
      var clearBtn = wrap.querySelector(".ndp-filter-clear");
      var chevron = wrap.querySelector(".ndp-filter-chevron");
      var col = wrap.getAttribute("data-col");
      var options = wrap.querySelectorAll(".ndp-filter-option");

      function updateClear() {
        clearBtn.classList.toggle("is-visible", !!input.value);
      }

      // Chevron click opens/focuses
      chevron.addEventListener("mousedown", function (e) {
        e.preventDefault();
        input.focus();
      });

      input.addEventListener("focus", function () {
        dropdown.classList.add("is-open");
        filterOpts("");
      });

      input.addEventListener("input", function () {
        dropdown.classList.add("is-open");
        filterOpts(input.value.trim().toLowerCase());
        updateClear();
      });

      input.addEventListener("blur", function () {
        setTimeout(function () { dropdown.classList.remove("is-open"); }, 150);
      });

      input.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          input.value = "";
          filterSelections[col] = [];
          dropdown.classList.remove("is-open");
          updateClear();
          input.blur();
          st.page = 0;
          render();
        }
      });

      clearBtn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        input.value = "";
        filterSelections[col] = [];
        options.forEach(function (o) { o.classList.remove("is-selected"); });
        updateClear();
        st.page = 0;
        render();
      });

      function filterOpts(q) {
        options.forEach(function (opt) {
          opt.style.display = (!q || opt.textContent.toLowerCase().indexOf(q) !== -1) ? "" : "none";
        });
      }

      options.forEach(function (opt) {
        opt.addEventListener("mousedown", function (e) {
          e.preventDefault();
          var val = opt.getAttribute("data-value");
          if (filterSelections[col].indexOf(val) !== -1) {
            filterSelections[col] = [];
            input.value = "";
            opt.classList.remove("is-selected");
          } else {
            filterSelections[col] = [val];
            input.value = val;
            options.forEach(function (o) { o.classList.remove("is-selected"); });
            opt.classList.add("is-selected");
          }
          dropdown.classList.remove("is-open");
          updateClear();
          st.page = 0;
          render();
        });
      });

      updateClear();
    });
  }

  function wireEvents() {
    // Filter dropdowns (searchable)
    wireFilterDropdowns();

    // Pagination
    document.getElementById("ndpPlanPrev").addEventListener("click", function () {
      if (st.page > 0) { st.page--; render(); }
    });
    document.getElementById("ndpPlanNext").addEventListener("click", function () {
      st.page++;
      render();
    });
    document.getElementById("ndpPlanPageSize").addEventListener("click", function (e) {
      var valueEl = e.currentTarget.querySelector(".table-pagination__size-value");
      var dropdown = e.currentTarget.querySelector(".table-pagination__size-dropdown");
      var opt = e.target.closest(".table-pagination__size-option");
      if (opt) {
        st.pageSize = parseInt(opt.getAttribute("data-value"), 10);
        st.page = 0;
        valueEl.textContent = st.pageSize;
        dropdown.querySelectorAll(".table-pagination__size-option").forEach(function (o) { o.classList.remove("is-active"); });
        opt.classList.add("is-active");
        dropdown.classList.remove("is-open");
        render();
      } else {
        dropdown.classList.toggle("is-open");
      }
    });

    // Delete selected
    document.getElementById("ndpPlanDelete").addEventListener("click", deleteSelected);

    // Delete key shortcut for selected rows
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!rowSelect || !rowSelect.size()) return;
      var tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Don't fire if pin cells are highlighted (that's handled by TableSelect.cells)
      if (panel.querySelector(".ndp-pin-cell.is-dragged")) return;
      e.preventDefault();
      deleteSelected();
    });

    // Select All / Deselect All
    document.getElementById("ndpPlanSelectAll").addEventListener("click", toggleSelectAll);

    // Add from clipboard
    document.getElementById("ndpPlanAdd").addEventListener("click", addFromClipboard);
  }

  // --- Row selection (via shared TableSelect) ---
  var rowSelect = null;
  var lastClickedIdx = null;

  function initRowSelect() {
    if (rowSelect) return;
    rowSelect = TableSelect.rows({
      container: panel,
      getRows: function () {
        var filtered = getFilteredRows();
        var jobIdx = st.headers.indexOf("JOB NO");
        if (jobIdx === -1) jobIdx = 0;
        return filtered.map(function (row, i) {
          return { id: (row[jobIdx] || "").trim(), el: null };
        });
      },
      onSelect: function () { render(); }
    });
  }

  function updateSelectionUI() {
    if (!rowSelect) return;
    var delBtn = document.getElementById("ndpPlanDelete");
    var selBtn = document.getElementById("ndpPlanSelectAll");
    var selectedEl = document.getElementById("ndpPlanSelected");
    var hasSelection = rowSelect.size() > 0;

    delBtn.disabled = !hasSelection;
    delBtn.style.opacity = hasSelection ? "1" : "0.38";

    // Selected count (MUI pattern: "X selected" on footer left)
    if (selectedEl) {
      selectedEl.textContent = hasSelection ? rowSelect.size() + " selected" : "";
    }

    var filtered = getFilteredRows();
    var jobIdx = st.headers.indexOf("JOB NO");
    if (jobIdx === -1) jobIdx = 0;
    var allSelected = filtered.length > 0 && filtered.every(function (row) {
      return rowSelect.has((row[jobIdx] || "").trim());
    });
    selBtn.textContent = allSelected ? "Deselect All" : "Select All";
  }

  function toggleSelectAll() {
    var filtered = getFilteredRows();
    var jobIdx = st.headers.indexOf("JOB NO");
    if (jobIdx === -1) jobIdx = 0;
    var ids = filtered.map(function (row) { return (row[jobIdx] || "").trim(); });
    rowSelect.selectAll(ids);
  }

  function toggleRowSelect(filteredIdx, jobNo, e) {
    rowSelect.toggle(jobNo, filteredIdx, e);
  }


  function deleteSelected() {
    if (!rowSelect || !rowSelect.size()) return;
    var jobIdx = st.headers.indexOf("JOB NO");
    var selected = rowSelect.getSelected();
    st.rows = st.rows.filter(function (row) {
      return !selected.has((row[jobIdx] || "").trim());
    });
    rowSelect.clear();
    st.page = 0;
    savePlan();
    rebuildFilters();
    render();
  }

  function addFromClipboard() {
    // Open a paste modal (same pattern as loader - no permission prompt needed)
    var existing = document.getElementById("ndpAddModal");
    if (existing) existing.remove();

    var html =
      '<div class="modal-backdrop open" id="ndpAddModal">' +
        '<div class="modal modal-sm">' +
          '<div class="modal-header">' +
            '<h3>Add Tasks</h3>' +
            '<button class="modal-close" aria-label="Close">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<p style="font-size:var(--text-body2);color:var(--color-grey);margin-bottom:var(--spacing-3)">Copy tasks from Taskforce, then click below and Ctrl+V to paste.</p>' +
            '<textarea class="ndp-paste-area" id="ndpAddPasteArea" placeholder="Ctrl+V to paste Taskforce rows..."></textarea>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("ndpAddModal");
    var area = document.getElementById("ndpAddPasteArea");

    modal.querySelector(".modal-close").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });

    area.addEventListener("paste", function (e) {
      e.preventDefault();
      var result = TF_PARSER.parseFromPaste(e);
      if (!result || !result.headers || !result.rows.length) {
        area.value = "No Taskforce data found";
        area.style.color = "var(--color-error)";
        return;
      }

      // Run through the same pipeline as initial load:
      // 1. Resolve positional (unnamed) columns
      var srcHeaders = result.headers;
      var srcRows = result.rows;
      if (typeof COL_MAP !== "undefined") COL_MAP.resolvePositional(srcHeaders);

      // 2. Enrich with OUC/PWA/TAG/Slot (same as NdpData.enrichTaskforce)
      var oucIdx = srcHeaders.indexOf("OUC");
      if (oucIdx === -1) { srcHeaders.push("OUC"); oucIdx = srcHeaders.length - 1; }
      var pwaIdx = srcHeaders.indexOf("PWA");
      if (pwaIdx === -1) { srcHeaders.push("PWA"); pwaIdx = srcHeaders.length - 1; }
      var tagIdx = srcHeaders.indexOf("TAG");
      if (tagIdx === -1) { srcHeaders.push("TAG"); tagIdx = srcHeaders.length - 1; }
      var slotIdx = srcHeaders.indexOf("Appt Slot");
      if (slotIdx === -1) { srcHeaders.push("Appt Slot"); slotIdx = srcHeaders.length - 1; }

      var gcIdx = srcHeaders.indexOf("Group Code");
      if (gcIdx === -1 && typeof COL_MAP !== "undefined") gcIdx = COL_MAP.findSourceIdx(srcHeaders, "Group Code");
      var startByIdx = srcHeaders.indexOf("Start by");
      if (startByIdx === -1 && typeof COL_MAP !== "undefined") startByIdx = COL_MAP.findSourceIdx(srcHeaders, "Start by");
      var apptDateIdx = -1;
      for (var ai = 0; ai < srcHeaders.length; ai++) {
        if (srcHeaders[ai].toLowerCase().indexOf("appointment window start") !== -1) { apptDateIdx = ai; break; }
      }

      var ws = NdpData.state.workstack;
      srcRows.forEach(function (row) {
        while (row.length < srcHeaders.length) row.push("");
        if (gcIdx !== -1 && typeof _dm !== "undefined" && !row[oucIdx]) {
          var gc = (row[gcIdx] || "").trim().toUpperCase();
          if (gc) { var info = _dm.lookup(ws, gc); if (info) { row[oucIdx] = info.ouc; row[pwaIdx] = info.pwa; } }
        }
        if (!row[tagIdx] && startByIdx !== -1 && row[startByIdx]) row[tagIdx] = NDP.deriveTag(row[startByIdx]);
        if (!row[slotIdx] && apptDateIdx !== -1 && row[apptDateIdx]) row[slotIdx] = NDP.deriveApptSlot(row[apptDateIdx]);
      });

      // 3. Map to plan columns + deduplicate
      var outHeaders = st.headers;
      var existingJobs = {};
      var jobIdx = outHeaders.indexOf("JOB NO");
      st.rows.forEach(function (row) {
        var id = (row[jobIdx] || "").trim();
        if (id) existingJobs[id] = true;
      });

      var idCol = -1;
      for (var si = 0; si < srcHeaders.length; si++) {
        if (srcHeaders[si].toLowerCase().trim() === "unique task id") { idCol = si; break; }
      }
      if (idCol === -1) {
        area.value = "Unique Task ID column not found";
        area.style.color = "var(--color-error)";
        return;
      }

      var added = 0;
      srcRows.forEach(function (row) {
        var taskId = (row[idCol] || "").trim();
        if (!taskId || taskId.length < 4 || existingJobs[taskId]) return;
        var mapped = mapTaskforceRowToDerisk(row, srcHeaders, outHeaders);
        if (!mapped) return;
        if (jobIdx !== -1) mapped[jobIdx] = taskId;
        var ctIdx = outHeaders.indexOf("COMMIT TYPE");
        if (ctIdx !== -1 && !mapped[ctIdx]) mapped[ctIdx] = "Manual Add";
        var srcColIdx = outHeaders.indexOf("SOURCE");
        if (srcColIdx !== -1) mapped[srcColIdx] = "Manual Add";
        st.rows.push(mapped);
        existingJobs[taskId] = true;
        added++;
      });

      if (added > 0) {
        st.page = 0;
        savePlan();
        rebuildFilters();
        render();
        modal.remove();
      } else {
        area.value = "No new tasks found (may already be in table)";
        area.style.color = "var(--color-warning)";
      }
    });

    area.focus();
  }

  // --- Filtering ---
  function getFilteredRows() {
    var rows = st.rows;

    // Search filter — searches ALL visible columns
    if (st.search) {
      rows = rows.filter(function (row) {
        for (var i = 0; i < st.headers.length; i++) {
          if ((row[i] || "").toUpperCase().indexOf(st.search) !== -1) return true;
        }
        return false;
      });
    }

    // Dropdown filters
    Object.keys(filterSelections).forEach(function (col) {
      var sel = filterSelections[col];
      if (!sel || !sel.length) return;
      var ci = st.headers.indexOf(col);
      if (ci === -1) return;
      rows = rows.filter(function (row) {
        return sel.indexOf((row[ci] || "").trim()) !== -1;
      });
    });

    return rows;
  }

  // --- Sorting ---
  function doSort(colIdx) {
    if (st.sortCol === colIdx) {
      if (st.sortAsc) { st.sortAsc = false; }
      else { st.sortCol = -1; st.page = 0; render(); return; }
    } else {
      st.sortCol = colIdx;
      st.sortAsc = true;
    }
    st.page = 0;
    st.rows.sort(function (a, b) {
      var va = a[colIdx] || "", vb = b[colIdx] || "";
      var na = parseFloat(va), nb = parseFloat(vb);
      var cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : va.localeCompare(vb);
      return st.sortAsc ? cmp : -cmp;
    });
    render();
  }

  // --- Render ---
  function render() {
    var thead = document.getElementById("ndpPlanThead");
    var tbody = document.getElementById("ndpPlanTbody");
    thead.innerHTML = "";
    tbody.innerHTML = "";

    // Header
    var visibleCols = getVisibleCols();
    var hr = document.createElement("tr");
    visibleCols.forEach(function (colName) {
      var ci = st.headers.indexOf(colName);
      var cfg = COL_CONFIG[colName] || {};
      var th = document.createElement("th");
      th.textContent = cfg.label || colName;
      th.style.textAlign = cfg.align || "center";
      th.style.whiteSpace = "nowrap";
      var icon = document.createElement("span");
      icon.className = "table-sort-icon" + (st.sortCol === ci ? " is-active" : "");
      if (st.sortCol === ci) {
        icon.innerHTML = st.sortAsc
          ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8z"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z"/></svg>';
      } else {
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>';
      }
      th.appendChild(icon);
      th.addEventListener("click", function () { if (ci !== -1) doSort(ci); });
      hr.appendChild(th);
    });
    thead.appendChild(hr);

    // Rows
    var filtered = getFilteredRows();
    var totalPages = Math.max(1, Math.ceil(filtered.length / st.pageSize));
    if (st.page >= totalPages) st.page = totalPages - 1;
    if (st.page < 0) st.page = 0;
    var start = st.page * st.pageSize;
    var end = Math.min(start + st.pageSize, filtered.length);
    var pageRows = filtered.slice(start, end);

    var frag = document.createDocumentFragment();
    pageRows.forEach(function (row, ri) {
      var tr = document.createElement("tr");
      var jobIdx = st.headers.indexOf("JOB NO");
      if (jobIdx === -1) jobIdx = 0; // fallback to first col as ID
      var jobNo = jobIdx !== -1 ? (row[jobIdx] || "").trim() : "";
      if (rowSelect && rowSelect.has(jobNo)) tr.style.background = "var(--hover-row)";
      tr.addEventListener("click", function (e) {
        if (e.target.closest(".ndp-pin-cell")) return;
        toggleRowSelect(start + ri, jobNo, e);
      });
      visibleCols.forEach(function (colName) {
        var ci = st.headers.indexOf(colName);
        var cfg = COL_CONFIG[colName] || {};
        var td = document.createElement("td");
        td.style.textAlign = cfg.align || "center";
        var val = ci !== -1 ? (row[ci] || "") : "";

        if (cfg.pill && val) {
          td.textContent = val;
          td.style.color = "var(--color-blue)";
          td.style.fontWeight = "var(--font-weight-medium)";
        } else if (cfg.editable) {
          td.textContent = val || "\u2014";
          td.className = "ndp-pin-cell" + (val ? "" : " ndp-pin-cell--empty");
          td.setAttribute("data-row", start + ri);
        } else {
          td.textContent = val;
        }

        if (cfg.bold) td.style.fontWeight = "var(--font-weight-medium)";
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);

    // Pagination
    document.getElementById("ndpPlanRange").textContent = filtered.length
      ? (start + 1) + "\u2013" + end + " of " + filtered.length
      : "0 of 0";
    document.getElementById("ndpPlanPrev").disabled = st.page === 0;
    document.getElementById("ndpPlanNext").disabled = st.page >= totalPages - 1;
    updateSelectionUI();
  }

  // --- TECH PIN cell selection (via shared TableSelect.cells) ---
  var pinSelect = null;

  function initPinDrag() {
    if (pinSelect) return;
    pinSelect = TableSelect.cells({
      container: panel,
      cellSelector: ".ndp-pin-cell",
      onPaste: function (cells, value) {
        var pin = value.replace(/[\s\-]/g, "").toUpperCase();
        applyPinToCells(cells, pin);
      },
      onDelete: function (cells) {
        applyPinToCells(cells, "");
      }
    });
  }

  function applyPinToCells(cells, pin) {
    var pinIdx = st.headers.indexOf("TECH PIN");
    var nameIdx = st.headers.indexOf("TECH NAME");
    if (pinIdx === -1) return;

    var resolved = NDP.resolveTech(pin);

    cells.forEach(function (td) {
      var rowIdx = parseInt(td.getAttribute("data-row"), 10);
      if (isNaN(rowIdx) || !st.rows[rowIdx]) return;
      st.rows[rowIdx][pinIdx] = resolved.pin;
      if (nameIdx !== -1) st.rows[rowIdx][nameIdx] = resolved.name;
    });

    savePlan();
    render();
  }

  // --- Persist plan changes (via NdpData) ---
  function savePlan() {
    NdpData.state.planHeaders = st.headers;
    NdpData.state.planRows = st.rows;
    NdpData.savePlan();
  }

  // --- Commit pill class resolver ---
  // (handled via CSS classes: ndp-pill--tail, ndp-pill--today, etc.)

  return {
    init: init,
    setSearch: function (query) {
      st.search = query;
      st.page = 0;
      if (st.rows.length) render();
    }
  };
})();
