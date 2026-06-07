"use strict";

const DataLoader = (() => {
  let snapshots = [];
  let index = null; // Map<JIN_ID, sorted rows[]>

  function parseCSV(text) {
    const lines = text.split("\n");
    const headerLine = lines[0];
    if (!headerLine) return [];
    const headers = headerLine.split(",");
    const hLen = headers.length;
    for (let i = 0; i < hLen; i++) headers[i] = headers[i].trim();

    const rows = new Array(lines.length - 1);
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const values = line.split(",");
      const row = {};
      for (let j = 0; j < hLen; j++) row[headers[j]] = (values[j] || "").trim();
      rows[count++] = row;
    }
    rows.length = count;
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

  function invalidateIndex() {
    index = null;
  }

  function buildIndex() {
    index = new Map();
    for (let i = 0; i < snapshots.length; i++) {
      const row = snapshots[i];
      const id = (row.JIN_ID || "").toUpperCase();
      if (!id) continue;
      let arr = index.get(id);
      if (!arr) { arr = []; index.set(id, arr); }
      arr.push(row);
    }
    // Sort each group by record time
    index.forEach((rows) => {
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
    snapshots = snapshots.concat(rows);
    invalidateIndex();
    return rows.length;
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

  function getAllSnapshots() {
    return snapshots;
  }

  return { loadFromText, loadMultiple, clear, queryByJinIds, getAllSnapshots, parseDate };
})();
