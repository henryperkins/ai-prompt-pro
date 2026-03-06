# Component Adoption Guide

Last updated: 2026-03-06

This guide defines which component paths are preferred for new work.

## Canonical imports (required)

Use these paths for all new code and migrations:

| Component | Canonical import |
| --- | --- |
| Button | `@/components/base/buttons/button` |
| Input | `@/components/base/input/input` |
| Textarea | `@/components/base/textarea` |
| Label | `@/components/base/label` |
| Badge | `@/components/base/badges/badges` |
| Select | `@/components/base/select/select` |
| Card | `@/components/base/card` |
| Dialog | `@/components/base/dialog` |
| Drawer | `@/components/base/drawer` |

Canonical `Button` API note:

- `size="icon"` is a valid canonical size.
- Legacy compatibility props remain prohibited: `variant`, `asChild`, and `size="default"`.

Canonical `Badge` API notes:

- Use `variant` (`"pill" | "subtle" | "modern"`), `tone`, and `size`.
- Legacy compatibility props `type` and `color` remain supported during migration only.
- Prefer `tone` over `color` for semantic state styling.

Do not import these deprecated paths:

- `@/components/base/primitives/button`
- `@/components/base/primitives/input`
- `@/components/base/primitives/badge`
- `@/components/base/primitives/select`
- `@/components/base/primitives/card`
- `@/components/base/primitives/drawer`
- `@/components/base/input/label`
- `@/components/base/textarea/textarea`
- `@/hooks/usePromptBuilderContext`

## Utility ownership

- Canonical class merge helper: `cx` from `@/lib/utils/cx`.
- `cn` from `@/lib/utils` is compatibility-only and currently delegates to `cx`.
- Do not introduce additional class merge helpers.

## Prop naming conventions

- Use `variant` for structural/visual style.
- Use `tone` for semantic intent.
- Use `size` for scale.
- Keep `className` as the shared escape hatch.
- Avoid mixing `type`, `variant`, and `color` for the same concept.

## Adoption status

| Area | Status | Notes |
| --- | --- | --- |
| Targeted primitive cutover (button/input/badge/select) | Completed | Enforced by `check:no-primitive-ds-imports` in strict mode. |
| Non-targeted primitive wrappers under `@/components/base/primitives/*` | Transitional | Existing usage is allowed for compatibility; avoid adding new imports when a canonical base component exists. |
| Canonical base components under `@/components/base/*` | Preferred | Default surface for new UI work. |
| Duplicate entrypoints (`input/label`, `textarea/textarea`, `primitives/card`, `primitives/drawer`) | Frozen | New usage is blocked by `check:no-duplicate-ds-entrypoints`. |

## Enforcement commands

Run before merge:

```bash
npm run check:no-duplicate-ds-entrypoints
STRICT_PRIMITIVE_IMPORTS=1 npm run check:no-primitive-ds-imports
npm run check:design-system
```

## Migration rule of thumb

When editing an existing file that imports from `@/components/base/primitives/*`:

1. Keep behavior stable first.
2. If a canonical base component exists for that primitive, migrate in the same PR when low risk.
3. If migration is high risk, keep the existing import and create a follow-up migration ticket.
