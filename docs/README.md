# Documentation Index

Last updated: 2026-02-26

Use this file as the starting point for repo documentation.

## Active operational docs

- `docs/design-system.md` - canonical design-system and UI governance reference.
- `docs/component-adoption.md` - canonical component import and adoption status guide.
- `docs/neon-cutover-runbook.md` - Neon production cutover and rollback operations.
- `docs/typography-regression-checklist.md` - typography validation checks.
- `docs/community-mobile-qa-checklist.md` - manual mobile QA checks.
- `docs/community-mobile-social-backlog.md` - active backlog for mobile social UX.
- `docs/rye-prompt-build-and-enhancement.md` - prompt build and enhancement architecture.
- `docs/codex-integration-review.md` - security and architecture review findings.

## Product and design reference docs

- `docs/launch-assets-pack.md`
- `docs/launch-messaging-pack.md`
- `docs/launch-measurement-baseline.md`
- `docs/launch-experiments.md`
- `docs/design-ux-review-prompt.md`
- `docs/ux-review-prioritized.md`

## External/spec source snapshots (archived)

Snapshot references from external sources have been moved to `docs/archive/2026-02/reference-clippings/`. Re-verify against source URLs before relying on policy details:
- Apple HIG (color, typography, layout, web standards, App Store review guidelines)
- OpenAI Codex (agent loop, app server, agent skills spec)
- Untitled UI (CLI tool, text editor components)

## Archived docs

- Archived documentation lives under `docs/archive/`.
- 2026-02 archival pass details: `docs/archive/2026-02/README.md`
- External reference clippings: `docs/archive/2026-02/reference-clippings/`
- Historical root planning artifacts now live in `docs/archive/2026-02/root-planning/`.
- Historical implementation specs and audits are in:
  - `docs/archive/2026-02/plans/`
  - `docs/archive/2026-02/reviews/`

## Maintenance policy

- Keep only currently actionable runbooks/checklists in `docs/` root.
- Move completed phase plans and one-time migration checklists to `docs/archive/YYYY-MM/`.
- Preserve historical context in archive files; do not delete unless content is duplicate and safely recoverable from git history.
- Run `npm run check:docs` before merge to catch missing local doc references.
