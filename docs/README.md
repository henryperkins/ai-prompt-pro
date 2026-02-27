# Documentation Index

Last updated: 2026-02-26

Use this file as the starting point for repo documentation.

## Active operational docs

- `docs/design-system.md` - canonical design-system and UI governance reference.
- `docs/component-adoption.md` - canonical component import and adoption status guide.
- `docs/neon-cutover-runbook.md` - Neon production operations, validation, and rollback runbook.
- `docs/typography-regression-checklist.md` - typography validation checks.
- `docs/community-mobile-qa-checklist.md` - manual mobile QA checks.
- `docs/community-mobile-social-backlog.md` - active backlog for mobile social UX.
- `docs/prompt-build-and-enhancement.md` - prompt build and enhancement architecture.

## Campaign and launch docs

- `docs/launch-assets-pack.md`
- `docs/launch-messaging-pack.md`
- `docs/launch-measurement-baseline.md`
- `docs/launch-experiments.md`
- Archive these to `docs/reviews/` when launch experiments and launch-window messaging are retired.

## Product/design templates

- `docs/design-ux-review-prompt.md` - reusable UX review prompt template.

## Historical review snapshots

- `docs/reviews/codex-integration-review.md` - point-in-time Codex integration audit snapshot.
- `docs/reviews/ux-review-prioritized.md` - point-in-time UX prioritization snapshot.
- `docs/reviews/community-mobile-social-backlog-2026-02.md` - original 2-sprint mobile social backlog snapshot.

## Local-only archive notes

- `docs/archive/` is a local historical workspace and is gitignored.
- Do not add required references from active docs to `docs/archive/`; keep required references in tracked docs or external source URLs.

## Maintenance policy

- Keep only currently actionable runbooks/checklists in `docs/` root.
- Move point-in-time review snapshots to `docs/reviews/` once they are superseded.
- Preserve historical context in archive files; do not delete unless content is duplicate and safely recoverable from git history.
- Run `npm run check:docs` before merge to catch missing local doc references and enforce historical warning headers in `docs/reviews/`.
