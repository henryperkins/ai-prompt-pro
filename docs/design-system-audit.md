# AI Prompt Pro — Frontend Design System Audit

**Date:** 2026-02-23
**Scope:** Design foundations, UI components, accessibility, responsiveness, theming, performance, documentation, governance

---

## Executive Summary

| # | Finding |
|---|---------|
| 1 | **Migration is ~80% complete** — 15 UUI (React Aria) components in production; 49 Radix primitives remain as deprecated fallbacks. No cross-system pollution detected. |
| 2 | **Token architecture is strong** — 900+ CSS custom properties with a well-structured semantic layer (text, border, fg, bg). Brand color scale fully customizable via CSS variables. |
| 3 | **Dark mode has a critical coverage gap** — Token layer supports light/dark comprehensively, but only 4 component files use explicit `dark:` overrides. Effective coverage ~2%. |
| 4 | **Accessibility is below WCAG 2.1 AA threshold** — Estimated 68/100. Strong focus management and React Aria a11y built-ins, but live regions (1 instance), screen reader support (16 sr-only uses), and form label associations are insufficient. |
| 5 | **Responsive design is solid** — 309 breakpoint instances across 62 files; mobile-first approach; Playwright E2E at 320–428px viewports. Tablet (768–1024px) coverage is thin. |
| 6 | **Testing is comprehensive** — 86 test files / 15.6K LOC with accessibility (axe), RLS, and persistence tests. **Visual regression is not CI-enforced**. |
| 7 | **CI/CD is well-guarded** — 6 custom enforcement scripts block legacy imports, enforce design token drift detection, and run lint + unit tests. Stronger than most mid-stage projects. |
| 8 | **Documentation is architecturally focused, developer-facing docs are thin** — 20 docs, but only 3/15 base components have Storybook stories. No JSDoc on 85%+ of components. No PR templates or commit conventions. |

---

## Scorecard

| Criterion | Score (0–5) | Rationale |
|-----------|:-----------:|-----------|
| **Consistency** | 3.5 | Semantic token layer is excellent; dual shadow systems, `cn()` vs `cx()` split, and 7 gray scale variants introduce ambiguity. |
| **Accessibility (WCAG)** | 2.5 | React Aria provides solid keyboard/focus defaults, but live regions, screen reader content, and label associations fall short of AA. |
| **Component API Ergonomics** | 4.0 | UUI components have clean, data-driven APIs (`items[]` for Select, `onPress`, `iconLeading`). Radix leftovers use compound children pattern — clear migration path. |
| **Responsiveness** | 3.5 | Mobile-first with hooks (`useIsMobile`, `useBreakpoint`) and Playwright coverage. Tablet breakpoints under-tested; some feature-flag gating for mobile UX. |
| **Theming** | 3.0 | 900+ tokens with full dark variant mapping — architecturally sound. But runtime dark mode only reaches ~2% of components; no `prefers-color-scheme` auto-detection. |
| **Performance** | 3.0 | 14 lazy-loaded routes, 207 memo instances. No image optimization, no explicit bundle splitting beyond Vite defaults, no performance monitoring. |
| **Documentation** | 2.0 | 3/15 Storybook stories, sparse JSDoc, no component adoption guide. Architectural docs exist but not developer-consumable. |
| **Contribution / Governance** | 2.5 | Strong CI enforcement scripts compensate for missing PR templates, commit conventions, and formal tracking. Migration tracked in markdown only. |

---

## Key Findings

### A. Visual Consistency

| Finding | Evidence | Severity |
|---------|----------|----------|
| **Dual shadow token systems** | `theme.css` uses `rgba(10,13,18,...)`, `index.css` uses `hsl(0 0% 0%/...)` — both define `--shadow-xs` through `--shadow-2xl` with different values | High |
| **7 gray scale variants with no selection guidance** | `gray`, `gray-blue`, `gray-cool`, `gray-modern`, `gray-neutral`, `gray-iron`, `gray-true`, `gray-warm` — 100+ tokens, unclear which to use | Medium |
| **Utility color alias redundancy** | `--color-brand-500` AND `--color-utility-brand-500` both exist (80+ duplicates) | Low |
| **Component-specific token naming drift** | `--color-avatar-bg`, `--color-button-primary-icon` vs semantic pattern `--color-{category}-{intent}` | Low |

### B. Interaction / UX

| Finding | Evidence | Severity |
|---------|----------|----------|
| **No `prefers-color-scheme` auto-detection** | Theme toggle is manual only; no `window.matchMedia('(prefers-color-scheme: dark)')` listener | Medium |
| **Only 1 `prefers-reduced-motion` CSS rule** | `index.css` lines 1011–1034 cover key animations but no JS-level motion detection | Medium |
| **Tablet viewport gap** | No Playwright tests between 428px and 1024px; minimal `md:` breakpoint usage | Medium |
| **Feature-flagged mobile UX** | `VITE_COMMUNITY_MOBILE_ENHANCEMENTS` gates mobile filter/comment drawers — not default | Low |

