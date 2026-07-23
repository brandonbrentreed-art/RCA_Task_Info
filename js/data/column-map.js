"use strict";

// ============================================================
// column-map.js — Centralised column mapping
// Single source of truth for mapping raw Taskforce headers
// to internal column names used across all table components.
// Loaded before enrich.js, support-tools.js, next-day-plan.js
// ============================================================

var COL_MAP = (function() {
  // Raw Taskforce header → internal name
  // Left = what comes from the Taskforce clipboard
  // Right = what we use internally across all tables
  var SOURCE_TO_INTERNAL = {
    "Unique Task ID":                       "TASK_ID",
    "Task status":                          "STATUS",
    "Task type":                            "TASK_TYPE",
    "Skill":                                "PRIMARY_SKILL",
    "Importance score":                     "IMP_SCORE",
    "Task appointment window start date":   "APPT_DATE",
    "Start by":                             "START_BY",
    "Complete by":                          "COMPLETE_BY",
    "Designated resource ID":               "TECH_PIN",
    "Resource name":                        "TECH_NAME",
    "Expected start date":                  "EXPECTED_START",
    "Estimated task duration":              "DURATION",
    "Expected finish date":                 "EXPECTED_FINISH",
    "Group Code":                           "GROUP_CODE",
    "Last task status progression":         "LAST_PROGRESS",
    "Work ID":                              "WORK_ID",
    "Asset name":                           "EXCHANGE",
    "Asset ID":                             "ASSET_ID",
    "Is task a linked task":                "LINKED",
    "Queue ID":                             "QUEUE",
    "MSC":                                  "MSC",
    "Care Level":                           "CARE_LEVEL",
    "Task description":                     "DESCRIPTION",
    "Task category":                        "CATEGORY",
    "Postcode":                             "POSTCODE",
    "Customer address":                     "ADDRESS",
    "Reported":                             "REPORTED",
    "Task created":                         "CREATED",
    "Other Skills":                         "SECONDARY_SKILLS"
  };

  // Internal name → display label (short, consumer-friendly)
  var INTERNAL_TO_LABEL = {
    "TASK_ID":          "Task ID",
    "STATUS":           "Status",
    "TASK_TYPE":        "Task Type",
    "PRIMARY_SKILL":    "Skill",
    "SECONDARY_SKILLS": "Skills",
    "IMP_SCORE":        "IMP Score",
    "APPT_DATE":        "Appt Date",
    "APPT_SLOT":        "Appt",
    "START_BY":         "Start By",
    "COMPLETE_BY":      "Complete By",
    "TECH_PIN":         "Tech ID",
    "TECH_NAME":        "Tech Name",
    "JOB_TITLE":        "Role",
    "EXPECTED_START":   "Exp Start",
    "DURATION":         "Duration",
    "EXPECTED_FINISH":  "Exp Finish",
    "GROUP_CODE":       "Group",
    "LAST_PROGRESS":    "Last Progress",
    "WORK_ID":          "Work ID",
    "EXCHANGE":         "Exchange",
    "ASSET_ID":         "Asset ID",
    "LINKED":           "Linked",
    "QUEUE":            "Queue",
    "MSC":              "MSC",
    "CARE_LEVEL":       "Care",
    "DESCRIPTION":      "Description",
    "CATEGORY":         "Category",
    "POSTCODE":         "Postcode",
    "ADDRESS":          "Address",
    "OUC":              "OUC",
    "PWA":              "PWA",
    "TAG":              "Commit Type",
    "ORDER_AGE":        "Age",
    "COMMIT_DATE":      "Commit Date",
    "DERISK_REASON":    "De-Risk",
    "FAULT_DWELL":      "Dwell",
    "SCHEDULING":       "Scheduled"
  };

  // Internal name → Pre-Plan Builder column name (DERISK_COLUMNS compatible)
  var INTERNAL_TO_BUILDER = {
    "TASK_ID":          "JOB NO",
    "START_BY":         "COMMIT DATE",
    "TAG":              "COMMIT TYPE",
    "ORDER_AGE":        "ORDER_AGE",
    "PRIMARY_SKILL":    "DERISK REASON",
    "APPT_SLOT":        "APPT SLOT",
    "EXPECTED_START":   "SCHEDULING",
    "TECH_PIN":         "TECH PIN",
    "TECH_NAME":        "TECH NAME",
    "JOB_TITLE":        "JOB TITLE",
    "PRIMARY_SKILL_RAW":"PRIMARY SKILL",
    "SECONDARY_SKILLS": "CAPABILITIES",
    "CARE_LEVEL":       "CARE LEVEL",
    "FAULT_DWELL":      "FAULT DWELL",
    "TASK_TYPE":        "TASK TYPE",
    "EXCHANGE":         "EXCHANGE NAME",
    "LINKED":           "TASK LINK",
    "PWA":              "PWA ID",
    "OUC":              "OUC"
  };

  // Get internal name from a raw source header
  function fromSource(header) {
    return SOURCE_TO_INTERNAL[header] || null;
  }

  // Get display label from internal name
  function toLabel(internal) {
    return INTERNAL_TO_LABEL[internal] || internal;
  }

  // Get builder column name from internal name
  function toBuilder(internal) {
    return INTERNAL_TO_BUILDER[internal] || internal;
  }

  // Find a source column index by internal name (case-insensitive fallback)
  function findSourceIdx(headers, internalName) {
    // First try exact match via reverse lookup
    for (var src in SOURCE_TO_INTERNAL) {
      if (SOURCE_TO_INTERNAL[src] === internalName) {
        var idx = headers.indexOf(src);
        if (idx !== -1) return idx;
      }
    }
    // Also check if the internal name itself is in headers
    var direct = headers.indexOf(internalName);
    if (direct !== -1) return direct;
    // Case-insensitive fallback
    var lower = internalName.toLowerCase();
    for (var i = 0; i < headers.length; i++) {
      if ((headers[i] || "").toLowerCase() === lower) return i;
    }
    return -1;
  }

  // Positional mappings: columns with empty headers identified by offset from a known column
  var POSITIONAL = [
    { after: "Skill", offset: 1, internal: "SECONDARY_SKILLS", name: "Other Skills" },
    { after: "MSC", offset: 1, internal: "CARE_LEVEL", name: "Care Level" },
    { after: "MSC", offset: 2, internal: "DESCRIPTION", name: "Task description" }
  ];

  // Resolve positional (unnamed) columns and patch headers in place.
  // Call this after parsing raw Taskforce headers to fill in empty slots.
  function resolvePositional(headers) {
    POSITIONAL.forEach(function(p) {
      var anchorIdx = headers.indexOf(p.after);
      if (anchorIdx === -1) return;
      var targetIdx = anchorIdx + p.offset;
      if (targetIdx >= headers.length) return;
      if (!headers[targetIdx] || !headers[targetIdx].trim()) {
        headers[targetIdx] = p.name;
      }
    });
  }

  return {
    SOURCE_TO_INTERNAL: SOURCE_TO_INTERNAL,
    INTERNAL_TO_LABEL: INTERNAL_TO_LABEL,
    INTERNAL_TO_BUILDER: INTERNAL_TO_BUILDER,
    POSITIONAL: POSITIONAL,
    fromSource: fromSource,
    toLabel: toLabel,
    toBuilder: toBuilder,
    findSourceIdx: findSourceIdx,
    resolvePositional: resolvePositional
  };
})();
