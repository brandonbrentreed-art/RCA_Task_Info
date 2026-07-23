"use strict";

// ============================================================
// ndp-demand.js — Demand tab (Workstack pivot)
// Pivot table: OUC × PWA × AM/PM/AllDay/Techs/Over-Short
// Stacked bar chart with legend toggles.
// Depends on: ndp-demand-data.js, ndp-demand-ui.js
// ============================================================

var NdpDemand = (function () {
  var panel = null;
  var pwaRows = [];

  function init() {
    panel = document.getElementById("panel-demand");
    if (!panel) return;

    var headers = NdpData.state.taskforceHeaders;
    var rows = NdpData.state.taskforceRows;
    if (!headers.length || !rows.length) return;

    // Clean previous render
    Array.from(panel.children).forEach(function (child) {
      if (!child.classList.contains("ndp-empty")) child.remove();
    });

    document.getElementById("ndpEmptyDemand").style.display = "none";
    buildPivot(headers, rows);
  }

  function buildPivot(headers, rows) {
    var oucIdx = headers.indexOf("OUC");
    var pwaIdx = headers.indexOf("PWA");
    var slotIdx = headers.indexOf("Appt Slot");
    var tagIdx = headers.indexOf("TAG");
    var pinIdx = headers.indexOf("Designated resource ID");
    if (pinIdx === -1) pinIdx = headers.indexOf("TECH PIN");
    var idIdx = headers.indexOf("Unique Task ID");
    if (idIdx === -1) idIdx = headers.indexOf("JOB NO");

    // If we don't have OUC/PWA enrichment, nothing to pivot
    if (oucIdx === -1 && pwaIdx === -1) {
      panel.insertAdjacentHTML("beforeend", '<div class="ndp-empty" style="display:flex"><p>OUC/PWA data not available. Ensure directory map matches your workstack.</p></div>');
      return;
    }

    // Filter out future with appointment
    rows = rows.filter(function (row) {
      var tag = tagIdx !== -1 ? (row[tagIdx] || "").trim() : "";
      var slot = slotIdx !== -1 ? (row[slotIdx] || "").trim() : "";
      if (tag === "Future" && slot) return false;
      return true;
    });

    // Detect extra tags (fibre resource_type values like BTTW, KCI2)
    var KNOWN = ["Tail", "Today", "Tomorrow", "Future", "Manual Add", ""];
    var extraTags = {};
    rows.forEach(function (row) {
      var tag = tagIdx !== -1 ? (row[tagIdx] || "").trim() : "";
      if (tag && KNOWN.indexOf(tag) === -1) extraTags[tag] = true;
    });
    var extraTagList = Object.keys(extraTags).sort();

    // Build PWA pivot
    var pwaMap = {};
    rows.forEach(function (row) {
      var ouc = oucIdx !== -1 ? (row[oucIdx] || "").trim() || "(blank)" : "(blank)";
      var pwa = pwaIdx !== -1 ? (row[pwaIdx] || "").trim() || "(blank)" : "(blank)";
      var key = ouc + "|" + pwa;
      if (!pwaMap[key]) pwaMap[key] = { ouc: ouc, pwa: pwa, am: 0, pm: 0, allDay: 0, total: 0, tail: 0, due: 0, future: 0, extra: {}, rows: [] };
      var p = pwaMap[key];
      p.total++;
      p.rows.push(row);

      var slot = NDP.normaliseSlot(slotIdx !== -1 ? row[slotIdx] : "");
      if (slot === "AM") p.am++;
      else if (slot === "PM") p.pm++;
      else if (slot === "All Day") p.allDay++;

      var tag = tagIdx !== -1 ? (row[tagIdx] || "").trim() : "";
      if (tag === "Tail") p.tail++;
      else if (tag === "Today" || tag === "Tomorrow") p.due++;
      else if (tag === "Future") p.future++;
      else if (tag && extraTags[tag]) {
        p.extra[tag] = (p.extra[tag] || 0) + 1;
      }
    });

    pwaRows = Object.keys(pwaMap).sort().map(function (k) { return pwaMap[k]; });

    // Tech count from tech sheet
    var techsByPwa = {};
    if (NdpData.state.techRows.length) {
      var thIdx = NdpData.state.techHeaders.indexOf("CALENDARIZED PWA");
      if (thIdx === -1) thIdx = NdpData.state.techHeaders.indexOf("IDEPLOY PWA");
      if (thIdx !== -1) {
        NdpData.state.techRows.forEach(function (row) {
          var pwa = (row[thIdx] || "").trim();
          if (pwa) techsByPwa[pwa] = (techsByPwa[pwa] || 0) + 1;
        });
      }
    }

    // Render table + chart
    var html =
      '<div style="display:flex;gap:var(--spacing-4);flex-shrink:0;overflow:auto;padding:var(--spacing-3) 0">' +
        '<div class="ndp-pivot" style="flex:1;min-width:0">' +
          '<div class="table-wrapper">' +
            '<table class="table">' +
              '<thead><tr>' +
                '<th style="text-align:left">OUC</th>' +
                '<th style="text-align:left">PWA</th>' +
                '<th style="text-align:center">AM</th><th style="text-align:center">PM</th><th style="text-align:center">All Day</th>' +
                '<th style="text-align:center">Techs</th><th style="text-align:center">Over/Short</th>' +
              '</tr></thead>' +
              '<tbody>' +
            pwaRows.map(function (p) {
              var techs = techsByPwa[p.pwa] || 0;
              var appts = p.am + p.pm + p.allDay;
              var needed = techs - Math.ceil(appts / NDP.JOBS_PER_TECH);
              var color = needed > 0 ? "var(--color-green)" : needed < 0 ? "var(--color-error)" : "var(--color-grey)";
              var prefix = needed > 0 ? "+" : "";
              var safeKey = NDP.escapeHtml(p.ouc + '|' + p.pwa);
              return '<tr>' +
                '<td style="text-align:left;font-weight:var(--font-weight-medium)">' + NDP.escapeHtml(p.ouc) + '</td>' +
                '<td style="text-align:left">' + NDP.escapeHtml(p.pwa) + '</td>' +
                '<td class="ndp-drill" data-key="' + safeKey + '" data-slot="AM" style="text-align:center;font-weight:500">' + p.am + '</td>' +
                '<td class="ndp-drill" data-key="' + safeKey + '" data-slot="PM" style="text-align:center;font-weight:500">' + p.pm + '</td>' +
                '<td class="ndp-drill" data-key="' + safeKey + '" data-slot="All Day" style="text-align:center;font-weight:500">' + p.allDay + '</td>' +
                '<td style="text-align:center">' + techs + '</td>' +
                '<td style="text-align:center;font-weight:var(--font-weight-medium);color:' + color + '">' + prefix + needed + '</td>' +
              '</tr>';
            }).join("") +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      buildSecondaryTable(pwaRows, techsByPwa, rows, headers, oucIdx, tagIdx, extraTagList) +
    '</div>' +
      '<div class="ndp-demand-chart" id="ndpDemandChart">' +
        buildChart(pwaRows, techsByPwa) +
      '</div>';

    panel.insertAdjacentHTML("beforeend", html);

    // --- Row click → highlight OUC in table + chart ---
    var activeOuc = null;
    var tableBody = panel.querySelector(".ndp-pivot tbody");
    if (tableBody) {
      tableBody.addEventListener("click", function (e) {
        var tr = e.target.closest("tr");
        if (!tr) return;
        // Don't interfere with drilldown cells
        if (e.target.closest(".ndp-drill")) return;

        var cells = tr.querySelectorAll("td");
        var clickedOuc = cells[0] ? cells[0].textContent.trim() : "";
        if (!clickedOuc) return;

        // Toggle: click same OUC again to clear
        if (activeOuc === clickedOuc) {
          activeOuc = null;
        } else {
          activeOuc = clickedOuc;
        }

        // Highlight table rows
        tableBody.querySelectorAll("tr").forEach(function (row) {
          var rowOuc = row.querySelector("td") ? row.querySelector("td").textContent.trim() : "";
          if (!activeOuc) {
            row.style.opacity = "";
          } else {
            row.style.opacity = rowOuc === activeOuc ? "1" : "0.3";
          }
        });

        // Highlight chart columns
        var bars = document.getElementById("ndpDemandBars");
        if (bars) {
          bars.querySelectorAll(".ndp-demand-col").forEach(function (col, i) {
            var p = pwaRows[i];
            if (!activeOuc) {
              col.style.opacity = "";
            } else {
              col.style.opacity = (p && p.ouc === activeOuc) ? "1" : "0.2";
            }
          });
        }
      });
    }

    // Legend toggle — show/hide bar segments
    var legend = document.getElementById("ndpDemandLegend");
    if (legend) {
      legend.addEventListener("click", function (e) {
        var item = e.target.closest(".ndp-demand-legend__item[data-seg]");
        if (!item) return;
        item.classList.toggle("is-active");
        var seg = item.getAttribute("data-seg");
        var active = item.classList.contains("is-active");
        var bars = document.getElementById("ndpDemandBars");
        if (!bars) return;
        bars.querySelectorAll(".ndp-demand-col__seg--" + seg).forEach(function (el) {
          el.style.display = active ? "" : "none";
        });
        // Recalculate overflow if active
        if (overflowActive) applyOverflow();
      });
    }

    // Overflow filter — rebuild chart showing only imbalanced PWAs
    var overflowBtn = document.getElementById("ndpDemandOverflow");
    var overflowActive = false;
    // Calculate scaleMax here so overflow handler has access
    var maxDemand = Math.max.apply(null, pwaRows.map(function (p) { return p.tail + p.due + p.future; })) || 1;
    var maxResource = Math.max.apply(null, pwaRows.map(function (p) { return (techsByPwa[p.pwa] || 0) * NDP.JOBS_PER_TECH; })) || 1;
    var chartScaleMax = Math.max(maxDemand, maxResource) || 1;
    if (overflowBtn) {
      overflowBtn.addEventListener("click", function () {
        overflowActive = !overflowActive;
        overflowBtn.style.color = overflowActive ? "var(--color-blue)" : "";
        overflowBtn.style.background = overflowActive ? "var(--hover-primary)" : "";

        applyOverflow();
      });
    }

    function applyOverflow() {
      var barsEl = document.getElementById("ndpDemandBars");
      if (!barsEl) return;

      // Check which legend segments are currently active
      var legendEl = document.getElementById("ndpDemandLegend");
      var activeTail = legendEl ? legendEl.querySelector('[data-seg="tail"].is-active') !== null : true;
      var activeDue = legendEl ? legendEl.querySelector('[data-seg="due"].is-active') !== null : true;
      var activeFuture = legendEl ? legendEl.querySelector('[data-seg="future"].is-active') !== null : true;

      if (!overflowActive) {
        // Restore: rebuild with normal bars
        barsEl.outerHTML = '<div class="ndp-demand-bars" id="ndpDemandBars">' + buildGridLines(chartScaleMax) + buildCols(pwaRows, techsByPwa, chartScaleMax) + '</div>';
        return;
      }

      // Calculate max excess for scaling
      var maxExcess = 1;
      pwaRows.forEach(function (p) {
        var demand = 0;
        if (activeTail) demand += p.tail;
        if (activeDue) demand += p.due;
        if (activeFuture) demand += p.future;
        var capacity = (techsByPwa[p.pwa] || 0) * NDP.JOBS_PER_TECH;
        var diff = Math.abs(demand - capacity);
        if (diff > maxExcess) maxExcess = diff;
      });

      // Build overflow bars
      var oucSeen = {};
      var overflowCols = pwaRows.map(function (p) {
        var isFirstInGroup = !oucSeen[p.ouc];
        oucSeen[p.ouc] = true;

        var demand = 0;
        if (activeTail) demand += p.tail;
        if (activeDue) demand += p.due;
        if (activeFuture) demand += p.future;
        var techs = techsByPwa[p.pwa] || 0;
        var capacity = techs * NDP.JOBS_PER_TECH;
        var diff = demand - capacity;
        var absDiff = Math.abs(diff);
        var h = absDiff ? Math.max(2, Math.round(absDiff / maxExcess * 100)) : 0;

        var seg = '';
        var tip = '';
        if (diff > 0) {
          // More demand than resource — show excess broken down by active segments
          tip = NDP.escapeHtml(p.pwa) + ' \u2014 ' + diff + ' task' + (diff !== 1 ? 's' : '') + ' over capacity';
          // Distribute excess proportionally across active segments
          var excessRemaining = diff;
          var excessSegs = '';
          if (activeFuture && p.future && excessRemaining > 0) {
            var futureShare = Math.min(p.future, excessRemaining);
            var fH = Math.max(1, Math.round(futureShare / maxExcess * 100));
            excessSegs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--future" data-tooltip="Future: ' + futureShare + '" style="height:' + fH + '%"></div>';
            excessRemaining -= futureShare;
          }
          if (activeDue && p.due && excessRemaining > 0) {
            var dueShare = Math.min(p.due, excessRemaining);
            var dH = Math.max(1, Math.round(dueShare / maxExcess * 100));
            excessSegs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--due" data-tooltip="Due: ' + dueShare + '" style="height:' + dH + '%"></div>';
            excessRemaining -= dueShare;
          }
          if (activeTail && p.tail && excessRemaining > 0) {
            var tailShare = Math.min(p.tail, excessRemaining);
            var tH = Math.max(1, Math.round(tailShare / maxExcess * 100));
            excessSegs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--tail" data-tooltip="Tail: ' + tailShare + '" style="height:' + tH + '%"></div>';
          }
          seg = excessSegs;
        } else if (diff < 0) {
          // More resource than demand
          var spareSlots = absDiff;
          var spareTechs = Math.floor(spareSlots / NDP.JOBS_PER_TECH);
          tip = NDP.escapeHtml(p.pwa) + ' \u2014 ' + spareSlots + ' spare slots (' + spareTechs + ' tech' + (spareTechs !== 1 ? 's' : '') + ' spare)';
          seg = '<div class="ndp-demand-col__seg ndp-demand-col__seg--resource" data-tooltip="' + tip + '" style="height:' + h + '%;border-radius:2px"></div>';
        } else {
          // Balanced
          tip = NDP.escapeHtml(p.pwa) + ' \u2014 Balanced';
          seg = '<div class="ndp-demand-col__seg" data-tooltip="' + tip + '" style="height:2%;background:var(--color-grey-200);border-radius:2px"></div>';
        }

        var shortLabel = p.pwa.replace(/^[A-Z]{2}-/, "").replace(/-19$/, "");

        return '<div class="ndp-demand-col' + (isFirstInGroup ? ' ndp-demand-col--group-start' : '') + '">' +
          '<div class="ndp-demand-col__pair">' +
            '<div class="ndp-demand-col__bar">' + seg + '</div>' +
          '</div>' +
          '<span class="ndp-demand-col__label">' + NDP.escapeHtml(shortLabel) + '</span>' +
        '</div>';
      }).join("");

      barsEl.outerHTML = '<div class="ndp-demand-bars" id="ndpDemandBars">' + buildGridLines(maxExcess) + overflowCols + '</div>';
    }

    // --- OUC label click → drilldown with PWA filter ---
    var oucsEl = document.getElementById("ndpDemandOucs");
    if (oucsEl) {
      oucsEl.addEventListener("click", function (e) {
        var oucSpan = e.target.closest(".ndp-demand-ouc");
        if (!oucSpan) return;
        var ouc = oucSpan.textContent.trim();
        if (!ouc) return;

        // Get all tasks for this OUC
        var matchedRows = [];
        var oucPwas = {};
        pwaRows.forEach(function (p) {
          if (p.ouc !== ouc) return;
          oucPwas[p.pwa] = true;
          p.rows.forEach(function (row) { matchedRows.push(row); });
        });

        if (!matchedRows.length) return;
        showDrilldown(ouc + ' \u2014 All Tasks', matchedRows, headers, idIdx, Object.keys(oucPwas).sort());
      });
    }

    // Drilldown click handler
    panel.addEventListener("click", function (e) {
      var cell = e.target.closest(".ndp-drill");
      if (!cell) return;
      var key = cell.getAttribute("data-key");
      var slot = cell.getAttribute("data-slot");
      var p = pwaMap[key];
      if (!p || !p.rows.length) return;

      var matchedRows = p.rows.filter(function (row) {
        return NDP.normaliseSlot(slotIdx !== -1 ? row[slotIdx] : "") === slot;
      });
      if (!matchedRows.length) return;
      showDrilldown(p.ouc + " / " + p.pwa + " \u2014 " + slot, matchedRows, headers, idIdx);
    });
  }

  // --- Drilldown modal ---
  var DRILL_PAGE_SIZE = NDP.DRILL_PAGE_SIZE;

  function showDrilldown(title, allRows, headers, idIdx, pwas) {
    var existing = document.getElementById("ndpDrillModal");
    if (existing) existing.remove();

    var skillIdx = headers.indexOf("Skill");
    if (skillIdx === -1) skillIdx = headers.indexOf("PRIMARY SKILL");
    var careIdx = headers.indexOf("Care Level");
    if (careIdx === -1) careIdx = headers.indexOf("CARE LEVEL");
    var typeIdx = headers.indexOf("Task type");
    if (typeIdx === -1) typeIdx = headers.indexOf("TASK TYPE");
    var pinIdx = headers.indexOf("Designated resource ID");
    if (pinIdx === -1) pinIdx = headers.indexOf("TECH PIN");
    var tagIdx = headers.indexOf("TAG");
    if (tagIdx === -1) tagIdx = headers.indexOf("COMMIT TYPE");
    var exchIdx = headers.indexOf("Asset name");
    if (exchIdx === -1) exchIdx = headers.indexOf("EXCHANGE NAME");
    var slotLocalIdx = headers.indexOf("Appt Slot");
    if (slotLocalIdx === -1) slotLocalIdx = headers.indexOf("APPT SLOT");

    var pwaLocalIdx = headers.indexOf("PWA");
    if (pwaLocalIdx === -1) pwaLocalIdx = headers.indexOf("PWA ID");

    // PWA filter bar (only if pwas provided)
    var pwaFilterHtml = '';
    if (pwas && pwas.length > 1) {
      pwaFilterHtml = '<div style="display:flex;gap:var(--spacing-2);flex-wrap:wrap;padding-bottom:var(--spacing-3);flex-shrink:0">';
      pwaFilterHtml += '<button class="ndp-pwa-filter is-active" data-pwa="">All (' + allRows.length + ')</button>';
      pwas.forEach(function (pwa) {
        var count = allRows.filter(function (r) { return (r[pwaLocalIdx] || "").trim() === pwa; }).length;
        var shortLabel = pwa.replace(/^[A-Z]{2}-/, "").replace(/-19$/, "");
        pwaFilterHtml += '<button class="ndp-pwa-filter" data-pwa="' + NDP.escapeHtml(pwa) + '">' + NDP.escapeHtml(shortLabel) + ' (' + count + ')</button>';
      });
      pwaFilterHtml += '</div>';
    }

    var html =
      '<div class="modal-backdrop open" id="ndpDrillModal">' +
        '<div class="modal modal-full">' +
          '<div class="modal-header">' +
            '<div class="modal-header-actions">' +
              '<h3>' + NDP.escapeHtml(title) + ' (' + allRows.length + ')</h3>' +
              '<button class="icon-btn icon-btn--sm tooltip" id="ndpDrillCopy" data-tooltip="Copy table"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button>' +
            '</div>' +
            '<button class="modal-close" aria-label="Close">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="modal-body" style="display:flex;flex-direction:column;min-height:0">' +
            pwaFilterHtml +
            '<div class="table-wrapper--flex">' +
              '<div class="table-scroll">' +
                '<table class="table">' +
                  '<thead><tr>' +
                    '<th style="text-align:left" data-col="' + idIdx + '">Task ID</th>' +
                    '<th style="text-align:left" data-col="' + pwaLocalIdx + '">PWA</th>' +
                    '<th style="text-align:left" data-col="' + exchIdx + '">Exchange</th>' +
                    '<th style="text-align:center" data-col="' + slotLocalIdx + '">Appt</th>' +
                    '<th style="text-align:center" data-col="' + tagIdx + '">Commit</th>' +
                    '<th style="text-align:center" data-col="' + skillIdx + '">Skill</th>' +
                    '<th style="text-align:center" data-col="' + careIdx + '">Response Code</th>' +
                    '<th style="text-align:center" data-col="' + typeIdx + '">Task Type</th>' +
                    '<th style="text-align:center" data-col="' + pinIdx + '">Tech</th>' +
                  '</tr></thead>' +
                  '<tbody id="ndpDrillTbody"></tbody>' +
                '</table>' +
              '</div>' +
              '<div class="table-pagination pagination-footer">' +
                '<span id="ndpDrillCount"></span>' +
                '<span id="ndpDrillRange"></span>' +
                '<button id="ndpDrillPrev" disabled><svg viewBox="0 0 24 24" fill="currentColor" style="width:var(--size-icon-sm);height:var(--size-icon-sm)"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>' +
                '<button id="ndpDrillNext" disabled><svg viewBox="0 0 24 24" fill="currentColor" style="width:var(--size-icon-sm);height:var(--size-icon-sm)"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("ndpDrillModal");
    modal.querySelector(".modal-close").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });

    // Copy table to clipboard
    document.getElementById("ndpDrillCopy").addEventListener("click", function () {
      var filtered = getFilteredRows();
      if (!filtered.length) return;
      var cols = ["Task ID", "PWA", "Exchange", "Appt", "Commit", "Skill", "Response Code", "Task Type", "Tech"];
      var indices = [idIdx, pwaLocalIdx, exchIdx, slotLocalIdx, tagIdx, skillIdx, careIdx, typeIdx, pinIdx];
      var tsv = cols.join("\t") + "\n";
      filtered.forEach(function (row) {
        tsv += indices.map(function (ci) { return ci !== -1 ? (row[ci] || "") : ""; }).join("\t") + "\n";
      });
      navigator.clipboard.writeText(tsv).then(function () {
        Notify.success("Copied " + filtered.length + " rows", 2000);
      }).catch(function () {});
    });

    // State
    var drillPage = 0;
    var activePwa = "";
    var sortCol = -1;
    var sortAsc = true;

    function getFilteredRows() {
      var filtered = activePwa
        ? allRows.filter(function (r) { return (r[pwaLocalIdx] || "").trim() === activePwa; })
        : allRows.slice();
      if (sortCol !== -1) {
        filtered.sort(function (a, b) {
          var va = (a[sortCol] || ""), vb = (b[sortCol] || "");
          var na = parseFloat(va), nb = parseFloat(vb);
          var cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : va.localeCompare(vb);
          return sortAsc ? cmp : -cmp;
        });
      }
      return filtered;
    }

    function renderDrillRows() {
      var tbody = document.getElementById("ndpDrillTbody");
      if (!tbody) return;
      tbody.innerHTML = "";

      var filtered = getFilteredRows();
      var totalPages = Math.max(1, Math.ceil(filtered.length / DRILL_PAGE_SIZE));
      if (drillPage >= totalPages) drillPage = totalPages - 1;
      if (drillPage < 0) drillPage = 0;
      var start = drillPage * DRILL_PAGE_SIZE;
      var end = Math.min(start + DRILL_PAGE_SIZE, filtered.length);
      var pageRows = filtered.slice(start, end);

      pageRows.forEach(function (row) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td style="text-align:left;font-weight:var(--font-weight-medium)">' + NDP.escapeHtml(idIdx !== -1 ? (row[idIdx] || "") : "") + '</td>' +
          '<td style="text-align:left">' + NDP.escapeHtml(pwaLocalIdx !== -1 ? (row[pwaLocalIdx] || "") : "") + '</td>' +
          '<td style="text-align:left">' + NDP.escapeHtml(exchIdx !== -1 ? (row[exchIdx] || "") : "") + '</td>' +
          '<td style="text-align:center">' + NDP.escapeHtml(slotLocalIdx !== -1 ? (row[slotLocalIdx] || "") : "") + '</td>' +
          '<td style="text-align:center;color:var(--color-blue);font-weight:var(--font-weight-medium)">' + NDP.escapeHtml(tagIdx !== -1 ? (row[tagIdx] || "") : "") + '</td>' +
          '<td style="text-align:center">' + NDP.escapeHtml(skillIdx !== -1 ? (row[skillIdx] || "") : "") + '</td>' +
          '<td style="text-align:center">' + NDP.escapeHtml(careIdx !== -1 ? (row[careIdx] || "") : "") + '</td>' +
          '<td style="text-align:center">' + NDP.escapeHtml(typeIdx !== -1 ? (row[typeIdx] || "") : "") + '</td>' +
          '<td style="text-align:center">' + NDP.escapeHtml(pinIdx !== -1 ? (row[pinIdx] || "") : "") + '</td>';
        tbody.appendChild(tr);
      });

      document.getElementById("ndpDrillCount").textContent = filtered.length + " tasks";
      document.getElementById("ndpDrillRange").textContent = filtered.length
        ? (start + 1) + "\u2013" + end + " of " + filtered.length
        : "0 of 0";
      document.getElementById("ndpDrillPrev").disabled = drillPage === 0;
      document.getElementById("ndpDrillNext").disabled = drillPage >= totalPages - 1;
    }

    // Header sort clicks
    modal.querySelectorAll("thead th[data-col]").forEach(function (th) {
      th.addEventListener("click", function () {
        var col = parseInt(th.getAttribute("data-col"), 10);
        if (isNaN(col) || col === -1) return;
        if (sortCol === col) {
          if (sortAsc) { sortAsc = false; }
          else { sortCol = -1; }
        } else {
          sortCol = col;
          sortAsc = true;
        }
        drillPage = 0;
        renderDrillRows();
        updateSortIndicators();
      });
    });

    function updateSortIndicators() {
      modal.querySelectorAll("thead th[data-col]").forEach(function (th) {
        var col = parseInt(th.getAttribute("data-col"), 10);
        var icon = th.querySelector(".table-sort-icon");
        if (!icon) {
          icon = document.createElement("span");
          icon.className = "table-sort-icon";
          th.appendChild(icon);
        }
        if (col === sortCol) {
          icon.classList.add("is-active");
          icon.innerHTML = sortAsc
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z"/></svg>';
        } else {
          icon.classList.remove("is-active");
          icon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>';
        }
      });
    }
    updateSortIndicators();

    // PWA filter clicks
    modal.querySelectorAll(".ndp-pwa-filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        modal.querySelectorAll(".ndp-pwa-filter").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        activePwa = btn.getAttribute("data-pwa");
        drillPage = 0;
        renderDrillRows();
      });
    });

    document.getElementById("ndpDrillPrev").addEventListener("click", function () {
      if (drillPage > 0) { drillPage--; renderDrillRows(); }
    });
    document.getElementById("ndpDrillNext").addEventListener("click", function () {
      drillPage++; renderDrillRows();
    });

    renderDrillRows();
  }

  // --- Secondary table — delegated to NdpDemandData ---
  function buildSecondaryTable(pwaRows, techsByPwa, rows, headers, oucIdx, tagIdx, extraTagList) {
    return NdpDemandData.buildSecondaryTable(pwaRows, techsByPwa, rows, headers, oucIdx, tagIdx, extraTagList);
  }

  // --- Chart helpers — delegated to NdpDemandUI ---
  function buildGridLines(scaleMax) { return NdpDemandUI.buildGridLines(scaleMax); }
  function buildCols(rows, techsByPwa, scaleMax) { return NdpDemandUI.buildCols(rows, techsByPwa, scaleMax); }
  function buildChart(pwaRows, techsByPwa) { return NdpDemandUI.buildChart(pwaRows, techsByPwa); }

  var demandSearch = "";

  function setSearch(query) {
    demandSearch = query;
    if (!panel) return;
    var tbody = panel.querySelector(".ndp-pivot tbody");
    if (!tbody) return;

    // Find which OUCs match the search
    var matchedOucs = {};
    tbody.querySelectorAll("tr").forEach(function (tr) {
      if (!demandSearch) {
        tr.style.opacity = "";
        tr.style.pointerEvents = "";
        return;
      }
      var text = tr.textContent.toUpperCase();
      var match = text.indexOf(demandSearch) !== -1;
      tr.style.opacity = match ? "1" : "0.15";
      tr.style.pointerEvents = match ? "" : "none";
      if (match) {
        var ouc = tr.querySelector("td") ? tr.querySelector("td").textContent.trim() : "";
        if (ouc) matchedOucs[ouc] = true;
      }
    });

    // Highlight chart columns for matched OUCs
    var bars = document.getElementById("ndpDemandBars");
    if (bars) {
      bars.querySelectorAll(".ndp-demand-col").forEach(function (col, i) {
        if (!demandSearch) {
          col.style.opacity = "";
          return;
        }
        var p = pwaRows[i];
        if (!p) return;
        // Match on PWA name or OUC
        var pwaMatch = p.pwa.toUpperCase().indexOf(demandSearch) !== -1;
        var oucMatch = matchedOucs[p.ouc];
        col.style.opacity = (pwaMatch || oucMatch) ? "1" : "0.2";
      });
    }
  }

  return { init: init, setSearch: setSearch };
})();