### C. Accessibility

| Finding | Evidence | Severity |
|---------|----------|----------|
| **Live regions nearly absent** | 1 `aria-live` instance across 147 component files; toasts/notifications unannounced | Critical |
| **Screen reader content sparse** | 16 `sr-only` instances total — no widget instructions, no dynamic state announcements | Critical |
| **`aria-labelledby` underutilized** | 1 instance vs 80 `aria-label` — complex form groups lack semantic label linking | High |
| **No ESLint a11y plugin** | `eslint-plugin-jsx-a11y` not in config — regressions not caught at lint time | High |
| **Form validation errors not announced** | No `aria-describedby` linking to error messages in validation flows | High |

### D. Engineering / Architecture

| Finding | Evidence | Severity |
|---------|----------|----------|
| **49 deprecated Radix primitives still in `/primitives/`** | Active usage in Dialog, Dropdown, Tabs, Sheet — no UUI replacements yet | Medium |
| **`cn()` vs `cx()` split** | 67 files use `cn()` (shadcn), 29 use `cx()` (UUI) — two utility functions for class merging | Low |
| **`onClick` dominant over `onPress`** | 95 `onClick` vs 1 `onPress` — feature components haven't adopted React Aria event model | Low |
| **No image optimization pipeline** | Raw `<img>` tags, no `loading="lazy"`, no WebP/AVIF, no responsive `srcset` | Medium |
| **No explicit Vite bundle splitting** | Default chunk strategy only — vendor, community, builder not separated | Low |

### E. Documentation / Governance

| Finding | Evidence | Severity |
|---------|----------|----------|
| **3/15 base components have Storybook stories** | Only Button, Input, Badge — no Avatar, Select, Checkbox, Tooltip, Dialog stories | High |
| **JSDoc on <15% of base components** | 9/60+ files have doc comments | High |
| **No PR templates or issue templates** | `.github/` lacks `ISSUE_TEMPLATE/` and `pull_request_template.md` | Medium |
| **No commit conventions enforced** | No commitlint/husky; history shows informal messages ("up", "fix: ...") | Low |
| **No coverage thresholds** | Vitest has no `--coverage` flags or threshold enforcement | Medium |
| **Storybook not in CI** | Stories exist but aren't built or verified during deployment | Medium |

---

## Priority Matrix

| Item | Impact | Effort | Rationale | Owner |
|------|--------|--------|-----------|-------|
| Add `aria-live` regions to toasts, form validation, async states | **High** | Low | Single biggest a11y gap; ~5 components to wrap | Frontend / A11y lead |
| Consolidate dual shadow systems into one | **High** | Low | Delete `index.css` shadow overrides, keep `theme.css` as source of truth | Design tokens owner |
| Install `eslint-plugin-jsx-a11y` + CI enforcement | **High** | Low | Catch a11y regressions automatically; 1 config change | DX / Build |
| Add `prefers-color-scheme` auto-detection | **Medium** | Low | ~10 LOC in ThemeProvider; respects OS preference | Frontend |
| Expand Storybook to all 15 base components | **High** | Medium | Document visual variants, states, and a11y for team reference | Design systems |
| Add `sr-only` instructions to complex widgets | **High** | Medium | Multi-select, combobox, drag-drop need screen reader guidance | Frontend / A11y |
| Designate 1 gray scale + deprecate other 6 | **Medium** | Low | Reduce 100+ gray tokens to ~15; add lint rule | Design tokens owner |
| Add `loading="lazy"` to all images | **Medium** | Low | Global sweep; standard HTML attribute | Frontend |
| Enforce test coverage thresholds (>70%) | **Medium** | Low | Add `--coverage` to vitest config + CI check | DX / Build |
| Add PR template + commit conventions | **Medium** | Low | `.github/pull_request_template.md` + commitlint | DX / Build |
| Create component adoption guide (v1 vs v2) | **High** | Medium | Markdown guide: which components to use, import paths, migration checklist | Design systems |
| Build UUI Dialog system (React Aria) | **High** | High | Replace Radix Dialog — last major primitive dependency | Design systems |
| Add Playwright tablet viewport tests (768–1024px) | **Medium** | Medium | Expand existing test suite with iPad/tablet configs | QA |
| Migrate `cn()` to `cx()` in feature components | **Low** | Medium | 67 files; mechanical but time-consuming | Frontend |

---

## Recommendations with Acceptance Criteria

### R1: Accessibility Live Regions

**Action:** Wrap toast/notification containers with `aria-live="polite" aria-atomic="true"`. Add `aria-describedby` linking form inputs to error messages.

