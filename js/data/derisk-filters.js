// ============================================================
// derisk-filters.js — Skill patterns + gating logic for Pre-Plan Builder
// Loaded before next-day-plan.js
// ============================================================

// Skill patterns used to filter tasks into the DE-RISK view.
// User can customise via Skill Config on home page — stored in localStorage.
var DERISK_SKILL_DEFAULTS = [
  'AFBSBC', 'AFBSDG', 'AFBSOH', 'AFPN23', 'AFPP1J',
  'AFPPDG', 'AFPS1L', 'AFPS1M', 'AFPS1S', 'AFSBBC',
  'FPFLAT', 'FPLADR', 'FPLIFT', 'FPLONG', 'FPWIC',
  'OFTP14', 'OMPONT', 'ONHOLD', 'RFJWIC', 'OFST*',
  'OGGA*',  'RFAST*', 'RSG*',   'RSFVAF', 'R*H',
  'RFLAT',  'LLONG',  '*ISDN*', 'REIN',   'RBT*',
  'RLOC8',  'SWATER', 'RLIFT',  'TELEC',  'OFPSM1',
  'OFPIDG', 'FPLOC8', 'RFPP1J', 'AFPIDG', 'AFPBDG',
  'FPJM',   'RFTTP1', 'HFPSU1', 'ADVP1',  'OFBIDV',
  'OFLMDU', 'FPSCAFF','AMITOW', 'RPFLAT', 'ADVBF2'
];

var DERISK_SKILL_STORAGE_KEY = 'prm_skill_patterns';

// Load user-customised patterns from localStorage, or use defaults
function loadSkillPatterns() {
  try {
    var raw = localStorage.getItem(DERISK_SKILL_STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {}
  return DERISK_SKILL_DEFAULTS.slice();
}

function saveSkillPatterns(patterns) {
  try { localStorage.setItem(DERISK_SKILL_STORAGE_KEY, JSON.stringify(patterns)); } catch (e) {}
  DERISK_SKILL_PATTERNS = patterns;
}

function resetSkillPatterns() {
  localStorage.removeItem(DERISK_SKILL_STORAGE_KEY);
  DERISK_SKILL_PATTERNS = DERISK_SKILL_DEFAULTS.slice();
}

var DERISK_SKILL_PATTERNS = loadSkillPatterns();

// Test if a single skill token matches any pattern
function deriskSkillMatch(token) {
  if (!token) return false;
  var t = token.toUpperCase().trim();
  if (!t) return false;
  for (var i = 0; i < DERISK_SKILL_PATTERNS.length; i++) {
    if (wildcardMatch(t, DERISK_SKILL_PATTERNS[i])) return true;
  }
  return false;
}

// Simple wildcard matcher (* = any chars)
function wildcardMatch(str, pattern) {
  var s = 0, p = 0, starS = -1, starP = -1;
  while (s < str.length) {
    if (p < pattern.length && (pattern[p] === str[s] || pattern[p] === '?')) {
      s++; p++;
    } else if (p < pattern.length && pattern[p] === '*') {
      starP = p; starS = s; p++;
    } else if (starP !== -1) {
      p = starP + 1; starS++; s = starS;
    } else {
      return false;
    }
  }
  while (p < pattern.length && pattern[p] === '*') p++;
  return p === pattern.length;
}

// Test if a row's primary + secondary skills match any pattern
// secondary can be pipe/comma/space separated
function deriskRowMatchesSkills(primarySkill, secondarySkills) {
  if (deriskSkillMatch(primarySkill)) return true;
  var sec = String(secondarySkills || '').replace(/[|,\/]/g, ' ').trim();
  if (!sec) return false;
  var tokens = sec.split(/\s+/);
  for (var i = 0; i < tokens.length; i++) {
    if (deriskSkillMatch(tokens[i])) return true;
  }
  return false;
}

// Returns the first matching skill token from primary/secondary, or '' if none
function deriskGetMatchedSkill(primarySkill, secondarySkills) {
  var prim = String(primarySkill || '').toUpperCase().trim();
  if (prim && deriskSkillMatch(prim)) return prim;
  var sec = String(secondarySkills || '').replace(/[|,\/]/g, ' ').trim();
  if (!sec) return '';
  var tokens = sec.split(/\s+/);
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i].toUpperCase().trim();
    if (t && deriskSkillMatch(t)) return t;
  }
  return '';
}

