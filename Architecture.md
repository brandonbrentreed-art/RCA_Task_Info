# Architecture

**Task Diagnostics Hub** — a static single-page app served via nginx (or locally via `serve.py`). No framework. Vanilla JS (ES5 for app modules, ES6 for timeline engine). Built from source templates into `dist/` by `build.py`.

---

## How the app loads

```
Browser → auth-guard.html → (SSO) → index.html
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼               ▼
                     home.html    timeline.html      ndp.html    ndc.html
                     (iframe)       (iframe)         (iframe)    (iframe)
```

`index.html` is the shell. It owns the nav sidebar and theme toggle. Each tool runs in a persistent `<iframe>` — switching pages just toggles `is-active`, so state is never lost. `home.html` cards post a `navigate` message to the parent shell to switch frames.

---

## Root files

| File | What it is |
|------|-----------|
| `index.html` | Shell page. Owns nav, theme toggle, iframe switching. Never reloads iframes. |
| `home.html` | Landing page loaded in the home iframe. Hero + tool cards. No nav chrome. |
| `timeline.html` | RCA Timeline tool. Loads CSV snapshots, traces task changes by JIN ID. |
| `ndp.html` | Next Day Plan tool. Three tabs: Plan, Demand, Risk. |
| `ndc.html` | NDC Allocation tool. Upload/preview task allocation files. |
| `auth-guard.html` | Entry point. Runs BT SSO via MSAL, then redirects to `index.html`. |
| `build.py` | Build pipeline. Injects partials, sets active nav, content-hashes asset URLs. Outputs to `dist/`. |
| `serve.py` | Dev server. Runs `build.py` then serves `dist/` on `localhost:8080`. |
| `Dockerfile` | Multi-stage build. Python stage runs `build.py`, nginx stage serves `dist/`. |
| `nginx.conf` | nginx config. Entry point is `auth-guard.html`. Static assets cached 1 year. |
| `Launch.bat` | Windows shortcut to run `serve.py`. |

---

## Source vs dist

**Never edit `dist/` directly.** It is generated output and is gitignored.

```
Source (root)          →   build.py   →   dist/
  timeline.html                              timeline.html  (partials injected, assets hashed)
  ndp.html                                   ndp.html
  ndc.html                                   ndc.html
  index.html                                 index.html     (assets hashed only)
  home.html                                  home.html
  auth-guard.html                            auth-guard.html
  partials/head.html   (injected)
  partials/nav.html    (injected, active link set)
  css/, js/, shared-ui/, shared-components/, assets/   (copied verbatim)
```

---

## Directories

| Directory | What it contains |
|-----------|-----------------|
| `js/` | All application JavaScript (see JS modules below) |
| `js/data/` | Data constants, column maps, skill filters, async data loaders |
| `js/auth/` | MSAL auth config and token/API helper |
| `js/lib/` | Vendored third-party libs (xlsx, html2canvas) — do not edit |
| `css/` | Page-specific CSS (`styles.css` for timeline, `ndp.css` for NDP) |
| `shared-ui/` | Design system CSS (theme, typography, layout, components, forms, responsive) |
| `shared-components/` | Reusable UI component CSS + JS (nav, modal, table, tabs, tooltip, notify, loader, pagination, search) |
| `partials/` | Build-time HTML fragments injected into template pages |
| `assets/` | Favicon, hero image, demo CSV |
| `cloud_functions/` | Backend Cloud Function (Python, BigQuery) for live Pool of Work API |

---

## JS modules

### Timeline page
| File | Role |
|------|------|
| `app.js` | Page controller. JIN input, chip management, session restore, export. |
| `dataLoader.js` | CSV parser and in-memory index. `queryByJinIds()`, `parseDate()`. |
| `timelineEngine.js` | Builds interval timelines from snapshot rows. Detects status/tech/WM/pin changes. |
| `timelineRenderer.js` | Renders pivot grid and task detail modal. Pagination, sort, copy. |
| `powData.js` | Live API data layer. Calls backend `pool_of_work` query, converts to CSV for DataLoader. |