**Acceptance:** axe-core reports 0 violations for "aria-live-region" and "form-field-multiple-labels" rules. Screen reader (VoiceOver/NVDA) announces toasts and validation errors without user action.

### R2: Consolidate Shadow Tokens

**Action:** Remove shadow definitions from `index.css` (lines ~100–112). Retain `theme.css` as single source. Update any component referencing the HSL shadow variants.

**Acceptance:** `grep -r "hsl(0 0%" src/styles/index.css` returns 0 shadow matches. Visual regression screenshots unchanged.

### R3: A11y Linting Gate

**Action:** Add `eslint-plugin-jsx-a11y` to `eslint.config.js` with `recommended` preset. Add to CI pipeline.

**Acceptance:** `npm run lint` fails on `<img>` without `alt`, `<div onClick>` without `role`, missing `aria-label` on icon-only buttons.

### R4: System Theme Preference Detection

**Action:** In ThemeProvider, add `window.matchMedia('(prefers-color-scheme: dark)')` listener. Apply system preference on first visit; respect manual override thereafter.

**Acceptance:** New user on macOS dark mode sees dark theme without manual toggle. Manual toggle overrides and persists. Toggling OS preference updates app if no manual override set.

### R5: Storybook Expansion + CI Integration

**Action:** Add stories for Avatar, Checkbox, Select, Tooltip, Textarea, Dialog, Drawer, Progress, ButtonGroup, Tabs, Badge variants, Form. Add `npx storybook build` to CI.

**Acceptance:** `ls src/components/base/**/*.stories.tsx | wc -l` >= 15. CI pipeline includes Storybook build step that fails on broken stories.

### R6: Gray Scale Rationalization

**Action:** Designate `gray` (neutral) as the canonical gray. Add a lint rule blocking `gray-blue`, `gray-cool`, etc. in new component code. Document the decision.

**Acceptance:** No new code references deprecated gray variants. `check-no-legacy-ds-props.mjs` extended to flag non-canonical grays.

### R7: Component Adoption Guide

**Action:** Create `docs/component-adoption.md` mapping every UI primitive to its canonical import path, variant/prop API, and migration status (deprecated / active / preferred).

**Acceptance:** Every component in `src/components/base/` has an entry. New contributors can determine the correct import in <30 seconds.

### R8: UUI Dialog System

**Action:** Build Dialog, AlertDialog, and Sheet components using `react-aria-components` (OverlayTrigger, Modal, Dialog). Match existing Radix API surface where possible for migration ease.

**Acceptance:** All feature components (Header, AuthDialog, NotificationPanel, etc.) migrate to UUI Dialog. Zero Radix Dialog imports in `src/components/` outside of `primitives/`. Focus trapping and keyboard dismiss verified via Playwright.

---

## 30 / 60 / 90-Day Plan

### Days 1–30: Foundations & Quick Wins

| Week | Action | Deliverable |
|------|--------|-------------|
| 1 | Consolidate dual shadow systems | Single `theme.css` shadow source; index.css cleaned |
| 1 | Install `eslint-plugin-jsx-a11y` + add to CI | Lint failures on a11y violations |
| 1 | Add `aria-live` to toast/notification components | Screen reader announces dynamic content |
| 2 | Designate canonical gray scale + lint rule | `gray` is canonical; 6 variants deprecated |
| 2 | Add `prefers-color-scheme` auto-detection | System theme respected on first visit |
| 2 | Add `loading="lazy"` to all `<img>` tags | Global sweep complete |
| 3 | Create PR template + commitlint setup | `.github/pull_request_template.md` + husky hook |
| 3 | Add vitest coverage thresholds (70%) | CI fails below threshold |
| 4 | Write component adoption guide | `docs/component-adoption.md` published |
| 4 | Add `sr-only` instructions to Select, MultiSelect, Combobox | Screen readers describe keyboard interactions |

### Days 31–60: Component Coverage & Documentation

| Week | Action | Deliverable |
|------|--------|-------------|
| 5–6 | Expand Storybook: Avatar, Checkbox, Select, Tooltip, Textarea, Progress | 9/15 base components with stories |
| 5–6 | Add JSDoc to all base component interfaces | IDE autocomplete shows prop descriptions |
| 7 | Build UUI Dialog component (React Aria) | Dialog + AlertDialog functional; feature flag gated |
| 7 | Add Storybook build to CI pipeline | Broken stories block deployment |
| 8 | Migrate feature components from Radix Dialog to UUI Dialog | AuthDialog, NotificationPanel, Header modals migrated |
| 8 | Add Playwright tablet viewport tests (768px, 1024px) | Tablet layouts verified in CI |

### Days 61–90: Migration Completion & Hardening

