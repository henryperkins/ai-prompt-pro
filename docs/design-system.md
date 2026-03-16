# PromptForge Design System

Last updated: 2026-03-16

## 1) System Overview

This project uses a **token-first design system** built on:

- CSS custom properties and semantic `@theme inline` mappings in `src/styles/tokens.css` (`:root` is the standard theme; `:root[data-theme="midnight"]` is the deeper variant; legacy `.dark` / `.dark-mode` aliases remain temporarily supported)
- Tailwind theme extensions mapped to those tokens
- Radix + shadcn-style UI primitives standardized for typography, spacing, and interaction

Primary source files:

- `src/styles/globals.css` (runtime entrypoint imported by the app)
- `src/styles/tokens.css` (canonical semantic tokens, type scale, shadows, standard + midnight theme variants, and semantic utility mappings)
- `src/styles/theme.css` (runtime theme bridge that loads the temporary Untitled compatibility layer)
- `src/styles/untitled-compat.css` (transitional palette + `utility-*` alias bridge loaded via `theme.css`)
- `src/styles/legacy-utility-tokens.css` (deprecated alias import for older references; no longer the runtime source of truth)
- `src/styles/base.css` (global element rules and browser resets)
- `src/styles/components.css` (shared component, layout, and motion classes)
- `src/styles/community.css` (community typography roles)
- `src/styles/typography.css`
- `src/styles/promptforge-fantasy.css`
- `tailwind.config.ts`
- `src/components/base/*` (canonical Untitled UI React components)
- `src/components/base/primitives/*` (legacy wrappers for non-targeted primitives)
- `docs/launch-messaging-pack.md`

Public surface contract:

- `src/components/base/*` is the stable public design-system facade for app and feature code.
- Public DS-owned entrypoints include `buttons/button`, `input/input`, `select/select`, `avatar`, `checkbox`, `textarea`, and `tooltip`.
- Public hybrid entrypoints include `label`, `form`, `button-group/button-group`, `buttons/button-utility`, and `progress-indicators/*`.
- Some public entrypoints remain intentional bridge wrappers over legacy primitives (`card`, `drawer`, `table`, `tabs`, `scroll-area`, and similar facades).
- Feature and product code should import the facade either way and never reach into `src/components/base/primitives/*` unless working on design-system internals.
- Branded wrappers outside `src/components/base/*` still count as design-system contract surfaces: `src/components/PageShell.tsx`, `PageHero` within that module, and `src/components/community/ProfileHero.tsx`.

Legacy note:

- `src/styles/globals.css` now imports `src/styles/theme.css`; it no longer loads `src/styles/legacy-utility-tokens.css` directly.
- `src/styles/theme.css` loads `src/styles/untitled-compat.css`, while `src/styles/tokens.css` remains the semantic source of truth.
- `src/styles/legacy-utility-tokens.css` is a deprecated shim that re-exports `src/styles/untitled-compat.css` for legacy imports.
- `src/index.css` is now a compatibility shim; import `src/styles/globals.css` directly for runtime usage.
- New semantic tokens, semantic utility names, and theme intent mappings must stay in `src/styles/tokens.css`; do not add new product semantics to `src/styles/untitled-compat.css`.

Phase 3 status (completed February 22, 2026):

- Canonical component APIs for shared primitives are `@/components/base/buttons/button`, `@/components/base/input/input`, `@/components/base/badges/badges`, and `@/components/base/select/select`.
- Canonical public tooltip import is `@/components/base/tooltip`; importing `@/components/base/tooltip/tooltip` is deprecated outside design-system bridge internals.
- App and feature code import from public `@/components/base/*` entrypoints; `@/components/base/primitives/*` is reserved for design-system internals only.
- The canonical class-merging helper is `cx` from `@/lib/utils/cx`; `cn` in `@/lib/utils` is a deprecated compatibility alias.
- The canonical initials helper is `getInitials` from `@/lib/utils/get-initials`.
- Imports or test mocks targeting `@/components/base/primitives/button|input|badge|select` are prohibited.
- Imports or re-exports of deprecated `Textarea` from `@/components/base/textarea` are prohibited in feature code; use `TextArea` instead.
- Theme model: PromptForge is dark-first. The default runtime theme is the standard brand palette, and the alternate mode is the deeper `midnight` variant.
- CI enforces this in strict mode via:
  - `scripts/check-token-runtime-drift.mjs`
  - `scripts/check-no-primitive-ds-imports.mjs`
  - `scripts/check-no-legacy-ds-props.mjs`
  - `scripts/check-no-deprecated-textarea-usage.mjs`
  - `scripts/check-no-literal-colors.mjs`
  - `scripts/check-no-deprecated-ds-bridges.mjs`
