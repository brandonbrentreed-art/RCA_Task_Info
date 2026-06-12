# Next Day Plan — Migration & Redesign

## Goal
Bring the Next Day Plan (NDP) feature from `WMS_PrePlan_Manager` into `RCA_Task_Info` as a clean, simplified new page — redesigned to fit the existing design system and architecture.

---

## Architecture Decisions

| Decision | Choice |
|----------|--------|
| Page | `ndp.html` — new top-level page |
| Nav | Added to sidebar nav in all pages |
| Styling | Uses existing `shared-ui/` tokens + `shared-components/` patterns |
| New CSS | `css/ndp.css` for page-specific styles |
| JS structure | Modular: one file per tab + shared data layer |
| External libs | `js/lib/xlsx-js-style.min.js` (export), `js/lib/html2canvas.min.js` (screenshot) |
| Data files | Bring `derisk-filters.js`, `column-map.js`, `directory-map.js`, `tech-db.js` into `js/data/` |

---

## Data Flow (Simplified)

The old app uses a multi-step home wizard. We simplify to an **inline loader** on the NDP page itself:

```
┌─────────────────────────────────────────────┐
│  NDP Page Load Bar (top of page)            │
│                                             │
│  1. Workstack toggle: Copper / Fibre        │
│  2. Upload Tech Sheet (.csv)                │
│  3. Paste Taskforce data (clipboard)        │
│  4. Upload Enrichment (Autofix or BTTW)     │
│                                             │
│  [Load Plan →]                              │
└─────────────────────────────────────────────┘
         ↓ sessionStorage persists state
┌─────────────────────────────────────────────┐
│  Tab Bar: Plan | Demand | Risk              │
└─────────────────────────────────────────────┘
```

Data persists in `sessionStorage` so refreshes / tab switches don't lose state.

### Loader UX — Dialog Pattern

The data loader lives inside a **modal/dialog** (reusing our `shared-components/modal` pattern):

- Header action bar has a **"Load Data"** icon button (folder icon — same as timeline)
- Clicking it opens the loader dialog
- Once data is loaded, dialog closes automatically
- User can reopen anytime to reload/change data
- Top-right **clear all** icon (✕) wipes session and resets page (same pattern as timeline)

```
┌─ Header ──────────────────────────────────────────────┐
│  Next Day Plan          [🔍] [📂 Load] [✕ Clear]     │
└───────────────────────────────────────────────────────┘
                              │
            ┌─────────────────▼──────────────────┐
            │  Load Data (dialog)                 │
            │                                    │
            │  ○ Copper  ● Fibre                 │
            │                                    │
            │  [Tech Sheet]     ✓ loaded          │
            │  [Taskforce]      paste here...     │
            │  [Enrichment]     ✓ loaded          │
            │                                    │
            │              [Load Plan →]          │
            └────────────────────────────────────┘
```

---

## Tabs — Redesigned

### Tab 1: Plan (Builder)

**Purpose**: The de-risked task list. Assign techs, manage rows.

| What stays | What changes |
|------------|-------------|
| Table with sortable columns, pagination | Simpler filter bar — fewer dropdowns, search-first |
| TECH PIN inline edit + drag-fill | Same interaction, cleaner cell styling |
| Commit Type tag pills | Reuse existing `shared-components` chip/pill styles |
| Add Tasks from clipboard | Keep — modal simplified |
| Delete selected rows | Keep |
| Skill Settings modal | Keep but restyle to match our modal component |

**Simplifications**:
- Remove the tag toggle row (Tail/Today/Tomorrow/Future/Fibre Priority/Manual Add) — replace with a single dropdown filter for Commit Type
- Reduce filter grid to max 4 key filters (OUC, Skills, Care Level, Task Type)
- Use our existing pagination component pattern

### Tab 2: Demand (Workstack)

**Purpose**: Pivot view showing demand vs capacity by OUC/PWA.

| What stays | What changes |
|------------|-------------|
| Pivot table (OUC, PWA, AM/PM/AllDay, Techs, Over/Short) | Cleaner table using our table.css |
| Stacked bar chart | Simplified — remove excess-only mode, keep legend toggles |
| Click-to-drilldown modals | Keep — use our modal component |
| CPE demand sub-table | Keep if Fibre workstack selected |

**Simplifications**:
- Remove the resource dialog (tech list per OUC) — low usage
- Chart: keep Tail/Due/Future + Appts toggle, drop excess filter
- Single copy button for pivot table

### Tab 3: Risk (Summary)

**Purpose**: Risk scoring — how many alternative techs can cover each task's skill in its OUC.

| What stays | What changes |
|------------|-------------|
| Risk toggle buttons (Critical/High/Medium/Low) | Keep — restyle as our pill toggles |
| Risk table (Task ID, OUC, PWA, Skill, Tech, Alts) | Keep — use our table component |
| Skill scarcity bar chart | Keep — clean horizontal bars |
| Screenshot to clipboard | Keep |
| Excel export | Keep |

**Simplifications**:
- Remove info popover (put explanation in a subtitle instead)
- Copy button copies visible rows (keep)
- Pagination uses our standard footer

---

## File Structure (New Files)

