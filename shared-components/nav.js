"use strict";

function initNav() {
  const trigger = document.querySelector(".nav-trigger");
  const sidebar = document.querySelector(".nav-sidebar");
  const overlay = document.querySelector(".nav-overlay");
  const close = document.querySelector(".nav-close");

  if (!trigger || !sidebar) return;

  function openNav() {
    sidebar.classList.add("open");
    if (overlay) overlay.classList.add("open");
  }

  function closeNav() {
    sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
  }

  trigger.addEventListener("click", openNav);
  if (close) close.addEventListener("click", closeNav);
  if (overlay) overlay.addEventListener("click", closeNav);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) closeNav();
  });
}

document.addEventListener("DOMContentLoaded", initNav);
