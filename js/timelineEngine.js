"use strict";

const TimelineEngine = (() => {
  const INTERVAL_MS = 15 * 60 * 1000;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function bucketKey(date) {
    return Math.floor(date.getTime() / INTERVAL_MS) * INTERVAL_MS;
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function formatTime(date) {
    return pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  function formatDate(date) {
    return pad2(date.getDate()) + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
  }

  function buildTimeline(rows) {
    // Bucket by 15-min key (numeric timestamp)
    const buckets = new Map();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const dt = DataLoader.parseDate(row.RECORD_TIME_BT || row.RECORD_TIME);
      if (!dt) continue;
      const key = bucketKey(dt);
      let arr = buckets.get(key);
      if (!arr) { arr = []; buckets.set(key, arr); }
      arr.push(row);
    }

    const first = rows[0] || {};
    const taskInfo = {
      jinId: first.JIN_ID || "",
      skillCode: first.SKILL_CODE || "",
      appointmentSlot: first.APPOINTMENT_SLOT || "",
      commitmentTime: first.COMMITMENT_TIME_BT || first.COMMITMENT_TIME || "",
      taskType: first.TASK_TYPE || "",
      exchangeGroup: first.EXCHANGE_GROUP || "",
      zoneCode: first.ZONE_CODE || "",
      careLevel: first.CARE_LEVEL || "",
      customerType: first.CUSTOMER_TYPE || "",
      cugId: first.CUG_ID || ""
    };

    // Sort bucket keys numerically
    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
    const intervals = new Array(sortedKeys.length);
    let prev = null;

    for (let k = 0; k < sortedKeys.length; k++) {
      const key = sortedKeys[k];
      const records = buckets.get(key);
      const latest = records[records.length - 1];
      const dt = new Date(key);

      const entry = {
        time: formatTime(dt),
        date: formatDate(dt),
        timestamp: dt,
        status: latest.TASK_STATUS,
        techId: latest.TECH_ID,
        workManager: latest.WORK_MANAGER_ID,
        commitmentTime: latest.COMMITMENT_TIME_BT || latest.COMMITMENT_TIME,
        estimatedStart: latest.ESTIMATED_START_TIME_BT || latest.ESTIMATED_START_TIME,
        earliestCompletion: latest.EARLIEST_COMPLETION_TIME_BT || "",
        latestCompletion: latest.LATEST_COMPLETION_TIME_BT || "",
        skillCode: latest.SKILL_CODE,
        priority: latest.PRIORITY_SCORE,
        importance: latest.IMPORTANCE_SCORE,
        appointmentSlot: latest.APPOINTMENT_SLOT,
        pinStatus: latest.PIN_STATUS || "",
        taskState: latest.TASK_STATE || "",
        colocated: latest.COLOCATED_INDICATOR || "",
        prePinned: latest.PRE_PINNED || "",
        tourStatus: latest.TOUR_STATUS || "",
        cugId: latest.CUG_ID || "",
        changes: []
      };

      if (prev) {
        if (prev.status !== entry.status) entry.changes.push({ field: "Status", from: prev.status, to: entry.status });
        if (prev.techId !== entry.techId) entry.changes.push({ field: "Tech", from: prev.techId, to: entry.techId });
        if (prev.workManager !== entry.workManager) entry.changes.push({ field: "WM", from: prev.workManager, to: entry.workManager });
        if (prev.pinStatus !== entry.pinStatus) entry.changes.push({ field: "Pin", from: prev.pinStatus, to: entry.pinStatus });
        if (prev.taskState !== entry.taskState) entry.changes.push({ field: "State", from: prev.taskState, to: entry.taskState });
      }

      // SLA check
      const slaDate = DataLoader.parseDate(latest.COMMITMENT_TIME_BT || latest.COMMITMENT_TIME);
      if (slaDate) {
        const diff = slaDate - dt;
        entry.slaMins = Math.round(diff / 60000);
        entry.slaBreached = diff <= 0;
      }

      intervals[k] = entry;
      prev = entry;
    }

    return { intervals, taskInfo };
  }

  function buildMultipleTimelines(jinIds) {
    const results = {};
    for (let i = 0; i < jinIds.length; i++) {
      const id = jinIds[i];
      const rows = DataLoader.queryByJinIds([id]);
      if (rows.length) results[id] = buildTimeline(rows);
    }
    return results;
  }

  return { buildTimeline, buildMultipleTimelines };
})();
