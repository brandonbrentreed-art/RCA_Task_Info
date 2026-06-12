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
  var container = document.querySelector(".search-expand");
  var toggle = container ? container.querySelector(".search-toggle") : null;
  var input = container ? container.querySelector(".search-input") : null;
  var clear = container ? container.querySelector(".search-clear") : null;
  var onInput = opts && opts.onInput ? opts.onInput : function () {};

  if (!container || !toggle || !input) return;

  function expand() {
    container.classList.add("active");
    input.focus();
  }

  function collapse() {
    container.classList.remove("active", "has-value");
    input.value = "";
    onInput("");
  }

  toggle.addEventListener("click", function () {
    if (container.classList.contains("active")) {
      collapse();
    } else {
      expand();
    }
  });

  input.addEventListener("input", function () {
    container.classList.toggle("has-value", input.value.length > 0);
    onInput(input.value.trim());
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") collapse();
  });

  input.addEventListener("blur", function () {
    if (!input.value.trim()) collapse();
  });

  if (clear) {
    clear.addEventListener("click", function () {
      input.value = "";
      container.classList.remove("has-value");
      input.focus();
      onInput("");
    });
  }
}
