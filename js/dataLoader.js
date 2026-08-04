"use strict";

// ============================================================
// dataLoader.js — RCA snapshot loader
// Parses CSV snapshots, builds a JIN_ID index, supports
// chunked async loading for large files.
// ============================================================

var DataLoader = (function () {
  var snapshots = [];
  var index = null; // Map<JIN_ID, sorted rows[]>
  var _headers = [];

  function parseCSV(text) {
    var len = text.length;

    // Find header line end
    var hEnd = text.indexOf("\n");
    if (hEnd === -1) hEnd = len;
    var headerLine = text.substring(0, hEnd);
    _headers = headerLine.split(",");
    var hLen = _headers.length;
    for (var i = 0; i < hLen; i++) {
      _headers[i] = _headers[i].trim();
    }

    // Parse rows
    var rows = [];
    var pos = hEnd + 1;

    while (pos < len) {
      var lineEnd = text.indexOf("\n", pos);
      if (lineEnd === -1) lineEnd = len;

      // Skip empty lines
      if (lineEnd === pos || (lineEnd === pos + 1 && text.charCodeAt(pos) === 13)) {
        pos = lineEnd + 1;
        continue;
      }

      var line = text.substring(pos, lineEnd);
      var values = line.split(",");
      var row = {};
      for (var j = 0; j < hLen; j++) {
        row[_headers[j]] = values[j] !== undefined ? values[j].trim() : "";
      }
      rows.push(row);
      pos = lineEnd + 1;
    }

    return rows;
  }

  function parseDate(str) {
    if (!str || str === "31/12/9999 00:00") return null;
    var d1 = str.charCodeAt(0) - 48, d2 = str.charCodeAt(1) - 48;
    var m1 = str.charCodeAt(3) - 48, m2 = str.charCodeAt(4) - 48;
    var y1 = str.charCodeAt(6) - 48, y2 = str.charCodeAt(7) - 48,
        y3 = str.charCodeAt(8) - 48, y4 = str.charCodeAt(9) - 48;
    var h1 = str.charCodeAt(11) - 48, h2 = str.charCodeAt(12) - 48;
    var mi1 = str.charCodeAt(14) - 48, mi2 = str.charCodeAt(15) - 48;
    return new Date(
      y1 * 1000 + y2 * 100 + y3 * 10 + y4,
      m1 * 10 + m2 - 1,
      d1 * 10 + d2,
      h1 * 10 + h2,
      mi1 * 10 + mi2
    );
  }

  function buildIndex() {
    index = new Map();
    var len = snapshots.length;
    for (var i = 0; i < len; i++) {
      var row = snapshots[i];
      var id = (row.JIN_ID || "").toUpperCase();
      if (!id) continue;
      var arr = index.get(id);
      if (!arr) { arr = []; index.set(id, arr); }
      arr.push(row);
    }
    // Sort each group by record time
    index.forEach(function (rows) {
      if (rows.length < 2) return;
      rows.sort(function (a, b) {
        var da = parseDate(a.RECORD_TIME_BT || a.RECORD_TIME);
        var db = parseDate(b.RECORD_TIME_BT || b.RECORD_TIME);
        if (!da || !db) return 0;
        return da - db;
      });
    });
  }

  function loadFromText(text) {
    var rows = parseCSV(text);
    snapshots = snapshots.concat(rows);
    index = null;
    return rows.length;
  }

  // Async chunked load — parses in batches to keep UI responsive.
  // Returns a Promise that resolves with row count.
  function loadFromTextAsync(text, onProgress) {
    // Null index at start so any mid-load query forces a full rebuild
    index = null;
    return new Promise(function (resolve) {
      var rows = parseCSV(text);
      var total = rows.length;
      var CHUNK = 8000;
      var offset = 0;

      function processChunk() {
        var end = Math.min(offset + CHUNK, total);
        for (var i = offset; i < end; i++) {
          snapshots.push(rows[i]);
        }
        offset = end;
        if (onProgress) onProgress(offset, total);

        if (offset < total) {
          setTimeout(processChunk, 0);
        } else {
          index = null;
          resolve(total);
        }
      }

      processChunk();
    });
  }

  function loadMultiple(texts) {
    snapshots = [];
    var total = 0;
    for (var i = 0; i < texts.length; i++) {
      total += loadFromText(texts[i]);
    }
    return total;
  }

  function clear() {
    snapshots = [];
    index = null;
  }

  function queryByJinIds(jinIds) {
    if (!index) buildIndex();
    if (jinIds.length === 1) {
      return index.get(jinIds[0].trim().toUpperCase()) || [];
    }
    var results = [];
    for (var i = 0; i < jinIds.length; i++) {
      var rows = index.get(jinIds[i].trim().toUpperCase());
      if (rows) {
        for (var j = 0; j < rows.length; j++) results.push(rows[j]);
      }
    }
    return results;
  }

  function getSnapshots() {
    return snapshots;
  }

  function getUniqueJinIds() {
    if (!index) buildIndex();
    return Array.from(index.keys());
  }

  return {
    loadFromText: loadFromText,
    loadFromTextAsync: loadFromTextAsync,
    loadMultiple: loadMultiple,
    clear: clear,
    queryByJinIds: queryByJinIds,
    getSnapshots: getSnapshots,
    getUniqueJinIds: getUniqueJinIds,
    parseDate: parseDate
  };
})();
