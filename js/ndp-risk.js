"use strict";

// ============================================================
// ndp-risk.js — Risk tab (Summary)
// Risk scoring: alternatives per OUC+skill.
// Toggle buttons, risk table, skill scarcity chart.
// ============================================================

var NdpRisk = (function () {
  var panel = null;
  var scored = [];
  var activeRisks = { Critical: true, High: true, Medium: false, Low: false };
  var page = 0;
  var pageSize = 30;

  function init() {
    panel = document.getElementById("panel-risk");
    if (!panel) return;

    var headers = NdpData.state.planHeaders;
    var rows = NdpData.state.planRows;
    if (!headers.length || !rows.length) return;

    // Clean previous render
    Array.from(panel.children).forEach(function (child) {
      if (!child.classList.contains("ndp-empty")) child.remove();
    });

    document.getElementById("ndpEmptyRisk").style.display = "none";
    activeRisks = { Critical: true, High: true, Medium: false, Low: false };
    page = 0;
    score(headers, rows);
    buildUI();
    render();
  }

  // --- Risk scoring ---
  function score(headers, rows) {
    var oucIdx = headers.indexOf("OUC");
    var pinIdx = headers.indexOf("TECH PIN");
    var skillIdx = headers.indexOf("DERISK REASON");

    // Build OUC+Skill → unique techs count
    var oucSkillTechs = {};
    rows.forEach(function (row) {
      var ouc = oucIdx !== -1 ? (row[oucIdx] || "").trim() : "";
      var pin = pinIdx !== -1 ? (row[pinIdx] || "").trim() : "";
      var skill = skillIdx !== -1 ? (row[skillIdx] || "").trim() : "";
      if (!ouc || !pin || !skill) return;
      if (!oucSkillTechs[ouc]) oucSkillTechs[ouc] = {};
      if (!oucSkillTechs[ouc][skill]) oucSkillTechs[ouc][skill] = {};
      oucSkillTechs[ouc][skill][pin] = true;
    });

    scored = rows.map(function (row) {
      var ouc = oucIdx !== -1 ? (row[oucIdx] || "").trim() : "";
      var skill = skillIdx !== -1 ? (row[skillIdx] || "").trim() : "";
      var alts = 0;
      if (ouc && skill && oucSkillTechs[ouc] && oucSkillTechs[ouc][skill]) {
        alts = Object.keys(oucSkillTechs[ouc][skill]).length;
      }
      return { row: row, score: alts };
    });

    scored.sort(function (a, b) { return a.score - b.score; });
  }

  function buildUI() {
    var html =
      '<div style="display:flex;flex-direction:column;flex:1;min-height:0;gap:var(--spacing-3);padding-top:var(--spacing-3)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div class="ndp-risk-toggles" id="ndpRiskToggles"></div>' +
          '<div style="display:flex;gap:var(--spacing-1)">' +
            '<button class="icon-btn tooltip" id="ndpRiskCopy" data-tooltip="Copy table" style="width:36px;height:36px"><svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button>' +
            '<button class="icon-btn tooltip" id="ndpRiskScreenshot" data-tooltip="Screenshot" style="width:36px;height:36px"><svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></button>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex:1;min-height:0;gap:var(--spacing-4)">' +
          '<div style="flex:2;min-height:0;overflow:auto">' +
            '<div class="table-wrapper">' +
              '<table class="table" id="ndpRiskTbl">' +
                '<thead id="ndpRiskThead"></thead>' +
                '<tbody id="ndpRiskTbody"></tbody>' +
              '</table>' +
            '</div>' +
            '<div class="table-pagination" id="ndpRiskPager">' +
              '<span id="ndpRiskCount"></span>' +
              '<span id="ndpRiskRange"></span>' +
              '<button id="ndpRiskPrev" disabled>&laquo;</button>' +
              '<button id="ndpRiskNext" disabled>&raquo;</button>' +
            '</div>' +
          '</div>' +
          '<div class="ndp-chart" id="ndpScarcityChart" style="flex:1"></div>' +
        '</div>' +
      '</div>';

    panel.insertAdjacentHTML("beforeend", html);
    renderToggles();
    wireEvents();
  }

  function renderToggles() {
    var el = document.getElementById("ndpRiskToggles");
    el.innerHTML = "";
    var buckets = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    scored.forEach(function (item) { buckets[NDP.riskLevel(item.score)]++; });

    var colors = {
      Critical: { c: "var(--color-error)", bg: "#FEE2E2" },
      High: { c: "var(--color-warning)", bg: "#FEF3C7" },
      Medium: { c: "var(--color-grey)", bg: "var(--color-grey-100)" },
      Low: { c: "var(--color-green)", bg: "#D1FAE5" }
    };

    ["Critical", "High", "Medium", "Low"].forEach(function (level) {
      var btn = document.createElement("button");
      btn.className = "ndp-risk-btn" + (activeRisks[level] ? " is-active" : "");
      btn.textContent = level + " (" + buckets[level] + ")";
      btn.style.color = colors[level].c;
      if (activeRisks[level]) {
        btn.style.borderColor = colors[level].c;
        btn.style.backgroundColor = colors[level].bg;
      }
      btn.addEventListener("click", function () {
        var activeCount = Object.keys(activeRisks).filter(function (k) { return activeRisks[k]; }).length;
        if (activeRisks[level] && activeCount <= 1) return;
        activeRisks[level] = !activeRisks[level];
        page = 0;
        renderToggles();
        render();
        renderChart();
      });
      el.appendChild(btn);
    });
  }

  function wireEvents() {
    document.getElementById("ndpRiskPrev").addEventListener("click", function () {
      if (page > 0) { page--; render(); }
    });
    document.getElementById("ndpRiskNext").addEventListener("click", function () {
      page++; render();
    });

    // Copy visible rows to clipboard
    document.getElementById("ndpRiskCopy").addEventListener("click", function () {
      var headers = NdpData.state.planHeaders;
      var visible = getVisible();
      if (!visible.length) return;
      var tsv = TABLE_COLS.map(function (c) { return c.label; }).join("\t") + "\n";
      visible.forEach(function (item) {
        tsv += TABLE_COLS.map(function (col) {
          if (col.key === "_RISK") return NDP.riskLevel(item.score);
          if (col.key === "_ALTS") return item.score;
          var ci = headers.indexOf(col.key);
          return ci !== -1 ? (item.row[ci] || "") : "";
        }).join("\t") + "\n";
      });
      navigator.clipboard.writeText(tsv).catch(function () {});
    });

    // Screenshot risk summary
    document.getElementById("ndpRiskScreenshot").addEventListener("click", function () {
      if (typeof html2canvas === "undefined") return;
      var target = panel.querySelector("[style*='flex-direction:column']");
      if (!target) return;
      html2canvas(target, { backgroundColor: "#ffffff", scale: 2 }).then(function (canvas) {
        canvas.toBlob(function (blob) {
          if (!blob) return;
          try {
            navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).catch(function () {
              window.open(URL.createObjectURL(blob), "_blank");
            });
          } catch (e) {
            window.open(URL.createObjectURL(blob), "_blank");
          }
        }, "image/png");
      });
    });
  }

  function getVisible() {
    return scored.filter(function (item) {
      return activeRisks[NDP.riskLevel(item.score)];
    });
  }

  // --- Render table ---
  var TABLE_COLS = [
    { key: "_RISK", label: "Risk" },
    { key: "JOB NO", label: "Task ID" },
    { key: "OUC", label: "OUC" },
    { key: "PWA ID", label: "PWA" },
    { key: "DERISK REASON", label: "De-Risk" },
    { key: "TECH PIN", label: "Tech" },
    { key: "TECH NAME", label: "Name" },
    { key: "CARE LEVEL", label: "Response Code" },
    { key: "_ALTS", label: "Alts" }
  ];

  function render() {
    var headers = NdpData.state.planHeaders;
    var thead = document.getElementById("ndpRiskThead");
    var tbody = document.getElementById("ndpRiskTbody");
    thead.innerHTML = "";
    tbody.innerHTML = "";

    var hr = document.createElement("tr");
    TABLE_COLS.forEach(function (col) {
      var th = document.createElement("th");
      th.textContent = col.label;
      th.style.textAlign = ["JOB NO", "OUC", "PWA ID", "DERISK REASON"].indexOf(col.key) !== -1 ? "left" : "center";
      hr.appendChild(th);
    });
    thead.appendChild(hr);

    var visible = getVisible();
    var totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    if (page >= totalPages) page = totalPages - 1;
    if (page < 0) page = 0;
    var start = page * pageSize;
    var end = Math.min(start + pageSize, visible.length);
    var pageRows = visible.slice(start, end);

    pageRows.forEach(function (item) {
      var tr = document.createElement("tr");
      var level = NDP.riskLevel(item.score);
      TABLE_COLS.forEach(function (col) {
        var td = document.createElement("td");
        if (col.key === "_RISK") {
          td.textContent = level;
          td.style.fontWeight = "var(--font-weight-medium)";
          if (level === "Critical") td.style.color = "var(--color-error)";
          else if (level === "High") td.style.color = "var(--color-warning)";
          else if (level === "Low") td.style.color = "var(--color-green)";
        } else if (col.key === "_ALTS") {
          td.textContent = item.score;
          td.style.fontWeight = "var(--font-weight-medium)";
          td.style.textAlign = "center";
          if (item.score === 0) td.style.color = "var(--color-error)";
          else if (item.score === 1) td.style.color = "var(--color-warning)";
          else td.style.color = "var(--color-green)";
        } else {
          var ci = headers.indexOf(col.key);
          td.textContent = ci !== -1 ? (item.row[ci] || "") : "";
          td.style.textAlign = ["JOB NO", "OUC", "PWA ID", "DERISK REASON"].indexOf(col.key) !== -1 ? "left" : "center";
          if (col.key === "JOB NO" || col.key === "OUC") td.style.fontWeight = "var(--font-weight-medium)";
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    document.getElementById("ndpRiskCount").textContent = visible.length + " tasks";
    document.getElementById("ndpRiskRange").textContent = visible.length
      ? (start + 1) + "\u2013" + end + " of " + visible.length
      : "0 of 0";
    document.getElementById("ndpRiskPrev").disabled = page === 0;
    document.getElementById("ndpRiskNext").disabled = page >= totalPages - 1;

    renderChart();
  }

  // --- Skill Scarcity Chart ---
  function renderChart() {
    var container = document.getElementById("ndpScarcityChart");
    var visible = getVisible();
    if (!visible.length) { container.innerHTML = ""; return; }

    var headers = NdpData.state.planHeaders;
    var skillIdx = headers.indexOf("DERISK REASON");
    var pwaIdx = headers.indexOf("PWA ID");

    var comboMap = {};
    visible.forEach(function (item) {
      var skill = skillIdx !== -1 ? (item.row[skillIdx] || "").trim() : "";
      var pwa = pwaIdx !== -1 ? (item.row[pwaIdx] || "").trim() || "(blank)" : "(blank)";
      if (!skill) return;
      var key = skill + "|" + pwa;
      if (!comboMap[key]) comboMap[key] = { skill: skill, pwa: pwa, tasks: 0, minAlts: Infinity };
      comboMap[key].tasks++;
      if (item.score < comboMap[key].minAlts) comboMap[key].minAlts = item.score;
    });

    var combos = Object.keys(comboMap).map(function (k) { return comboMap[k]; });
    combos.sort(function (a, b) {
      if (a.minAlts !== b.minAlts) return a.minAlts - b.minAlts;
      return b.tasks - a.tasks;
    });

    var maxTasks = combos.reduce(function (m, c) { return Math.max(m, c.tasks); }, 1);

    var html = '<div style="font-size:var(--text-caption);font-weight:var(--font-weight-medium);margin-bottom:var(--spacing-2);color:var(--color-grey)">Skill Scarcity by PWA</div>';
    combos.slice(0, 20).forEach(function (d) {
      var pct = Math.max(4, Math.round(d.tasks / maxTasks * 100));
      var level = NDP.riskLevel(d.minAlts);
      var color = level === "Critical" ? "var(--color-error)"
                : level === "High" ? "var(--color-warning)"
                : "var(--color-green)";
      html += '<div class="ndp-bar-row">' +
        '<span class="ndp-bar-row__label">' + NDP.escapeHtml(d.skill) + '</span>' +
        '<span class="ndp-bar-row__pwa">' + NDP.escapeHtml(d.pwa) + '</span>' +
        '<div class="ndp-bar-row__track"><div class="ndp-bar-row__fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
        '<span class="ndp-bar-row__meta" style="color:' + color + '">' + d.tasks + ' \u00b7 ' + d.minAlts + ' alt' + (d.minAlts !== 1 ? 's' : '') + '</span>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  return { init: init };
})();
