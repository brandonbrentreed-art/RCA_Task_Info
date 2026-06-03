"use strict";

function openModal(id) {
  const backdrop = document.getElementById(id);
  if (backdrop) backdrop.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  const backdrop = document.getElementById(id);
  if (backdrop) backdrop.classList.remove("open");
  document.body.style.overflow = "";
}

function initModals() {
  // Close on backdrop click
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });

  // Close on X button
  document.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      const backdrop = btn.closest(".modal-backdrop");
      if (backdrop) closeModal(backdrop.id);
    });
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const open = document.querySelector(".modal-backdrop.open");
      if (open) closeModal(open.id);
    }
  });
}

document.addEventListener("DOMContentLoaded", initModals);