- Branded wrapper visual checkpoints live in `src/pages/ComponentsShowcase.tsx`, `src/components/PageShell.stories.tsx`, and `src/components/community/ProfileHero.stories.tsx`.

## 1.1) Canonical Surface (Use This, Not That)

Canonical public imports:

- Button: `@/components/base/buttons/button`
- Input: `@/components/base/input/input`
- Badge: `@/components/base/badges/badges`
- Avatar: `@/components/base/avatar`
- Button utility: `@/components/base/buttons/button-utility`
- Button group: `@/components/base/button-group/button-group`
- Checkbox: `@/components/base/checkbox`
- Tooltip: `@/components/base/tooltip`
- Label: `@/components/base/label`
- Form: `@/components/base/form/form`
- Dialog: `@/components/base/dialog`
- Drawer: `@/components/base/drawer`
- Table: `@/components/base/table`
- Tabs: `@/components/base/tabs`
- Textarea: `@/components/base/textarea` (prefer `TextArea`; legacy `Textarea` remains temporary)

Use this, not that:

| Concern | Use this | Not that |
| --- | --- | --- |
| DS component entrypoints | `@/components/base/*` public entrypoints | `@/components/base/primitives/*` in feature/app code |
| Public DS contract | `@/components/base/*` facade (DS-owned or bridge-backed) | Importing implementation details directly from `primitives/*` |
| Avatar | `@/components/base/avatar` | `@/components/base/avatar/avatar` |
| Checkbox | `@/components/base/checkbox` | `@/components/base/checkbox/checkbox` |
| Tooltip | `@/components/base/tooltip` | `@/components/base/tooltip/tooltip` in app/feature code |
| Textarea | `TextArea` from `@/components/base/textarea` | Deprecated `Textarea` from `@/components/base/textarea`, or `TextArea` from `@/components/base/textarea/textarea` |
| Class merge helper | `cx` from `@/lib/utils/cx` | `cn` from `@/lib/utils` |
| Theme preference values | `"default"` / `"midnight"` | `"light"` / `"dark"` in new logic or UX copy |

## 1.2) Theme Model and Compatibility Aliases

- PromptForge is dark-first:
  - `:root` = standard brand theme (`data-theme="default"`)
  - `:root[data-theme="midnight"]` = deeper alternate theme
- Runtime state and persistence use only semantic values: `default`, `midnight`.
- Compatibility aliases remain temporary:
  - CSS selectors: `.dark`, `.dark-mode`
  - Legacy stored values: `"light"`, `"dark"` (normalized at load)
- New product copy and new feature logic must use standard/midnight wording.

## 1.3) Runtime Compatibility Reduction Path

`src/styles/untitled-compat.css` remains a runtime bridge, but it should only shrink over time.

Rules for future work:

- Keep semantic color intent, text intent, border intent, and background intent in `src/styles/tokens.css`.
- Limit `src/styles/untitled-compat.css` to transitional ramps and legacy `utility-*` aliases needed for existing components.
- Do not add new product-facing semantics to the compat layer.
- When migrating a component off compat aliases, remove the alias usage first, then prune the unused compat token or ramp in a follow-up cleanup.

---

## 2) Design Principles

1. **Semantic tokens over hardcoded values**
   - Color, type, radius, and shadow values are defined as tokens.
