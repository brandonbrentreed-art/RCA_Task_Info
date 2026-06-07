"use strict";

const DataLoader = (() => {
  let snapshots = [];

  function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",");
    return lines.slice(1).map((line) => {
      const values = line.split(",");
      const row = {};
      headers.forEach((h, i) => (row[h.trim()] = (values[i] || "").trim()));
      return row;
    });
  }

  function parseDate(str) {
    if (!str || str === "31/12/9999 00:00") return null;
    const [datePart, timePart] = str.split(" ");
    const [d, m, y] = datePart.split("/");
    return new Date(`${y}-${m}-${d}T${timePart}:00`);
  }

  function loadFromText(text) {
    const rows = parseCSV(text);
    snapshots = snapshots.concat(rows);
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
  }

  function queryByJinIds(jinIds) {
    const ids = new Set(jinIds.map((id) => id.trim().toUpperCase()));
    return snapshots
      .filter((row) => ids.has(row.JIN_ID?.toUpperCase()))
      .sort((a, b) => {
        const da = parseDate(a.RECORD_TIME_BT || a.RECORD_TIME);
        const db = parseDate(b.RECORD_TIME_BT || b.RECORD_TIME);
        if (!da || !db) return 0;
        return da - db;
      });
  }

  function getAllSnapshots() {
    return snapshots;
  }

  return { loadFromText, loadMultiple, clear, queryByJinIds, getAllSnapshots, parseDate };
})();
