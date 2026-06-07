"use strict";

(function() {
  var tip = document.createElement("div");
  tip.className = "tooltip-float";
  tip.style.left = "0px";
  tip.style.top = "0px";

  var ready = false;
  var currentEl = null;

  function ensureMount() {
    if (!ready) {
      document.body.appendChild(tip);
      ready = true;
    }
  }

  function showTip(el) {
    ensureMount();
    var text = el.getAttribute("data-tooltip");
    if (!text) return;
    currentEl = el;
    tip.textContent = text;
    tip.style.display = "block";
    tip.style.opacity = "0";

    // Measure
    var rect = el.getBoundingClientRect();
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    var isTop = el.classList.contains("tooltip-top");

    var left = rect.left + rect.width / 2 - tw / 2;
    var top = isTop ? rect.top - th - 8 : rect.bottom + 8;

    // Clamp
    if (left < 8) left = 8;
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    if (top < 4) top = rect.bottom + 8;
    if (top + th > window.innerHeight - 4) top = rect.top - th - 8;

    tip.style.left = left + "px";
    tip.style.top = top + "px";
    tip.style.opacity = "1";
  }

  function hideTip() {
    currentEl = null;
    tip.style.opacity = "0";
    tip.style.display = "none";
  }

  // Use mouseover/mouseout for delegation (they bubble unlike mouseenter/mouseleave)
  document.addEventListener("mouseover", function(e) {
    var el = e.target.closest ? e.target.closest("[data-tooltip]") : null;
    if (!el) {
      // Check parentNode chain for IE/older browser fallback
      var node = e.target;
      while (node && node !== document) {
        if (node.getAttribute && node.getAttribute("data-tooltip")) { el = node; break; }
        node = node.parentNode;
      }
    }
    if (el && el !== currentEl) showTip(el);
  });

  document.addEventListener("mouseout", function(e) {
    if (!currentEl) return;
    var related = e.relatedTarget;
    // If we left the tooltip-target entirely
    if (!related || (!currentEl.contains(related) && related !== currentEl)) {
      hideTip();
    }
  });

  // Convert title attrs to data-tooltip
  function convert(root) {
    if (!root || !root.querySelectorAll) return;
    var els = root.querySelectorAll("[title]");
    for (var i = 0; i < els.length; i++) {
      if (!els[i].getAttribute("data-tooltip")) {
        els[i].setAttribute("data-tooltip", els[i].getAttribute("title"));
      }
      els[i].removeAttribute("title");
    }
    if (root.getAttribute && root.getAttribute("title")) {
      if (!root.getAttribute("data-tooltip")) {
        root.setAttribute("data-tooltip", root.getAttribute("title"));
      }
      root.removeAttribute("title");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      ensureMount();
      convert(document.body);
    });
  } else {
    ensureMount();
    convert(document.body);
  }

  // Watch for dynamic elements
  if (window.MutationObserver) {
    new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        for (var j = 0; j < mutations[i].addedNodes.length; j++) {
          var node = mutations[i].addedNodes[j];
          if (node.nodeType === 1) convert(node);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