### NDP page
| File | Role |
|------|------|
| `ndp-app.js` | Page controller. Tab switching, loader modal, toolbar state, session restore. |
| `ndp-data.js` | Data loading and parsing. Tech sheet CSV, Taskforce clipboard, enrichment files, OUC/PWA resolution, sessionStorage persistence. |
| `ndp-enrich.js` | Maps Taskforce rows into `DERISK_COLUMNS` format. Derives OUC/PWA, TAG, Appt Slot, Tech Name. |
| `ndp-plan.js` | Plan tab. Table with sort, pagination, filter dropdowns, inline TECH PIN editing, row select/delete, add from clipboard. |
| `ndp-demand.js` | Demand tab. OUC×PWA pivot table, drilldown modal, overflow filter, chart interaction. |
| `ndp-demand-data.js` | Secondary table builders for Demand tab (copper ageing buckets, fibre priority). |
| `ndp-demand-ui.js` | Chart rendering helpers (grid lines, bar columns, OUC grouping). |
| `ndp-risk.js` | Risk tab. Scores tasks by alternative tech count per OUC+skill. Toggle filters, scarcity chart, screenshot/copy. |
| `ndp-tf-parser.js` | Parses Taskforce clipboard (HTML or TSV) into `{ headers, rows }`. |

### NDC page
| File | Role |
|------|------|
| `ndc-app.js` | Full NDC page controller. Upload preview, table rendering, search, clock/cutoff logic. |

### Shared data
| File | Role |
|------|------|
| `js/data/constants.js` | `NDP` namespace. Magic numbers, export theme colours, tag/slot/risk helpers, `escapeHtml`, `canonicalKey`, `resolveTech`. |
| `js/data/column-map.js` | `COL_MAP`. Maps raw Taskforce header names to internal names and builder column names. |
| `js/data/derisk-filters.js` | Skill pattern list, wildcard matcher, `deriskGateRow()`, `DERISK_COLUMNS` definition. |
| `js/data/tech-db.js` | Async loader for `tech-db.json`. Exposes `_techDB.lookup()`, `_techDB.ready()`. |
| `js/data/directory-map.js` | Async loader for `directory-map.json`. Exposes `_dm.lookup()`, `_dm.oucList()`, `_dm.pwasForOucs()`. |
| `icons.js` | SVG path data and `iconSvg()` helper used across all pages. |

### Auth
| File | Role |
|------|------|
| `js/auth/auth-config.js` | Environment config (`entraClientId`, `apiBaseUrl`, `devMode` flag). |
| `js/auth/auth.js` | MSAL init, silent/interactive token acquisition, `apiCall()` helper. |

---

## Build pipeline (`build.py`)

1. Reads `partials/head.html` and `partials/nav.html`
2. For each **partial page** (`timeline.html`, `ndp.html`, `ndc.html`):
   - Replaces `<!-- include: partials/head.html -->` with shared head content
   - Replaces `<!-- include: partials/nav.html -->` with nav, adding `class="active"` to the matching link
   - Content-hashes all local `<link href>` and `<script src>` URLs (`?v=<md5[:6]>`)
3. For each **plain page** (`index.html`, `home.html`, `auth-guard.html`): hash injection only
4. Copies `css/`, `js/`, `shared-ui/`, `shared-components/`, `assets/` verbatim into `dist/`

---

## Data files (gitignored — sensitive)

| File | Contents |
|------|----------|
| `js/data/tech-db.json` | Staff PINs → name + job title lookup |
| `js/data/directory-map.json` | Group Code → OUC + PWA mapping per workstack |

---

## Dev workflow

```bash
# Run locally
python serve.py          # builds dist/ then serves on localhost:8080

# Build only
python build.py

# Deploy (Docker)
docker build -t task-hub .
docker run -p 80:80 task-hub
```
