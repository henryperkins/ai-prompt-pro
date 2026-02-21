# Hookup Audit and Action Plan

Date: 2026-02-21

## Scope
- Runtime pages in `src/pages/`
- Media/theme files in `public/`

## Discovery Method
1. Classified assets as `RUNTIME`, `DOCS_ONLY`, or `NO_REF` by scanning `src/**` and `index.html`.
2. Traced provenance with `git log --follow` for each `NO_REF`/`DOCS_ONLY` candidate.
3. Checked route wiring from `src/App.tsx` and user reachability from navigation components.

## Findings: Pages

### Runtime route coverage
All page files in `src/pages/` are imported and routed in `src/App.tsx`.

### Why some pages looked "unhooked"
- `LibraryBulkEdit` is now a compatibility redirect route:
  - It reads legacy selection params and writes session selection state.
  - It immediately redirects to `/library` where bulk actions are now inline.
- This is an intentional migration path, not an orphan page.

### Page action plan
- `Keep` `src/pages/LibraryBulkEdit.tsx` as compatibility redirect.
- `Keep` all routed pages as-is.
- Optional future cleanup: remove `LibraryBulkEdit` only after confirming no inbound links/bookmarks rely on `/library/bulk-edit`.

## Findings: Media / Theme

### Root causes for unhooked files
- Template carryover: `public/placeholder.svg` from initial scaffold.
- Duplicate icon exports: non-referenced Apple icon variants added during iOS metadata update (`33c430f`) while `index.html` references the `*x*` variants.
- Intentional docs-only brand inventory: many `public/brand/*` assets are documented in `docs/design-system.md` for optional usage patterns, but not all are required at runtime.

### Remove vs implement decisions

#### Removed now (orphan/duplicate, no runtime reference)
- `public/placeholder.svg`
- `public/apple-touch-icon-120.png`
- `public/apple-touch-icon-152.png`
- `public/apple-touch-icon-167.png`
- `public/apple-touch-icon-180.png`

#### Keep (runtime)
- `public/apple-touch-icon.png`
- `public/apple-touch-icon-152x152.png`
- `public/apple-touch-icon-167x167.png`
- `public/apple-touch-icon-180x180.png`
- `public/favicon.ico`
- `public/social-card-launch.svg`
- `public/brand/pf-logo-symbol-primary-v2.png`
- `public/brand/pf-gradient-hero-light.png`
- `public/brand/pf-gradient-hero-dark.png`

#### Keep (intentional non-import/platform or docs inventory)
- `public/robots.txt` (served endpoint, not imported by app code)
- `public/staticwebapp.config.json` (Azure SWA runtime config)
- Remaining `public/brand/*` docs-only assets (intentional design inventory)

## Implementation Follow-ups
1. If the goal is to fully use all docs-only brand assets, define specific surfaces and owners first (header wordmark, profile badge surfaces, decorative frame placements).
2. If the goal is lean runtime footprint, remove unused `public/brand/*` entries only after design sign-off.
3. When compatibility window closes, remove `/library/bulk-edit` redirect route and related helper utilities.
