"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
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
    jinInput.placeholder = "Paste JIN IDs — e.g. B1-26636097A B6-27209822A";
  }

  function lockInput() {
    jinInput.disabled = true;
    jinInput.placeholder = "Load data first...";
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

  // Search expand toggle
  searchToggle.addEventListener("click", () => {
    searchExpand.classList.toggle("active");
    if (searchExpand.classList.contains("active")) {
      searchFilter.focus();
    } else {
      searchFilter.value = "";
      runSearch();
    }
  });

  searchFilter.addEventListener("input", debounce(runSearch, 300));

  searchFilter.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchExpand.classList.remove("active");
      searchFilter.value = "";
      runSearch();
    }
  });

  // Close search on click outside
  document.addEventListener("click", (e) => {
    if (!searchExpand.contains(e.target) && searchExpand.classList.contains("active")) {
      searchExpand.classList.remove("active");
      searchFilter.value = "";
      runSearch();
    }
  });

  // Export summary report
  // Export summary report
  exportBtn.addEventListener("click", exportReport);

  function exportReport() {
    if (!dataLoaded || !activeIds.length) return;

    const timelines = TimelineEngine.buildMultipleTimelines(activeIds);
    const rows = [["Task ID", "Skill", "Appt Slot", "Commitment", "Current Status", "Current Pin", "Est Start", "Status Changes", "Tech Changes", "WM Changes"]];

    Object.keys(timelines).forEach((id) => {
      const { intervals, taskInfo } = timelines[id];
      const last = intervals[intervals.length - 1];

      let statusChanges = 0;
      let techChanges = 0;
      let wmChanges = 0;

      intervals.forEach((entry) => {
        entry.changes.forEach((c) => {
          if (c.field === "Status") statusChanges++;
          if (c.field === "Tech") techChanges++;
          if (c.field === "WM") wmChanges++;
        });
      });

      rows.push([
        id,
        taskInfo.skillCode,
        taskInfo.appointmentSlot,
        taskInfo.commitmentTime,
        last ? last.status : "",
        last ? (last.techId || "NONE") : "",
        last && last.estimatedStart !== "31/12/9999 00:00" ? last.estimatedStart : "",
        statusChanges,
        techChanges,
        wmChanges
      ]);
    });

    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RCA_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Load data
  fileInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    DataLoader.clear();
    let total = 0;
    for (const file of files) {
      const text = await file.text();
      total += DataLoader.loadFromText(text);
    }

    dataLoaded = true;
    unlockInput();
    setToolbarState(true);
    runSearch();
  });

  // Clear
  clearBtn.addEventListener("click", () => {
    jinInput.value = "";
    searchFilter.value = "";
    searchExpand.classList.remove("active");
    activeIds = [];
    renderChips();
    resultsContainer.innerHTML = "";
    DataLoader.clear();
    dataLoaded = false;
    fileInput.value = "";
    lockInput();
    setToolbarState(false);
  });

  // Parse on input
  jinInput.addEventListener("input", debounce(handleInput, 300));

  function handleInput() {
    const raw = jinInput.value.trim();
    if (!raw) return;

    const ids = parseJinIds(raw);
    if (!ids.length) return;

    ids.forEach((id) => {
      if (!activeIds.includes(id)) activeIds.push(id);
    });

    jinInput.value = "";
    renderChips();
    runSearch();
  }

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
    resultsContainer.innerHTML = `
      <div class="loader-overlay">
        <div class="loader-spinner"></div>
        <span class="loader-text">Loading timeline...</span>
      </div>`;
  }

  function runSearch() {
    if (!dataLoaded || !activeIds.length) {
      resultsContainer.innerHTML = "";
      return;
    }

    const filter = searchFilter.value.trim().toUpperCase();
    const idsToRender = filter
      ? activeIds.filter((id) => id.includes(filter))
      : activeIds;

    if (!idsToRender.length) {
      resultsContainer.innerHTML = "";
      return;
    }

    showLoader();

    requestAnimationFrame(() => {
      setTimeout(() => {
        const timelines = TimelineEngine.buildMultipleTimelines(idsToRender);
        TimelineRenderer.renderAll(timelines, resultsContainer);
      }, 300);
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
