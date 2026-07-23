"use strict";

// ============================================================
// ndp-demand-data.js — Demand tab data processing
// Secondary table builders: enrichment (copper) and fibre priority.
// Loaded before ndp-demand-ui.js.
// ============================================================

var NdpDemandData = (function () {

  // --- Copper: Ageing buckets by OUC (from TailsReport enrichment) ---
  function buildEnrichTable() {
    if (!NdpData.state.enrichRows.length) return "";

    var enrichRows = NdpData.state.enrichRows;
    var slaIdx = NdpData.state.enrichSlaIdx;
    var dwellIdx = NdpData.state.enrichDwellIdx;
    var idIdx = NdpData.state.enrichIdIdx;

    var tfHeaders = NdpData.state.taskforceHeaders;
    var tfRows = NdpData.state.taskforceRows;
    var tfIdIdx = tfHeaders.indexOf("Unique Task ID");
    if (tfIdIdx === -1) tfIdIdx = tfHeaders.indexOf("JOB NO");
    var tfOucIdx = tfHeaders.indexOf("OUC");

    var tfServiceIdx = -1;
    for (var si = 0; si < tfHeaders.length; si++) {
      var sh = (tfHeaders[si] || "").toLowerCase().trim();
      if (sh === "work id" || sh === "serviceid" || sh === "service id" || sh === "af_service_id") { tfServiceIdx = si; break; }
    }

    var idToOuc = {};
    if (tfOucIdx !== -1) {
      tfRows.forEach(function (r) {
        var ouc = (r[tfOucIdx] || "").trim();
        if (!ouc) return;
        if (tfIdIdx !== -1) {
          var raw = (r[tfIdIdx] || "").trim();
          var canonical = NDP.canonicalKey(raw);
          if (canonical) idToOuc[canonical] = ouc;
          if (raw) idToOuc[raw.toUpperCase()] = ouc;
        }
        if (tfServiceIdx !== -1) {
          var svc = (r[tfServiceIdx] || "").trim();
          if (svc) idToOuc[svc] = ouc;
          if (svc) idToOuc[svc.toUpperCase()] = ouc;
        }
      });
    }

    var oucData = {};
    var ageIdx = NdpData.state.enrichAgeIdx;
    enrichRows.forEach(function (row) {
      var rawId = idIdx !== -1 ? (row[idIdx] || "").trim() : "";
      var canonical = NDP.canonicalKey(rawId);
      var ouc = idToOuc[canonical] || idToOuc[rawId.toUpperCase()] || null;
      if (!ouc) return;
      if (!oucData[ouc]) oucData[ouc] = { ouc: ouc, total: 0, slaBreach: 0, highDwell: 0, ageBuckets: {} };
      oucData[ouc].total++;
      if (slaIdx !== -1) {
        var sla = String(row[slaIdx] || "").trim().toUpperCase();
        if (sla === "BREACH" || sla === "Y" || sla === "YES" || sla === "TRUE" || sla === "1") oucData[ouc].slaBreach++;
      }
      if (dwellIdx !== -1) {
        var dwell = parseFloat(row[dwellIdx]) || 0;
        if (dwell > 24) oucData[ouc].highDwell++;
      }
      if (ageIdx !== -1) {
        var age = String(row[ageIdx] || "").trim();
        if (age) oucData[ouc].ageBuckets[age] = (oucData[ouc].ageBuckets[age] || 0) + 1;
      }
    });

    var oucList = Object.keys(oucData).sort().map(function (k) { return oucData[k]; });
    if (!oucList.length) return "";

    var allBuckets = {};
    oucList.forEach(function (d) {
      Object.keys(d.ageBuckets).forEach(function (b) { allBuckets[b] = true; });
    });
    var bucketCols = Object.keys(allBuckets).sort(function (a, b) {
      var numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0;
      var numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0;
      return numB - numA;
    });
    if (!bucketCols.length) return "";

    var html =
      '<div style="flex:1;min-width:0">' +
        '<div class="table-wrapper">' +
          '<table class="table">' +
            '<thead><tr>' +
              '<th style="text-align:left">OUC</th>' +
              '<th style="text-align:center">Tasks</th>' +
              bucketCols.map(function (b) { return '<th style="text-align:center">' + NDP.escapeHtml(b) + '</th>'; }).join('') +
            '</tr></thead>' +
            '<tbody>';

    oucList.forEach(function (d) {
      html += '<tr>' +
        '<td style="text-align:left;font-weight:var(--font-weight-medium)">' + NDP.escapeHtml(d.ouc) + '</td>' +
        '<td style="text-align:center">' + d.total + '</td>' +
        bucketCols.map(function (b) {
          var count = d.ageBuckets[b] || 0;
          var color = count ? 'var(--color-navy)' : 'var(--color-grey-light)';
          return '<td style="text-align:center;color:' + color + ';font-weight:' + (count ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)') + '">' + count + '</td>';
        }).join('') +
      '</tr>';
    });

    html += '</tbody></table></div></div>';
    return html;
  }

  // --- Fibre: Priority types by OUC (from BTTW/KCI2 resource_type) ---
  function buildFibrePriorityTable(rows, headers, oucIdx, tagIdx, extraTagList) {
    if (!extraTagList || !extraTagList.length) return "";

    var oucSet = {};
    var tagOuc = {};
    extraTagList.forEach(function (tag) { tagOuc[tag] = {}; });

    rows.forEach(function (row) {
      var tag = tagIdx !== -1 ? (row[tagIdx] || "").trim() : "";
      if (!tag || !tagOuc[tag]) return;
      var ouc = oucIdx !== -1 ? (row[oucIdx] || "").trim() || "(blank)" : "(blank)";
      oucSet[ouc] = true;
      tagOuc[tag][ouc] = (tagOuc[tag][ouc] || 0) + 1;
    });

    var oucList = Object.keys(oucSet).sort();
    if (!oucList.length) return "";

    var html =
      '<div style="flex:1;min-width:0">' +
        '<div class="table-wrapper">' +
          '<table class="table">' +
            '<thead><tr>' +
              '<th style="text-align:left">Fibre Priority</th>' +
              oucList.map(function (o) { return '<th style="text-align:center">' + NDP.escapeHtml(o) + '</th>'; }).join('') +
            '</tr></thead>' +
            '<tbody>';

    extraTagList.forEach(function (tag) {
      html += '<tr>' +
        '<td style="text-align:left;font-weight:var(--font-weight-medium);color:var(--color-blue)">' + NDP.escapeHtml(tag) + '</td>' +
        oucList.map(function (ouc) {
          var count = tagOuc[tag][ouc] || 0;
          var color = count ? 'var(--color-warning)' : 'var(--color-grey-light)';
          return '<td style="text-align:center;color:' + color + ';font-weight:' + (count ? 'var(--font-weight-medium)' : 'var(--font-weight-regular)') + '">' + count + '</td>';
        }).join('') +
      '</tr>';
    });

    html += '</tbody></table></div></div>';
    return html;
  }

  // --- Workstack-aware secondary table dispatcher ---
  function buildSecondaryTable(pwaRows, techsByPwa, rows, headers, oucIdx, tagIdx, extraTagList) {
    if (NdpData.state.workstack === "fibre") {
      return buildFibrePriorityTable(rows, headers, oucIdx, tagIdx, extraTagList);
    }
    return buildEnrichTable();
  }

  return {
    buildSecondaryTable: buildSecondaryTable,
    buildEnrichTable: buildEnrichTable,
    buildFibrePriorityTable: buildFibrePriorityTable
  };
})();
