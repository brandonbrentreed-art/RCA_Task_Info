# Code Quality Audit — Formatting & Consistency

Scope: all source JS, CSS, HTML partials, and Python files.
Goal: clean whitespace, fix inconsistencies, remove dead/redundant code.
Work through items one at a time, confirm before moving on.

---

## Summary of Findings

### 1. Mixed line endings (CRLF vs LF)
**Files affected:**
- `js/app.js` — CRLF
- `js/ndp-app.js` — CRLF
- `js/ndp-demand.js` — CRLF
- `js/ndp-risk.js` — CRLF
- `js/data/constants.js` — CRLF
- `js/data/derisk-filters.js` — CRLF
- `js/auth/auth-config.js` — CRLF
- `css/ndp.css` — CRLF
- `js/ndc-app.js` — LF (inconsistent with above)
- `js/ndp-data.js` — LF
- `js/ndp-demand-data.js` — LF
- `js/ndp-demand-ui.js` — LF
- `js/ndp-enrich.js` — LF
- `js/ndp-plan.js` — LF
- `js/ndp-tf-parser.js` — LF
- `js/powData.js` — LF
- `js/timelineEngine.js` — LF
- `js/timelineRenderer.js` — LF
- `js/data/column-map.js` — LF
- `css/styles.css` — LF
- `partials/head.html` — LF
- `partials/nav.html` — LF

**Fix:** Normalise all source files to LF. Add/confirm `.gitattributes` enforces `* text=auto eol=lf`.

---

### 2. Trailing blank lines / extra blank lines in CSS
**Files affected:**
- `css/ndp.css` — multiple double/triple blank lines between rule blocks (lines ~270–280, ~310–315, ~380–385, ~430–435, ~490–495). Specifically:
  - After `.ndp-pin-input { ... }` — 3 blank lines before `.ndp-drill`
  - After `.table tbody tr[style*="hover-row"]` — 2 blank lines before `#ndpPlanAdd`
  - After `[data-theme="dark"] .ndp-drill:hover` — 2 blank lines before `.ndp-demand-col__label`
  - After `.ndp-demand-oucs .ndp-demand-ouc + .ndp-demand-ouc` — 2 blank lines before `.ndp-demand-legend`
  - After `.ndp-demand-legend__item:not(.is-active) .ndp-demand-legend__dot` — 2 blank lines before `.ndp-demand-grid`
  - After `.ndp-demand-col { z-index: 1; }` — 2 blank lines before `.ndp-pwa-filter`
  - After `.ndp-pwa-filter.is-active` — 2 blank lines before `.ndp-demand-ouc { cursor: pointer }`
  - After `.ndp-demand-ouc:hover` — 2 blank lines before `.ndp-filter-wrap`

**Fix:** Reduce all multi-blank-line gaps to a single blank line between rule blocks.

---

### 3. Duplicate CSS rule — `.ndp-demand-ouc` defined twice
**File:** `css/ndp.css`
- First definition (~line 310): sets `font-size`, `font-weight`, `color`, `text-align`, `white-space`, `overflow`, `text-overflow`
- Second definition (~line 430): only adds `cursor: pointer`
- Third definition (~line 435): only adds `:hover` colour

**Fix:** Merge the `cursor: pointer` and `:hover` into the first `.ndp-demand-ouc` block. Remove the duplicate bare selector.

---

### 4. Inconsistent quote style in JS
**Files affected:**
- `js/ndc-app.js` — uses single quotes `'` throughout (ES5 IIFE style)
- `js/ndp-app.js` — uses double quotes `"` throughout
- `js/ndp-data.js` — uses double quotes `"`
- `js/ndp-plan.js` — uses double quotes `"`
- `js/ndp-demand.js` — uses double quotes `"`
- `js/data/column-map.js` — uses single quotes `'` throughout
- `js/data/derisk-filters.js` — uses single quotes `'` throughout
- `js/auth/auth.js` — uses backtick template literals + double quotes (ES6 style)
- `js/timelineEngine.js` — uses double quotes + backticks (ES6)
- `js/timelineRenderer.js` — uses double quotes + backticks (ES6)

**Fix:** No mass rewrite needed — the split is intentional (ES5 modules use single quotes, ES6 modules use double/backtick). Document the convention. The only real inconsistency to fix is `column-map.js` and `derisk-filters.js` using single quotes while the rest of the NDP ES5 modules use double quotes. Normalise those two files to double quotes to match `ndp-data.js`, `ndp-plan.js`, etc.

---

### 5. Stray/redundant variable declarations
**File:** `js/app.js`
- `updateSearchState` function is defined (line ~72) but **never called** anywhere in the file. Dead code.
- `debounce` function is defined at the bottom of the DOMContentLoaded callback but **never called**. Dead code.

