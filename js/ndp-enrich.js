"use strict";

// ============================================================
// ndp-enrich.js — Task row mapping for NDP
// Maps Taskforce rows into DERISK_COLUMNS format.
// Loaded after constants.js, column-map.js, derisk-filters.js, directory-map.js
// ============================================================

// Map a Taskforce row into DERISK_COLUMNS format.
// Returns the mapped row array, or null if tfRow is null.
function mapTaskforceRowToDerisk(tfRow, tfHeaders, outHeaders) {
  if (!tfRow) return null;

  var SRC_MAP = {
    "JOB NO": "Unique Task ID",
    "DUE DATE": "Start by",
    "TAG": "TAG",
    "ORDER_AGE": "ORDER_AGE",
    "FOS SKILL": "Skill",
    "TF_SCHED": "Expected start date",
    "TECH PIN": "Designated resource ID",
    "WMSKILL": "Skill",
    "SECONDARY WMSKILL": "Other Skills",
    "TF_CARE": "Care Level",
    "TF_LINK": "Is task a linked task",
    "TASK TYPE": "Task type",
    "ASSET NAME": "Asset name",
    "APPT SLOT": "Appt Slot",
    "AF_FAULT_DWELL": "AF_FAULT_DWELL",
    "DIRECTORY_PWA": "PWA",
    "DIRECTORY_OUC": "OUC",
    "DURATION": "Estimated task duration",
    "WORK ID": "Work ID"
  };

  var mapped = [];
  for (var c = 0; c < DERISK_COLUMNS.length; c++) {
    var col = DERISK_COLUMNS[c];
    if (col.src === null) { mapped.push(""); continue; }
    var tfColName = SRC_MAP[col.src] || null;
    if (tfColName) {
      var ti = tfHeaders.indexOf(tfColName);
      if (ti === -1 && typeof COL_MAP !== "undefined") ti = COL_MAP.findSourceIdx(tfHeaders, tfColName);
      mapped.push(ti !== -1 ? (tfRow[ti] || "") : "");
    } else {
      mapped.push("");
    }
  }

  // Derive COMMIT TYPE from date if not already set
  var commitTypeIdx = outHeaders.indexOf("COMMIT TYPE");
  var commitDateIdx = outHeaders.indexOf("COMMIT DATE");
  var STANDARD_TAGS = NDP.KNOWN_TAGS.concat([""]);
  if (commitTypeIdx !== -1 && commitDateIdx !== -1 && mapped[commitDateIdx]) {
    var currentCt = (mapped[commitTypeIdx] || "").trim();
    if (!currentCt || STANDARD_TAGS.indexOf(currentCt) !== -1) {
      if (!currentCt) mapped[commitTypeIdx] = NDP.deriveTag(mapped[commitDateIdx]);
    }
  }

  // Derive OUC/PWA from Group Code via DirectoryMap if missing
  var oucColIdx = outHeaders.indexOf("OUC");
  var pwaColIdx = outHeaders.indexOf("PWA ID");
  var ws = NdpData.state.workstack;

  if (ws && typeof _dm !== "undefined" && oucColIdx !== -1 && !mapped[oucColIdx]) {
    var gcTfIdx = tfHeaders.indexOf("Group Code");
    var gc = gcTfIdx !== -1 ? (tfRow[gcTfIdx] || "").trim().toUpperCase() : "";
    if (gc) {
      var info = _dm.lookup(ws, gc);
      if (info) {
        mapped[oucColIdx] = info.ouc;
        if (pwaColIdx !== -1) mapped[pwaColIdx] = info.pwa;
      }
    }
  }

  // Derive APPT SLOT from appointment date if not already set
  var apptSlotIdx = outHeaders.indexOf("APPT SLOT");
  if (apptSlotIdx !== -1 && !mapped[apptSlotIdx]) {
    var apptDateTfIdx = tfHeaders.indexOf("Task appointment window start date");
    if (apptDateTfIdx === -1) {
      for (var ai = 0; ai < tfHeaders.length; ai++) {
        if (tfHeaders[ai].toLowerCase().indexOf("appointment window start") !== -1) { apptDateTfIdx = ai; break; }
      }
    }
    if (apptDateTfIdx !== -1 && tfRow[apptDateTfIdx]) {
      mapped[apptSlotIdx] = NDP.deriveApptSlot(tfRow[apptDateTfIdx]);
    }
  }

  // Resolve TECH NAME + JOB TITLE from centralised helper
  var techPinIdx = outHeaders.indexOf("TECH PIN");
  if (techPinIdx !== -1 && mapped[techPinIdx]) {
    var resolved = NDP.resolveTech(mapped[techPinIdx]);
    var techNameIdx = outHeaders.indexOf("TECH NAME");
    var techTitleIdx = outHeaders.indexOf("JOB TITLE");
    if (techNameIdx !== -1) mapped[techNameIdx] = resolved.name;
    if (techTitleIdx !== -1) mapped[techTitleIdx] = resolved.title;
  }

  return mapped;
}
