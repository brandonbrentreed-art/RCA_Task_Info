"use strict";

// ============================================================
// table.js — Centralised table interaction patterns
// Shared by any page that needs:
//   - Row selection (click, shift+click, select all)
//   - Cell selection (drag, shift+click, ctrl+click, paste, delete)
//   - Pagination helpers
//   - Sort (basic DOM sort for static tables)
//
// Usage:
//   TableSelect.rows(opts)  — row selection on a table
//   TableSelect.cells(opts) — cell column selection (drag + paste)
// ============================================================

var TableSelect = (function () {

  // --- Row Selection ---
  // opts: {
  //   container: element (panel/wrapper containing the table),
  //   getRows: fn() -> array of { id, el } for current page,
  //   onSelect: fn(selectedIds: Set) — called after selection changes
  // }
  function rows(opts) {
    var container = opts.container;
    var getRows = opts.getRows;
    var onSelect = opts.onSelect || function () {};
    var selected = new Set();
    var lastIdx = null;

    function toggle(id, idx, e) {
      var all = getRows();
      if (e.shiftKey && lastIdx !== null) {
        var from = Math.min(lastIdx, idx);
        var to = Math.max(lastIdx, idx);
        for (var i = from; i <= to; i++) {
          if (all[i]) selected.add(all[i].id);
        }
      } else {
        if (selected.size > 1 || (selected.size === 1 && !selected.has(id))) {
          selected.clear();
          selected.add(id);
        } else if (selected.has(id)) {
          selected.delete(id);
        } else {
          selected.add(id);
        }
      }
      lastIdx = idx;
      onSelect(selected);
    }

    function selectAll(ids) {
      var allSelected = ids.length > 0 && ids.every(function (id) { return selected.has(id); });
      if (allSelected) {
        ids.forEach(function (id) { selected.delete(id); });
      } else {
        ids.forEach(function (id) { selected.add(id); });
      }
      onSelect(selected);
    }

    function clear() {
      selected.clear();
      lastIdx = null;
      onSelect(selected);
    }

    function has(id) { return selected.has(id); }
    function size() { return selected.size; }
    function getSelected() { return selected; }

    return {
      toggle: toggle,
      selectAll: selectAll,
      clear: clear,
      has: has,
      size: size,
      getSelected: getSelected
    };
  }

  // --- Cell Selection (column drag + shift/ctrl + paste/delete) ---
  // opts: {
  //   container: element (panel containing table),
  //   cellSelector: string (CSS selector for selectable cells, e.g. ".ndp-pin-cell"),
  //   onPaste: fn(cells: array of elements, value: string) — called on Ctrl+V
  //   onDelete: fn(cells: array of elements) — called on Delete/Backspace
  // }
  function cells(opts) {
    var container = opts.container;
    var cellSelector = opts.cellSelector;
    var onPaste = opts.onPaste || function () {};
    var onDelete = opts.onDelete || function () {};
    var dragActive = false;
    var dragCells = [];
    var lastCellIdx = null;
    var HIGHLIGHT_CLASS = "is-dragged";

    function getAllCells() {
      return Array.from(container.querySelectorAll(cellSelector));
    }

    function clearSelection() {
      dragCells.forEach(function (td) { td.classList.remove(HIGHLIGHT_CLASS); });
      dragCells = [];
    }

    // Mousedown: start drag or shift/ctrl select
    container.addEventListener("mousedown", function (e) {
      var td = e.target.closest(cellSelector);
      if (!td || e.button !== 0) return;
      e.preventDefault();

      var allCells = getAllCells();
      var cellIdx = allCells.indexOf(td);

      if (e.shiftKey && lastCellIdx !== null) {
        var from = Math.min(lastCellIdx, cellIdx);
        var to = Math.max(lastCellIdx, cellIdx);
        for (var i = from; i <= to; i++) {
          if (dragCells.indexOf(allCells[i]) === -1) {
            dragCells.push(allCells[i]);
            allCells[i].classList.add(HIGHLIGHT_CLASS);
          }
        }
      } else if (e.ctrlKey || e.metaKey) {
        var idx = dragCells.indexOf(td);
        if (idx !== -1) {
          dragCells.splice(idx, 1);
          td.classList.remove(HIGHLIGHT_CLASS);
        } else {
          dragCells.push(td);
          td.classList.add(HIGHLIGHT_CLASS);
        }
      } else {
        clearSelection();
        dragActive = true;
        dragCells = [td];
        td.classList.add(HIGHLIGHT_CLASS);
      }

      lastCellIdx = cellIdx;
    });

    // Mouseover extends drag
    container.addEventListener("mouseover", function (e) {
      if (!dragActive) return;
      var td = e.target.closest(cellSelector);
      if (!td || dragCells.indexOf(td) !== -1) return;
      dragCells.push(td);
      td.classList.add(HIGHLIGHT_CLASS);
    });

    // Mouseup ends drag
    document.addEventListener("mouseup", function () {
      dragActive = false;
    });

    // Click outside clears
    document.addEventListener("mousedown", function (e) {
      if (!dragCells.length) return;
      if (!e.target.closest(cellSelector)) {
        clearSelection();
        lastCellIdx = null;
      }
    });

    // Paste
    document.addEventListener("paste", function (e) {
      if (!dragCells.length) return;
      var tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      var text = e.clipboardData.getData("text/plain");
      var val = (text || "").trim();
      if (!val) return;
      onPaste(dragCells, val);
      clearSelection();
      lastCellIdx = null;
    });

    // Delete
    document.addEventListener("keydown", function (e) {
      if (!dragCells.length) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      var tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      onDelete(dragCells);
      clearSelection();
      lastCellIdx = null;
    });

    return { clear: clearSelection };
  }

  return { rows: rows, cells: cells };
})();

