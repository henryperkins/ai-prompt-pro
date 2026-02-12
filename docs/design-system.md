# AI Prompt Pro Design System

## 1) System Overview

This project uses a **token-first design system** built on:

- CSS custom properties in `:root` and `.dark` (source of truth)
- Tailwind theme extensions mapped to those tokens
- Radix + shadcn-style UI primitives standardized for typography, spacing, and interaction

Primary source files:

- `src/index.css`
- `tailwind.config.ts`
- `src/components/ui/*`

---

## 2) Design Principles

1. **Semantic tokens over hardcoded values**
   - Color, type, radius, and shadow values are defined as tokens.
2. **System fonts only**
   - No external web-font dependency in runtime.
3. **Mobile-first ergonomics**
  - Controls are touch-friendly by default (`h-11` / ~44px) and default/small controls are denser on desktop (`sm:h-9`/`sm:h-10`).
4. **Readable, consistent typography**
   - Shared scale and line-height tokens are applied globally and in component primitives.
5. **Accessible interactions**
   - Focus rings, reduced-motion support, and tabular numerics for data-heavy UI.

---

## 3) Color System (HSL Tokens)

All semantic colors are tokenized in HSL.

### Core semantic tokens

- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--popover`, `--popover-foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### Specialized token groups

- `--sidebar-*` (sidebar semantic palette)
- `--chart-*` (chart color set)
- Delight/brand motion accents:
  - `--delight-warm`, `--delight-cool`, `--delight-glow`, `--delight-surface`

Dark mode overrides the same semantic tokens under `.dark`.

---

## 4) Typography System

## 4.1 Font Families

- `--font-sans`: system sans stack
- `--font-serif`: system serif stack
- `--font-mono`: system mono stack

Tailwind maps these to `font-sans`, `font-serif`, and `font-mono`.

## 4.2 Type Scale Tokens

Defined as paired size/line-height tokens:

- `--type-2xs-size` / `--type-2xs-line`
- `--type-xs-size` / `--type-xs-line`
- `--type-sm-size` / `--type-sm-line`
- `--type-base-size` / `--type-base-line`
- `--type-lg-size` / `--type-lg-line`
- `--type-xl-size` / `--type-xl-line`
- `--type-2xl-size` / `--type-2xl-line`
- `--type-3xl-size` / `--type-3xl-line`
- `--type-4xl-size` / `--type-4xl-line`
- `--type-5xl-size` / `--type-5xl-line`

Tracking tokens:

- `--type-label-caps-tracking`
- `--type-label-shortcut-tracking`

## 4.3 Global Base Typographic Rules

- Body defaults to `font-sans`, `text-sm` on mobile and `text-base` at `sm+`, antialiased.
- Headings use semantic size + weight rules from token scale.
- Paragraph/control text defaults to `--type-sm` on mobile.
- At `sm` breakpoint (`min-width: 640px`), body/control copy scales up to `--type-base`.
- Code-like elements (`code`, `pre`, `kbd`, `samp`) use `--font-mono` with tabular numerics.

## 4.4 Global Typography Utility Classes

Shared utility roles are available globally (not only in community-scoped typography):

- `.type-label-caps`
  - Uppercase semantic labels with `--type-label-caps-tracking`.
- `.type-label-shortcut`
  - Keyboard/shortcut metadata text with `--type-label-shortcut-tracking` and tabular numerics.

Use these utilities instead of repeating ad-hoc `tracking-[...]` declarations.

---

## 5) Component Sizing Standards

This system standardizes control heights and text density across UI primitives.

## 5.1 Height conventions

- **Default control**: `h-11` mobile, `sm:h-10` desktop
- **Small control**: `h-11` mobile, `sm:h-9` desktop (small only at `sm+`)
- **Large control**: `h-12` mobile, `sm:h-11` desktop
- **Icon button**: `h-11 w-11` mobile, `sm:h-10 sm:w-10` desktop

## 5.2 Primitive behavior

- Buttons, toggles, tab triggers use normalized line-height and weight.
- Inputs/selects/textarea use shared text and focus treatment.
- Labels use responsive text sizing (`text-sm` -> `sm:text-base`) with consistent line-height.
- Primitive text sizing should rely on the tokenized Tailwind scale (`text-sm`, `sm:text-base`, etc.) rather than explicit one-off line-height utilities.

This reduces “one-off” typography and improves consistency in dense forms.

---

## 6) Radius, Shadows, and Spacing

- Radius token: `--radius` with Tailwind mapping:
  - `rounded-lg = var(--radius)`
  - `rounded-md = calc(var(--radius) - 2px)`
  - `rounded-sm = calc(var(--radius) - 4px)`
- Shadow tokens:
  - `--shadow-2xs`, `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-2xl`
- Base spacing token available as `--spacing`.

---

## 7) Motion and Interaction

- Shared motion curve: `--motion-snap` (`cubic-bezier(0.2, 0.8, 0.2, 1)`).
- Core interactive utility classes:
  - `.interactive-chip`
  - `.interactive-card`
- Delight enhancement keyframes and stateful animation classes:
  - Hero drift, enhance pulse/ignite/stream/settle, sheen/wave transitions.
- Reduced motion support:
  - `@media (prefers-reduced-motion: reduce)` disables non-essential animations and transforms.

---

## 8) Community Typography Subsystem

Community surfaces use a scoped typographic subsystem under `.community-typography`.

Role tokens include:

- screen title/subtitle
- tab label
- post title/body
- author/timestamp/meta
- button/chip/reply/input/help/code

Utility class roles include:

- `.type-screen-title`, `.type-screen-subtitle`
- `.type-post-title`, `.type-post-body`
- `.type-author`, `.type-timestamp`, `.type-meta`
- `.type-button-label`, `.type-chip`, `.type-reply-label`, `.type-input`, `.type-help`, `.type-code`
- `.type-label-caps`, `.type-link-inline`, `.type-numeric`, `.type-wrap-safe`, `.type-prose-measure`

Compact mode is supported via:

- `.community-typography[data-density="compact"]`

---

## 9) Accessibility Baseline

- Touch-first interactive sizing on mobile (`~44px` targets).
- Focus-visible ring styling is standardized in UI primitives.
- Reduced motion support is built in globally.
- Tabular numerics for counts/metrics (`font-variant-numeric: tabular-nums`).
- Wrap-safe helpers prevent overflow in long user-generated content.

---

## 10) Where to Update the System

When evolving the design system, use this order:

1. **Token values**: `src/index.css`
2. **Tailwind mapping**: `tailwind.config.ts`
3. **Primitive contracts**: `src/components/ui/*`
4. **Feature-specific semantic classes**: e.g., community type roles in `src/index.css`

Avoid direct hardcoded `px` typography values and avoid bypassing primitives unless strictly necessary.

