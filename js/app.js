"use strict";

const INPUT_PLACEHOLDER_READY = "Paste JIN IDs — e.g. B1-26636097A B6-27209822A";
const INPUT_PLACEHOLDER_LOCKED = "Fetch data first...";

document.addEventListener("DOMContentLoaded", () => {

  const jinInput = document.getElementById("jinInput");
  const clearBtn = document.getElementById("clearBtn");
  const resultsContainer = document.getElementById("results");
  const chipContainer = document.getElementById("chipContainer");
  const searchToggle = document.querySelector(".search-toggle");
  const searchExpand = document.querySelector(".search-expand");
  const searchFilter = document.getElementById("searchFilter");
  const exportBtn = document.getElementById("exportBtn");

  let dataLoaded = false;
  let activeIds = [];

  function unlockInput() {
    jinInput.disabled = false;
    jinInput.placeholder = INPUT_PLACEHOLDER_READY;
  }

  function lockInput() {
    jinInput.disabled = true;
    jinInput.placeholder = INPUT_PLACEHOLDER_LOCKED;
  }

  const toolbarBtns = [searchToggle, exportBtn, clearBtn];

  function setToolbarState(enabled) {
    toolbarBtns.forEach(btn => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? "1" : "0.38";
      btn.style.pointerEvents = enabled ? "auto" : "none";
    });
  }

  lockInput();
  setToolbarState(false);

  function restoreActiveIds() {
    try {
      const storedIds = sessionStorage.getItem("rca_active_ids");
      if (storedIds) {
        activeIds = JSON.parse(storedIds);
        renderChips();
        runSearch();
      }
    } catch (e) {}
  }

  // Restore data from sessionStorage if available
  try {
    const source = sessionStorage.getItem("rca_csv_source");
    const stored = sessionStorage.getItem("rca_csv_data");
    if (source === "demo") {
      fetch("assets/RCA_DEV.csv").then(r => r.text()).then(csv => {
        DataLoader.clear();
        DataLoader.loadFromText(csv);
        dataLoaded = true;
        unlockInput();
        setToolbarState(true);
        restoreActiveIds();
      }).catch(() => {});
    } else if (stored) {
      const texts = JSON.parse(stored);
      DataLoader.clear();
      texts.forEach(t => DataLoader.loadFromText(t));
      dataLoaded = true;
      unlockInput();
      setToolbarState(true);
      restoreActiveIds();
    }
  } catch (e) {}

  initSearch({ onInput: () => filterRows() });

  // Export summary report
  exportBtn.addEventListener("click", exportReport);

  function exportReport() {
    if (!dataLoaded || !activeIds.length || typeof XLSX === "undefined") return;

    const timelines = TimelineEngine.buildMultipleTimelines(activeIds);
    const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const hdrS = { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, border, fill: { fgColor: { rgb: "142032" } } };
    const cellS = { alignment: { horizontal: "center", vertical: "center" }, border };

    const HEADERS = ["Task ID", "Task Type", "Exchange", "Zone", "Care Level", "Skill", "Appt Slot", "Commitment", "CUG", "Intervals", "Total Changes", "Final Status", "Final Tech"];

    const data = [HEADERS];
    Object.keys(timelines).forEach((id) => {
      const { intervals, taskInfo } = timelines[id];
      const totalChanges = intervals.reduce((n, e) => n + e.changes.length, 0);
      const last = intervals[intervals.length - 1] || {};
      data.push([
        id,
        taskInfo.taskType || "",
        taskInfo.exchangeGroup || "",
        taskInfo.zoneCode || "",
        taskInfo.careLevel || "",
        taskInfo.skillCode || "",
        taskInfo.appointmentSlot || "",
        taskInfo.commitmentTime || "",
        taskInfo.cugId && taskInfo.cugId !== "NONE" ? taskInfo.cugId : "",
        intervals.length,
        totalChanges,
        last.status || "",
        last.techId || ""
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = HEADERS.map((_, c) => ({
      wch: Math.min(80, Math.max(...data.map(row => String(row[c] ?? "").length)) + 2)
    }));
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const a = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[a]) ws[a].s = R === 0 ? hdrS : cellS;
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, "RCA Summary");
    XLSX.writeFile(wb, `RCA_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
    if (typeof Notify !== "undefined") Notify.success("Report exported", 2000);
  }

  // Fetch live data modal
  const fetchBtn = document.getElementById("fetchBtn");
  const demoBtn = document.getElementById("demoBtn");
  const powFetchModal = document.getElementById("powFetchModal");
  const powZoneInput = document.getElementById("powZoneInput");
  const powDateInput = document.getElementById("powDateInput");
  const powDatePicker = document.getElementById("powDatePicker");
  if (powDatePicker) {
    powDatePicker.addEventListener("change", function () {
      powDateInput.value = powDatePicker.value;
    });
  }
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

  // Load demo data from bundled CSV
  demoBtn.addEventListener("click", async () => {
    demoBtn.disabled = true;
    demoBtn.textContent = "Loading\u2026";
    try {
      const res = await fetch("assets/RCA_DEV.csv");
      if (!res.ok) throw new Error("Failed to load demo file");
      const csv = await res.text();
      DataLoader.clear();
      await DataLoader.loadFromTextAsync(csv);
      try { sessionStorage.setItem("rca_csv_source", "demo"); } catch (e) {}
      dataLoaded = true;
      unlockInput();
      setToolbarState(true);
      closeFetchModal();
      if (typeof Notify !== "undefined") Notify.success("Demo data loaded \u2014 " + DataLoader.getSnapshots().length + " snapshots", 3000);
    } catch (err) {
      if (typeof Notify !== "undefined") Notify.error(err.message || "Failed to load demo data");
    } finally {
      demoBtn.disabled = false;
      demoBtn.textContent = "Load Demo";
    }
  });
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
    } finally {
      powFetchGo.disabled = false;
      powFetchGo.textContent = "Fetch";
    }
  });

  // Clear
  clearBtn.addEventListener("click", () => {
    jinInput.value = "";
    searchFilter.value = "";
    searchExpand.classList.remove("active", "has-value");
    filterRows();
    activeIds = [];
    renderChips();
    resultsContainer.innerHTML = "";
    resultsContainer.classList.remove("results-ready");
    DataLoader.clear();
    dataLoaded = false;
    lockInput();
    setToolbarState(false);
    try {
      sessionStorage.removeItem("rca_csv_data");
      sessionStorage.removeItem("rca_csv_source");
      sessionStorage.removeItem("rca_active_ids");
    } catch (e) {}
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
    try { sessionStorage.setItem("rca_active_ids", JSON.stringify(activeIds)); } catch (e) {}

    if (!dataLoaded || !activeIds.length) {
      resultsContainer.innerHTML = "";
      resultsContainer.classList.remove("results-ready");
      return;
    }

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

});

