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

  function buildCols(rows, minutesByPwa, scaleMax) {
    var oucSeen = {};
    return rows.map(function (p) {
      var isFirstInGroup = !oucSeen[p.ouc];
      oucSeen[p.ouc] = true;

      var total    = p.tail + p.due + p.future;
      var capacity = minutesByPwa[p.pwa] ? minutesByPwa[p.pwa] / NDP.AVG_JOB_MINS : 0;

      var tailH = total ? Math.round(p.tail   / scaleMax * 100) : 0;
      var dueH  = total ? Math.round(p.due    / scaleMax * 100) : 0;
      var futH  = total ? Math.round(p.future / scaleMax * 100) : 0;
      var capH  = capacity ? Math.round(capacity / scaleMax * 100) : 0;

      var demandSegs = "";
      if (p.future) demandSegs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--future" style="height:' + futH + '%"></div>';
      if (p.due)    demandSegs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--due" style="height:' + dueH + '%"></div>';
      if (p.tail)   demandSegs += '<div class="ndp-demand-col__seg ndp-demand-col__seg--tail" style="height:' + tailH + '%"></div>';
      if (!total)   demandSegs = '<div class="ndp-demand-col__seg" style="height:1px;min-height:0;background:var(--color-grey-200);opacity:0.5"></div>';

      var resourceSeg = capH
        ? '<div class="ndp-demand-col__seg ndp-demand-col__seg--resource" style="height:' + capH + '%;border-radius:2px"></div>'
        : '<div class="ndp-demand-col__seg" style="height:1px;min-height:0;background:var(--color-error);opacity:0.4"></div>';

      var shortLabel = p.pwa.replace(/^[A-Z]{2}-/, "").replace(/-19$/, "");

      return '<div class="ndp-demand-col' + (isFirstInGroup ? ' ndp-demand-col--group-start' : '') + '">' +
        '<div class="ndp-demand-col__pair">' +
          '<div class="ndp-demand-col__bar">' + demandSegs + '</div>' +
          '<div class="ndp-demand-col__bar ndp-demand-col__bar--resource">' + resourceSeg + '</div>' +
        '</div>' +
        '<span class="ndp-demand-col__label">' + NDP.escapeHtml(shortLabel) + '</span>' +
      '</div>';
    }).join("");
  }

  function buildChart(pwaRows, minutesByPwa) {
    if (!pwaRows.length) return "";

    var maxDemand   = Math.max.apply(null, pwaRows.map(function (p) { return p.tail + p.due + p.future; })) || 1;
    var maxResource = Math.max.apply(null, pwaRows.map(function (p) { return minutesByPwa[p.pwa] ? minutesByPwa[p.pwa] / NDP.AVG_JOB_MINS : 0; })) || 1;
    var scaleMax    = Math.max(maxDemand, maxResource) || 1;

    var cols      = buildCols(pwaRows, minutesByPwa, scaleMax);
    var gridLines = buildGridLines(scaleMax);

    var oucGroups = getOucGroups(pwaRows);
    var oucRow = oucGroups.map(function (g) {
      return '<span class="ndp-demand-ouc" style="flex:' + g.span + '">' + NDP.escapeHtml(g.ouc) + '</span>';
    }).join("");

    return '<div style="display:flex;justify-content:center;align-items:center;position:relative;padding-bottom:var(--spacing-2)">' +
      '<div class="ndp-demand-legend" id="ndpDemandLegend">' +
        '<span class="ndp-demand-legend__item is-active" data-seg="tail"><span class="ndp-demand-legend__dot" style="background:var(--color-grey-300)"></span>Tail</span>' +
        '<span class="ndp-demand-legend__item is-active" data-seg="due"><span class="ndp-demand-legend__dot" style="background:#5488C7"></span>Due</span>' +
        '<span class="ndp-demand-legend__item is-active" data-seg="future"><span class="ndp-demand-legend__dot" style="background:var(--color-green)"></span>Future</span>' +
        '<span class="ndp-demand-legend__item is-active" style="pointer-events:none"><span class="ndp-demand-legend__dot" style="background:rgba(84,136,199,0.45)"></span>Resource</span>' +
      '</div>' +
      '<button class="icon-btn tooltip" id="ndpDemandOverflow" data-tooltip="Show imbalances only" style="width:28px;height:28px;position:absolute;right:0">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z"/></svg>' +
      '</button>' +
    '</div>' +
      '<div class="ndp-demand-bars" id="ndpDemandBars">' + gridLines + cols + '</div>' +
      '<div class="ndp-demand-oucs" id="ndpDemandOucs">' + oucRow + '</div>';
  }

  // ── Rich hover tooltip ────────────────────────────────────────────────
  var _richTip = null;

  function getRichTip() {
    if (_richTip && !document.body.contains(_richTip)) _richTip = null;
    if (!_richTip) {
      _richTip = document.createElement('div');
      _richTip.className = 'ndp-chart-tip';
      _richTip.style.cssText = 'position:fixed;display:none;pointer-events:none;z-index:99999';
      document.body.appendChild(_richTip);
    }
    return _richTip;
  }

  function getActiveLegendSegs() {
    var legendEl = document.getElementById('ndpDemandLegend');
    return {
      tail:   !legendEl || legendEl.querySelector('[data-seg="tail"].is-active')   !== null,
      due:    !legendEl || legendEl.querySelector('[data-seg="due"].is-active')    !== null,
      future: !legendEl || legendEl.querySelector('[data-seg="future"].is-active') !== null
    };
  }

  // Wire hover tooltip onto the bars container.
  // Called after every applyOverflow() rebuild — barsEl is replaced via outerHTML
  // so old listeners are garbage-collected with the old element. lastIdx resets
  // to -1 in each new closure, so no stale state carries over between rebuilds.
  // isOverflow: function() returning bool — reads current overflow state from caller.
  function wireChartTooltip(pwaRows, minutesByPwa, techsByPwa, isOverflow) {
    var barsEl = document.getElementById('ndpDemandBars');
    if (!barsEl) return;
    var tip = getRichTip();
    var lastIdx = -1;

    barsEl.addEventListener('mousemove', function (e) {
      var col = e.target.closest('.ndp-demand-col');
      if (!col) {
        if (tip.style.display === 'block') {
          var tw = tip.offsetWidth;
          var th = tip.offsetHeight;
          var x = e.clientX + 14;
          var y = e.clientY - th - 8;
          if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 14;
          if (y < 8) y = e.clientY + 14;
          tip.style.left = x + 'px';
          tip.style.top  = y + 'px';
        }
        return;
      }

      var idx = Array.prototype.indexOf.call(barsEl.querySelectorAll('.ndp-demand-col'), col);
      var p = pwaRows[idx];
      if (!p) { tip.style.display = 'none'; lastIdx = -1; return; }

      if (idx !== lastIdx) {
        lastIdx = idx;

        var segs     = getActiveLegendSegs();
        var techs    = (techsByPwa && techsByPwa[p.pwa]) || 0;
        var netMins  = minutesByPwa[p.pwa] || 0;
        var capacity = netMins ? netMins / NDP.AVG_JOB_MINS : 0;

        var tail   = segs.tail   ? p.tail   : 0;
        var due    = segs.due    ? p.due    : 0;
        var future = segs.future ? p.future : 0;
        var demand = tail + due + future;

        var diff      = demand - capacity;
        var diffColor = diff > 0 ? 'var(--color-error)' : diff < 0 ? 'var(--color-green)' : 'var(--color-grey)';
        var diffText  = diff > 0 ? '+' + diff.toFixed(1) : diff.toFixed(1);
        var shortLabel = p.pwa.replace(/^[A-Z]{2}-/, '').replace(/-19$/, '');

        var resourceRow;
        if (isOverflow && isOverflow() && diff < 0) {
          // Spare capacity — show in people terms
          var spare     = -diff;
          var spareMins = Math.round(spare * NDP.AVG_JOB_MINS);
          var spareTechs = Math.floor(spareMins / NDP.ROSTER_DAY_MINS);
          var techLabel = spareTechs === 1 ? '1 person' : spareTechs + ' people';
          resourceRow =
            '<div class="ndp-chart-tip__row"><span class="ndp-chart-tip__swatch" style="background:rgba(84,136,199,0.45)"></span><span>Spare capacity</span><span class="ndp-chart-tip__val" style="color:var(--color-green)">' + spare.toFixed(1) + ' jobs</span></div>' +
            '<div class="ndp-chart-tip__row" style="color:var(--color-grey-light);font-size:0.9em"><span></span><span>~' + spareMins + ' mins \u00b7 could spare ' + techLabel + '</span></div>';
        } else if (isOverflow && isOverflow() && diff > 0) {
          // Over capacity — show shortfall in people terms
          var over      = diff;
          var overMins  = Math.round(over * NDP.AVG_JOB_MINS);
          var overTechs = Math.ceil(overMins / NDP.ROSTER_DAY_MINS);
          var needLabel = overTechs === 1 ? '1 person' : overTechs + ' people';
          resourceRow =
            '<div class="ndp-chart-tip__row"><span class="ndp-chart-tip__swatch" style="background:rgba(84,136,199,0.45)"></span><span>Over capacity</span><span class="ndp-chart-tip__val" style="color:var(--color-error)">+' + over.toFixed(1) + ' jobs</span></div>' +
            '<div class="ndp-chart-tip__row" style="color:var(--color-grey-light);font-size:0.9em"><span></span><span>~' + overMins + ' mins \u00b7 needs ' + needLabel + '</span></div>';
        } else {
          // Normal view — show raw capacity
          var ratio = capacity ? (demand / capacity).toFixed(2) : '\u2014';
          resourceRow =
            '<div class="ndp-chart-tip__row"><span class="ndp-chart-tip__swatch" style="background:rgba(84,136,199,0.45)"></span><span>Resource</span><span class="ndp-chart-tip__val">' + capacity.toFixed(1) + ' jobs</span></div>' +
            '<div class="ndp-chart-tip__row" style="color:var(--color-grey-light);font-size:0.9em"><span></span><span>' + techs + ' techs \u00b7 ' + netMins + ' mins</span></div>';
        }

        var titleSuffix = (isOverflow && isOverflow()) ? '' : ' <span class="ndp-chart-tip__ratio">(' + (capacity ? (demand / capacity).toFixed(2) : '\u2014') + ')</span>';

        tip.innerHTML =
          '<div class="ndp-chart-tip__title">' + NDP.escapeHtml(shortLabel) + titleSuffix + '</div>' +
          '<div class="ndp-chart-tip__rows">' +
            '<div class="ndp-chart-tip__row"><span class="ndp-chart-tip__swatch" style="background:#bdbdbd"></span><span>Tail</span><span class="ndp-chart-tip__val">' + tail + '</span></div>' +
            '<div class="ndp-chart-tip__row"><span class="ndp-chart-tip__swatch" style="background:#5488C7"></span><span>Due</span><span class="ndp-chart-tip__val">' + due + '</span></div>' +
            '<div class="ndp-chart-tip__row"><span class="ndp-chart-tip__swatch" style="background:#43B072"></span><span>Future</span><span class="ndp-chart-tip__val">' + future + '</span></div>' +
            '<div class="ndp-chart-tip__divider"></div>' +
            '<div class="ndp-chart-tip__row"><span class="ndp-chart-tip__swatch" style="background:#5488C7;opacity:0.6"></span><span>Demand</span><span class="ndp-chart-tip__val">' + demand + '</span></div>' +
            resourceRow +
            '<div class="ndp-chart-tip__divider"></div>' +
            '<div class="ndp-chart-tip__row ndp-chart-tip__row--diff"><span>Balance</span><span class="ndp-chart-tip__val" style="color:' + diffColor + ';font-weight:600">' + diffText + '</span></div>' +
          '</div>';
      }

      var tw = tip.offsetWidth;
      var th = tip.offsetHeight;
      var x = e.clientX + 14;
      var y = e.clientY - th - 8;
      if (x + tw > window.innerWidth - 8) x = e.clientX - tw - 14;
      if (y < 8) y = e.clientY + 14;
      tip.style.display = 'block';
      tip.style.left = x + 'px';
      tip.style.top  = y + 'px';
    });

    barsEl.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      lastIdx = -1;
    });
  }

  return {
    getOucGroups: getOucGroups,
    buildGridLines: buildGridLines,
    buildCols: buildCols,
    buildChart: buildChart,
    wireChartTooltip: wireChartTooltip
  };
})();
