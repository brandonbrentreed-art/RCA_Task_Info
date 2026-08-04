"use strict";

const Notify = (() => {
  let container = null;

  function getContainer() {
    if (!container || !document.body.contains(container)) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
  };

  function toast(message, type = "info", duration = 4000) {
    if (window.self !== window.top) {
      window.parent.postMessage({ type: "notify", payload: { message, kind: type, duration } }, "*");
      return () => {};
    }
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-dismiss" aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
    `;

    getContainer().appendChild(el);
    requestAnimationFrame(() => el.classList.add("toast--visible"));

    const dismiss = () => {
      el.classList.remove("toast--visible");
      setTimeout(() => el.remove(), 300);
    };

    el.querySelector(".toast-dismiss").addEventListener("click", dismiss);
    if (duration > 0) setTimeout(dismiss, duration);

    return dismiss;
  }

  function success(message, duration) { return toast(message, "success", duration); }
  function error(message, duration) { return toast(message, "error", duration); }
  function warning(message, duration) { return toast(message, "warning", duration); }
  function info(message, duration) { return toast(message, "info", duration); }

  return { toast, success, error, warning, info };
})();

const Dialog = (() => {
  let backdrop = null;
  let pendingDialogs = {};

  function getBackdrop() {
    if (!backdrop || !document.body.contains(backdrop)) {
      backdrop = document.createElement("div");
      backdrop.className = "dialog-backdrop";
      backdrop.innerHTML = `<div class="dialog">
        <h3 class="dialog-title"></h3>
        <p class="dialog-message"></p>
        <div class="dialog-actions">
          <button class="btn btn-text" id="dialogCancel">Cancel</button>
          <button class="btn btn-primary" id="dialogConfirm">Confirm</button>
        </div>
      </div>`;
      document.body.appendChild(backdrop);
    }
    return backdrop;
  }

  // Handle dialog requests from iframes
  if (window.self === window.top) {
    window.addEventListener("message", (e) => {
      if (!e.data || e.data.type !== "dialog-request") return;
      const { id, options } = e.data;
      _confirm(options).then((result) => {
        e.source.postMessage({ type: "dialog-response", id, result }, "*");
      });
    });
  }

  function _confirm({ title = "Confirm", message = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", type = "primary" } = {}) {
    return new Promise((resolve) => {
      const el = getBackdrop();
      el.querySelector(".dialog-title").textContent = title;
      el.querySelector(".dialog-message").textContent = message;
      const confirmBtn = el.querySelector("#dialogConfirm");
      const cancelBtn = el.querySelector("#dialogCancel");
      confirmBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      confirmBtn.className = `btn btn-${type}`;

      function close(result) {
        el.classList.remove("dialog--open");
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        el.removeEventListener("click", onBackdrop);
        resolve(result);
      }

      function onConfirm() { close(true); }
      function onCancel() { close(false); }
      function onBackdrop(e) { if (e.target === el) close(false); }

      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
      el.addEventListener("click", onBackdrop);

      requestAnimationFrame(() => el.classList.add("dialog--open"));
    });
  }

  function confirm(options = {}) {
    if (window.self !== window.top) {
      return new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        pendingDialogs[id] = resolve;
        window.parent.postMessage({ type: "dialog-request", id, options }, "*");

        function onResponse(e) {
          if (!e.data || e.data.type !== "dialog-response" || e.data.id !== id) return;
          window.removeEventListener("message", onResponse);
          delete pendingDialogs[id];
          resolve(e.data.result);
        }
        window.addEventListener("message", onResponse);
      });
    }
    return _confirm(options);
  }

  return { confirm };
})();
