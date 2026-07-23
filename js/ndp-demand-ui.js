"use strict";

// ============================================================
// ndp-demand-ui.js — Demand tab chart rendering helpers
// Grid lines, bar columns, OUC grouping, chart assembly.
// Loaded before ndp-demand.js.
// ============================================================

var NdpDemandUI = (function () {

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

  return {
    getOucGroups: getOucGroups,
    buildGridLines: buildGridLines,
    buildCols: buildCols,
    buildChart: buildChart
  };
})();
