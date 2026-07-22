# Build Pipeline — Action Plan

Items identified during dev session that require a proper build pipeline to resolve cleanly.
To be addressed in next session.

---

## 1. Nav HTML Duplication

**Problem**
The full nav chrome (hamburger trigger, overlay, sidebar with brand logo + nav links + build version, theme toggle SVGs) is copy-pasted verbatim across `timeline.html`, `ndp.html`, and `ndc.html`. Any change — adding a nav link, bumping the version label, updating an icon — must be made in 3 places.

**Action**
- Introduce a templating step (e.g. a lightweight Python/Node build script, or a tool like `html-includes`)
- Extract nav chrome into a single `partials/nav.html` partial
- Each page references `<!-- include: partials/nav.html -->` and the build injects it at compile time
- The `class="active"` on the current page link should be injected by the build based on the output filename

---

## 2. `<head>` Boilerplate Duplication

**Problem**
The `<head>` block — font preconnect tags, theme-restore inline script, and the full CSS link stack — is near-identical across `timeline.html`, `ndp.html`, and `ndc.html`. Only the page-specific CSS differs.

**Action**
- Extract shared head content into `partials/head.html`
- Each page declares only its page-specific CSS additions
- Build injects the shared head partial + page-specific additions at compile time

---

## 3. Version Cache-Busting

**Problem**
`?v=5`, `?v=6`, `?v=7` query strings were manually maintained and had drifted out of sync across the same page. They were stripped in this session as they provided no value in dev.

**Action**
- Build pipeline should auto-generate a content hash suffix for all `<link>` and `<script>` tags at compile time (e.g. `styles.css?v=a3f2c1`)
- Hash derived from file content so it only changes when the file actually changes
- No manual version management needed

---

## 4. JSON Data Files — Fetch Timing Safety

**Problem**
`tech-db.json` and `directory-map.json` are now fetched asynchronously. Existing code in `constants.js`, `ndp-data.js`, `ndp-enrich.js`, and `ndp-plan.js` calls `_techDB.lookup()` and `_dm.lookup()` synchronously. A `ready()` callback was added to both loaders but existing call sites have not been audited.

**Action**
- Audit all call sites of `_techDB.lookup()`, `_techDB.has()`, `_dm.lookup()`, `_dm.prefixes()`, `_dm.oucList()`, `_dm.pwaList()`, `_dm.pwasForOucs()`
- Wrap any call sites that run at page init (not in response to user action) inside `_techDB.ready()` / `_dm.ready()` callbacks
- Consider whether data should be preloaded at app start with a loading indicator rather than lazy-loaded on first use

---

## 5. `ndc.html` Size (37 KB — Watch)

**Problem**
`ndc.html` is 37 KB and growing. It contains significant inline JS logic that belongs in a dedicated `js/ndc-app.js` module.

**Action**
- Extract all inline `<script>` blocks from `ndc.html` into `js/ndc-app.js`
- `ndc.html` should only contain HTML structure and a single `<script src="js/ndc-app.js">` reference
- Reduces HTML file to structural markup only — consistent with how `ndp.html` and `timeline.html` are structured

---

## 6. `ndp-demand.js` Size (40 KB — Watch)

**Problem**
`ndp-demand.js` is 40 KB. It likely contains distinct concerns (data processing, chart rendering, UI event handling) that have grown together.

**Action**
- Review and split into `ndp-demand-data.js` (processing) and `ndp-demand-ui.js` (rendering/events) if logical seams exist
- Target max file size of ~25 KB per module

---

## Notes

- All items above are **non-breaking** — the app works correctly as-is
- Items 1–3 are purely a build/tooling concern and should be tackled together as a single pipeline setup task
- Items 4–6 are code quality improvements that can be done independently
