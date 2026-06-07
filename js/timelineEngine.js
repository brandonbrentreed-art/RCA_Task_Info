"use strict";

const TimelineEngine = (() => {
  const INTERVAL_MS = 15 * 60 * 1000;

  function bucketKey(date) {
    const floored = new Date(Math.floor(date.getTime() / INTERVAL_MS) * INTERVAL_MS);
    return floored.toISOString();
  }

  function formatTime(date) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function buildTimeline(rows) {
    const buckets = new Map();

    rows.forEach((row) => {
      const dt = DataLoader.parseDate(row.RECORD_TIME_BT || row.RECORD_TIME);
      if (!dt) return;
      const key = bucketKey(dt);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(row);
    });

    const intervals = [];
    let prev = null;

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

    const sortedKeys = Array.from(buckets.keys()).sort();
    sortedKeys.forEach((key) => {
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

      intervals.push(entry);
      prev = entry;
    });

    return { intervals, taskInfo };
  }

  function buildMultipleTimelines(jinIds) {
    const results = {};
    jinIds.forEach((id) => {
      const rows = DataLoader.queryByJinIds([id]);
      if (rows.length) results[id] = buildTimeline(rows);
    });
    return results;
  }

  return { buildTimeline, buildMultipleTimelines };
})();