// --- Basic DOM sort (for static tables without JS-driven render) ---
function initTables() {
  document.querySelectorAll(".table th.sortable").forEach(function (th) {
    th.addEventListener("click", function () {
      var table = th.closest(".table");
      var idx = Array.from(th.parentNode.children).indexOf(th);
      var tbody = table.querySelector("tbody");
      var rows = Array.from(tbody.querySelectorAll("tr"));

      var isAsc = th.classList.contains("sort-asc");
      table.querySelectorAll("th").forEach(function (h) { h.classList.remove("sort-asc", "sort-desc"); });
      th.classList.add(isAsc ? "sort-desc" : "sort-asc");

      var dir = isAsc ? -1 : 1;
      rows.sort(function (a, b) {
        var aVal = a.children[idx].textContent.trim();
        var bVal = b.children[idx].textContent.trim();
        return isNaN(aVal) ? dir * aVal.localeCompare(bVal) : dir * (aVal - bVal);
      });
      rows.forEach(function (row) { tbody.appendChild(row); });
    });
  });
}

// --- Right-click copy cell (context menu on any .table td) ---
(function () {
  var menu = document.createElement("div");
  menu.className = "table-ctx-menu";
  menu.innerHTML =
    '<div class="table-ctx-menu__item" id="tableCtxCopy">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>' +
      '<span id="tableCtxLabel"></span>' +
    '</div>';
  document.body.appendChild(menu);
  var targetCell = null;

  document.addEventListener("contextmenu", function (e) {
    var td = e.target.closest(".table td");
    if (!td) return;
    e.preventDefault();
    targetCell = td;
    var text = td.textContent.trim();
    var label = document.getElementById("tableCtxLabel");
    label.textContent = text.length > 24 ? text.slice(0, 22) + "\u2026" : text;
    menu.style.left = Math.min(e.clientX, window.innerWidth - 160) + "px";
    menu.style.top = Math.min(e.clientY, window.innerHeight - 40) + "px";
    menu.classList.add("is-open");
  });

  document.getElementById("tableCtxCopy").addEventListener("click", function () {
    if (!targetCell) return;
    var text = targetCell.textContent.trim();
    navigator.clipboard.writeText(text).then(function () {
      if (typeof Notify !== "undefined") Notify.success("Copied: " + (text.length > 20 ? text.slice(0, 18) + "\u2026" : text), 2000);
    }).catch(function () {});
    menu.classList.remove("is-open");
  });

  document.addEventListener("click", function () { menu.classList.remove("is-open"); });
  document.addEventListener("scroll", function () { menu.classList.remove("is-open"); }, true);
})();


// --- Close any open dropdowns on click outside (centralised) ---
document.addEventListener("click", function (e) {
  // Pagination size dropdowns
  if (!e.target.closest(".table-pagination__size")) {
    document.querySelectorAll(".table-pagination__size-dropdown.is-open").forEach(function (d) {
      d.classList.remove("is-open");
    });
  }
  // Filter dropdowns
  if (!e.target.closest(".ndp-filter-wrap")) {
    document.querySelectorAll(".ndp-filter-dropdown.is-open").forEach(function (d) {
      d.classList.remove("is-open");
    });
  }
});

