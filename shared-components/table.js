"use strict";

function initTables() {
  document.querySelectorAll(".table th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const table = th.closest(".table");
      const idx = Array.from(th.parentNode.children).indexOf(th);
      const tbody = table.querySelector("tbody");
      const rows = Array.from(tbody.querySelectorAll("tr"));

      // Toggle direction
      const isAsc = th.classList.contains("sort-asc");
      table.querySelectorAll("th").forEach((h) => h.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(isAsc ? "sort-desc" : "sort-asc");

      const dir = isAsc ? -1 : 1;
      rows.sort((a, b) => {
        const aVal = a.children[idx].textContent.trim();
        const bVal = b.children[idx].textContent.trim();
        return isNaN(aVal) ? dir * aVal.localeCompare(bVal) : dir * (aVal - bVal);
      });

      rows.forEach((row) => tbody.appendChild(row));
    });
  });
}

document.addEventListener("DOMContentLoaded", initTables);
