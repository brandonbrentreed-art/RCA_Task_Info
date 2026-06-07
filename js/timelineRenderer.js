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

  let pivotState = { page: 0, pageSize: 30, timelinesMap: null, container: null };

  function statusColour(status) {
    return STATUS_COLOURS[status] || "var(--color-grey-300)";
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

    // Collect timestamps only for visible tasks
    const allTimestamps = new Set();
    pagedIds.forEach((id) => {
      timelinesMap[id].intervals.forEach((entry) => allTimestamps.add(entry.timestamp.toISOString()));
    });
    const sortedTimestamps = Array.from(allTimestamps).sort();

    // Build grid
    const wrapper = document.createElement("div");
    wrapper.className = "pivot-wrapper";

    const scroll = document.createElement("div");
    scroll.className = "pivot-scroll";

    const table = document.createElement("div");
    table.className = "pivot-grid";
    table.style.gridTemplateColumns = `260px repeat(${sortedTimestamps.length}, minmax(120px, 1fr))`;

    // Header row
    const cornerCell = document.createElement("div");
    cornerCell.className = "pivot-cell pivot-header pivot-corner";
    cornerCell.innerHTML = `<span>Task ID</span><span class="pivot-corner-sub">Skill • Appt • Commitment</span>`;
    table.appendChild(cornerCell);

    sortedTimestamps.forEach((ts) => {
      const dt = new Date(ts);
      const headerCell = document.createElement("div");
      headerCell.className = "pivot-cell pivot-header";
      headerCell.innerHTML = `<span>${dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span><span>${dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>`;
      table.appendChild(headerCell);
    });

    // Data rows
    pagedIds.forEach((id) => {
      const { intervals, taskInfo } = timelinesMap[id];
      const entryMap = new Map();
      intervals.forEach((e) => entryMap.set(e.timestamp.toISOString(), e));

      const rowLabel = document.createElement("div");
      rowLabel.className = "pivot-cell pivot-row-label";
      rowLabel.setAttribute("data-task-id", id);
      rowLabel.innerHTML = `<span class="pivot-row-id"><a class="pivot-row-link" href="#" data-jin="${id}">${id}</a><button class="pivot-copy" aria-label="Copy ${id}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button></span><span class="pivot-row-meta">${taskInfo.skillCode} • ${taskInfo.appointmentSlot} • ${taskInfo.commitmentTime}</span><span class="pivot-row-meta">${taskInfo.taskType} • ${taskInfo.exchangeGroup} • CL${taskInfo.careLevel}${taskInfo.cugId && taskInfo.cugId !== "NONE" ? " • " + taskInfo.cugId : ""}</span>`;
      rowLabel.querySelector(".pivot-row-link").addEventListener("click", (e) => {
        e.preventDefault();
        openTaskDetail(id, timelinesMap[id]);
      });
      rowLabel.querySelector(".pivot-copy").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        navigator.clipboard.writeText(id).then(() => {
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
          btn.classList.add("pivot-copy--done");
          setTimeout(() => {
            btn.classList.add("pivot-copy--fade");
            setTimeout(() => {
              btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
              btn.classList.remove("pivot-copy--done", "pivot-copy--fade");
            }, 200);
          }, 600);
        });
      });
      table.appendChild(rowLabel);

      sortedTimestamps.forEach((ts) => {
        const cell = document.createElement("div");
        cell.className = "pivot-cell pivot-data";
        cell.setAttribute("data-task-id", id);

        const entry = entryMap.get(ts);
        if (entry) {
          const hasChanges = entry.changes.length > 0;
          if (hasChanges) cell.classList.add("pivot-data--changed");

          let html = `<span class="pivot-status" style="background:${statusColour(entry.status)}">${entry.status}</span>`;
          html += `<span class="pivot-tech">${entry.techId || "—"}</span>`;
          html += `<span class="pivot-pin">${entry.pinStatus || "—"}</span>`;
          html += `<span class="pivot-wm">${entry.estimatedStart && entry.estimatedStart !== "31/12/9999 00:00" ? "Start Time: " + entry.estimatedStart : "—"}</span>`;

          if (hasChanges) {
            html += `<div class="pivot-changes">`;
            entry.changes.forEach((c) => {
              html += `<span class="pivot-change">${c.field}: ${c.from || '—'} → ${c.to || '—'}</span>`;
            });
            html += `</div>`;
          }

          cell.innerHTML = html;
        }

        table.appendChild(cell);
      });
    });

    scroll.appendChild(table);
    wrapper.appendChild(scroll);

    // Pagination footer inside wrapper
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

    title.textContent = `Task Detail — ${id}`;

    // Build summary text for copy
    function buildSummary() {
      const changes = [];
      intervals.forEach((entry) => {
        entry.changes.forEach((c) => {
          changes.push(`${c.field}: ${c.from || '—'} → ${c.to || '—'} (at ${entry.time})`);
        });
      });

      let text = `Task: ${id}\n`;
      text += `Type: ${taskInfo.taskType} | Exchange: ${taskInfo.exchangeGroup} | Zone: ${taskInfo.zoneCode} | Care Level: ${taskInfo.careLevel}\n`;
      text += `Skill: ${taskInfo.skillCode} | Appt: ${taskInfo.appointmentSlot} | Commitment: ${taskInfo.commitmentTime}\n`;
      if (changes.length) {
        changes.forEach((c) => { text += `${c}\n`; });
      } else {
        text += `No changes detected\n`;
      }
      text += `Intervals: ${intervals.length} | Changes: ${changes.length}`;
      return text;
    }

    let detailState = { page: 0, pageSize: 30 };

    function renderDetailPage() {
      const { page, pageSize } = detailState;
      const paged = intervals.slice(page * pageSize, (page + 1) * pageSize);
      const headers = ["Time", "Status", "Task State", "Tech ID", "Pin Status", "Start Time", "Skill", "Priority", "Importance", "Appt Slot", "CUG", "Colocated", "Pre-Pinned", "Tour"];

      let html = `<div class="detail-meta">`;
      html += `<span><strong>Task Type:</strong> ${taskInfo.taskType}</span>`;
      html += `<span><strong>Exchange:</strong> ${taskInfo.exchangeGroup}</span>`;
      html += `<span><strong>Zone:</strong> ${taskInfo.zoneCode}</span>`;
      html += `<span><strong>Care Level:</strong> ${taskInfo.careLevel}</span>`;
      html += `<span><strong>Commitment:</strong> ${taskInfo.commitmentTime}</span>`;
      html += `</div>`;

      html += `<div class="detail-table-wrapper"><table class="detail-table"><thead><tr>`;
      headers.forEach((h) => { html += `<th>${h}</th>`; });
      html += `</tr></thead><tbody>`;

      paged.forEach((entry) => {
        const changed = entry.changes.length > 0;
        html += `<tr class="${changed ? 'detail-row--changed' : ''}">`;
        html += `<td>${entry.date} ${entry.time}</td>`;
        html += `<td><span class="pivot-status" style="background:${statusColour(entry.status)}">${entry.status}</span></td>`;
        html += `<td>${entry.taskState || '—'}</td>`;
        html += `<td>${entry.techId || '—'}</td>`;
        html += `<td>${entry.pinStatus || '—'}</td>`;
        html += `<td>${entry.estimatedStart && entry.estimatedStart !== '31/12/9999 00:00' ? entry.estimatedStart : '—'}</td>`;
        html += `<td>${entry.skillCode || '—'}</td>`;
        html += `<td>${entry.priority || '—'}</td>`;
        html += `<td>${entry.importance || '—'}</td>`;
        html += `<td>${entry.appointmentSlot || '—'}</td>`;
        html += `<td>${entry.cugId && entry.cugId !== 'NONE' ? entry.cugId : '—'}</td>`;
        html += `<td>${entry.colocated || '—'}</td>`;
        html += `<td>${entry.prePinned || '—'}</td>`;
        html += `<td>${entry.tourStatus || '—'}</td>`;
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
      body.innerHTML = html;

      // Pagination inside the table wrapper
      const tableWrapper = body.querySelector(".detail-table-wrapper");
      const pagination = Pagination.create(
        intervals.length, page, pageSize, DETAIL_PAGE_SIZE_OPTIONS,
        (p) => { detailState.page = p; renderDetailPage(); },
        (s) => { detailState.pageSize = s; detailState.page = 0; renderDetailPage(); }
      );
      tableWrapper.appendChild(pagination);
    }

    renderDetailPage();

    // Wire copy summary button
    const copyBtn = document.getElementById("taskDetailCopy");
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(buildSummary()).then(() => {
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        setTimeout(() => {
          copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
        }, 600);
      });
    };

    openModal("taskDetailModal");
  }

  return { renderAll };
})();
