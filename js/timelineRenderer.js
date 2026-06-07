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

  function statusColour(status) {
    return STATUS_COLOURS[status] || "var(--color-grey-300)";
  }

  function renderAll(timelinesMap, container) {
    container.innerHTML = "";

    const ids = Object.keys(timelinesMap);
    if (!ids.length) {
      container.innerHTML = `<p class="text-body2" style="color:var(--color-grey-light)">No results. Check your JIN IDs and ensure data is loaded.</p>`;
      return;
    }

    // Collect all unique interval timestamps across all tasks
    const allTimestamps = new Set();
    ids.forEach((id) => {
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
    ids.forEach((id) => {
      const { intervals, taskInfo } = timelinesMap[id];
      const entryMap = new Map();
      intervals.forEach((e) => entryMap.set(e.timestamp.toISOString(), e));

      // Row label with task info
      const rowLabel = document.createElement("div");
      rowLabel.className = "pivot-cell pivot-row-label";
      rowLabel.setAttribute("data-task-id", id);
      rowLabel.innerHTML = `<span class="pivot-row-id">${id}<button class="pivot-copy" aria-label="Copy ${id}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button></span><span class="pivot-row-meta">${taskInfo.skillCode} • ${taskInfo.appointmentSlot} • ${taskInfo.commitmentTime}</span>`;
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

      // Cells
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
          html += `<span class="pivot-wm">${entry.estimatedStart && entry.estimatedStart !== "31/12/9999 00:00" ? entry.estimatedStart : "—"}</span>`;

          if (hasChanges) {
            html += `<div class="pivot-changes">`;
            entry.changes.forEach((c) => {
              html += `<span class="pivot-change">▶ ${c.field}</span>`;
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
    container.appendChild(wrapper);
  }

  return { renderAll };
})();
