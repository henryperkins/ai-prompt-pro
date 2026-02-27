# Review Snapshots

Last updated: 2026-02-26

This directory stores point-in-time review outputs that are useful for historical context but should not be treated as current operational guidance.

- `codex-integration-review.md` - static Codex integration audit snapshot.
- `ux-review-prioritized.md` - UX prioritization snapshot from a prior review pass.
- `community-mobile-social-backlog-2026-02.md` - original 2-sprint community mobile backlog snapshot before status normalization.

When a review becomes dated or superseded, move it here from `docs/` root and update `docs/README.md`.

Review file convention:
- Keep `Last updated: YYYY-MM-DD` near the top.
- Add the standard warning block immediately after:
  - `> Historical snapshot.`
  - `> Do not treat this file as current operational guidance; use \`docs/README.md\` to find active docs.`
- `npm run check:docs` enforces this warning block for files in `docs/reviews/` (except this README).