```
RCA_Task_Info/
├── ndp.html                          # New page
├── css/
│   └── ndp.css                       # Page-specific styles (tabs, charts, filters)
├── js/
│   ├── data/
│   │   ├── column-map.js             # From WMS (column resolution)
│   │   ├── derisk-filters.js         # From WMS (skill gate logic)
│   │   ├── directory-map.js          # From WMS (exchange → OUC/PWA)
│   │   ├── tech-db.js                # From WMS (PIN → name lookup)
│   │   └── constants.js              # App-wide constants (adapted)
│   ├── lib/
│   │   ├── xlsx-js-style.min.js      # Excel export
│   │   └── html2canvas.min.js        # Screenshot
│   ├── ndp-data.js                   # Data loading, parsing, enrichment
│   ├── ndp-plan.js                   # Tab 1: Plan builder
│   ├── ndp-demand.js                 # Tab 2: Demand/workstack pivot
│   └── ndp-risk.js                   # Tab 3: Risk summary
└── shared-components/
    └── tabs.css                      # New: tab bar component (reusable)
```

---

## Migration Checklist

### Phase 1: Scaffold ✅
- [x] Create `ndp.html` with nav, theme toggle, tab bar, empty panels
- [x] Create `css/ndp.css` with tab styles, chart styles, filter bar
- [x] Create `shared-components/tabs.css` for reusable tab component
- [x] Add NDP to nav in `index.html` and `timeline.html`
- [x] Add NDP card to home page
- [x] Create `js/ndp-app.js` — page controller (tabs, loader dialog, toolbar)
- [x] Create `js/data/constants.js` — NDP namespace with shared utilities
- [x] Create `js/data/` and `js/lib/` directories
- [ ] Bring over `js/lib/` files (xlsx, html2canvas) — on demand when export is built

### Phase 2: Data Layer ✅
- [x] Port `js/data/constants.js` (NDP namespace — adapted)
- [x] Port `js/data/column-map.js`
- [x] Port `js/data/derisk-filters.js` (updated PRM ref → direct string)
- [x] Port `js/data/directory-map.js`
- [ ] Port `js/data/tech-db.js` — deferred until PIN resolution needed
- [x] Create `js/ndp-enrich.js` — mapTaskforceRowToDerisk (adapted from enrich.js)
- [x] Create `js/ndp-data.js` — unified data loader
  - Workstack selection
  - Tech sheet CSV upload + parse
  - Taskforce clipboard paste + parse
  - OUC/PWA enrichment via directory-map
  - TAG + Appt Slot derivation
  - De-risk gating → plan rows
  - `sessionStorage` persistence + restore

### Phase 3: Plan Tab ✅
- [x] Create `js/ndp-plan.js`
  - Table render with sort, pagination
  - TECH PIN inline edit (click-to-edit)
  - Simplified filter bar (4 dropdowns + search)
  - Commit type pills with colour coding
  - Session persistence on PIN edits

### Phase 4: Demand Tab ✅
- [x] Create `js/ndp-demand.js`
  - Pivot table (OUC × PWA × AM/PM/AllDay/Techs/Over-Short)
  - Stacked bar chart (Tail/Due/Future segments)
  - Tech count from uploaded tech sheet
  - Future-with-appointment filtering

### Phase 5: Risk Tab ✅
- [x] Create `js/ndp-risk.js`
  - Risk scoring (alternatives count per OUC+skill)
  - Risk toggle buttons (Critical/High/Medium/Low)
  - Risk table with pagination
  - Skill scarcity horizontal bar chart (top 20)

### Phase 6: Polish ✅
- [x] Port `js/data/tech-db.js` for TECH PIN → name resolution
- [x] Wire PIN resolution in ndp-enrich.js (initial load) + ndp-plan.js (inline edit)
- [x] Add Excel export via xlsx-js-style (Export button in header)
- [x] Add screenshot to clipboard via html2canvas (Risk tab)
- [x] Add copy-to-clipboard (Risk tab — TSV format)
- [x] Add row delete (Plan tab — click to select, delete button)
- [x] Add tasks from clipboard (Plan tab — paste Taskforce rows)
- [x] Click-to-drilldown modals in Demand tab (AM/PM/AllDay cells)
- [x] Drilldown cells hover state
- [ ] Responsive tweaks (defer — desktop-first tool)
- [ ] Full dark mode QA pass
- [ ] End-to-end test with real data

---

## Design Principles (vs old app)

1. **Fewer controls visible at once** — progressive disclosure, not a wall of buttons
2. **Consistent with RCA Timeline** — same nav, same spacing, same typography
3. **No duplicated CSS** — everything references `shared-ui/theme.css` tokens
4. **Flat JS** — no build step, vanilla ES5-compat, `"use strict"`
5. **Session-resilient** — data survives page nav via sessionStorage

---

## Open Questions — Resolved

- [x] **Skill Config modal?** — Skip for now, but keep OUC/PWA mapping (directory-map) as it's needed for enrichment
- [x] **Data loader visibility?** — Use a dialog component (our existing modal pattern). User opens it, loads data, closes it. Clean.
- [x] **Clear all & restart?** — Yes. Reuse the existing top-right action icon pattern (like our clear button in timeline)
- [x] **Cross-tab drilldown → Plan?** — Yes, drilldown modals can add tasks to Plan tab

---

## Next Steps

Start with **Phase 1: Scaffold** — get the page structure in place with working nav and empty tabs, then iterate tab by tab.
