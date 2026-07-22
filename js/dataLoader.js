"use strict";

const DataLoader = (() => {
  let snapshots = [];
  let index = null; // Map<JIN_ID, sorted rows[]>

  // Pre-allocate header index for fast column access
  let _headers = [];
  let _jinCol = -1;
  let _recordTimeCol = -1;

  function parseCSV(text) {
    const nlCode = 10; // \n
    const len = text.length;

    // Find header line end
    let hEnd = text.indexOf("\n");
    if (hEnd === -1) hEnd = len;
    const headerLine = text.substring(0, hEnd);
    _headers = headerLine.split(",");
    const hLen = _headers.length;
    for (let i = 0; i < hLen; i++) {
      _headers[i] = _headers[i].trim();
      if (_headers[i] === "JIN_ID") _jinCol = i;
      if (_headers[i] === "RECORD_TIME_BT" || _headers[i] === "RECORD_TIME") _recordTimeCol = i;
    }

    // Parse rows — avoid creating substrings where possible
    const rows = [];
    let pos = hEnd + 1;

    while (pos < len) {
      // Find line end
      let lineEnd = text.indexOf("\n", pos);
      if (lineEnd === -1) lineEnd = len;

      // Skip empty lines
      if (lineEnd === pos || (lineEnd === pos + 1 && text.charCodeAt(pos) === 13)) {
        pos = lineEnd + 1;
        continue;
      }

      const line = text.substring(pos, lineEnd);
      const values = line.split(",");
      const row = {};
      for (let j = 0; j < hLen; j++) {
        row[_headers[j]] = values[j] !== undefined ? values[j].trim() : "";
      }
      rows.push(row);
      pos = lineEnd + 1;
    }

    return rows;
  }

  function parseDate(str) {
    if (!str || str === "31/12/9999 00:00") return null;
    const d1 = str.charCodeAt(0) - 48, d2 = str.charCodeAt(1) - 48;
    const m1 = str.charCodeAt(3) - 48, m2 = str.charCodeAt(4) - 48;
    const y1 = str.charCodeAt(6) - 48, y2 = str.charCodeAt(7) - 48, y3 = str.charCodeAt(8) - 48, y4 = str.charCodeAt(9) - 48;
    const h1 = str.charCodeAt(11) - 48, h2 = str.charCodeAt(12) - 48;
    const mi1 = str.charCodeAt(14) - 48, mi2 = str.charCodeAt(15) - 48;
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
    const len = snapshots.length;
    for (let i = 0; i < len; i++) {
      const row = snapshots[i];
      const id = (row.JIN_ID || "").toUpperCase();
      if (!id) continue;
      let arr = index.get(id);
      if (!arr) { arr = []; index.set(id, arr); }
      arr.push(row);
    }
    // Sort each group by record time
    index.forEach((rows) => {
      if (rows.length < 2) return;
      rows.sort((a, b) => {
        const da = parseDate(a.RECORD_TIME_BT || a.RECORD_TIME);
        const db = parseDate(b.RECORD_TIME_BT || b.RECORD_TIME);
        if (!da || !db) return 0;
        return da - db;
      });
    });
  }

  function loadFromText(text) {
    const rows = parseCSV(text);
    if (snapshots.length === 0) {
      snapshots = rows;
    } else {
      snapshots = snapshots.concat(rows);
    }
    index = null;
    return rows.length;
  }

  /**
   * Async chunked load — parses in batches to keep UI responsive.
   * Returns a Promise that resolves with row count.
   */
  function loadFromTextAsync(text, onProgress) {
    return new Promise((resolve) => {
      const rows = parseCSV(text);
      const total = rows.length;
      const CHUNK = 8000;
      let offset = 0;

      function processChunk() {
        const end = Math.min(offset + CHUNK, total);
        for (let i = offset; i < end; i++) {
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
    let total = 0;
    texts.forEach((t) => (total += loadFromText(t)));
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
    const results = [];
    for (let i = 0; i < jinIds.length; i++) {
      const rows = index.get(jinIds[i].trim().toUpperCase());
      if (rows) for (let j = 0; j < rows.length; j++) results.push(rows[j]);
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
    loadFromText,
    loadFromTextAsync,
    loadMultiple,
    clear,
    queryByJinIds,
    getAllSnapshots: getSnapshots,
    getSnapshots,
    getUniqueJinIds,
    parseDate
  };
})();
