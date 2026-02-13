Assumption: this review is based on the provided screenshots plus code context in `docs/review-inputs-fresh.md` and current route/component files; most captured states are empty/error, so I prioritized resilience and first-run clarity.

**First Impressions (30s)**
The product feels clean, structured, and credible for technical users. Immediate friction is high because key surfaces are dominated by empty/error states, and mobile navigation hides some high-value entry points (notably Presets), so first-time users can stall before they get a “win.”

**Prioritized Changes**

**P0 (must fix)**

1. **Fail-open app startup instead of hard crash**
Problem: app throws at init when Neon env vars are missing in `src/integrations/neon/client.ts:26`.
Why it matters: one config mistake turns into total product failure, blocking onboarding and QA.
Recommendation: degrade gracefully and expose a “backend not configured” UI state.
Implementation hint: replace top-level `throw` with a safe client factory + `isBackendConfigured` guard used by persistence/community calls.
Before/After: before = app crashes on load; after = app loads Builder and shows actionable setup/error cards for backend-dependent features.

2. **Add true recovery paths for Community errors**
Problem: Community error cards route away but do not offer retry (`src/components/community/CommunityFeed.tsx:114`, `src/pages/CommunityPost.tsx:256`).
Why it matters: transient network/auth failures become dead ends and increase bounce.
Recommendation: add `Retry` as primary action and auth-aware fallback copy/actions.
Implementation hint: pass `onRetry` from page-level loaders, parse error types (network/auth/not found), and show tailored copy.
Before/After: before = “Go elsewhere”; after = one-tap retry with contextual guidance.

3. **Unify breakpoints to remove tablet layout bugs**
Problem: `useIsMobile` uses `768px` (`src/hooks/use-mobile.tsx:3`) while mobile nav/layout uses Tailwind `sm` `640px` (`src/components/PageShell.tsx:17`, `src/pages/Index.tsx:1600`).
Why it matters: 640–767px gets mixed desktop/mobile behavior, spacing offsets, and sticky bar misplacement.
Recommendation: centralize breakpoint constants and use the same threshold for nav, sticky action bar, and drawer behavior.
Implementation hint: create `src/lib/breakpoints.ts` and consume it in both JS hooks and CSS class strategy.
Before/After: before = inconsistent tablet UX; after = predictable responsive behavior across phone/tablet.

4. **Restore visible keyboard focus in Community search**
Problem: search input suppresses focus ring in `src/pages/Community.tsx:331`.
Why it matters: keyboard users can lose focus context (WCAG focus visibility risk).
Recommendation: keep a visible focus treatment on input or parent container.
Implementation hint: remove `focus-visible:ring-0` and add `focus-within` ring on wrapper.
Before/After: before = invisible focus on key control; after = clear, accessible focus state.

**P1 (should fix)**

1. **Make Presets discoverable on mobile**
Problem: Presets is hidden behind Builder tab popover behavior in `src/components/BottomNav.tsx:24`.
Why it matters: users miss the fastest “start with template” path.
Recommendation: expose Presets as a first-class mobile nav destination or explicit home CTA.
Implementation hint: include `/presets` in mobile nav items or add a prominent “Start from preset” button in Builder hero.
Before/After: before = hidden secondary interaction; after = obvious single-tap entry.

2. **Reduce Builder first-screen cognitive load**
Problem: home screen stacks many controls before users complete the core task (`src/pages/Index.tsx:1296` onward).
Why it matters: slows “time to first successful enhance.”
Recommendation: tighten progressive disclosure around one primary path: input -> enhance -> refine.
Implementation hint: default-collapse advanced sections, keep one concise step hint, and reveal deeper controls after first enhance.
Before/After: before = many simultaneous decisions; after = guided first outcome in under 10 seconds.

3. **Improve state card readability and hierarchy**
Problem: critical states rely heavily on `text-xs` and low-emphasis copy (`src/components/ui/state-card.tsx:52`, `src/components/ui/state-card.tsx:90`).
Why it matters: error/empty states are currently frequent and need fast comprehension.
Recommendation: promote state title/body sizing and strengthen action prominence.
Implementation hint: standardize `StateCard` typography to `text-sm` body and reserve `text-xs` for metadata only.
Before/After: before = low-signal status messaging; after = immediately scannable recovery guidance.

4. **Replace disabled-action `title` hints with visible helper text**
Problem: disabled Share reason uses `title` tooltip in Library (`src/pages/Library.tsx:490`), which is weak on touch/mobile.
Why it matters: users don’t know how to unblock actions.
Recommendation: show inline reason under disabled action (“Sign in to share” / “Add use case first”).
Implementation hint: derive disabled reason string and render directly in-row near action controls.
Before/After: before = hidden reason; after = explicit next step.

5. **Fix Community card semantics for assistive tech**
Problem: entire card acts as `role="link"` while containing nested interactive controls in `src/components/community/CommunityPostCard.tsx:100`.
Why it matters: confusing focus order and redundant interaction semantics.
Recommendation: make only title/preview a `Link`, keep action row as separate controls.
Implementation hint: remove card-level keyboard navigation handlers; use explicit anchor targets for navigation.
Before/After: before = mixed interaction model; after = cleaner, predictable semantics.

