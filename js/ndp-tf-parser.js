"use strict";

// ============================================================
// ndp-tf-parser.js — Taskforce clipboard parsing
// Ported from WMS_PrePlan_Manager/js/taskforce-parser.js
// Parses HTML or text clipboard into { headers: [], rows: [] }
// ============================================================

var TF_PARSER = (function () {
  var SKIP_ROWS = NDP.SKIP_ROWS;
  var MAX_CELL = NDP.MAX_CELL;
  var WANTED_LOWER = [
    "unique task id", "task status", "start by", "complete by",
    "importance score", "task type", "skill", "designated resource id"
  ];

  function clean(s) {
    return typeof s === "string" ? s.trim().replace(/\s+/g, " ").slice(0, MAX_CELL) : "";
  }

  // Check if a row of cells is a Taskforce header row
  function isHeaderRow(cells) {
    var cellsLower = cells.map(function (c) { return c.toLowerCase().trim(); });
    var hits = WANTED_LOWER.filter(function (w) { return cellsLower.indexOf(w) !== -1; }).length;
    return hits >= 2;
  }

  // Extract data rows from TR elements starting at startIdx
  function extractDataRows(trs, startIdx) {
    var rows = [];
    for (var i = startIdx; i < trs.length; i++) {
      var cells = Array.from(trs[i].querySelectorAll(":scope > td, :scope > th")).map(function (c) {
        return clean(c.textContent);
      });
      if (cells.length > 0) rows.push(cells);
    }
    return rows;
  }

  // Parse HTML clipboard into { headers: [], rows: [] } or null
  function parseHtml(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var srcHeaders = null;
    var dataRows = [];

    // Try each table with :scope selectors
    var tables = Array.from(doc.querySelectorAll("table"));
    for (var tb = 0; tb < tables.length; tb++) {
      var trs = Array.from(tables[tb].querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr"));
      if (trs.length < SKIP_ROWS + 2) continue;

      for (var r = SKIP_ROWS; r < Math.min(trs.length, SKIP_ROWS + 10); r++) {
        var cells = Array.from(trs[r].querySelectorAll(":scope > td, :scope > th")).map(function (c) {
          return clean(c.textContent);
        });
        if (isHeaderRow(cells)) {
          srcHeaders = cells;
          dataRows = extractDataRows(trs, r + 1);
          break;
        }
      }
      if (srcHeaders) break;
    }

    // Fallback: scan all TRs
    if (!srcHeaders) {
      var allTrs = Array.from(doc.querySelectorAll("tr"));
      for (var a = SKIP_ROWS; a < allTrs.length; a++) {
        var aCells = Array.from(allTrs[a].querySelectorAll(":scope > td, :scope > th")).map(function (c) {
          return clean(c.textContent);
        });
        if (isHeaderRow(aCells)) {
          srcHeaders = aCells;
          dataRows = extractDataRows(allTrs, a + 1);
          break;
        }
      }
    }

    // Also try from row 0 if nothing found after SKIP
    if (!srcHeaders) {
      var allTrs2 = Array.from(doc.querySelectorAll("tr"));
      for (var b = 0; b < Math.min(allTrs2.length, 20); b++) {
        var bCells = Array.from(allTrs2[b].querySelectorAll(":scope > td, :scope > th")).map(function (c) {
          return clean(c.textContent);
        });
        if (isHeaderRow(bCells)) {
          srcHeaders = bCells;
          dataRows = extractDataRows(allTrs2, b + 1);
          break;
        }
      }
    }

    if (!srcHeaders || dataRows.length === 0) return null;

    // Drop last row if it's just a timestamp
    var lastRow = dataRows[dataRows.length - 1];
    var filledCells = lastRow.filter(function (c) { return c !== ""; }).length;
    if (filledCells <= 1) dataRows.pop();

    return { headers: srcHeaders, rows: dataRows };
  }

  // Parse plain text (TSV) clipboard into { headers: [], rows: [] } or null
  function parseText(text) {
    var lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var allRows = [];
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i]) continue;
      allRows.push(lines[i].split("\t").map(clean));
    }

    var srcHeaders = null;
    var headerIdx = -1;
    for (var h = SKIP_ROWS; h < Math.min(allRows.length, SKIP_ROWS + 10); h++) {
      if (h >= allRows.length) break;
      if (isHeaderRow(allRows[h])) {
        srcHeaders = allRows[h];
        headerIdx = h;
        break;
      }
    }

    // Also try from row 0 if not found after SKIP
    if (!srcHeaders) {
      for (var h2 = 0; h2 < Math.min(allRows.length, 20); h2++) {
        if (isHeaderRow(allRows[h2])) {
          srcHeaders = allRows[h2];
          headerIdx = h2;
          break;
        }
      }
    }

    if (!srcHeaders) return null;

    var dataRows = allRows.slice(headerIdx + 1);

    // Drop last row if it's just a timestamp
    if (dataRows.length > 0) {
      var lastRow = dataRows[dataRows.length - 1];
      var filledCells = lastRow.filter(function (c) { return c !== ""; }).length;
      if (filledCells <= 1) dataRows.pop();
    }

    if (dataRows.length === 0) return null;
    return { headers: srcHeaders, rows: dataRows };
  }

  // Parse from a paste event (no permission prompt needed)
  function parseFromPaste(e) {
    if (!e || !e.clipboardData) return null;
    var html = e.clipboardData.getData("text/html");
    var text = e.clipboardData.getData("text/plain");

    // Try HTML first
    if (html && html.trim().length > 50) {
      var result = parseHtml(html);
      if (result) return result;
    }

    // Fallback to plain text
    if (text && text.trim().length > 50) {
      return parseText(text);
    }

    return null;
  }

  return {
    parseHtml: parseHtml,
    parseText: parseText,
    parseFromPaste: parseFromPaste,
    isHeaderRow: isHeaderRow,
    clean: clean
  };
})();
