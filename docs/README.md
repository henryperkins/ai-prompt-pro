# Documentation Index

Last updated: 2026-03-13

Use this file as the starting point for repo documentation.

## Active operational docs

- `docs/design-system.md` - canonical design-system and UI governance reference.
- `docs/component-adoption.md` - canonical component import and adoption status guide.
- `docs/design-system-baseline-inventory.md` - generated baseline inventory for DS refactor planning.
- `docs/design-system-state-matrix.md` - live state coverage artifact for primitives and branded wrappers.
- `docs/design-system-state-matrix-template.md` - reusable state coverage template for core primitives.
- `docs/neon-cutover-runbook.md` - Neon production operations, validation, and rollback runbook.
- `docs/typography-regression-checklist.md` - typography validation checks.
- `docs/community-mobile-qa-checklist.md` - manual mobile QA checks.
- `docs/community-mobile-social-backlog.md` - active backlog for mobile social UX.
- `prompt-build-and-enhancement.md` - prompt build and enhancement architecture.

## Active planning docs

- `docs/plans/2026-03-13-builder-review-findings-remediation.md` - umbrella implementation plan for the 2026-03-13 builder UX/design-system review covering vocabulary normalization, pre-run hierarchy, draft-state compression, control architecture, reset demotion, mobile glanceability, accessibility hardening, degraded-service handling, and artifact refresh.
- `docs/plans/2026-03-12-output-panel-review-state-regressions-remediation.md` - step-by-step remediation plan for the reviewed output-panel lifecycle regression, stale archived-detail contract drift, and missing post-settle enhancement coverage.
- `docs/plans/2026-03-12-prompt-enhancer-in-progress-ui-remediation.md` - completed remediation record and validation log for the screenshot-driven enhancer UI/workflow review covering preview-first hierarchy, trust-state clarity, action gating, scoring semantics, and layout balance.
- `docs/plans/2026-03-12-prompt-builder-enhancer-workflow-remediation.md` - completed remediation record and validation log for the prompt builder / enhancer workflow fixes across mobile session access, stale enhancement preview drift, guest session-state gating, and structured constraint round-tripping.
- `docs/plans/2026-03-12-enhance-retry-regression-remediation.md` - step-by-step remediation plan for the reviewed ai-client retry-state surfacing, HTTP rate-limit hint propagation, and docs drift gaps in the current transport diff.
- `docs/plans/2026-03-12-agent-service-hardening-remediation.md` - step-by-step remediation plan for the remaining agent-service operational, security, and maintainability gaps.
- `docs/plans/2026-03-09-prompt-enhancement-improvements.md` - broader prompt enhancement roadmap and implementation ordering.
- `docs/plans/2026-03-09-telemetry-findings-remediation.md` - step-by-step remediation plan for the verified enhancement telemetry gaps.
- `docs/plans/2026-03-10-prompt-enhancement-verification-remediation.md` - step-by-step remediation plan for the remaining prompt-enhancement verification gaps.
- `docs/plans/2026-03-10-prompt-enhancement-ui-surface-remediation.md` - follow-up plan for UI-surface classification, telemetry exports, and mobile enhancement-control parity.

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