6. **Increase touch comfort in mobile sticky action bar**
Problem: Web switch control is visually/tap-size constrained (`src/components/ui/switch.tsx:12`, `src/pages/Index.tsx:1617`).
Why it matters: accidental taps and poor ergonomics on 360–430px devices.
Recommendation: enlarge hit area and spacing of sticky controls.
Implementation hint: wrap switch+label in a minimum `44x44` hitbox, or introduce a mobile-specific larger switch size token.
Before/After: before = cramped utility toggle; after = reliable one-handed interaction.

7. **Simplify per-item actions in Library on mobile**
Problem: each saved prompt stacks many right-rail buttons (`src/pages/Library.tsx:454`).
Why it matters: scan overload and mis-tap risk as list grows.
Recommendation: keep one primary action (`Load`) and collapse secondary actions into overflow menu.
Implementation hint: reuse existing `DropdownMenu` pattern from Output panel actions.
Before/After: before = dense vertical action rail; after = cleaner row with focused primary action.

8. **Reduce initial Builder rendering cost**
Problem: Builder route is large and mounts many heavy regions eagerly (`src/pages/Index.tsx`, `src/components/OutputPanel.tsx`).
Why it matters: slower first paint/interaction on mid-tier mobile devices.
Recommendation: lazy-mount advanced panels and expensive views.
Implementation hint: defer non-critical sections (advanced context, diff dialog payload, markdown rendering) until opened/needed.
Before/After: before = heavier first render; after = faster perceived load and snappier typing.

**P2 (nice to have)**

1. **Virtualize long lists**
Problem: list-heavy surfaces render full arrays (Library, Community feed/comments) without virtualization.
Why it matters: large datasets will degrade scroll performance.
Recommendation: virtualize where item count can exceed ~50.
Implementation hint: apply `@tanstack/react-virtual` to Library list and long comment threads.
Before/After: before = jank risk on big datasets; after = stable scroll performance.

2. **Use route-specific Suspense fallbacks**
Problem: global fallback is plain “Loading...” (`src/App.tsx:30`).
Why it matters: weak perceived performance and context loss between routes.
Recommendation: show route-shaped skeletons for Builder/Community/Library.
Implementation hint: wrap route elements in lightweight per-page skeleton components.
Before/After: before = generic blank loading; after = context-preserving loading states.

3. **Optimize background rendering for low-end mobile**
Problem: fixed multi-layer radial background on body (`src/index.css:191`, `src/index.css:195`).
Why it matters: can increase repaint cost during scroll.
Recommendation: disable `background-attachment: fixed` on small screens.
Implementation hint: media query for mobile to switch to `background-attachment: scroll`.
Before/After: before = potential scroll repaint overhead; after = smoother scrolling.

4. **Normalize UI density tokens across feature screens**
Problem: repeated ad-hoc `text-xs`/size classes across components (`src/components/OutputPanel.tsx:460`, `src/components/ui/state-card.tsx:90`, `src/components/BuilderTabs.tsx:42`).
Why it matters: visual inconsistency and harder maintenance.
Recommendation: define semantic density variants (`comfortable`, `compact`) for key primitives.
Implementation hint: add variant props to shared components (state cards, toolbar buttons, section labels) tied to design tokens.
Before/After: before = per-screen sizing drift; after = consistent and maintainable design language.

**Implementation Checklist (Sprint Ready)**

Assumption: owners below are role-based and can be mapped to specific people during sprint planning.

**Sizing Legend**
- `S`: <= 1 day
- `M`: 2-4 days
- `L`: 5+ days or multi-PR

**Suggested Sequence**
1. Sprint 1: complete all `P0` tickets.
2. Sprint 2: complete `P1` tickets focused on first-run and accessibility.
3. Sprint 3: complete remaining `P1` and selected `P2` performance/consistency work.

**P0 Tickets**

- [x] `UX-P0-01` Fail-open startup when backend is not configured
Owner: Frontend
Effort: `M`
Dependencies: none
Acceptance Criteria:
1. App does not crash on startup when Neon env vars are missing.
2. Builder route remains usable in degraded mode.
3. Backend-dependent surfaces show actionable setup/error state instead of throwing.
4. Automated test covers missing-config startup path.

- [x] `UX-P0-02` Add retry-first recovery for Community errors
Owner: Frontend
Effort: `M`
Dependencies: `UX-P0-01`
Acceptance Criteria:
1. Community feed and post error states expose `Retry` as the primary action.
2. Retry re-runs the same loader/request without requiring navigation away.
3. Copy/actions differ for at least `network`, `auth`, and `not found` conditions.
4. Regression test validates retry callback wiring.

- [x] `UX-P0-03` Unify responsive breakpoints across hooks and layout
Owner: Frontend
Effort: `M`
Dependencies: none
Acceptance Criteria:
1. A single shared breakpoint source exists (for example `src/lib/breakpoints.ts`).
2. `useIsMobile` and route/layout mobile behavior read from the same threshold.
3. No conflicting mobile/desktop behavior at `640-767px`.
4. Mobile viewport checks pass at `320`, `375`, `390`, and `428`.

