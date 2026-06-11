# RCA Task Info

Lightweight RCA (Root Cause Analysis) web app built with vanilla HTML, CSS, and JavaScript. No frameworks, no build step.

## Architecture Overview

```
┌─────────────┐       ┌──────────────────┐       ┌────────────┐
│   Browser   │──────▶│  Frontend (Nginx) │       │  BigQuery  │
│  (Entra ID  │       │  Cloud Run        │       └─────▲──────┘
│   MSAL.js)  │       └──────────────────┘             │
│             │                                        │
│             │       ┌──────────────────┐             │
│             │──────▶│  API (Flask)      │─────────────┘
│             │ Bearer│  Cloud Run        │  SA identity
└─────────────┘ token └──────────────────┘
```

- **Auth**: Microsoft Entra ID (MSAL.js in browser → Bearer token → API validates via JWKS)
- **Frontend**: Static HTML/CSS/JS served by Nginx container on Cloud Run
- **API**: Flask + BigQuery client, parameterised queries only (no raw SQL)
- **Data**: BigQuery (accessed via service account, not user credentials)
- **IaC**: Terraform (GCP provider)
- **CI/CD**: GitLab CI → Cloud Build → Artifact Registry → Terraform apply

## Structure

```
├── index.html                  ← App entry point
├── ndc.html                    ← NDC page
├── timeline.html               ← Timeline page
├── auth-guard.html             ← Auth gate (redirects unauthenticated users)
├── serve.py                    ← Dev server (python)
├── Launch.bat                  ← Windows launch script
├── Dockerfile                  ← Frontend container image
├── nginx.conf                  ← Nginx config for containerised frontend
├── .gitlab-ci.yml              ← CI/CD pipeline definition
├── .gitattributes
├── api/                        ← BACKEND API (Cloud Run)
│   ├── main.py                 ← Flask application (Entra token validation + BigQuery)
│   ├── requirements.txt        ← Python dependencies
│   └── Dockerfile              ← API container image
├── css/
│   └── styles.css              ← Page-level layout (imports shared-ui)
├── js/
│   ├── app.js                  ← Main init + event wiring
│   ├── dataLoader.js           ← CSV parsing + data store
│   ├── timelineEngine.js       ← 15-min interval bucketing + change detection
│   ├── timelineRenderer.js     ← Pivot grid DOM rendering
│   └── auth/                   ← AUTHENTICATION
│       ├── auth-config.js      ← Entra ID / MSAL config
│       └── auth.js             ← Auth logic (login, token, guard)
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
│   ├── loader.css              ← Spinner / linear / overlay loaders
│   ├── notify.css + notify.js  ← Toast notifications
│   └── pagination.js           ← Pagination logic
├── terraform/                  ← INFRASTRUCTURE AS CODE
│   ├── main.tf                 ← Cloud Run, Artifact Registry, IAM
│   └── iam.tf                  ← Service account permissions
├── assets/
│   ├── Brand_Logo.png
│   ├── favicon-light.svg
│   ├── Idenna_x_Open_Reach_screen_shots_300dpi-11.jpg
│   └── README.md (this file)
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

`--radius: 4px` — Enterprise feel, applied to all components.

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

Defined in `shared-ui/theme.css`:
```css
--table-border: 1px solid var(--color-grey-300);
```
Use for ALL table/grid outer borders and cell dividers.

### Nav Brand Logo

The navigation sidebar uses an inline SVG wordmark (`openreach`) with `fill="currentColor"` to inherit `var(--nav-text)`. No external image dependency — adapts to light/dark themes automatically.

### Component Sizes (MUI-guided)

All component dimensions are centralised in `shared-ui/theme.css`. Zero hardcoded pixel values across shared CSS.

#### Icons

| Token | Size | Usage |
|-------|------|-------|
| `--size-icon-xs` | 16px | Inline indicators, dismiss/remove icons |
| `--size-icon-sm` | 20px | Secondary actions, toast icons |
| `--size-icon-md` | 24px | Standard icon (MUI default) |
| `--size-icon-lg` | 40px | Prominent icons, card icons |

#### Touch Targets

| Token | Size | Usage |
|-------|------|-------|
| `--size-btn-touch` | 48px | Primary interactive (hamburger, theme toggle, icon-btn) |
| `--size-btn-sm` | 36px | Compact interactive (modal close) |
| `--size-btn-xs` | 32px | Dense interactive (pagination arrows) |

#### Navigation

| Token | Size | Usage |
|-------|------|-------|
| `--size-nav-width` | 260px | Drawer width (MUI standard 240–320) |
| `--size-nav-logo` | 40px | Brand mark max-height |

#### Surfaces

| Token | Size | Usage |
|-------|------|-------|
| `--size-modal-sm` | 360px | Confirmation dialogs |
| `--size-modal-md` | 500px | Standard modal |
| `--size-modal-lg` | 720px | Content-heavy modal |
| `--size-dialog` | 400px | Alert/confirm dialog |
| `--size-toast-max` | 360px | Snackbar / toast |

#### Form Controls

| Token | Size | Usage |
|-------|------|-------|
| `--size-toggle-width` | 36px | Switch track width |
| `--size-toggle-height` | 20px | Switch track height |
| `--size-toggle-knob` | 16px | Switch thumb |
| `--size-chip-radius` | 16px | Chip pill shape |
| `--size-chip-dismiss` | 18px | Chip close button |
| `--size-textarea-min` | 100px | Textarea minimum height |
| `--size-search-width` | 200px | Expanded search field |
| `--size-select-arrow` | 18px | Dropdown caret icon |

#### Feedback

| Token | Size | Usage |
|-------|------|-------|
| `--size-spinner` | 36px | Circular progress |
| `--size-spinner-sm` | 20px | Inline circular progress |
| `--size-progress-height` | 4px | Linear progress bar |
| `--size-tooltip-font` | 11px | Tooltip text (MUI uses 10–11px) |

#### Misc

| Token | Size | Usage |
|-------|------|-------|
| `--size-avatar` | 40px | User avatar (MUI default) |

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
- Component sizes → use `var(--size-*)` tokens (icons, buttons, modals, form controls)
- Icon sizes → `var(--size-icon-md)` standard, never hardcode px values
- Touch targets → `var(--size-btn-touch)` minimum (48px, MUI accessibility standard)
- Hover states → use `var(--hover-overlay)` for light surfaces, `var(--nav-hover)` for dark surfaces

### Component usage

- Buttons → `btn btn-primary | btn-success | btn-outlined | btn-text`
- Icon buttons → `icon-btn` (`var(--size-btn-touch)` circular, hover state built-in)
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
4. Follow MUI naming/sizing conventions — use `var(--size-*)` tokens, never hardcode
5. All interactive icons use `icon-btn` class (`var(--size-btn-touch)` circle, circular hover)
6. Disabled state: `opacity: 0.38` + `pointer-events: none`

### Tooltip system

Native `title` attributes are **suppressed** app-wide. The `tooltip.js` auto-converts any `title` to `data-tooltip` and adds the custom tooltip class. Use `data-tooltip` directly for best practice.

---

## CI/CD Pipeline (.gitlab-ci.yml)

Triggered on push to `main`. Three jobs:

| Stage | Job | What it does |
|-------|-----|--------------|
| build | `build-frontend` | Cloud Build → pushes `frontend:SHA` + `:latest` to Artifact Registry |
| build | `build-api` | Cloud Build → pushes `api:SHA` + `:latest` to Artifact Registry |
| deploy | `terraform-deploy` | `terraform init` + `apply -auto-approve` with project vars |

GCP Project: `or-tfconfig-dec-exp-prod`
Region: `europe-west2`
Registry: `europe-west2-docker.pkg.dev/or-tfconfig-dec-exp-prod/rca-task-info`

---

## Terraform / Infrastructure

### What it provisions

| Resource | Purpose |
|----------|--------|
| `google_cloud_run_v2_service.frontend` | Static frontend (Nginx), public, scales 0→3 |
| `google_cloud_run_v2_service.api` | FastAPI backend, public (token-validated), scales 0→5 |
| IAM: `bigquery.dataViewer` + `bigquery.jobUser` | API SA → BigQuery access |
| IAM: `cloudbuild.builds.editor` + `artifactregistry.writer` + `run.admin` + `iam.serviceAccountUser` | Deployer SA → CI/CD permissions |

### Variables required

| Variable | Source |
|----------|--------|
| `project_id` | GCP project |
| `region` | Default `europe-west2` |
| `image_tag` | Set by CI (commit SHA or `latest`) |
| `api_service_account` | Pre-created SA for the API |
| `deployer_sa_email` | Pre-created SA for GitLab CI |
| `entra_tenant_id` | Azure Entra ID |
| `entra_client_id` | Entra App Registration |

### Pre-requisites (one-time)

1. **Artifact Registry** — create the container repo:
   ```bash
   gcloud artifacts repositories create rca-task-info \
     --repository-format=docker \
     --location=europe-west2
   ```
2. **Service Accounts** — create API SA + Deployer SA in GCP IAM
3. **Entra App Registration** — create in Azure, expose scope `access_as_user`, set redirect URI after first deploy
4. **GitLab CI/CD Variables** — add: `GCP_SA_KEY`, `DEPLOYER_SA_EMAIL`, `entra_tenant_id`, `entra_client_id`

### Outputs

| Output | Value |
|--------|-------|
| `frontend_url` | Cloud Run URL for the frontend |
| `api_url` | Cloud Run URL for the API |

After first deploy, update `js/auth/auth-config.js` → `apiBaseUrl` with the `api_url` output, then rebuild and push.

---

## Running (local dev)

```bash
python serve.py
```

Kills any existing process on port 8080, starts fresh server, opens browser.

Or via VS Code: `Ctrl+Shift+B` (default build task).
