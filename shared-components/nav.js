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

  // Suppress URL preview on all links and handle navigation via JS
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    if (link.classList.contains("active") || href === "#") { link.removeAttribute("href"); link.style.cursor = href === "#" ? "pointer" : "default"; return; }
    const isExternal = link.getAttribute("target") === "_blank" || href.startsWith("mailto:") || href.startsWith("http");
    link.dataset.href = href;
    link.removeAttribute("href");
    link.style.cursor = "pointer";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (isExternal) {
        if (href.startsWith("mailto:")) {
          if (typeof Notify !== 'undefined') Notify.info('Opening email client...', 2000);
          window.location.href = href;
        }
        else { window.open(href, "_blank"); }
      } else {
        document.body.classList.add("page-exit");
        setTimeout(() => { window.location.href = href; }, 200);
      }
    });
  });
}

function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  function updateTooltip() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.setAttribute("data-tooltip", isDark ? "Light mode" : "Dark mode");
  }
  updateTooltip();
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateTooltip();
  });
}

// Init when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init() {
  // Restore scroll position from previous visit
  var scrollKey = "scroll_" + location.pathname;
  var savedScroll = sessionStorage.getItem(scrollKey);
  if (savedScroll) {
    requestAnimationFrame(function () {
      var main = document.querySelector(".table-scroll, .results-area, main, #app");
      if (main) main.scrollTop = parseInt(savedScroll, 10);
    });
  }
  // Save scroll position on navigate away
  window.addEventListener("beforeunload", function () {
    var main = document.querySelector(".table-scroll, .results-area, main, #app");
    if (main) {
      try { sessionStorage.setItem(scrollKey, main.scrollTop); } catch (e) {}
    }
  });

  document.body.style.opacity = "0";
  requestAnimationFrame(() => {
    document.body.style.transition = "opacity 200ms ease";
    document.body.style.opacity = "1";
  });
  initNav();
  initThemeToggle();
}

