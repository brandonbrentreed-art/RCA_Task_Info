# Optimisation & Refactor Action Plan

Progress tracker — check off each item as it's completed.

---

## 🔴 Security (Priority 1)

- [x] **`main.py`** — Replace `CORS(app, origins=['*'])` with env-var-driven allowed origins
- [x] **`main.py`** — Remove `'detail': str(e)` from BigQuery error response (log server-side only)

---

## 🟠 Medium Priority

- [x] **`timelineRenderer.js`** — Reset `pivotState.page` (and optionally `pageSize`) inside `renderAll` so stale pagination doesn't persist across data reloads
- [x] **`timelineRenderer.js`** — Cache the sorted timestamp array per page slice instead of rebuilding the `tsSet` on every `renderPivotPage` call
- [x] **`nav.js`** — Keep `href` on anchor tags; use `event.preventDefault()` for page-transition logic instead of stripping the attribute

---

## 🟡 Code Quality / Duplication

- [x] **`app.js`** — Refactor `setToolbarState` to loop over a `toolbarBtns` array instead of repeating 3 properties × 3 elements
- [x] **`app.js`** — Extract `restoreActiveIds()` helper to remove the duplicated `rca_active_ids` restore block
- [x] **`app.js`** — Consolidate `powFetchGo` reset into a `finally` block (currently duplicated in two error paths)
- [x] **`app.js`** — Deduplicate `sessionStorage.setItem('rca_active_ids', ...)` in `runSearch` (written in two branches)
- [x] **`timelineEngine.js` + `timelineRenderer.js`** — Move `pad2` and `MONTHS` into a shared utility (e.g. `js/utils.js`)
- [x] **`timelineRenderer.js`** — Merge `PIVOT_PAGE_SIZE_OPTIONS` and `DETAIL_PAGE_SIZE_OPTIONS` into a single `PAGE_SIZE_OPTIONS` constant
- [x] **`build.py`** — Extract a `build_page(page, inject_partials)` helper to remove the near-identical PARTIAL_PAGES / PLAIN_PAGES loops

---

## 🔵 Dead Code / Cleanup

- [x] **`dataLoader.js`** — Remove unused variables `_jinCol`, `_recordTimeCol`, and `nlCode`
- [x] **`dataLoader.js`** — Simplify `loadFromText` by removing the unnecessary `if snapshots.length === 0` branch
- [x] **`tooltip.js`** — Remove the unreachable IE `while (node.parentNode)` fallback
- [x] **`powData.js`** — Modernise from `var` / ES5 function expressions to `const`/`let` and arrow functions

---

## ⚙️ Infrastructure

- [x] **`Dockerfile`** — Add a `.dockerignore` to exclude `cloud_functions/`, `assets/RCA_DEV.csv`, `serve.py`, `bump-build.py`, `*.bat`, `*.md` from the build context

---

## Summary

| Priority | Total | Done |
|----------|-------|------|
| 🔴 Security | 2 | 2 |
| 🟠 Medium | 3 | 3 |
| 🟡 Quality | 7 | 7 |
| 🔵 Cleanup | 4 | 4 |
| ⚙️ Infra | 1 | 1 |
| **Total** | **17** | **17** |
