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

    // Resource from tech sheet — net available minutes per PWA + tech count for display.
    // Uses CALENDARIZED PWA if set, falls back to IDEPLOY PWA per row.
    // Only counts techs with net available minutes > 0 (ROSTER + OVERTIME - ABSENCE).
    var minutesByPwa = {};   // sum of net mins per PWA  → drives capacity
    var techsByPwa   = {};   // count of available techs → display only (Techs column)
    if (NdpData.state.techRows.length) {
      var th = NdpData.state.techHeaders;
      var calIdx  = th.indexOf("CALENDARIZED PWA");
      var ideIdx  = th.indexOf("IDEPLOY PWA");
      var rosIdx  = th.indexOf("ROSTER MINS");
      var absIdx  = th.indexOf("ABSENCE MINS");
      var otIdx   = th.indexOf("OVERTIME MINS");

      NdpData.state.techRows.forEach(function (row) {
        var pwa = (calIdx !== -1 ? (row[calIdx] || "").trim() : "") ||
                  (ideIdx !== -1 ? (row[ideIdx] || "").trim() : "");
        if (!pwa) return;

        var roster   = rosIdx !== -1 ? (parseFloat(row[rosIdx]) || 0) : 0;
        var absence  = absIdx !== -1 ? (parseFloat(row[absIdx]) || 0) : 0;
        var overtime = otIdx  !== -1 ? (parseFloat(row[otIdx])  || 0) : 0;
        var netMins  = roster + overtime - absence;
        if (netMins <= 0) return;

        minutesByPwa[pwa] = (minutesByPwa[pwa] || 0) + netMins;
        techsByPwa[pwa]   = (techsByPwa[pwa]   || 0) + 1;
      });
    }

    // capacity in jobs = total available minutes / avg job duration
    function capacityJobs(pwa) {
      return minutesByPwa[pwa] ? minutesByPwa[pwa] / NDP.AVG_JOB_MINS : 0;
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
              var cap   = capacityJobs(p.pwa);
              var needed = cap - appts;
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
                '<td style="text-align:center;font-weight:var(--font-weight-medium);color:' + color + '">' + prefix + needed.toFixed(1) + '</td>' +
              '</tr>';
            }).join("") +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      buildSecondaryTable(pwaRows, techsByPwa, rows, headers, oucIdx, tagIdx, extraTagList) +
    '</div>' +
      '<div class="ndp-demand-chart" id="ndpDemandChart">' +
        buildChart(pwaRows, minutesByPwa) +
      '</div>';

    panel.insertAdjacentHTML("beforeend", html);
    NdpDemandUI.wireChartTooltip(pwaRows, minutesByPwa, techsByPwa, function () { return overflowActive; });
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
          el.classList.toggle("ndp-demand-col__seg--hidden", !active);
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
    var maxResource = Math.max.apply(null, pwaRows.map(function (p) { return capacityJobs(p.pwa); })) || 1;
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

      // Fade out → rebuild → fade in
      barsEl.classList.add("is-transitioning");
      setTimeout(function () {
        _applyOverflow();
        // Reapply any legend-toggled-off hidden classes to the new DOM
        var legendEl = document.getElementById("ndpDemandLegend");
        if (legendEl) {
          ["tail", "due", "future"].forEach(function (seg) {
            var isActive = legendEl.querySelector('[data-seg="' + seg + '"].is-active') !== null;
            if (!isActive) {
              var newBars = document.getElementById("ndpDemandBars");
              if (newBars) {
                newBars.querySelectorAll(".ndp-demand-col__seg--" + seg).forEach(function (el) {
                  el.classList.add("ndp-demand-col__seg--hidden");
                });
              }
            }
          });
        }
        var newBarsEl = document.getElementById("ndpDemandBars");
        if (newBarsEl) {
          newBarsEl.offsetHeight;
          newBarsEl.classList.remove("is-transitioning");
        }
      }, 180);
    }

    function _applyOverflow() {
      var barsEl = document.getElementById("ndpDemandBars");
      if (!barsEl) return;

      if (!overflowActive) {
        barsEl.outerHTML = '<div class="ndp-demand-bars is-transitioning" id="ndpDemandBars">' + buildGridLines(chartScaleMax) + buildCols(pwaRows, minutesByPwa, chartScaleMax) + '</div>';
        NdpDemandUI.wireChartTooltip(pwaRows, minutesByPwa, techsByPwa, function () { return overflowActive; });
        return;
      }

      var legendEl = document.getElementById("ndpDemandLegend");
      var activeTail   = !legendEl || legendEl.querySelector('[data-seg="tail"].is-active')   !== null;
      var activeDue    = !legendEl || legendEl.querySelector('[data-seg="due"].is-active')    !== null;
      var activeFuture = !legendEl || legendEl.querySelector('[data-seg="future"].is-active') !== null;

      // Scale = max excess (either side) across all PWAs using only active segments
      var scaleMax = 1;
      pwaRows.forEach(function (p) {
        var demand = (activeTail ? p.tail : 0) + (activeDue ? p.due : 0) + (activeFuture ? p.future : 0);
        var excess = Math.abs(demand - capacityJobs(p.pwa));
        if (excess > scaleMax) scaleMax = excess;
      });

      var oucSeen = {};
      var cols = pwaRows.map(function (p) {
        var isFirstInGroup = !oucSeen[p.ouc];
        oucSeen[p.ouc] = true;

        var demand = (activeTail ? p.tail : 0) + (activeDue ? p.due : 0) + (activeFuture ? p.future : 0);
        var cap  = capacityJobs(p.pwa);
        var diff = demand - cap;

        var demandSegs = '<div class="ndp-demand-col__seg" style="height:1px;min-height:0;background:var(--color-grey-200)"></div>';
        var resourceSeg = '<div class="ndp-demand-col__seg" style="height:1px;min-height:0;background:var(--color-grey-200)"></div>';

        if (diff > 0) {
          var segs = '';
          var remaining = diff;
          if (activeFuture && p.future && remaining > 0) { var s = Math.min(p.future, remaining); segs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--future" data-tooltip="Future excess: ' + s + '" style="height:' + Math.round(s / scaleMax * 100) + '%"></div>'; remaining -= s; }
          if (activeDue    && p.due    && remaining > 0) { var s = Math.min(p.due,    remaining); segs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--due" data-tooltip="Due excess: ' + s + '" style="height:' + Math.round(s / scaleMax * 100) + '%"></div>'; remaining -= s; }
          if (activeTail   && p.tail   && remaining > 0) { var s = Math.min(p.tail,   remaining); segs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--tail" data-tooltip="Tail excess: ' + s + '" style="height:' + Math.round(s / scaleMax * 100) + '%"></div>'; }
          demandSegs = segs;
        } else if (diff < 0) {
          var spare = -diff;
          var spareMins = Math.round(spare * NDP.AVG_JOB_MINS);
          resourceSeg = '<div class="ndp-demand-col__seg ndp-demand-col__seg--resource" data-tooltip="' + NDP.escapeHtml(p.pwa) + ' \u2014 ' + spare.toFixed(1) + ' spare slots (~' + spareMins + ' mins)" style="height:' + Math.round(Math.abs(diff) / scaleMax * 100) + '%"></div>';
        }

        var shortLabel = p.pwa.replace(/^[A-Z]{2}-/, "").replace(/-19$/, "");

        return '<div class="ndp-demand-col' + (isFirstInGroup ? ' ndp-demand-col--group-start' : '') + '">' +
          '<div class="ndp-demand-col__pair">' +
            '<div class="ndp-demand-col__bar">' + demandSegs + '</div>' +
            '<div class="ndp-demand-col__bar ndp-demand-col__bar--resource">' + resourceSeg + '</div>' +
          '</div>' +
          '<span class="ndp-demand-col__label">' + NDP.escapeHtml(shortLabel) + '</span>' +
        '</div>';
      }).join("");

      barsEl.outerHTML = '<div class="ndp-demand-bars is-transitioning" id="ndpDemandBars">' + buildGridLines(scaleMax) + cols + '</div>';
      NdpDemandUI.wireChartTooltip(pwaRows, minutesByPwa, techsByPwa, function () { return overflowActive; });
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
          '<div class="modal-body" style="display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:var(--content-inset)">' +
            pwaFilterHtml +
            '<div class="table-wrapper--flex" style="flex:1;min-height:0;display:flex;flex-direction:column">' +
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
