"use strict";

// ============================================================
// search.js — Centralised expandable search component
// Shared by: timeline.html, ndp.html (any page with .search-expand)
//
// Usage: initSearch({ onInput: fn(query) })
//   Expects DOM structure:
//     .search-expand
//       .search-toggle (button)
//       .search-input (input)
//       .search-clear (button)
// ============================================================

function initSearch(opts) {
  const container = document.querySelector(".search-expand");
  const toggle = container ? container.querySelector(".search-toggle") : null;
  const input = container ? container.querySelector(".search-input") : null;
  const clear = container ? container.querySelector(".search-clear") : null;
  const onInput = opts && opts.onInput ? opts.onInput : () => {};

  if (!container || !toggle || !input) return;

  const expand = () => {
    container.classList.add("active");
    input.focus();
  };

  const collapse = () => {
    container.classList.remove("active", "has-value");
    input.value = "";
    onInput("");
  };

  toggle.addEventListener("click", () => {
    if (container.classList.contains("active")) collapse();
    else expand();
  });

  input.addEventListener("input", () => {
    container.classList.toggle("has-value", input.value.length > 0);
    onInput(input.value.trim());
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") collapse();
  });

  input.addEventListener("blur", () => {
    if (!input.value.trim()) collapse();
  });

  if (clear) {
    clear.addEventListener("click", () => {
      input.value = "";
      container.classList.remove("has-value");
      input.focus();
      onInput("");
    });
  }
}