| Week | Action | Deliverable |
|------|--------|-------------|
| 9–10 | Build UUI Dropdown/ContextMenu (React Aria) | Menu primitives replace Radix equivalents |
| 9–10 | Complete Storybook for all 15 base components | Full visual documentation |
| 11 | Migrate `cn()` to `cx()` in remaining feature components | Single utility function across codebase |
| 11 | Add visual regression testing to CI (Playwright screenshots) | Screenshot diffs block merges with visual changes |
| 12 | Delete `primitives/` directory + remove Radix dependencies | Zero Radix imports in component tree |
| 12 | Final WCAG 2.1 AA audit (manual + automated) | Compliance score >= 85/100 |

---

## Open Questions / Missing Inputs

| # | Question | Why It Matters |
|---|----------|---------------|
| 1 | **Is there a Figma source of truth for tokens?** | If tokens are defined in Figma, a token sync tool (Style Dictionary, Tokens Studio) would prevent CSS/design drift. |
| 2 | **What is the target browser matrix?** | Determines whether CSS `@layer`, `:where()`, and `@property` are safe to use without fallbacks. |
| 3 | **Is there a dedicated a11y testing environment (screen reader + keyboard)?** | Manual testing with VoiceOver/NVDA is required for live region verification — automated tools catch only ~30% of real a11y issues. |
| 4 | **What is the bundle size budget?** | Without a target (e.g., <200KB JS initial), performance optimizations lack a measurable goal. |
| 5 | **Are there plans to support additional themes beyond light/dark?** | The PromptForge fantasy theme suggests multi-theme capability — if so, the token architecture should be formalized for N themes. |
| 6 | **Who owns the design system day-to-day?** | A dedicated maintainer or rotating ownership model affects governance recommendations (PR review cadence, deprecation timelines). |
| 7 | **Is the Codex agent service (`agent_service/`) in scope for design system tokens?** | If the agent service renders UI, it needs access to the same token layer. |

---

## Appendix: Token Inventory Summary

| Category | Tokens | Status | Notes |
|----------|--------|--------|-------|
| **Typography** | 10 sizes + line-heights x 3 variants | Complete | Well-structured type scale with line-height pairing |
| **Spacing** | 1 base (`--spacing: 0.25rem`) | Minimal | Single base unit for calculations; no pre-computed scale |
| **Border Radius** | 10 values (0px to 9999px) | Complete | Covers all common use cases |
| **Shadows** | 12 primary (xs-3xl) + 6 special | Dual System | Two competing shadow sources in CSS |
| **Colors — Base** | 200+ tokens across 25+ palettes | Comprehensive | Excessive but flexible |
| **Colors — Semantic** | 100+ mapped tokens (text, border, fg, bg) | Comprehensive | Well-categorized; some utility layer redundancy |
| **Colors — Dark Mode** | Full override set per light mode | Complete | Inverted scales, properly mapped |
| **Motion/Animation** | 1 easing + 9 keyframes | Limited | Only one easing function; bespoke animations |
| **Component Colors** | 20+ component-specific tokens | Ad-hoc | Naming inconsistent with semantic layer |

## Appendix: Component Inventory

### UUI Components (React Aria) — 15 files, Production

| Component | Path | React Aria |
|-----------|------|:----------:|
| Button | `base/buttons/button.tsx` | Yes |
| Input | `base/input/input.tsx` | Yes |
| Select | `base/select/select.tsx` | Yes |
| Checkbox | `base/checkbox/checkbox.tsx` | Yes |
| Avatar | `base/avatar/avatar.tsx` | — |
| Tooltip | `base/tooltip/tooltip.tsx` | Yes |
| Badge | `base/badges/badges.tsx` | — |
| Textarea | `base/textarea/textarea.tsx` | Yes |
| ComboBox | `base/select/combobox.tsx` | Yes |
| Label | `base/input/label.tsx` | Yes |
| HintText | `base/input/hint-text.tsx` | — |
| SelectItem | `base/select/select-item.tsx` | Yes |
| Popover | `base/select/popover.tsx` | — |
| ButtonGroup | `base/button-group/button-group.tsx` | — |
| Progress | `base/progress-indicators/*.tsx` | — |

### Radix Primitives (Deprecated) — 49 files

Dialog, AlertDialog, Drawer, Button (with runtime warning), Checkbox, Input, Label, InputOTP, Select, Textarea, DropdownMenu, ContextMenu, NavigationMenu, Menubar, Popover, Avatar, Badge, Card, Table, Tabs, Accordion, Pagination, Breadcrumb, Carousel, Collapsible, Command, Form, HoverCard, Progress, RadioGroup, Resizable, ScrollArea, Separator, Skeleton, Slider, Sonner, Switch, Toast, Toaster, Toggle, ToggleGroup, Tooltip, StateCard, AspectRatio, Alert, Calendar, Sidebar
