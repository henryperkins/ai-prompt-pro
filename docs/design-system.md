# PromptForge Design System

Last updated: 2026-02-26

## 1) System Overview

This project uses a **token-first design system** built on:

- CSS custom properties in `:root` and `.dark` (source of truth)
- Tailwind theme extensions mapped to those tokens
- Radix + shadcn-style UI primitives standardized for typography, spacing, and interaction

Primary source files:

- `src/index.css`
- `src/styles/globals.css`
- `src/styles/untitled-compat.css` (transitional legacy token aliases)
- `src/styles/typography.css`
- `tailwind.config.ts`
- `src/components/base/*` (canonical Untitled UI React components)
- `src/components/base/primitives/*` (legacy wrappers for non-targeted primitives)
- `docs/launch-messaging-pack.md`

Legacy note:

- `src/styles/theme.css` is imported via `src/styles/globals.css` as part of the runtime style stack.

Phase 3 status (completed February 22, 2026):

- Canonical component APIs for shared primitives are `@/components/base/buttons/button`, `@/components/base/input/input`, `@/components/base/badges/badges`, and `@/components/base/select/select`.
- Imports or test mocks targeting `@/components/base/primitives/button|input|badge|select` are prohibited.
- CI enforces this in strict mode via:
  - `scripts/check-token-runtime-drift.mjs`
  - `scripts/check-no-primitive-ds-imports.mjs`

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
- Verify border contrast in both light and dark themes before release.

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
2. **Brand assets**: `public/brand/*`
3. **Tailwind mapping**: `tailwind.config.ts`
4. **Canonical component contracts**: `src/components/base/*`
5. **Feature-specific semantic classes**: e.g., community type roles in `src/index.css`

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
- [ ] Validate light and dark variants for all tokens used in foreground/background pairs.
- [ ] Validate increased-contrast readability for key interactions (button labels, links, status chips, destructive actions).
- [ ] Do not rely on color alone for state or meaning; pair with text, iconography, or shape.
- [ ] Keep high-emphasis tinted controls limited per surface (single primary action by default).
- [ ] Export standard raster assets in sRGB unless a tested Display P3 workflow is explicitly required.

Implementation map:

- Token source: `src/index.css`
- Tailwind color mapping: `tailwind.config.ts`
- Primitive usage enforcement: `src/components/base/primitives/*`
- Brand/delight accents: `src/index.css` (`--delight-*`)

### 11.2 Typography Checklist (HIG Typography)

- [ ] Keep runtime font dependencies system-based (`--font-sans`, `--font-serif`, `--font-mono`).
- [ ] Map all role text to the tokenized scale (`--type-*`) and Tailwind semantic sizes (`text-sm`, `sm:text-base`, etc.).
- [ ] Avoid thin/ultralight weights in UI copy; prefer regular/medium/semibold/bold hierarchy.
- [ ] Preserve hierarchy under larger text settings (primary content remains most prominent and earliest in scan order).
- [ ] Minimize truncation at larger sizes; allow useful multi-line wrapping for key content.
- [ ] Scale meaningful icons with adjacent text where icons carry information.
- [ ] Use shared tracking utilities (`.type-label-caps`, `.type-label-shortcut`) instead of one-off tracking classes.

Implementation map:

- Typography tokens and base rules: `src/index.css`
- Tailwind font families and sizing hooks: `tailwind.config.ts`
- Primitive label/input/button text contracts: `src/components/base/primitives/*`
- Community-specific roles: `.community-typography` rules in `src/index.css`

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

- Layout tokens and spacing primitives: `src/index.css`
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

1. Run `npm run lint`.
2. Run `npm test`.
3. Run `npm run test:mobile`.
4. Run `npm run build`.
5. Perform manual checklist pass for sections 11.1 through 11.5.

### 11.7 Maintenance Rule

When Apple guidance changes, update this section and the underlying implementation in this order:

1. `src/index.css` token/model updates
2. `tailwind.config.ts` semantic mapping updates
3. `src/components/base/primitives/*` primitive contract updates
4. Feature-level semantics in `src/pages/*`, `src/hooks/*`, `src/lib/*`
5. Documentation sync in `docs/design-system.md`

Monitor source updates from:

- `https://developer.apple.com/design/human-interface-guidelines/` ("New and updated")
- `https://developer.apple.com/app-store/review/guidelines/` (policy changes)
