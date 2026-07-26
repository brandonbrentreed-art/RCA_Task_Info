# Sanity Check — Code Quality Audit

Full audit across all JS, Python and shared components.
Covers: hardcoded values, dead code, trailing whitespace / blank lines, style inconsistencies.

---

## 🔴 Hardcoded Values to Centralise

- [x] **`app.js` L112** — `"#142032"`, `"#FFFFFF"`, `"#e0e0e0"`, `"#f5f7fa"` hardcoded in the XLS export HTML template. Should reference `NDP.EXPORT` constants already defined in `constants.js`
- [x] **`app.js` L19** — `"Paste JIN IDs..."` and `"Fetch data first..."` are inline UI strings. Move to named constants at top of file
- [x] **`app.js` L113** — `"31/12/9999 00:00"` sentinel date hardcoded. Centralised to `utils.js` as `Utils.SENTINEL_DATE`
- [x] **`timelineRenderer.js` L14** — `pageSize: 30` hardcoded as default. Now derives from `PAGE_SIZE_OPTIONS[0]`
- [x] **`timelineRenderer.js` L57** — `"260px"` and `"minmax(120px,1fr)"` grid column widths hardcoded inline in HTML string. Move to CSS custom properties
- [x] **`nav.js` L11** — `TRANSITION_MS = 250` now read at runtime via `getComputedStyle`
- [x] **`main.py` L57** — GCP project ID `"or-tfconfig-dec-exp-prod"` moved to `GCP_PROJECT` env var

---

## 🟡 Dead / Redundant Code

- [x] **`timelineEngine.js`** — `pad2`, `formatTime`, `formatDate` wrappers removed, `Utils.*` called directly
- [x] **`timelineRenderer.js`** — `pad2`, `fmtHeaderDate`, `fmtHeaderTime` wrappers removed, `Utils.*` called directly
- [x] **`timelineRenderer.js`** — `MONTHS_SHORT` unused assignment removed
- [x] **`dataLoader.js`** — `getAllSnapshots` duplicate alias removed
- [x] **`app.js`** — unused `searchClear` DOM query removed
- [x] **`nav.js`** — trailing blank line removed

---

## 🔵 Whitespace / Formatting

- [x] **`app.js`** — Normalised to LF, `initSearch` callback converted to arrow function
- [x] **`dataLoader.js`** — Normalised to LF
- [x] **`search.js`** — Rewritten with `const`/`let`, arrow functions, LF line endings
- [x] **`nav.js`** — Trailing blank line removed
- [x] **`timelineRenderer.js`** — trailing comma on `pivotState` object consistent with rest of file

---

## ⚪ Minor Style Consistency

- [x] **`timelineEngine.js`** — `derivePinStatus` modernised from `var` to `const`/`let`
- [x] **`app.js`** — `initSearch` callback normalised to arrow function
- [x] **`build.py`** — `build_page` signature simplified: `head_partial`/`nav_partial_template` now optional keyword args, not passed for plain pages

---

## Summary

| Category | Items | Fixed |
|----------|-------|-------|
| 🔴 Hardcoded values | 7 | 7 |
| 🟡 Dead / redundant code | 6 | 6 |
| 🔵 Whitespace / formatting | 5 | 5 |
| ⚪ Style consistency | 3 | 3 |
| **Total** | **21** | **21** |
