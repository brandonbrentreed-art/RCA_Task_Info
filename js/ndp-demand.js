"use strict";

// ============================================================
// ndp-demand.js — Demand tab (Workstack pivot)
// Pivot table: OUC × PWA × AM/PM/AllDay/Techs/Over-Short
// Stacked bar chart with legend toggles.
// ============================================================

var NdpDemand = (function () {
  var panel = null;

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

    var pwaRows = Object.keys(pwaMap).sort().map(function (k) { return pwaMap[k]; });

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

    // Render table
    var html =
      '<div class="ndp-pivot" style="flex:1;min-height:0;overflow:auto;padding:var(--spacing-3) 0">' +
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
        buildChart(pwaRows) +
      '</div>';

    panel.insertAdjacentHTML("beforeend", html);

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

  function buildChart(pwaRows) {
    if (!pwaRows.length) return "";
    var max = Math.max.apply(null, pwaRows.map(function (p) { return p.tail + p.due + p.future; })) || 1;

    var cols = pwaRows.map(function (p) {
      var tailH = Math.max(2, Math.round(p.tail / max * 100));
      var dueH = Math.max(2, Math.round(p.due / max * 100));
      var futH = Math.max(2, Math.round(p.future / max * 100));
      var segs = "";
      if (p.future) segs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--future" style="height:' + futH + '%"></div>';
      if (p.due) segs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--due" style="height:' + dueH + '%"></div>';
      if (p.tail) segs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--tail" style="height:' + tailH + '%"></div>';
      var shortLabel = p.pwa.replace(/^[A-Z]{2}-/, "").replace(/-19$/, "");
      return '<div class="ndp-demand-col">' +
        '<div class="ndp-demand-col__bar">' + segs + '</div>' +
        '<span class="ndp-demand-col__label">' + NDP.escapeHtml(shortLabel) + '</span>' +
      '</div>';
    }).join("");

    return cols;
  }

  return { init: init };
})();
