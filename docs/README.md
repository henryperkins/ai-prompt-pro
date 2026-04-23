# Documentation Index

Last updated: 2026-04-23

Use this file as the starting point for repo documentation.

## Active operational docs

- `docs/builder-workflow-reference.md` - current builder workflow, vocabulary, and visual artifact reference for the shipped `/` route.
- `docs/design-system.md` - canonical design-system and UI governance reference.
- `docs/component-adoption.md` - canonical component import and adoption status guide.
- `docs/design-system-baseline-inventory.md` - generated baseline inventory for DS refactor planning.
- `docs/design-system-state-matrix.md` - live state coverage artifact for primitives and branded wrappers.
- `docs/design-system-state-matrix-template.md` - reusable state coverage template for core primitives.
- `docs/neon-cutover-runbook.md` - Neon production operations, validation, and rollback runbook.
- `docs/migration-neon-to-cloudflare.md` - Neon-to-Cloudflare migration runbook and status reference.
- `docs/typography-regression-checklist.md` - typography validation checks.
- `docs/community-mobile-qa-checklist.md` - manual mobile QA checks.
- `docs/community-mobile-social-backlog.md` - active backlog for mobile social UX.
- `docs/github-context-reference.md` - GitHub repository-context setup, constraints, and verification guide.

## Active planning docs

- `docs/plans/2026-03-13-builder-review-findings-remediation.md` - implementation plan and execution log for the 2026-03-13 builder UX/design-system review covering vocabulary normalization, pre-run hierarchy, draft-state compression, control architecture, reset demotion, mobile glanceability, accessibility hardening, degraded-service handling, and the scripted review-artifact refresh flow.
- `docs/plans/2026-03-26-cloudflare-regressions-remediation.md` - implementation plan for the Cloudflare migration regressions covering auth truthfulness, session refresh, profile consistency, persistence invariants, share contract fixes, and worker-backed test alignment.
- `docs/plans/2026-03-12-agent-service-refactoring.md` - phased decomposition of the monolithic `agent_service/codex_service.mjs` into dedicated modules (config, logging, HTTP/SSE helpers, enhancement orchestration, URL extraction, router).
- `docs/plans/2026-03-06-web-search-activity-visibility.md` - plan for surfacing Codex web-search item lifecycle events to the enhancement UI.
- `docs/plans/2026-03-16-github-integration-recommendation.md` - reviewed baseline recommendation for the GitHub repo-integration feature.
- `docs/plans/2026-03-16-github-integration-recommendation-critique.md` - critique of the above recommendation against the current codebase and deployment topology.
- `docs/plans/2026-03-16-github-integration-implementation.md` - concrete phased implementation plan for GitHub repo integration (Octokit + GitHub App, context assembly, UI).
- `docs/plans/2026-03-16-github-integration-plan-review-codex.md` - Codex review of the implementation plan.
- `docs/plans/2026-03-16-github-integration-plan-review-architect.md` - architect review of the implementation plan.
- `docs/plans/2026-03-16-github-sandbox-exploration-approach.md` - sandbox filesystem approach for autonomous repo exploration, dependent on the GitHub-integration Phase 1 connection flow.

## Agentic-worker plans

- `docs/superpowers/plans/2026-03-17-auth-neon-github-hardening.md` - plan authored for `superpowers:subagent-driven-development` / `superpowers:executing-plans` covering auth, Neon, and GitHub-integration hardening.

## Campaign and launch docs

- `docs/launch-assets-pack.md`
- `docs/launch-messaging-pack.md`
- `docs/launch-measurement-baseline.md`
- `docs/launch-experiments.md`
- Archive these to `docs/reviews/` when launch experiments and launch-window messaging are retired.

## Product/design templates

- `docs/design-ux-review-prompt.md` - reusable UX review prompt template.

## Evaluation sets

- `docs/evals/prompt-enhancement-eval-set.md` - curated eval set for the prompt enhancement pipeline.

## Historical review snapshots

- `docs/reviews/codex-integration-review.md` - point-in-time Codex integration audit snapshot.
- `docs/reviews/ux-review-prioritized.md` - point-in-time UX prioritization snapshot.
- `docs/reviews/community-mobile-social-backlog-2026-02.md` - original 2-sprint mobile social backlog snapshot.
- `docs/reviews/builder-workflow-ux-analysis.md` - end-to-end builder workflow UX analysis (2026-03-12).
- `docs/reviews/2026-03-09-audit-6f12621-through-head.md` - commit-range audit from PR #7 merge through HEAD.
- `docs/reviews/2026-03-09-audit-3ae0c61-post-enhance-phase0.md` - post-merge audit for commit `3ae0c61`.
- `docs/reviews/2026-03-09-audit-combined-6f12621-through-head.md` - consolidated audit covering the above ranges.
- `docs/reviews/2026-03-09-findings-remediation-plan.md` - verified remediation plan derived from the 2026-03-09 audits (superseded by shipped fixes).
- `docs/reviews/2026-03-13-community-user-blocks-remediation.md` - resolved remediation plan for the missing `community_user_blocks` table.
- `docs/reviews/2026-03-26-auth-security-review.md` - point-in-time authentication/security review of the Cloudflare auth migration.

## Local-only archive notes

- `docs/archive/` is a local historical workspace and is gitignored.
- Do not add required references from active docs to `docs/archive/`; keep required references in tracked docs or external source URLs.

## Maintenance policy

- Keep only currently actionable runbooks/checklists in `docs/` root.
- Place all repository planning documents under `docs/plans/` (dated `YYYY-MM-DD-slug.md`). Do not introduce a top-level `plans/` directory.
- Move point-in-time review snapshots to `docs/reviews/` once they are superseded; each review must start with a `Last updated:` line and the standard historical-snapshot warning block enforced by `npm run check:docs`.
- Preserve historical context in archive files; do not delete unless content is duplicate and safely recoverable from git history.
- Run `npm run check:docs` before merge to catch missing local doc references and enforce historical warning headers in `docs/reviews/`.

