"use strict";

function initNav() {
  const sidebar = document.querySelector(".nav-sidebar");
  const toggle = document.querySelector(".nav-toggle");
  const main = document.querySelector(".main-with-sidebar");

  if (!sidebar || !toggle) return;

  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    if (main) main.classList.toggle("sidebar-collapsed");
  });
}

document.addEventListener("DOMContentLoaded", initNav);
