"use strict";

const TimelineRenderer = (() => {
  const STATUS_COLOURS = {
    AWI: "var(--color-blue)",
    ACT: "var(--color-green)",
    CAN: "var(--color-error)",
    HLD: "var(--color-warning)",
    HPD: "var(--color-grey)",
    ISS: "var(--color-navy)",
  };

  const PIVOT_PAGE_SIZE_OPTIONS = [30, 60, 90];
  const DETAIL_PAGE_SIZE_OPTIONS = [30, 60, 90];
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let pivotState = { page: 0, pageSize: 30, timelinesMap: null, container: null };

  function statusColour(status) {
    return STATUS_COLOURS[status] || "var(--color-grey-300)";
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function fmtHeaderDate(dt) {
    return pad2(dt.getDate()) + " " + MONTHS_SHORT[dt.getMonth()];
  }

  function fmtHeaderTime(dt) {
    return pad2(dt.getHours()) + ":" + pad2(dt.getMinutes());
  }

  function renderAll(timelinesMap, container) {
    pivotState.timelinesMap = timelinesMap;
    pivotState.container = container;
    pivotState.page = 0;
    renderPivotPage();
  }

  function renderPivotPage() {
    const { timelinesMap, container, page, pageSize } = pivotState;
    container.innerHTML = "";

    const ids = Object.keys(timelinesMap);
    if (!ids.length) {
      container.innerHTML = `<p class="text-body2" style="color:var(--color-grey-light)">No results. Check your JIN IDs and ensure data is loaded.</p>`;
      return;
    }

    const pagedIds = ids.slice(page * pageSize, (page + 1) * pageSize);

    // Collect timestamps for visible tasks
    const tsSet = new Set();
    for (let i = 0; i < pagedIds.length; i++) {
      const intervals = timelinesMap[pagedIds[i]].intervals;
      for (let j = 0; j < intervals.length; j++) tsSet.add(intervals[j].timestamp.getTime());
    }
    const sortedTs = Array.from(tsSet).sort((a, b) => a - b);
    const tsCount = sortedTs.length;

    // Build HTML as array for speed
    const html = [];
    html.push('<div class="pivot-wrapper"><div class="pivot-scroll"><div class="pivot-grid" style="grid-template-columns:260px repeat(', tsCount, ',minmax(120px,1fr))">');

    // Corner cell
    html.push('<div class="pivot-cell pivot-header pivot-corner"><span>Task ID</span><span class="pivot-corner-sub">Skill \u2022 Appt \u2022 Commitment</span></div>');

    // Header cells
    for (let i = 0; i < tsCount; i++) {
      const dt = new Date(sortedTs[i]);
      html.push('<div class="pivot-cell pivot-header"><span>', fmtHeaderDate(dt), '</span><span>', fmtHeaderTime(dt), '</span></div>');
    }

    // Build a quick lookup: timestamp -> index for each task
    for (let r = 0; r < pagedIds.length; r++) {
      const id = pagedIds[r];
      const { intervals, taskInfo } = timelinesMap[id];

      // Build entry map keyed by timestamp ms
      const entryMap = new Map();
      for (let j = 0; j < intervals.length; j++) entryMap.set(intervals[j].timestamp.getTime(), intervals[j]);

      // Row label
      html.push('<div class="pivot-cell pivot-row-label" data-task-id="', id, '"><span class="pivot-row-id"><a class="pivot-row-link" href="#" data-jin="', id, '">', id, '</a><button class="pivot-copy" data-copy-id="', id, '" aria-label="Copy ', id, '"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button></span><span class="pivot-row-meta">', taskInfo.skillCode, ' \u2022 ', taskInfo.appointmentSlot, ' \u2022 ', taskInfo.commitmentTime, '</span><span class="pivot-row-meta">', taskInfo.taskType, ' \u2022 ', taskInfo.exchangeGroup, ' \u2022 CL', taskInfo.careLevel, (taskInfo.cugId && taskInfo.cugId !== "NONE" ? " \u2022 " + taskInfo.cugId : ""), '</span></div>');

      // Data cells
      for (let c = 0; c < tsCount; c++) {
        const entry = entryMap.get(sortedTs[c]);
        if (!entry) {
          html.push('<div class="pivot-cell pivot-data" data-task-id="', id, '"></div>');
          continue;
        }
        const hasChanges = entry.changes.length > 0;
        html.push('<div class="pivot-cell pivot-data', hasChanges ? ' pivot-data--changed' : '', '" data-task-id="', id, '">');
        html.push('<span class="pivot-status" style="background:', statusColour(entry.status), '">', entry.status, '</span>');
        html.push('<span class="pivot-tech">', entry.techId || "\u2014", '</span>');
        html.push('<span class="pivot-pin">', entry.pinStatus || "\u2014", '</span>');
        html.push('<span class="pivot-wm">', entry.estimatedStart && entry.estimatedStart !== "31/12/9999 00:00" ? "Start Time: " + entry.estimatedStart : "\u2014", '</span>');
        if (hasChanges) {
          html.push('<div class="pivot-changes">');
          for (let ch = 0; ch < entry.changes.length; ch++) {
            const c2 = entry.changes[ch];
            html.push('<span class="pivot-change">', c2.field, ': ', c2.from || '\u2014', ' \u2192 ', c2.to || '\u2014', '</span>');
          }
          html.push('</div>');
        }
        html.push('</div>');
      }
    }

    html.push('</div></div></div>');

    // Insert via innerHTML (single reflow)
    const frag = document.createElement("div");
    frag.innerHTML = html.join("");
    const wrapper = frag.firstElementChild;

    // Event delegation on the grid
    const grid = wrapper.querySelector(".pivot-grid");
    grid.addEventListener("click", (e) => {
      // Handle row link clicks
      const link = e.target.closest(".pivot-row-link");
      if (link) {
        e.preventDefault();
        const jin = link.dataset.jin;
        openTaskDetail(jin, timelinesMap[jin]);
        return;
      }
      // Handle copy button clicks
      const copyBtn = e.target.closest(".pivot-copy");
      if (copyBtn) {
        const copyId = copyBtn.dataset.copyId;
        navigator.clipboard.writeText(copyId).then(() => {
          copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
          copyBtn.classList.add("pivot-copy--done");
          setTimeout(() => {
            copyBtn.classList.add("pivot-copy--fade");
            setTimeout(() => {
              copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
              copyBtn.classList.remove("pivot-copy--done", "pivot-copy--fade");
            }, 200);
          }, 600);
        });
        return;
      }
    });

    // Pagination
    const pagination = Pagination.create(
      ids.length, page, pageSize, PIVOT_PAGE_SIZE_OPTIONS,
      (p) => { pivotState.page = p; renderPivotPage(); },
      (s) => { pivotState.pageSize = s; pivotState.page = 0; renderPivotPage(); }
    );
    wrapper.appendChild(pagination);

    container.appendChild(wrapper);
  }

  function openTaskDetail(id, timeline) {
    const { intervals, taskInfo } = timeline;
    const title = document.getElementById("taskDetailTitle");
    const body = document.getElementById("taskDetailBody");

    title.textContent = "Task Detail \u2014 " + id;

    function buildSummary() {
      const changes = [];
      for (let i = 0; i < intervals.length; i++) {
        const entry = intervals[i];
        for (let j = 0; j < entry.changes.length; j++) {
          const c = entry.changes[j];
          changes.push(c.field + ": " + (c.from || '\u2014') + " \u2192 " + (c.to || '\u2014') + " (at " + entry.time + ")");
        }
      }
      let text = "Task: " + id + "\n";
      text += "Type: " + taskInfo.taskType + " | Exchange: " + taskInfo.exchangeGroup + " | Zone: " + taskInfo.zoneCode + " | Care Level: " + taskInfo.careLevel + "\n";
      text += "Skill: " + taskInfo.skillCode + " | Appt: " + taskInfo.appointmentSlot + " | Commitment: " + taskInfo.commitmentTime + "\n";
      if (changes.length) {
        for (let i = 0; i < changes.length; i++) text += changes[i] + "\n";
      } else {
        text += "No changes detected\n";
      }
      text += "Intervals: " + intervals.length + " | Changes: " + changes.length;
      return text;
    }

    let detailState = { page: 0, pageSize: 30 };

    function renderDetailPage() {
      const { page, pageSize } = detailState;
      const paged = intervals.slice(page * pageSize, (page + 1) * pageSize);
      const headers = ["Time", "Status", "Task State", "Tech ID", "Pin Status", "Start Time", "Skill", "Priority", "Importance", "Appt Slot", "CUG", "Colocated", "Pre-Pinned", "Tour"];

      const html = [];
      html.push('<div class="detail-meta">');
      html.push('<span><strong>Task Type:</strong> ', taskInfo.taskType, '</span>');
      html.push('<span><strong>Exchange:</strong> ', taskInfo.exchangeGroup, '</span>');
      html.push('<span><strong>Zone:</strong> ', taskInfo.zoneCode, '</span>');
      html.push('<span><strong>Care Level:</strong> ', taskInfo.careLevel, '</span>');
      html.push('<span><strong>Commitment:</strong> ', taskInfo.commitmentTime, '</span>');
      html.push('</div>');
      html.push('<div class="detail-table-wrapper"><table class="detail-table"><thead><tr>');
      for (let i = 0; i < headers.length; i++) html.push('<th>', headers[i], '</th>');
      html.push('</tr></thead><tbody>');

      for (let i = 0; i < paged.length; i++) {
        const entry = paged[i];
        const changed = entry.changes.length > 0;
        html.push('<tr class="', changed ? 'detail-row--changed' : '', '">');
        html.push('<td>', entry.date, ' ', entry.time, '</td>');
        html.push('<td><span class="pivot-status" style="background:', statusColour(entry.status), '">', entry.status, '</span></td>');
        html.push('<td>', entry.taskState || '\u2014', '</td>');
        html.push('<td>', entry.techId || '\u2014', '</td>');
        html.push('<td>', entry.pinStatus || '\u2014', '</td>');
        html.push('<td>', entry.estimatedStart && entry.estimatedStart !== '31/12/9999 00:00' ? entry.estimatedStart : '\u2014', '</td>');
        html.push('<td>', entry.skillCode || '\u2014', '</td>');
        html.push('<td>', entry.priority || '\u2014', '</td>');
        html.push('<td>', entry.importance || '\u2014', '</td>');
        html.push('<td>', entry.appointmentSlot || '\u2014', '</td>');
        html.push('<td>', entry.cugId && entry.cugId !== 'NONE' ? entry.cugId : '\u2014', '</td>');
        html.push('<td>', entry.colocated || '\u2014', '</td>');
        html.push('<td>', entry.prePinned || '\u2014', '</td>');
        html.push('<td>', entry.tourStatus || '\u2014', '</td>');
        html.push('</tr>');
      }

      html.push('</tbody></table></div>');
      body.innerHTML = html.join("");

      const tableWrapper = body.querySelector(".detail-table-wrapper");
      const pagination = Pagination.create(
        intervals.length, page, pageSize, DETAIL_PAGE_SIZE_OPTIONS,
        (p) => { detailState.page = p; renderDetailPage(); },
        (s) => { detailState.pageSize = s; detailState.page = 0; renderDetailPage(); }
      );
      tableWrapper.appendChild(pagination);
    }

    renderDetailPage();

    const copyBtn = document.getElementById("taskDetailCopy");
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(buildSummary()).then(() => {
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        setTimeout(() => {
          copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
        }, 600);
      });
    };

    openModal("taskDetailModal");
  }

  return { renderAll };
})();
