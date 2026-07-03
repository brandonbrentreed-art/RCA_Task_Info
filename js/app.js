"use strict";

document.addEventListener("DOMContentLoaded", () => {

  const jinInput = document.getElementById("jinInput");
  const clearBtn = document.getElementById("clearBtn");
  const resultsContainer = document.getElementById("results");
  const chipContainer = document.getElementById("chipContainer");
  const searchToggle = document.querySelector(".search-toggle");
  const searchExpand = document.querySelector(".search-expand");
  const searchFilter = document.getElementById("searchFilter");
  const searchClear = document.getElementById("searchClear");
  const exportBtn = document.getElementById("exportBtn");

  let dataLoaded = false;
  let activeIds = [];

  function unlockInput() {
    jinInput.disabled = false;
    jinInput.placeholder = "Paste JIN IDs — e.g. B1-26636097A B6-27209822A";
  }

  function lockInput() {
    jinInput.disabled = true;
    jinInput.placeholder = "Fetch data first...";
  }

  function setToolbarState(enabled) {
    searchToggle.disabled = !enabled;
    exportBtn.disabled = !enabled;
    clearBtn.disabled = !enabled;
    searchToggle.style.opacity = enabled ? "1" : "0.38";
    exportBtn.style.opacity = enabled ? "1" : "0.38";
    clearBtn.style.opacity = enabled ? "1" : "0.38";
    searchToggle.style.pointerEvents = enabled ? "auto" : "none";
    exportBtn.style.pointerEvents = enabled ? "auto" : "none";
    clearBtn.style.pointerEvents = enabled ? "auto" : "none";
  }

  lockInput();
  setToolbarState(false);

  // Restore data from sessionStorage if available
  try {
    const stored = sessionStorage.getItem("rca_csv_data");
    if (stored) {
      const texts = JSON.parse(stored);
      DataLoader.clear();
      texts.forEach(t => DataLoader.loadFromText(t));
      dataLoaded = true;
      unlockInput();
      setToolbarState(true);

      const storedIds = sessionStorage.getItem("rca_active_ids");
      if (storedIds) {
        activeIds = JSON.parse(storedIds);
        renderChips();
        runSearch();
      }
    }
  } catch (e) {}

  // Search expand — handled by shared component
  initSearch({
    onInput: function (query) {
      filterRows();
    }
  });

  function updateSearchState() {
    searchExpand.classList.toggle("has-value", searchFilter.value.length > 0);
  }

  // Export summary report
  exportBtn.addEventListener("click", exportReport);

  function exportReport() {
    if (!dataLoaded || !activeIds.length) return;

    const timelines = TimelineEngine.buildMultipleTimelines(activeIds);
    const headers = ["Task ID", "Skill", "Task Type", "Exchange", "Appt Slot", "Commitment", "Care Level", "CUG", "Current Status", "Pin Status", "Task State", "Current Tech", "Est Start", "Status Changes", "Tech Changes", "WM Changes", "Pin Changes"];
    const rows = [];

    Object.keys(timelines).forEach((id) => {
      const { intervals, taskInfo } = timelines[id];
      const last = intervals[intervals.length - 1];

      let statusChanges = 0;
      let techChanges = 0;
      let wmChanges = 0;
      let pinChanges = 0;

      intervals.forEach((entry) => {
        entry.changes.forEach((c) => {
          if (c.field === "Status") statusChanges++;
          if (c.field === "Tech") techChanges++;
          if (c.field === "WM") wmChanges++;
          if (c.field === "Pin") pinChanges++;
        });
      });

      rows.push([
        id,
        taskInfo.skillCode,
        taskInfo.taskType,
        taskInfo.exchangeGroup,
        taskInfo.appointmentSlot,
        taskInfo.commitmentTime,
        taskInfo.careLevel,
        taskInfo.cugId,
        last ? last.status : "",
        last ? last.pinStatus : "",
        last ? last.taskState : "",
        last ? (last.techId || "NONE") : "",
        last && last.estimatedStart !== "31/12/9999 00:00" ? last.estimatedStart : "",
        statusChanges,
        techChanges,
        wmChanges,
        pinChanges
      ]);
    });

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11pt; }
        th { background: #142032; color: #FFFFFF; font-weight: bold; padding: 8px 12px; text-align: left; white-space: nowrap; }
        td { padding: 6px 12px; border-bottom: 1px solid #e0e0e0; white-space: nowrap; }
        tr:nth-child(even) td { background: #f5f5f5; }
      </style>
      </head>
      <body>
      <table>${"<tr>" + headers.map((h) => `<th>${h}</th>`).join("") + "</tr>"}${rows.map((r) => "<tr>" + r.map((v) => `<td>${v}</td>`).join("") + "</tr>").join("")}</table>
      </body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RCA_Summary_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Fetch live data modal
  const fetchBtn = document.getElementById("fetchBtn");
  const powFetchModal = document.getElementById("powFetchModal");
  const powZoneInput = document.getElementById("powZoneInput");
  const powDateInput = document.getElementById("powDateInput");
  const powFetchGo = document.getElementById("powFetchGo");
  const powFetchCancel = document.getElementById("powFetchCancel");
  const powFetchError = document.getElementById("powFetchError");

  function openFetchModal() {
    powZoneInput.value = "";
    powDateInput.value = "";
    powFetchError.style.display = "none";
    powFetchGo.disabled = false;
    powFetchGo.textContent = "Fetch";
    powFetchModal.classList.add("open");
    powZoneInput.focus();
  }

  function closeFetchModal() {
    powFetchModal.classList.remove("open");
  }

  fetchBtn.addEventListener("click", openFetchModal);
  powFetchCancel.addEventListener("click", closeFetchModal);
  powFetchModal.querySelector(".modal-close").addEventListener("click", closeFetchModal);
  powFetchModal.addEventListener("click", (e) => { if (e.target === powFetchModal) closeFetchModal(); });

  powFetchGo.addEventListener("click", async () => {
    const zone = powZoneInput.value.trim();
    if (!zone) {
      powFetchError.textContent = "Zone code is required.";
      powFetchError.style.display = "block";
      powZoneInput.focus();
      return;
    }
    const date = powDateInput.value || null;
    powFetchError.style.display = "none";
    powFetchGo.disabled = true;
    powFetchGo.textContent = "Fetching…";

    try {
      const result = await PowData.fetchPoolOfWork(zone, date);
      if (!result.data || !result.data.length) {
        powFetchError.textContent = "No records returned for that zone / date.";
        powFetchError.style.display = "block";
        powFetchGo.disabled = false;
        powFetchGo.textContent = "Fetch";
        return;
      }
      const csv = PowData.toCSV(result.data);
      DataLoader.clear();
      DataLoader.loadFromText(csv);
      try { sessionStorage.setItem("rca_csv_data", JSON.stringify([csv])); } catch (e) {}
      dataLoaded = true;
      unlockInput();
      setToolbarState(true);
      closeFetchModal();
      runSearch();
    } catch (err) {
      powFetchError.textContent = err.message || "Fetch failed. Check your connection and try again.";
      powFetchError.style.display = "block";
      powFetchGo.disabled = false;
      powFetchGo.textContent = "Fetch";
    }
  });

  // Clear
  clearBtn.addEventListener("click", () => {
    jinInput.value = "";
    searchFilter.value = "";
    searchExpand.classList.remove("active");
    activeIds = [];
    renderChips();
    resultsContainer.innerHTML = "";
    resultsContainer.classList.remove("results-ready");
    DataLoader.clear();
    dataLoaded = false;
    lockInput();
    setToolbarState(false);
    try { sessionStorage.removeItem("rca_csv_data"); sessionStorage.removeItem("rca_active_ids"); } catch (e) {}
  });

  // Render on Enter only
  jinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const raw = jinInput.value.trim();
      if (raw) {
        const ids = parseJinIds(raw);
        ids.forEach((id) => {
          if (!activeIds.includes(id)) activeIds.push(id);
        });
        jinInput.value = "";
        renderChips();
      }
      runSearch();
    }
  });

  function parseJinIds(raw) {
    const pattern = /(?:B[16]-[A-Z0-9]+|C5-[A-Z0-9]+|F1-[A-Z0-9]+|RG-[A-Z0-9]+|OS-[A-Z0-9]+|OZ-[A-Z0-9]+)/gi;
    const matches = raw.match(pattern);
    return matches ? [...new Set(matches.map((m) => m.toUpperCase()))] : [];
  }

  function removeId(id) {
    activeIds = activeIds.filter((i) => i !== id);
    renderChips();
    runSearch();
  }

  function renderChips() {
    chipContainer.innerHTML = "";
    const maxVisible = 5;
    const visible = activeIds.slice(0, maxVisible);
    const overflow = activeIds.length - maxVisible;

    visible.forEach((id) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${id}<button class="chip-dismiss" aria-label="Remove ${id}">✕</button>`;
      chip.querySelector(".chip-dismiss").addEventListener("click", () => removeId(id));
      chipContainer.appendChild(chip);
    });

    if (overflow > 0) {
      const countChip = document.createElement("span");
      countChip.className = "chip chip-count";
      countChip.textContent = `+${overflow} more`;
      chipContainer.appendChild(countChip);
    }
  }

  function showLoader() {
    resultsContainer.classList.remove("results-ready");
    resultsContainer.innerHTML = `
      <div class="loader-overlay">
        <div class="loader-spinner"></div>
        <span class="loader-text">Loading timeline...</span>
      </div>`;
  }

  function filterRows() {
    const filter = searchFilter.value.trim().toUpperCase();
    const rows = resultsContainer.querySelectorAll("[data-task-id]");
    rows.forEach((row) => {
      const id = row.getAttribute("data-task-id");
      row.style.display = (!filter || id.includes(filter)) ? "" : "none";
    });
  }

  function runSearch() {
    if (!dataLoaded || !activeIds.length) {
      resultsContainer.innerHTML = "";
      resultsContainer.classList.remove("results-ready");
      // Persist active IDs
      try { sessionStorage.setItem("rca_active_ids", JSON.stringify(activeIds)); } catch (e) {}
      return;
    }

    // Persist active IDs
    try { sessionStorage.setItem("rca_active_ids", JSON.stringify(activeIds)); } catch (e) {}

    showLoader();

    requestAnimationFrame(() => {
      const timelines = TimelineEngine.buildMultipleTimelines(activeIds);
      const offscreen = document.createElement("div");
      TimelineRenderer.renderAll(timelines, offscreen);

      resultsContainer.innerHTML = "";
      while (offscreen.firstChild) {
        resultsContainer.appendChild(offscreen.firstChild);
      }
      resultsContainer.classList.add("results-ready");
      filterRows();
    });
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }
});
