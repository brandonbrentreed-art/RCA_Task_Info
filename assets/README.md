# RCA Task Info

Lightweight RCA (Root Cause Analysis) web app built with vanilla HTML, CSS, and JavaScript. No frameworks, no build step.

## Structure

```
├── index.html                  ← App entry point
├── serve.py                    ← Dev server (python)
├── css/
│   └── styles.css              ← Page-level layout (imports shared-ui)
├── js/
│   ├── app.js                  ← Main init + event wiring
│   ├── dataLoader.js           ← CSV parsing + data store
│   ├── timelineEngine.js       ← 15-min interval bucketing + change detection
│   └── timelineRenderer.js     ← Pivot grid DOM rendering
├── shared-ui/                  ← CENTRALISED DESIGN SYSTEM
│   ├── theme.css               ← Tokens (colours, spacing, radius, shadows, typography)
│   ├── typography.css          ← MUI heading/body/caption scale
│   ├── components.css          ← btn, card, chip, divider
│   ├── layout.css              ← flex, grid, gap, margin, padding utilities
│   └── forms.css               ← field, label, input, select, textarea, toggle
├── shared-components/          ← REUSABLE UI COMPONENTS
│   ├── nav.css + nav.js        ← Off-canvas sidebar navigation
│   ├── table.css + table.js    ← Sortable table (defines --table-border)
│   ├── timeline.css            ← Pivot grid timeline
│   ├── modal.css + modal.js    ← Dialog overlay
│   ├── tooltip.css + tooltip.js← MUI tooltip (suppresses native title)
│   └── [future components]
├── assets/
│   ├── Brand_Logo.png
│   ├── Dev_Build.csv
│   └── README.md (this file)
└── .vscode/
    ├── tasks.json
    └── launch.json
```

---

## Design System Reference

### Colours

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-white` | `#FFFFFF` | Panels, backgrounds |
| `--color-navy` | `#142032` | Primary text, nav, headers |
| `--color-green` | `#43B072` | Success, active status |
| `--color-blue` | `#5488C7` | Primary actions, links |
| `--color-grey` | `#50535A` | Body text, secondary |
| `--color-page-bg` | `#e8eaed` | Page background |
| `--color-grey-100` | `#f5f5f5` | Subtle backgrounds |
| `--color-grey-200` | `#e0e0e0` | Borders (light) |
| `--color-grey-300` | `#bdbdbd` | Borders (defined — inputs, tables) |
| `--color-grey-light` | `#8a8d93` | Captions, placeholders |
| `--color-divider` | `rgba(20,32,50,0.12)` | Section dividers |
| `--color-error` | `#d32f2f` | Errors, breaches |
| `--color-warning` | `#ed6c02` | Changes, warnings |
| `--color-info` | `#0288d1` | Info states |
| `--color-success` | `#43B072` | Positive states |

Extended nuance colours: `--color-navy-light`, `--color-green-light`, `--color-green-dark`, `--color-blue-light`, `--color-blue-dark`.

### Typography

| Token | Size | Usage |
|-------|------|-------|
| `--text-h1` | 2.125rem (34px) | Page titles |
| `--text-h2` | 1.5rem (24px) | Section headings |
| `--text-h3` | 1.25rem (20px) | Card headings |
| `--text-h4` | 1.125rem (18px) | Sub-headings |
| `--text-body1` | 1rem (16px) | Default body |
| `--text-body2` | 0.875rem (14px) | Secondary text, table cells |
| `--text-caption` | 0.75rem (12px) | Labels, metadata |

Font: **Roboto** (loaded from Google Fonts)
Weights: `--font-weight-light` (300), `--font-weight-regular` (400), `--font-weight-medium` (500), `--font-weight-bold` (700)

### Spacing

4px base grid: `--spacing-1` (4px) through `--spacing-10` (40px).

### Shape

`--radius: 2px` — Enterprise feel, applied to all components.

### Shadows (Elevation)

| Token | Usage |
|-------|-------|
| `--shadow-1` | Cards, buttons |
| `--shadow-2` | App panel, elevated surfaces |
| `--shadow-3` | Modals, overlays |

### Transitions

| Token | Duration |
|-------|----------|
| `--transition-fast` | 150ms |
| `--transition-standard` | 250ms |

### Table Border

Defined in `shared-components/table.css`:
```css
--table-border: 1px solid var(--color-grey-300);
```
Use for ALL table/grid outer borders and cell dividers.

---

## Rules for Future Builds

### NEVER hardcode values

- Colours → use `var(--color-*)` tokens (including `var(--color-white)` not `#fff`)
- Font sizes → use `var(--text-*)` tokens
- Font weights → use `var(--font-weight-*)` tokens
- Spacing/padding/margin → use `var(--spacing-*)` tokens
- Border radius → use `var(--radius)`
- Shadows → use `var(--shadow-*)` tokens
- Transitions → use `var(--transition-*)` tokens
- Table/grid borders → use `var(--table-border)`
- Icon sizes → 24px standard, 28px for nav trigger
- Touch targets → 48px minimum (MUI standard)
- Hover states → `rgba(20, 32, 50, 0.08)` for light surfaces, `rgba(255, 255, 255, 0.12)` for dark surfaces

### Component usage

- Buttons → `btn btn-primary | btn-success | btn-outlined | btn-text`
- Icon buttons → `icon-btn` (48px circular, hover state built-in)
- Inputs → `input` | `input-sm` | `input-lg`
- Cards → `card`
- Chips → `chip` (with optional `chip-dismiss` button inside, `chip-count` for overflow)
- Tooltips → add class `tooltip` + `data-tooltip="text"` (placement: default bottom, `tooltip-top`, `tooltip-left`, `tooltip-right`)
- Loader → `loader-spinner` (circular), `loader-linear` (bar), `loader-overlay` (full area with text)
- Search → `search-expand` wrapper with `search-toggle` icon-btn + `search-input` (expands on click)
- Layout → `flex`, `flex-col`, `grid`, `grid-2/3/4`, `gap-*`, `mt-*`, `mb-*`, `p-*`
- Typography → `text-h1` through `text-h4`, `text-body1`, `text-body2`, `text-caption`, `text-overline`

### Page layout pattern

```
body (--color-page-bg, padding: --spacing-6, viewport-locked)
  └── #app (white panel, --shadow-2, --radius, border: --color-grey-200)
        ├── header (flex-shrink:0, border-bottom divider)
        ├── .query-bar (flex-shrink:0)
        └── .results-area (flex:1, overflow:auto)
```

### Adding new components

1. Create CSS + JS in `shared-components/`
2. Use only theme tokens — no raw values
3. Link CSS in `<head>`, JS before `</body>`
4. Follow MUI naming/sizing conventions (48px touch targets, 24px icons, 4px grid)
5. All interactive icons use `icon-btn` class (48px circle, circular hover)
6. Disabled state: `opacity: 0.38` + `pointer-events: none`

### Tooltip system

Native `title` attributes are **suppressed** app-wide. The `tooltip.js` auto-converts any `title` to `data-tooltip` and adds the custom tooltip class. Use `data-tooltip` directly for best practice.

---

## Running

```bash
python serve.py
```

Kills any existing process on port 8080, starts fresh server, opens browser.

Or via VS Code: `Ctrl+Shift+B` (default build task).
