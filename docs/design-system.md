# PromptForge Design System

## 1) System Overview

This project uses a **token-first design system** built on:

- CSS custom properties in `:root` and `.dark` (source of truth)
- Tailwind theme extensions mapped to those tokens
- Radix + shadcn-style UI primitives standardized for typography, spacing, and interaction

Primary source files:

- `src/index.css`
- `tailwind.config.ts`
- `src/components/ui/*`
- `docs/launch-messaging-pack.md`

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

---

## 11) Apple Alignment Implementation Checklist

Use this checklist for iOS-facing releases and major UI refactors. It consolidates guidance from:

- `https://developer.apple.com/design/human-interface-guidelines/`
- `docs/apple-color.md`
- `docs/apple-layout.html`
- `docs/apple-typography.md`
- `docs/apple-web-standards.md`
- `docs/app-review-guidelines.md`

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
- Primitive usage enforcement: `src/components/ui/*`
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
- Primitive label/input/button text contracts: `src/components/ui/*`
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
- Responsive breakpoint contracts: `tailwind.config.ts`, `src/components/ui/*`
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

- UX and primitive quality baseline: `src/components/ui/*`, `src/pages/*`
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
3. `src/components/ui/*` primitive contract updates
4. Feature-level semantics in `src/pages/*`, `src/hooks/*`, `src/lib/*`
5. Documentation sync in `docs/design-system.md`

Monitor source updates from:

- `https://developer.apple.com/design/human-interface-guidelines/` ("New and updated")
- `https://developer.apple.com/app-store/review/guidelines/` (policy changes)
