# Component Adoption Guide

Last updated: 2026-02-26

This guide defines which component paths are preferred for new work.

## Canonical imports (required)

Use these paths for all new code and migrations:

| Component | Canonical import |
| --- | --- |
| Button | `@/components/base/buttons/button` |
| Input | `@/components/base/input/input` |
| Badge | `@/components/base/badges/badges` |
| Select | `@/components/base/select/select` |

Do not import these deprecated paths:

- `@/components/base/primitives/button`
- `@/components/base/primitives/input`
- `@/components/base/primitives/badge`
- `@/components/base/primitives/select`

## Adoption status

| Area | Status | Notes |
| --- | --- | --- |
| Targeted primitive cutover (button/input/badge/select) | Completed | Enforced by `check:no-primitive-ds-imports` in strict mode. |
| Non-targeted primitive wrappers under `@/components/base/primitives/*` | Transitional | Existing usage is allowed for compatibility; avoid adding new imports when a canonical base component exists. |
| Canonical base components under `@/components/base/*` | Preferred | Default surface for new UI work. |

## Enforcement commands

Run before merge:

```bash
STRICT_PRIMITIVE_IMPORTS=1 npm run check:no-primitive-ds-imports
npm run check:design-system
```

## Migration rule of thumb

When editing an existing file that imports from `@/components/base/primitives/*`:

1. Keep behavior stable first.
2. If a canonical base component exists for that primitive, migrate in the same PR when low risk.
3. If migration is high risk, keep the existing import and create a follow-up migration ticket.