- [x] `UX-P0-04` Restore visible keyboard focus in Community search
Owner: Frontend
Effort: `S`
Dependencies: none
Acceptance Criteria:
1. Search input has clear visible focus styling for keyboard users.
2. Focus styling passes quick keyboard-only traversal test in Community page.
3. No regression to surrounding input styles in light/dark theme variants (if enabled).

**P1 Tickets**

- [x] `UX-P1-01` Make Presets first-class on mobile
Owner: Frontend
Effort: `M`
Dependencies: `UX-P0-03`
Acceptance Criteria:
1. Mobile users can reach Presets in one tap from primary navigation or equivalent prominent CTA.
2. Presets entry is visible at first load on mobile widths.
3. Existing Builder navigation behavior remains functional.

- [x] `UX-P1-02` Reduce first-screen Builder cognitive load
Owner: Frontend + Design
Effort: `L`
Dependencies: `UX-P1-01`
Acceptance Criteria:
1. First screen emphasizes a single core flow: input -> enhance -> refine.
2. Advanced controls are collapsed or deferred by default.
3. At least one concise step hint is visible for first-run users.
4. Existing power-user controls remain available after first interaction.

- [x] `UX-P1-03` Increase state-card readability and action hierarchy
Owner: Frontend + Design
Effort: `M`
Dependencies: none
Acceptance Criteria:
1. State-card body copy uses readable default size (no `text-xs` as primary body text).
2. Primary action is visually dominant over secondary actions.
3. Updated state-card style is applied consistently across empty/error/loading states.

- [x] `UX-P1-04` Replace tooltip-only disabled reasons with inline helper text
Owner: Frontend
Effort: `S`
Dependencies: none
Acceptance Criteria:
1. Disabled actions in Library show visible unblock guidance inline.
2. Guidance works on touch devices without hover/tooltips.
3. Disabled reason text updates correctly with auth/content state.

- [x] `UX-P1-05` Fix Community card interaction semantics
Owner: Frontend
Effort: `M`
Dependencies: none
Acceptance Criteria:
1. Card container is no longer a synthetic link role wrapping nested controls.
2. Navigation is handled by explicit link targets (title/preview).
3. Action buttons remain independently focusable and operable.
4. Keyboard tab order is predictable and linear.

- [x] `UX-P1-06` Increase touch target comfort in mobile sticky action bar
Owner: Frontend
Effort: `S`
Dependencies: `UX-P0-03`
Acceptance Criteria:
1. Sticky controls meet minimum comfortable touch target (44x44px target area).
2. Toggle and label spacing prevents accidental taps on 360-430px widths.
3. Mobile Playwright checks confirm no overlap/clipping.

- [x] `UX-P1-07` Simplify Library row actions on mobile
Owner: Frontend + Design
Effort: `M`
Dependencies: `UX-P1-04`
Acceptance Criteria:
1. Each row has one clear primary action (`Load`).
2. Secondary actions are grouped into overflow menu.
3. Mobile list remains scannable without right-rail action stacking.

- [x] `UX-P1-08` Defer non-critical Builder rendering work
Owner: Frontend
Effort: `L`
Dependencies: `UX-P1-02`
Acceptance Criteria:
1. Non-critical sections are lazy-mounted or rendered on demand.
2. Initial render work is reduced for Builder route (measured via React profiler or performance traces).
3. No functional regressions in advanced panels when opened later.

**P2 Tickets**

- [x] `UX-P2-01` Virtualize long lists (Library and large Community views)
Owner: Frontend
Effort: `L`
Dependencies: `UX-P1-07`
Acceptance Criteria:
1. List virtualization is applied where list size exceeds agreed threshold.
2. Scroll remains smooth for large datasets (manual QA with seeded data).
3. Keyboard navigation and screen reader semantics remain intact.

- [x] `UX-P2-02` Add route-specific Suspense/skeleton fallbacks
Owner: Frontend + Design
Effort: `M`
Dependencies: none
Acceptance Criteria:
1. Builder, Community, and Library have route-shaped loading states.
2. Generic global `Loading...` fallback is no longer primary user experience.
3. Loading skeletons match each page layout closely enough to preserve context.

- [x] `UX-P2-03` Reduce mobile repaint cost from background attachment
Owner: Frontend
Effort: `S`
Dependencies: none
Acceptance Criteria:
1. Small-screen CSS disables fixed background attachment.
2. Mobile scroll smoothness improves subjectively on low-end devices.
3. Desktop background appearance remains unchanged.

- [x] `UX-P2-04` Normalize density tokens across key UI primitives
Owner: Frontend + Design
Effort: `M`
Dependencies: `UX-P1-03`
Acceptance Criteria:
1. Shared density variants are defined and documented.
2. State cards, toolbar buttons, and section labels consume shared density variants.
3. Ad-hoc sizing classes are reduced in touched files.

**Release Gate for UX Batch**
1. `npm run lint` passes.
2. `npm test` passes.
3. `npm run test:mobile` passes for Community and Builder flows.
4. Manual QA checklist updated in `docs/community-mobile-qa-checklist.md` for changed mobile behaviors.
