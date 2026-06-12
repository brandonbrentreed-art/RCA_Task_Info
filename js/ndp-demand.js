"use strict";

// ============================================================
// ndp-demand.js — Demand tab (Workstack pivot)
// Pivot table: OUC × PWA × AM/PM/AllDay/Techs/Over-Short
// Stacked bar chart with legend toggles.
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

    // Build PWA pivot
    var pwaMap = {};
    rows.forEach(function (row) {
      var ouc = oucIdx !== -1 ? (row[oucIdx] || "").trim() || "(blank)" : "(blank)";
      var pwa = pwaIdx !== -1 ? (row[pwaIdx] || "").trim() || "(blank)" : "(blank)";
      var key = ouc + "|" + pwa;
      if (!pwaMap[key]) pwaMap[key] = { ouc: ouc, pwa: pwa, am: 0, pm: 0, allDay: 0, total: 0, tail: 0, due: 0, future: 0, rows: [] };
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
      '<div class="ndp-pivot" style="flex-shrink:0;overflow:auto;padding:var(--spacing-3) 0">' +
        '<div class="table-wrapper">' +
          '<table class="table">' +
            '<thead><tr>' +
              '<th style="text-align:left">OUC</th>' +
              '<th style="text-align:left">PWA</th>' +
              '<th>AM</th><th>PM</th><th>All Day</th>' +
              '<th>Techs</th><th>Over/Short</th>' +
            '</tr></thead>' +
            '<tbody>' +
            pwaRows.map(function (p) {
              var techs = techsByPwa[p.pwa] || 0;
              var appts = p.am + p.pm + p.allDay;
              var needed = techs - Math.ceil(appts / NDP.JOBS_PER_TECH);
              var color = needed > 0 ? "var(--color-green)" : needed < 0 ? "var(--color-error)" : "var(--color-grey)";
              var prefix = needed > 0 ? "+" : "";
              return '<tr>' +
                '<td style="text-align:left;font-weight:var(--font-weight-medium)">' + NDP.escapeHtml(p.ouc) + '</td>' +
                '<td style="text-align:left">' + NDP.escapeHtml(p.pwa) + '</td>' +
                '<td class="ndp-drill" data-key="' + p.ouc + '|' + p.pwa + '" data-slot="AM" style="cursor:pointer;font-weight:500">' + p.am + '</td>' +
                '<td class="ndp-drill" data-key="' + p.ouc + '|' + p.pwa + '" data-slot="PM" style="cursor:pointer;font-weight:500">' + p.pm + '</td>' +
                '<td class="ndp-drill" data-key="' + p.ouc + '|' + p.pwa + '" data-slot="All Day" style="cursor:pointer;font-weight:500">' + p.allDay + '</td>' +
                '<td>' + techs + '</td>' +
                '<td style="font-weight:var(--font-weight-medium);color:' + color + '">' + prefix + needed + '</td>' +
              '</tr>';
            }).join("") +
            '</tbody>' +
          '</table>' +
        '</div>' +
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
  function showDrilldown(title, rows, headers, idIdx) {
    var existing = document.getElementById("ndpDrillModal");
    if (existing) existing.remove();

    var skillIdx = headers.indexOf("Skill");
    var careIdx = headers.indexOf("Care Level");
    if (careIdx === -1) careIdx = headers.indexOf("CARE LEVEL");
    var typeIdx = headers.indexOf("Task type");

    var html =
      '<div class="modal-backdrop open" id="ndpDrillModal">' +
        '<div class="modal modal-lg">' +
          '<div class="modal-header">' +
            '<h3>' + NDP.escapeHtml(title) + ' (' + rows.length + ')</h3>' +
            '<button class="modal-close" aria-label="Close">' +
              '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="modal-body" style="overflow:auto">' +
            '<table class="table" style="font-size:var(--text-caption)">' +
              '<thead><tr><th style="text-align:left">Task ID</th><th>Skill</th><th>Care</th><th>Type</th></tr></thead>' +
              '<tbody>' +
              rows.map(function (row) {
                return '<tr>' +
                  '<td style="text-align:left;font-weight:500">' + NDP.escapeHtml(idIdx !== -1 ? (row[idIdx] || "") : "") + '</td>' +
                  '<td>' + NDP.escapeHtml(skillIdx !== -1 ? (row[skillIdx] || "") : "") + '</td>' +
                  '<td>' + NDP.escapeHtml(careIdx !== -1 ? (row[careIdx] || "") : "") + '</td>' +
                  '<td>' + NDP.escapeHtml(typeIdx !== -1 ? (row[typeIdx] || "") : "") + '</td>' +
                '</tr>';
              }).join("") +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML("beforeend", html);
    var modal = document.getElementById("ndpDrillModal");
    modal.querySelector(".modal-close").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });
  }

  // --- Chart helpers ---
  function getOucGroups(pwaRows) {
    var groups = [];
    var lastOuc = "";
    var span = 0;
    pwaRows.forEach(function (p, i) {
      if (p.ouc !== lastOuc) {
        if (lastOuc) groups.push({ ouc: lastOuc, span: span });
        lastOuc = p.ouc;
        span = 1;
      } else {
        span++;
      }
      if (i === pwaRows.length - 1) groups.push({ ouc: lastOuc, span: span });
    });
    return groups;
  }

  function buildGridLines(scaleMax) {
    var gridLines = '';
    var steps = 4;
    for (var s = 1; s <= steps; s++) {
      var pct = Math.round(s / steps * 100);
      var val = Math.round(s / steps * scaleMax);
      gridLines += '<div class="ndp-demand-grid" style="bottom:' + pct + '%"><span class="ndp-demand-grid__label">' + val + '</span></div>';
    }
    return gridLines;
  }

  function buildCols(rows, techsByPwa, scaleMax) {
    var oucSeen = {};
    return rows.map(function (p) {
      var isFirstInGroup = !oucSeen[p.ouc];
      oucSeen[p.ouc] = true;

      var total = p.tail + p.due + p.future;
      var capacity = (techsByPwa[p.pwa] || 0) * NDP.JOBS_PER_TECH;
      var isShort = total > capacity;

      var tailH = total ? Math.round(p.tail / scaleMax * 100) : 0;
      var dueH = total ? Math.round(p.due / scaleMax * 100) : 0;
      var futH = total ? Math.round(p.future / scaleMax * 100) : 0;
      var capH = capacity ? Math.round(capacity / scaleMax * 100) : 0;

      var demandSegs = "";
      if (p.future) demandSegs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--future" data-tooltip="Future: ' + p.future + '" style="height:' + futH + '%"></div>';
      if (p.due) demandSegs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--due" data-tooltip="Due: ' + p.due + '" style="height:' + dueH + '%"></div>';
      if (p.tail) demandSegs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--tail" data-tooltip="Tail: ' + p.tail + '" style="height:' + tailH + '%"></div>';

      var techs = techsByPwa[p.pwa] || 0;
      var shortLabel = p.pwa.replace(/^[A-Z]{2}-/, "").replace(/-19$/, "");

      return '<div class="ndp-demand-col' + (isFirstInGroup ? ' ndp-demand-col--group-start' : '') + '">' +
        '<div class="ndp-demand-col__pair">' +
          '<div class="ndp-demand-col__bar">' + demandSegs + '</div>' +
          '<div class="ndp-demand-col__bar ndp-demand-col__bar--resource">' +
            (capH ? '<div class="ndp-demand-col__seg ndp-demand-col__seg--resource" data-tooltip="' + NDP.escapeHtml(p.pwa) + ' \u2014 Techs: ' + techs + ' (capacity: ' + capacity + ')" style="height:' + capH + '%;border-radius:2px"></div>' : '') +
          '</div>' +
        '</div>' +
        '<span class="ndp-demand-col__label">' + NDP.escapeHtml(shortLabel) + '</span>' +
      '</div>';
    }).join("");
  }

  function buildChart(pwaRows, techsByPwa) {
    if (!pwaRows.length) return "";

    var maxDemand = Math.max.apply(null, pwaRows.map(function (p) { return p.tail + p.due + p.future; })) || 1;
    var maxResource = Math.max.apply(null, pwaRows.map(function (p) { return (techsByPwa[p.pwa] || 0) * NDP.JOBS_PER_TECH; })) || 1;
    var scaleMax = Math.max(maxDemand, maxResource) || 1;

    var cols = buildCols(pwaRows, techsByPwa, scaleMax);

    var gridLines = buildGridLines(scaleMax);

    var oucGroups = getOucGroups(pwaRows);
    var oucRow = oucGroups.map(function (g) {
      return '<span class="ndp-demand-ouc" style="flex:' + g.span + '">' + NDP.escapeHtml(g.ouc) + '</span>';
    }).join("");

    return '<div style="display:flex;justify-content:center;align-items:center;position:relative;padding-bottom:var(--spacing-2)">' +
      '<div class="ndp-demand-legend" id="ndpDemandLegend">' +
        '<span class="ndp-demand-legend__item is-active" data-seg="tail"><span class="ndp-demand-legend__dot" style="background:var(--color-warning)"></span>Tail</span>' +
        '<span class="ndp-demand-legend__item is-active" data-seg="due"><span class="ndp-demand-legend__dot" style="background:var(--color-blue)"></span>Due</span>' +
        '<span class="ndp-demand-legend__item is-active" data-seg="future"><span class="ndp-demand-legend__dot" style="background:var(--color-grey-300)"></span>Future</span>' +
        '<span class="ndp-demand-legend__item is-active" style="pointer-events:none"><span class="ndp-demand-legend__dot" style="background:var(--color-green)"></span>Resource</span>' +
      '</div>' +
      '<button class="icon-btn tooltip" id="ndpDemandOverflow" data-tooltip="Show imbalances only" style="width:28px;height:28px;position:absolute;right:0">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z"/></svg>' +
      '</button>' +
    '</div>' +
      '<div class="ndp-demand-bars" id="ndpDemandBars">' + gridLines + cols + '</div>' +
      '<div class="ndp-demand-oucs" id="ndpDemandOucs">' + oucRow + '</div>';
  }

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