2. **System fonts only**
   - No external web-font dependency in runtime.
3. **Mobile-first ergonomics**
  - Controls are touch-friendly by default (`h-11` / ~44px) and default/small controls are denser on desktop (`sm:h-9`/`sm:h-10`).
4. **Readable, consistent typography**
   - Shared scale and line-height tokens are applied globally, in component primitives, and in `.prose` typography rules.
5. **Accessible interactions**
   - Focus rings, reduced-motion support, and tabular numerics for data-heavy UI.

---

## 3)  Color System (HSL Tokens)

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

PromptForge ships a standard dark-first theme in `:root` and a deeper `midnight` variant under `:root[data-theme="midnight"]`. Legacy `.dark` / `.dark-mode` selectors remain as compatibility aliases while the theme model is being clarified in code and docs.

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
- `buttons/button-utility` keeps icon-only controls at `h-11 w-11` on mobile and only compacts at `sm+`.
- `button-group/button-group` keeps segmented controls at `min-h-11` on mobile and only compacts at `sm+`.
- Inputs/selects/textarea use shared text and focus treatment.
- Tables should import from `@/components/base/table` (not `@/components/base/primitives/table`) for a stable public surface.
- Labels use responsive text sizing (`text-sm` -> `sm:text-base`) with consistent line-height.
- The public `Label` wrapper may add required markers and tooltip affordances, but it must preserve the primitive responsive typography contract.
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

## 6.1 Logo System

Canonical active product branding assets live in `public/pf/`:

- `promptforge-wordmark.png` (default product/header/marketing wordmark)

Legacy brand pack assets remain in `public/brand/` for compatibility and historical reference:

- `pf-logo-symbol-primary-v2.png`
- `pf-logo-wordmark-horizontal-v2.png`
- `pf-logo-monogram-badge-v2.png`

Usage contract:

- Header, hero, and product chrome: `promptforge-wordmark.png`.
- New UI work should not introduce `pf-logo-monogram-badge*` usage.
- Minimum rendered size:
  - Wordmark: `96px` width
- Clear space: preserve at least `0.5x` logo height on all sides.
- Do not stretch logos, recolor outside semantic brand tokens, or apply heavy effects that reduce legibility.

## 6.2 Customized Gradient Recipes

Primary gradient drivers:

- `--delight-warm`
- `--delight-cool`
- `--delight-glow`
- `--delight-surface`

Branded overlays:

- `public/brand/pf-gradient-hero-light.png`
- `public/brand/pf-gradient-hero-dark.png`

Recommended recipes (token-first, with optional asset overlay):

```css
.brand-gradient-hero {
  background-image:
    radial-gradient(520px 220px at 8% -12%, hsl(var(--delight-warm) / 0.2), transparent 58%),
    radial-gradient(460px 220px at 92% -14%, hsl(var(--delight-cool) / 0.16), transparent 56%),
    linear-gradient(180deg, hsl(var(--delight-surface) / 0.55), hsl(var(--card) / 0.9));
}

.brand-gradient-surface {
  background-image: linear-gradient(
    140deg,
    hsl(var(--card)),
    hsl(var(--delight-surface) / 0.72)
  );
}
```

## 6.3 Customized Borders and Frames

Border assets in `public/brand/`:

- `pf-border-frame-light.png`
- `pf-border-frame-thin-v2.png`
- `pf-border-frame-bold-v2.png`
- `pf-border-frame-dashed-v2.png`
- `pf-border-corners-minimal-v2.png`
- `pf-border-strip-seamless.png`

Recommended border treatments:

- Default UI chrome: semantic token border (`border-border` / `--border`).
- Emphasis panels: gradient border using transparent border + layered backgrounds.
- Marketing/hero framing: image-based frame assets on non-critical decorative layers only.

Gradient border recipe:

```css
.brand-border-gradient {
  border: 1px solid transparent;
  background:
    linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box,
    linear-gradient(120deg, hsl(var(--delight-cool) / 0.6), hsl(var(--delight-warm) / 0.7)) border-box;
}
```

