"use strict";

function initTooltips() {
  // Convert any existing title attributes to data-tooltip and suppress native
  document.querySelectorAll("[title]").forEach((el) => {
    if (!el.hasAttribute("data-tooltip")) {
      el.setAttribute("data-tooltip", el.getAttribute("title"));
    }
    el.removeAttribute("title");
    el.classList.add("tooltip");
  });

  // Observe DOM for dynamically added elements with title
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        convertTitles(node);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function convertTitles(root) {
  if (root.hasAttribute && root.hasAttribute("title")) {
    if (!root.hasAttribute("data-tooltip")) {
      root.setAttribute("data-tooltip", root.getAttribute("title"));
    }
    root.removeAttribute("title");
    root.classList.add("tooltip");
  }
  root.querySelectorAll && root.querySelectorAll("[title]").forEach((el) => {
    if (!el.hasAttribute("data-tooltip")) {
      el.setAttribute("data-tooltip", el.getAttribute("title"));
    }
    el.removeAttribute("title");
    el.classList.add("tooltip");
  });
}

document.addEventListener("DOMContentLoaded", initTooltips);
