"use strict";

const Pagination = (() => {
  const ICON_FIRST = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z"/></svg>';
  const ICON_PREV = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
  const ICON_NEXT = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
  const ICON_LAST = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"/></svg>';

  function create(totalItems, page, pageSize, pageSizeOptions, onPageChange, onPageSizeChange) {
    const totalPages = Math.ceil(totalItems / pageSize);
    const start = page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, totalItems);

    const footer = document.createElement("div");
    footer.className = "pagination-footer";

    footer.innerHTML = `
      <span class="pagination-info">Rows per page:</span>
      <select aria-label="Rows per page">${pageSizeOptions.map((s) => `<option value="${s}" ${s === pageSize ? "selected" : ""}>${s}</option>`).join("")}</select>
      <span class="pagination-info">${start}\u2013${end} of ${totalItems}</span>
      <div class="pagination-nav">
        <button aria-label="First page" ${page === 0 ? "disabled" : ""} data-action="first">${ICON_FIRST}</button>
        <button aria-label="Previous page" ${page === 0 ? "disabled" : ""} data-action="prev">${ICON_PREV}</button>
        <button aria-label="Next page" ${page >= totalPages - 1 ? "disabled" : ""} data-action="next">${ICON_NEXT}</button>
        <button aria-label="Last page" ${page >= totalPages - 1 ? "disabled" : ""} data-action="last">${ICON_LAST}</button>
      </div>
    `;

    footer.querySelector("select").addEventListener("change", (e) => onPageSizeChange(parseInt(e.target.value)));
    footer.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "first") onPageChange(0);
        else if (action === "prev") onPageChange(page - 1);
        else if (action === "next") onPageChange(page + 1);
        else if (action === "last") onPageChange(totalPages - 1);
      });
    });

    return footer;
  }

  function createEmpty() {
    const footer = document.createElement("div");
    footer.className = "pagination-footer";
    footer.innerHTML = `
      <span class="pagination-info">Rows per page:</span>
      <select aria-label="Rows per page" disabled><option>10</option></select>
      <span class="pagination-info">0\u20130 of 0</span>
      <div class="pagination-nav">
        <button disabled>${ICON_FIRST}</button>
        <button disabled>${ICON_PREV}</button>
        <button disabled>${ICON_NEXT}</button>
        <button disabled>${ICON_LAST}</button>
      </div>
    `;
    return footer;
  }

  return { create, createEmpty };
})();