Border usage rules:

- Keep interactive hit areas independent from decorative frame assets.
- Avoid decorative borders on dense form regions and long text blocks.
- Verify border contrast in both standard and midnight themes before release.

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

1. **Token values**: `src/styles/tokens.css`
2. **Brand assets**: `public/brand/*`
3. **Tailwind mapping**: `tailwind.config.ts`, `src/styles/legacy-utility-tokens.css`
4. **Canonical component contracts**: `src/components/base/*`
5. **Feature-specific semantic classes**: e.g., community type roles in `src/styles/community.css`

Avoid direct hardcoded `px` typography values and avoid bypassing primitives unless strictly necessary.

---

## 11) Apple Alignment Implementation Checklist

Use this checklist for iOS-facing releases and major UI refactors. It consolidates guidance from:

- `https://developer.apple.com/design/human-interface-guidelines/`
- `https://developer.apple.com/design/human-interface-guidelines/color`
- `https://developer.apple.com/design/human-interface-guidelines/layout`
- `https://developer.apple.com/design/human-interface-guidelines/typography`
- `https://developer.apple.com/app-store/review/guidelines/`

### 11.1 Color Checklist (HIG Color)

- [ ] Use semantic tokens only for UI color in app code (no one-off hex/rgb in components).
- [ ] Keep semantic intent stable (`--primary` for emphasis, `--muted` for supporting surfaces, etc.); avoid reusing one color token for conflicting meanings.
- [ ] Validate both standard and midnight variants for all tokens used in foreground/background pairs.
- [ ] Validate increased-contrast readability for key interactions (button labels, links, status chips, destructive actions).
- [ ] Do not rely on color alone for state or meaning; pair with text, iconography, or shape.
- [ ] Keep high-emphasis tinted controls limited per surface (single primary action by default).
- [ ] Export standard raster assets in sRGB unless a tested Display P3 workflow is explicitly required.

Implementation map:

- Token source: `src/styles/tokens.css`
- Tailwind color mapping: `tailwind.config.ts`
- Primitive usage enforcement: `src/components/base/primitives/*`
- Brand/delight accents: `src/styles/tokens.css` (`--delight-*`)

### 11.2 Typography Checklist (HIG Typography)

- [ ] Keep runtime font dependencies system-based (`--font-sans`, `--font-serif`, `--font-mono`).
- [ ] Map all role text to the tokenized scale (`--type-*`) and Tailwind semantic sizes (`text-sm`, `sm:text-base`, etc.).
- [ ] Avoid thin/ultralight weights in UI copy; prefer regular/medium/semibold/bold hierarchy.
- [ ] Preserve hierarchy under larger text settings (primary content remains most prominent and earliest in scan order).
- [ ] Minimize truncation at larger sizes; allow useful multi-line wrapping for key content.
- [ ] Scale meaningful icons with adjacent text where icons carry information.
- [ ] Use shared tracking utilities (`.type-label-caps`, `.type-label-shortcut`) instead of one-off tracking classes.

Implementation map:

- Typography tokens and base rules: `src/styles/tokens.css`, `src/styles/base.css`
- Tailwind font families and sizing hooks: `tailwind.config.ts`
- Primitive label/input/button text contracts: `src/components/base/primitives/*`
- Community-specific roles: `.community-typography` rules in `src/styles/community.css`

### 11.3 Layout and Adaptivity Checklist (HIG Layout)

- [ ] Preserve clear grouping and separation of related content using spacing, surfaces, and separators.
- [ ] Keep critical information/actions in primary scan areas (top + leading side in reading order).
- [ ] Ensure controls remain visually distinct from content layers.
- [ ] Respect safe areas and avoid overlap with device/system UI.
- [ ] Prefer full-bleed content regions where appropriate; avoid clipped/letterboxed primary layouts unless intentional.
- [ ] Keep touch targets and spacing comfortable so adjacent controls remain clearly distinguishable.
- [ ] Support orientation/viewport changes without abrupt hierarchy breaks or content jumps.
- [ ] Validate long text, localization expansion, and wrap behavior (including RTL-sensitive layouts).