document.addEventListener("DOMContentLoaded", initTables);

// --- Column Resize (auto-wires on any .table th) ---
var TableResize = (function () {
  var active = null; // { th, startX, startW }

  function init(table) {
    if (!table || table.dataset.resizeInit) return;
    table.dataset.resizeInit = "1";
    table.querySelectorAll("thead th").forEach(addHandle);
  }

  function addHandle(th) {
    if (th.querySelector(".table-resize-handle")) return;
    var handle = document.createElement("span");
    handle.className = "table-resize-handle";
    th.appendChild(handle);

    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      active = { th: th, startX: e.clientX, startW: th.offsetWidth };
      handle.classList.add("is-active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });

    handle.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    handle.addEventListener("dblclick", function (e) {
      e.preventDefault();
      e.stopPropagation();
      autoFit(th);
      var table = th.closest(".table");
      if (table) _saveWidths(table);
    });
  }

  document.addEventListener("mousemove", function (e) {
    if (!active) return;
    var diff = e.clientX - active.startX;
    var newW = Math.max(40, active.startW + diff);
    active.th.style.width = newW + "px";
  });

  document.addEventListener("mouseup", function () {
    if (!active) return;
    var handle = active.th.querySelector(".table-resize-handle");
    if (handle) handle.classList.remove("is-active");
    var table = active.th.closest(".table");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    active = null;
    if (table) _saveWidths(table);
  });

  function autoFit(th) {
    var table = th.closest(".table");
    if (!table) return;
    var colIdx = Array.from(th.parentNode.children).indexOf(th);
    var span = _measureSpan(th);
    var maxW = span.offsetWidth + 16;
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      var td = tr.children[colIdx];
      if (!td) return;
      span.textContent = td.textContent;
      var w = span.offsetWidth + 16;
      if (w > maxW) maxW = w;
    });
    document.body.removeChild(span);
    th.style.width = Math.max(40, maxW) + "px";
  }

  function autoFitAll(table) {
    if (!table) return;
    var ths = Array.from(table.querySelectorAll("thead th"));
    if (!ths.length) return;
    var span = _measureSpan(ths[0]);
    ths.forEach(function (th, ci) {
      if (th.classList.contains("table-col-checkbox")) return;
      span.textContent = th.textContent;
      var maxW = span.offsetWidth + 16;
      table.querySelectorAll("tbody tr").forEach(function (tr) {
        var td = tr.children[ci];
        if (!td) return;
        span.textContent = td.textContent;
        var w = span.offsetWidth + 16;
        if (w > maxW) maxW = w;
      });
      th.style.width = Math.max(40, maxW) + "px";
    });
    document.body.removeChild(span);
  }

  function _measureSpan(refEl) {
    var span = document.createElement("span");
    span.style.cssText = "visibility:hidden;position:absolute;white-space:nowrap;";
    var style = getComputedStyle(refEl);
    span.style.font = style.font;
    span.style.padding = style.paddingLeft + " " + style.paddingRight;
    span.textContent = refEl.textContent;
    document.body.appendChild(span);
    return span;
  }

  // Observe new tables — debounced to batch rapid DOM changes
  var pending = null;
  var observer = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () {
      pending = null;
      document.querySelectorAll(".table thead").forEach(function (thead) {
        var table = thead.closest(".table");
        if (!table) return;
        if (!table.dataset.resizeInit) {
          init(table);
          autoFitAll(table);
          _saveWidths(table);
        } else {
          var needsHandles = false;
          thead.querySelectorAll("th").forEach(function (th) {
            if (!th.querySelector(".table-resize-handle") && !th.classList.contains("table-col-checkbox")) {
              addHandle(th);
              needsHandles = true;
            }
          });
          if (needsHandles) _restoreWidths(table);
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Persist/restore column widths across re-renders
  function _saveWidths(table) {
    var ths = table.querySelectorAll("thead th");
    var widths = [];
    ths.forEach(function (th) { widths.push(th.offsetWidth); });
    table._colWidths = widths;
  }

  function _restoreWidths(table) {
    if (!table._colWidths) return;
    var ths = table.querySelectorAll("thead th");
    var widths = table._colWidths;
    ths.forEach(function (th, i) {
      if (widths[i] && !th.classList.contains("table-col-checkbox")) {
        th.style.width = widths[i] + "px";
      }
    });
  }

  return { init: init, autoFit: autoFit, autoFitAll: autoFitAll };
})();
