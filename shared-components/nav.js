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

  // Smooth page transitions on nav links
  document.querySelectorAll(".nav-item a, .home-card").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href === "#" || link.classList.contains("active")) return;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.add("page-exit");
      setTimeout(() => { window.location.href = href; }, 200);
    });
  });
}

// Fade in on page load
document.addEventListener("DOMContentLoaded", () => {
  document.body.style.opacity = "0";
  requestAnimationFrame(() => {
    document.body.style.transition = "opacity 200ms ease";
    document.body.style.opacity = "1";
  });
  initNav();
});