**File:** `js/ndp-app.js`
- `showEmptyStates` function is defined but **never called** (only `hideEmptyStates` is used). Dead code.

**File:** `js/ndp-risk.js`
- `var headers = NdpData.state.planHeaders;` is declared inside `getVisible()` but `headers` is never used in that function body. Dead variable.

**Fix:** Remove all four dead items.

---

### 6. Inconsistent spacing around variable declarations
**File:** `js/app.js`
- `const powDateInput  = document.getElementById(\"powDateInput\");` — double space before `=` (alignment artifact). Should be single space.

**File:** `js/icons.js`
- Icon object properties use padded alignment with multiple spaces (e.g. `home:     {`, `timeline: {`). This is intentional visual alignment — leave as-is (it's consistent within the file).

**File:** `js/data/column-map.js`
- Property values in `SOURCE_TO_INTERNAL` use padded alignment with multiple spaces. Intentional — leave as-is.

**Fix:** Only fix the `powDateInput` double-space in `app.js`.

---

### 7. Missing `"use strict"` directive
**Files affected:**
- `js/data/column-map.js` — has `'use strict'` inside the IIFE, not at file top (minor, but inconsistent with other modules that put it at the top)
- `js/data/derisk-filters.js` — **no `"use strict"` at all**
- `js/auth/auth.js` — **no `"use strict"` at all**
- `js/auth/auth-config.js` — **no `"use strict"` at all**

**Fix:**
- Add `"use strict";` to top of `derisk-filters.js`
- Add `"use strict";` to top of `auth.js` and `auth-config.js`
- Move `'use strict'` in `column-map.js` to file top (outside IIFE), matching the pattern of all other modules

---

### 8. Inconsistent comment header style
**Files with banner comments:**
- Most NDP JS files use `// ============...` banner style ✅
- `js/data/column-map.js` uses `// ============...` ✅
- `js/data/derisk-filters.js` uses `// ============...` ✅
- `js/auth/auth.js` uses a plain `// auth.js - ...` single line comment — inconsistent
- `js/auth/auth-config.js` uses `// auth-config.js` single line — inconsistent
- `js/powData.js` uses `// ============...` ✅
- `js/icons.js` — no banner at all

**Fix:** Low priority — leave auth files as-is (they're infrastructure, not app logic). Add a minimal one-line comment to `icons.js` for clarity.

---

### 9. `build.py` — open() calls without context managers
**File:** `build.py`
- `open(src_path, encoding='utf-8').read()` — file handle not explicitly closed (relies on GC)
- `open(out_path, 'w', encoding='utf-8').write(html)` — same issue

**Fix:** Wrap all `open()` calls in `with` statements.

---

### 10. `serve.py` — clean, no issues found ✅

---

## Action Plan

Work through in this order (smallest/safest first):

| # | Item | File(s) | Risk |
|---|------|---------|------|
| 1 | Remove dead functions: `updateSearchState`, `debounce` | `app.js` | Low |
| 2 | Remove dead function: `showEmptyStates` | `ndp-app.js` | Low |
| 3 | Remove dead variable: `var headers` in `getVisible()` | `ndp-risk.js` | Low |
| 4 | Fix double-space on `powDateInput` | `app.js` | Low |
| 5 | Add `"use strict"` to `derisk-filters.js`, `auth.js`, `auth-config.js` | 3 files | Low |
| 6 | Move `'use strict'` to file top in `column-map.js` | `column-map.js` | Low |
| 7 | Normalise quotes in `column-map.js` + `derisk-filters.js` to double quotes | 2 files | Medium |
| 8 | Merge duplicate `.ndp-demand-ouc` CSS rules | `ndp.css` | Low |
| 9 | Remove extra blank lines in `ndp.css` | `ndp.css` | Low |
| 10 | Normalise line endings to LF across all source files | All | Low (git handles) |
| 11 | Wrap `open()` calls in `with` in `build.py` | `build.py` | Low |
| 12 | Add one-line comment to `icons.js` | `icons.js` | Low |

---

## Status

- [x] Item 1 — Remove dead functions in app.js
- [x] Item 2 — Remove showEmptyStates in ndp-app.js
- [x] Item 3 — Remove dead var in ndp-risk.js
- [x] Item 4 — Fix double-space in app.js
- [x] Item 5 — Add "use strict" to 3 files
- [x] Item 6 — Move 'use strict' in column-map.js
- [x] Item 7 — Normalise quotes in column-map.js + derisk-filters.js
- [x] Item 8 — Merge duplicate CSS rule
- [x] Item 9 — Remove extra blank lines in ndp.css
- [x] Item 10 — Normalise line endings
- [x] Item 11 — Fix open() in build.py
- [x] Item 12 — Add comment to icons.js