// Gate a task row for DE-RISK inclusion
// Returns true if the row should appear in the Pre-Plan Builder
// src: the row array, headers: the header array
function deriskGateRow(row, headers) {
  var tagIdx = headers.indexOf('TAG');
  if (tagIdx === -1) tagIdx = headers.indexOf('COMMIT TYPE');
  var apptIdx = headers.indexOf('APPT SLOT');
  var statusIdx = headers.indexOf('JOB STATUS');
  if (statusIdx === -1) statusIdx = headers.indexOf('Task status');
  var skillIdx = headers.indexOf('FOS SKILL');
  if (skillIdx === -1) skillIdx = headers.indexOf('DERISK REASON');
  if (skillIdx === -1) skillIdx = headers.indexOf('Skill');
  var skill2Idx = headers.indexOf('SECONDARY WMSKILL');
  if (skill2Idx === -1) skill2Idx = headers.indexOf('WMSKILL');
  if (skill2Idx === -1) skill2Idx = headers.indexOf('CAPABILITIES');
  if (skill2Idx === -1) skill2Idx = headers.indexOf('PRIMARY SKILL');
  if (skill2Idx === -1) skill2Idx = headers.indexOf('Other Skills');
  var cugIdx = -1;

  // Must have a status value (skip if column missing entirely)
  if (statusIdx !== -1) {
    var status = String(row[statusIdx] || '').trim().toUpperCase();
    if (!status) return false;
  }

  // TAG gating: exclude FUTURE (or blank) when APPT SLOT present
  var tag = tagIdx !== -1 ? String(row[tagIdx] || '').trim().toUpperCase() : '';
  var appt = apptIdx !== -1 ? String(row[apptIdx] || '').trim() : '';
  var isFuture = (tag === 'FUTURE' || tag === '');
  if (isFuture && appt.length > 0) return false;

  // Skill match (primary + secondary)
  var primary = skillIdx !== -1 ? String(row[skillIdx] || '').trim() : '';
  var secondary = skill2Idx !== -1 ? String(row[skill2Idx] || '').trim() : '';
  var skillPass = deriskRowMatchesSkills(primary, secondary);

  return skillPass;
}

// DE-RISK output column definitions
// Maps from enriched DB headers to the 19 DE-RISK display columns
var DERISK_COLUMNS = [
  { name: 'JOB NO',        src: 'JOB NO' },
  { name: 'COMMIT DATE',   src: 'DUE DATE' },
  { name: 'COMMIT TYPE',   src: 'TAG' },
  { name: 'SOURCE',        src: null },
  { name: 'ORDER_AGE',     src: 'ORDER_AGE' },
  { name: 'DERISK REASON', src: 'FOS SKILL' },
  { name: 'APPT SLOT',     src: 'APPT SLOT' },
  { name: 'SCHEDULING',    src: 'TF_SCHED' },
  { name: 'TECH PIN',      src: 'TECH PIN' },
  { name: 'TECH NAME',     src: null },
  { name: 'JOB TITLE',    src: null },
  { name: 'PRIMARY SKILL', src: 'WMSKILL' },
  { name: 'CAPABILITIES',  src: 'SECONDARY WMSKILL' },
  { name: 'CARE LEVEL',    src: 'TF_CARE' },
  { name: 'FAULT DWELL',   src: 'AF_FAULT_DWELL' },
  { name: 'TASK TYPE',     src: 'TASK TYPE' },
  { name: 'EXCHANGE NAME', src: 'ASSET NAME' },
  { name: 'TASK LINK',     src: 'TF_LINK' },
  { name: 'PWA ID',        src: 'DIRECTORY_PWA' },
  { name: 'OUC',           src: 'DIRECTORY_OUC' },
  { name: 'DURATION',      src: 'DURATION' }
];