Implementation map:

- Layout tokens and spacing primitives: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/components.css`
- Responsive breakpoint contracts: `tailwind.config.ts`, `src/components/base/primitives/*`
- Route-level composition and content hierarchy: `src/pages/*`
- Mobile viewport regression checks: `playwright/community.mobile.spec.ts`

### 11.4 iOS Web App Standards Checklist (Safari / Home Screen)

Apply when this project is delivered as a Home Screen web app (PWA-like install flow on iOS).

- [ ] Provide `apple-touch-icon` assets with appropriate sizes from `public/`.
- [ ] Define a stable web app title using `apple-mobile-web-app-title`.
- [ ] If standalone mode is intended, set `apple-mobile-web-app-capable=yes`.
- [ ] If standalone mode is enabled, set and verify `apple-mobile-web-app-status-bar-style`.
- [ ] Provide startup image links only when explicitly required and tested across target devices.
- [ ] Verify native link schemes (`tel:`, `sms:` and similar) open the expected system apps.

Implementation map:

- Head/meta tags: `index.html`
- Icon/startup assets: `public/`
- Deep link rendering and behavior checks: route-level pages in `src/pages/*`

### 11.5 App Review Readiness Checklist (If Shipping via App Store Wrapper)

Use for any native wrapper, hybrid shell, or packaged distribution that goes through App Review.

- [ ] App experience is app-like and useful beyond a basic website wrapper.
- [ ] Submission build is complete: no placeholder content, broken routes, or incomplete flows.
- [ ] Demo credentials or a fully functional review mode is available for App Review.
- [ ] Privacy policy is accessible in-app and accurately describes collection, sharing, retention, and deletion.
- [ ] User-generated content flows include reporting, moderation handling, and user blocking.
- [ ] Payments for digital features/content use in-app purchase where required by policy.
- [ ] Subscription terms are clear before purchase (value, billing cadence, cancellation path).
- [ ] Any third-party login implementation includes required equivalent login options.
- [ ] Push notifications are optional for core functionality and respect explicit user consent.

Implementation map:

- UX and primitive quality baseline: `src/components/base/primitives/*`, `src/pages/*`
- Community moderation/UGC surfaces: `src/pages/*`, `src/hooks/*`, `src/lib/*`
- Policy and release process docs: `docs/*`

### 11.6 Release Verification Steps

1. Run `npm run check:docs`.
2. Run `npm run check:design-system`.
3. Run `npx vitest run src/test/button-utility.test.tsx src/test/button-group.test.tsx src/test/label.test.tsx`.
4. Run `npx vitest run src/test/accessibility-axe.test.tsx src/test/community-routes-accessibility-axe.test.tsx`.
5. Run `npx playwright test playwright/design-system.mobile.spec.ts`.
6. Run `npm run test:mobile`.
7. Run `npm run check:prod` before merge when design-system work also changes product logic.
8. Perform manual checklist pass for sections 11.1 through 11.5.

### 11.7 Maintenance Rule

When Apple guidance changes, update this section and the underlying implementation in this order:

1. `src/styles/tokens.css`, `src/styles/base.css`, and `src/styles/components.css` updates
2. `tailwind.config.ts` semantic mapping updates
3. `src/components/base/primitives/*` primitive contract updates
4. Feature-level semantics in `src/pages/*`, `src/hooks/*`, `src/lib/*`
5. Documentation sync in `docs/design-system.md`

Monitor source updates from:

- `https://developer.apple.com/design/human-interface-guidelines/` ("New and updated")
- `https://developer.apple.com/app-store/review/guidelines/` (policy changes)

## 12) State Matrix Template

Use `docs/design-system-state-matrix.md` as the current evidence-backed matrix and `docs/design-system-state-matrix-template.md` when auditing or introducing new core primitive states.
