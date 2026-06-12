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
            '<button class="icon-btn icon-btn--sm tooltip" id="ndpRiskCopy" data-tooltip="Copy table"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button>' +
            '<button class="icon-btn icon-btn--sm tooltip" id="ndpRiskScreenshot" data-tooltip="Screenshot to clipboard"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3.2"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg></button>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex:1;min-height:0;gap:var(--spacing-4)">' +
          '<div style="flex:2;min-height:0;display:flex;flex-direction:column">' +
            '<div class="table-wrapper--flex">' +
              '<div class="table-scroll">' +
                '<table class="table" id="ndpRiskTbl">' +
                  '<thead id="ndpRiskThead"></thead>' +
                  '<tbody id="ndpRiskTbody"></tbody>' +
                '</table>' +
              '</div>' +
              '<div class="table-pagination pagination-footer" id="ndpRiskPager">' +
                '<span class="table-pagination__label">Rows per page:</span>' +
                '<select class="table-pagination__select" id="ndpRiskPageSize">' +
                  '<option value="30" selected>30</option>' +
                  '<option value="50">50</option>' +
                  '<option value="100">100</option>' +
                '</select>' +
                '<span class="table-pagination__range" id="ndpRiskRange"></span>' +
                '<button id="ndpRiskPrev" disabled><svg viewBox="0 0 24 24" fill="currentColor" style="width:var(--size-icon-sm);height:var(--size-icon-sm)"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>' +
                '<button id="ndpRiskNext" disabled><svg viewBox="0 0 24 24" fill="currentColor" style="width:var(--size-icon-sm);height:var(--size-icon-sm)"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="ndp-scarcity" id="ndpScarcityChart">' +
            '<div class="ndp-scarcity__header">Skill Scarcity</div>' +
            '<div class="ndp-scarcity__list"></div>' +
          '</div>' +
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
    document.getElementById("ndpRiskPageSize").addEventListener("change", function (e) {
      pageSize = parseInt(e.target.value, 10);
      page = 0;
      render();
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
      navigator.clipboard.writeText(tsv).then(function () {
        Notify.success("Copied " + visible.length + " rows", 2000);
      }).catch(function () {});
    });

    // Screenshot risk summary (same format as WMS)
    document.getElementById("ndpRiskScreenshot").addEventListener("click", function () {
      if (typeof html2canvas === "undefined") return;

      var headers = NdpData.state.planHeaders;
      var oucIdx = headers.indexOf("OUC");
      var pwaIdx = headers.indexOf("PWA ID");
      var skillIdx = headers.indexOf("DERISK REASON");
      var totalJobs = NdpData.state.planRows.length;

      // Bucket counts
      var buckets = { Critical: [], High: [], Medium: [], Low: [] };
      scored.forEach(function (item) { buckets[NDP.riskLevel(item.score)].push(item); });

      // Build PWA-level summary from Critical + High
      var screenshotRows = buckets.Critical.concat(buckets.High);
      var pwaRisk = {};
      screenshotRows.forEach(function (item) {
        var pwa = pwaIdx !== -1 ? (item.row[pwaIdx] || "").trim() || "(blank)" : "(blank)";
        var ouc = oucIdx !== -1 ? (item.row[oucIdx] || "").trim() : "";
        var skill = skillIdx !== -1 ? (item.row[skillIdx] || "").trim() : "";
        var level = NDP.riskLevel(item.score);
        var key = pwa + "|" + ouc;
        if (!pwaRisk[key]) pwaRisk[key] = { pwa: pwa, ouc: ouc, critical: 0, high: 0, skills: {} };
        if (level === "Critical") pwaRisk[key].critical++;
        else pwaRisk[key].high++;
        if (skill) pwaRisk[key].skills[skill] = (pwaRisk[key].skills[skill] || 0) + 1;
      });

      var pwaList = Object.keys(pwaRisk).map(function (k) { return pwaRisk[k]; });
      pwaList.sort(function (a, b) {
        if (a.critical !== b.critical) return b.critical - a.critical;
        return b.high - a.high;
      });

      // Build offscreen report
      var report = document.createElement("div");
      report.style.cssText = "position:fixed;top:-9999px;left:0;width:680px;padding:24px;background:#fff;font-family:Roboto,Segoe UI,sans-serif;color:#0D1117;";
      document.body.appendChild(report);

      var dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });

      report.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #142032">' +
          '<div><div style="font-size:15px;font-weight:600;color:#142032">Pre-Plan Risk Summary</div><div style="font-size:10px;color:#57606A;margin-top:2px">' + dateStr + '</div></div>' +
          '<div style="font-size:10px;color:#57606A">' + totalJobs + ' tasks</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:12px">' +
          '<div style="flex:1;background:#FEE2E2;border-radius:4px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:700;color:#D32F2F">' + buckets.Critical.length + '</div><div style="font-size:8px;color:#7F1D1D;text-transform:uppercase">Critical</div></div>' +
          '<div style="flex:1;background:#FEF3C7;border-radius:4px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:700;color:#D97706">' + buckets.High.length + '</div><div style="font-size:8px;color:#78350F;text-transform:uppercase">High</div></div>' +
          '<div style="flex:1;background:#F3F4F6;border-radius:4px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:600">' + buckets.Medium.length + '</div><div style="font-size:8px;color:#57606A;text-transform:uppercase">Medium</div></div>' +
          '<div style="flex:1;background:#D1FAE5;border-radius:4px;padding:6px;text-align:center"><div style="font-size:16px;font-weight:600;color:#059669">' + buckets.Low.length + '</div><div style="font-size:8px;color:#064E3B;text-transform:uppercase">Low</div></div>' +
        '</div>';

      if (pwaList.length) {
        var t = '<table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr>';
        t += '<th style="padding:4px 8px;background:#142032;color:#fff;font-weight:500;text-align:left">PWA</th>';
        t += '<th style="padding:4px 8px;background:#142032;color:#fff;font-weight:500;text-align:left">OUC</th>';
        t += '<th style="padding:4px 8px;background:#142032;color:#fff;font-weight:500;text-align:center">Critical</th>';
        t += '<th style="padding:4px 8px;background:#142032;color:#fff;font-weight:500;text-align:center">High</th>';
        t += '<th style="padding:4px 8px;background:#142032;color:#fff;font-weight:500;text-align:left">Scarce Skills</th>';
        t += '</tr></thead><tbody>';
        pwaList.forEach(function (p, i) {
          var bg = i % 2 === 0 ? "#fff" : "#F9FAFB";
          var topSkills = Object.keys(p.skills).sort(function (a, b) { return p.skills[b] - p.skills[a]; }).slice(0, 3).join(", ");
          t += '<tr>';
          t += '<td style="padding:3px 8px;border-bottom:1px solid #E5E7EB;background:' + bg + ';text-align:left;font-weight:600">' + NDP.escapeHtml(p.pwa) + '</td>';
          t += '<td style="padding:3px 8px;border-bottom:1px solid #E5E7EB;background:' + bg + ';text-align:left">' + NDP.escapeHtml(p.ouc) + '</td>';
          t += '<td style="padding:3px 8px;border-bottom:1px solid #E5E7EB;background:' + bg + ';text-align:center;color:' + (p.critical ? '#D32F2F;font-weight:700' : '#57606A') + '">' + p.critical + '</td>';
          t += '<td style="padding:3px 8px;border-bottom:1px solid #E5E7EB;background:' + bg + ';text-align:center;color:' + (p.high ? '#D97706;font-weight:600' : '#57606A') + '">' + p.high + '</td>';
          t += '<td style="padding:3px 8px;border-bottom:1px solid #E5E7EB;background:' + bg + ';text-align:left;color:#57606A">' + NDP.escapeHtml(topSkills) + '</td>';
          t += '</tr>';
        });
        t += '</tbody></table>';
        report.innerHTML += t;
      } else {
        report.innerHTML += '<div style="padding:14px;text-align:center;color:#059669;font-weight:600">\u2705 No Critical or High risk items</div>';
      }

      html2canvas(report, { backgroundColor: "#ffffff", scale: 2 }).then(function (canvas) {
        document.body.removeChild(report);
        canvas.toBlob(function (blob) {
          if (!blob) return;
          try {
            navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(function () {
              Notify.success("Screenshot copied to clipboard", 2000);
            }).catch(function () {
              window.open(URL.createObjectURL(blob), "_blank");
            });
          } catch (e) {
            window.open(URL.createObjectURL(blob), "_blank");
          }
        }, "image/png");
      }).catch(function () { document.body.removeChild(report); });
    });
  }

  var searchQuery = "";

  function getVisible() {
    var filtered = scored.filter(function (item) {
      return activeRisks[NDP.riskLevel(item.score)];
    });
    if (searchQuery) {
      var headers = NdpData.state.planHeaders;
      filtered = filtered.filter(function (item) {
        for (var i = 0; i < item.row.length; i++) {
          if ((item.row[i] || "").toUpperCase().indexOf(searchQuery) !== -1) return true;
        }
        // Also match risk level text
        if (NDP.riskLevel(item.score).toUpperCase().indexOf(searchQuery) !== -1) return true;
        return false;
      });
    }
    return filtered;
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

    document.getElementById("ndpRiskRange").textContent = visible.length
      ? (start + 1) + "\u2013" + end + " of " + visible.length
      : "0 of 0";
    document.getElementById("ndpRiskPrev").disabled = page === 0;
    document.getElementById("ndpRiskNext").disabled = page >= totalPages - 1;

    renderChart();
  }

  // --- Skill Scarcity Chart ---
  function renderChart() {
    var container = document.querySelector("#ndpScarcityChart .ndp-scarcity__list");
    if (!container) return;
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

    var html = "";
    combos.slice(0, 15).forEach(function (d) {
      var pct = Math.max(4, Math.round(d.tasks / maxTasks * 100));
      var level = NDP.riskLevel(d.minAlts);
      var color = level === "Critical" ? "var(--color-error)"
                : level === "High" ? "var(--color-warning)"
                : "var(--color-green)";
      html += '<div class="ndp-scarcity__row">' +
        '<div class="ndp-scarcity__info">' +
          '<span class="ndp-scarcity__skill">' + NDP.escapeHtml(d.skill) + '</span>' +
          '<span class="ndp-scarcity__pwa">' + NDP.escapeHtml(d.pwa) + '</span>' +
        '</div>' +
        '<div class="ndp-scarcity__bar">' +
          '<div class="ndp-scarcity__fill" style="width:' + pct + '%;background:' + color + '"></div>' +
        '</div>' +
        '<span class="ndp-scarcity__meta" style="color:' + color + '">' + d.tasks + ' task' + (d.tasks !== 1 ? 's' : '') + ', ' + d.minAlts + ' cover</span>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  return {
    init: init,
    setSearch: function (query) {
      searchQuery = query;
      page = 0;
      if (scored.length) render();
    }
  };
})();
