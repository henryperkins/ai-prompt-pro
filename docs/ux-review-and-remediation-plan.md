# PromptForge UX Review and Remediation Plan

Date: 2026-02-11  
Scope: React + Vite frontend (`/`, `/community`, `/community/:postId`, `/library`, `/history`, `*`)  
Inputs used: Mobile and desktop screenshots, route/flow descriptions, current source implementation

## UX Review (Prioritized Findings)

### First impressions (30 seconds)
- Product feel: clean, credible, professional tooling for technical users.
- Immediate friction: community appears broken for signed-out users when an auth/session error is surfaced.
- 10-second findability: builder flow is clear; community and library action hierarchy is weaker in empty/error states.

### P0 (must fix)

#### P0-1: Community page can fail for signed-out users because vote-state loading is coupled to critical content loading
- Problem (what/where): `loadMyVotes` is included in critical hydration (`src/pages/Community.tsx`, `src/pages/CommunityPost.tsx`), and auth-related errors can escalate to page-level errors.
- Why it matters: new users hit an error wall and cannot browse public content, breaking discovery/remix flow.
- Recommendation: decouple vote-state fetching from feed/post fetching; treat vote state as optional enhancement.
- Implementation hint: use `Promise.allSettled` in feed/post hydration and default vote state to `{}` when vote lookup fails.
- Before/after:
  - Before: signed-out user may see destructive error and no feed content.
  - After: feed/post content loads; vote controls are disabled/neutral without blocking the page.

#### P0-2: Builder accordion lacks robust visible keyboard focus treatment
- Problem (what/where): primary section toggles rely on `AccordionTrigger` without explicit focus-visible ring styles (`src/components/ui/accordion.tsx` used heavily in `src/pages/Index.tsx`).
- Why it matters: keyboard users can lose focus context in the core flow.
- Recommendation: add explicit focus-visible ring and offset styling to accordion triggers.
- Implementation hint: align trigger focus states with existing button/input patterns (`focus-visible:ring-2`, `ring-ring`, `ring-offset-2`).
- Before/after:
  - Before: weak/invisible focus feedback while tabbing builder sections.
  - After: clear focus location and predictable keyboard progression.

### P1 (should fix)

#### P1-1: Mobile navigation is redundant (header menu + bottom nav for same routes)
- Problem (what/where): route navigation appears in both mobile header dropdown and bottom nav (`src/components/Header.tsx`, `src/components/BottomNav.tsx`).
- Why it matters: duplicate navigation increases cognitive load and weakens primary hierarchy.
- Recommendation: keep bottom nav as primary route navigation on mobile; reserve header menu for account/settings actions.
- Implementation hint: centralize nav config (`src/lib/navigation.ts`) and render route actions once per breakpoint intent.
- Before/after:
  - Before: two competing nav systems.
  - After: one clear primary mobile nav with reduced clutter.

#### P1-2: Community mobile filters are hard to discover
- Problem (what/where): horizontal overflow chip rail hides taxonomy depth (`src/pages/Community.tsx`).
- Why it matters: users miss filtering capabilities and perceive weak content controls.
- Recommendation: use mobile-first filter controls (compact sort + category select/chips with clear filter entry point).
- Implementation hint: branch on `useIsMobile` and render smaller filter model on phones, keep full chip rail on desktop/tablet.
- Before/after:
  - Before: hidden horizontal taxonomy.
  - After: immediately discoverable filters and faster narrowing.

#### P1-3: Empty/error states are consistent but low-conversion
- Problem (what/where): empty states mostly present static messaging and basic CTAs across community/library/history/404.
- Why it matters: first-run users get dead ends instead of guided activation.
- Recommendation: standardize state patterns with:
  - reason
  - primary next step
  - secondary fallback/education action
- Implementation hint: create reusable `StateCard` component for `empty`, `error`, and `auth-required` variants.
- Before/after:
  - Before: passive placeholders.
  - After: guided actions that return users to successful flows.

#### P1-4: Save/share dialog validation lacks inline guidance
- Problem (what/where): submit disabled states do not clearly indicate which required fields are missing (`src/components/OutputPanel.tsx`).
- Why it matters: users must manually infer missing inputs, increasing friction.
- Recommendation: add inline field-level validation and helper text for required fields.
- Implementation hint: migrate dialog forms to `react-hook-form` + `zod` with inline errors and touched states.
- Before/after:
  - Before: opaque disabled submit.
  - After: explicit field-level recovery guidance.

#### P1-5: Touch targets and micro-typography are too dense in action-heavy cards
- Problem (what/where): many controls use `h-7` and `text-[11px]` in community cards/library actions and bottom nav labels.
- Why it matters: increased mis-taps and readability issues on 360–390px screens.
- Recommendation: enforce mobile minimum touch target sizes for actionable controls and normalize metadata text size.
- Implementation hint: introduce reusable size tokens/util classes and apply to chips/buttons/nav labels.
- Before/after:
  - Before: compact but error-prone touch behavior.
  - After: more forgiving one-hand mobile interactions.

#### P1-6: Accessibility semantics need cleanup in form labeling and live status
- Problem (what/where):
  - visual label not associated to textarea in `PromptInput`
  - dynamic IDs for constraints may be brittle
  - enhance phase status is mostly visual
- Why it matters: reduced screen-reader clarity and state awareness.
- Recommendation: improve label/id associations, sanitize IDs, and add polite live region status updates.
- Implementation hint:
  - use explicit `id` + `htmlFor`
  - slugify generated IDs
  - add `aria-live="polite"` for enhance phase transitions
- Before/after:
  - Before: partially accessible semantics.
  - After: reliable assistive-tech support across builder actions.

### P2 (nice to have)

#### P2-1: Performance headroom for scale
- Problem (what/where): derived prompt/score recompute on every hook render; large card lists can become heavy.
- Why it matters: risk of degraded responsiveness as data volume and UI complexity grow.
- Recommendation: memoize derived values and introduce virtualization thresholds for long lists.
- Implementation hint: `useMemo`, `React.memo`, and virtualized list strategy for large feeds.
- Before/after:
  - Before: acceptable at low scale, riskier as content grows.
  - After: stable responsiveness under larger workloads.

#### P2-2: Design debt from duplicated patterns and large domain hook
- Problem (what/where): `usePromptBuilder` is large and styles/state patterns are repeated across pages.
- Why it matters: slows delivery and increases regression risk.
- Recommendation: split hook by responsibility and standardize shared surface/state components.
- Implementation hint: extract modules (`useDraftPersistence`, `useRemix`, `useVersions`) and shared state components.
- Before/after:
  - Before: logic/style coupling and duplication.
  - After: maintainable architecture for incremental UX work.

#### P2-3: Remove stale style artifact
- Problem (what/where): `src/App.css` appears unused.
- Why it matters: low-grade maintenance noise.
- Recommendation: remove if unreferenced.
- Implementation hint: delete file and verify no imports.
- Before/after:
  - Before: dead file in styling surface.
  - After: cleaner style ownership.

---

## Comprehensive Plan to Address All Issues

## 1) Execution strategy
- Ship in 4 phases to reduce risk and keep behavior stable.
- Fix P0 first with regression tests before visual refactors.
- Use route-by-route validation on mobile (360/390/430), tablet, desktop.
- Track completion with explicit acceptance criteria per issue ID.

## 2) Phase plan

### Phase 0: Baseline and guardrails (0.5 sprint)
- Objectives:
  - establish measurable baseline before changes
  - add regression tests around known fragile flows
- Tasks:
  - capture baseline screenshots for all reviewed routes (mobile + desktop)
  - run and store baseline Lighthouse/Web Vitals for `/`, `/community`, `/library`
  - add a11y smoke checks (keyboard nav/focus visibility) for builder/community
  - create issue tracker entries keyed by IDs: `P0-1` ... `P2-3`
- Deliverables:
  - baseline report in `docs/`
  - initial test harness updates in `src/test/`

### Phase 1: P0 reliability + accessibility core (1 sprint)
- Objectives:
  - prevent public feed lockouts
  - ensure keyboard-visible focus in core builder flow
- Included IDs: `P0-1`, `P0-2`

### Phase 2: P1 UX flow and mobile ergonomics (1–1.5 sprints)
- Objectives:
  - clarify navigation hierarchy
  - improve mobile discoverability and completion rate
- Included IDs: `P1-1` to `P1-6`

### Phase 3: P2 performance and maintainability (1 sprint, parallelizable)
- Objectives:
  - reduce long-term design debt
  - prepare for higher data volume and faster iteration
- Included IDs: `P2-1` to `P2-3`

---

## 3) Issue-by-issue implementation backlog

### P0-1 backlog (community auth/session resilience)
- Scope:
  - `src/pages/Community.tsx`
  - `src/pages/CommunityPost.tsx`
  - `src/lib/community.ts`
- Engineering tasks:
  - split feed/post hydration into:
    - required data: posts + profiles + parent posts/remixes
    - optional data: vote state
  - swap critical `Promise.all` for `Promise.allSettled` where vote status is included
  - in vote-state loader, return empty map on auth lookup failure for anonymous/public paths
  - preserve destructive errors only for actual feed/post fetch failure
- UX tasks:
  - update error copy for non-blocking auth situations (informational tone, non-destructive)
- Test tasks:
  - add regression tests:
    - signed-out user sees feed content even when vote endpoint fails
    - post detail renders when vote state fetch fails
    - vote controls remain disabled with clear affordance
- Acceptance criteria:
  - community list/detail always render public content if public fetch succeeds
  - no destructive auth session banner for optional vote-state failures

### P0-2 backlog (keyboard focus for accordion)
- Scope:
  - `src/components/ui/accordion.tsx`
  - `src/pages/Index.tsx`
- Engineering tasks:
  - add explicit focus-visible ring styles to trigger
  - verify ring contrast on light/dark themes
  - validate no style regressions in existing accordion usages
- Test tasks:
  - add keyboard tab-order and focus-visible test for all builder sections
- Acceptance criteria:
  - focus ring is clearly visible on each accordion trigger via keyboard-only navigation

### P1-1 backlog (mobile nav simplification)
- Scope:
  - `src/components/Header.tsx`
  - `src/components/BottomNav.tsx`
  - new `src/lib/navigation.ts`
- Engineering tasks:
  - create single route nav config source
  - on mobile:
    - keep bottom nav route links
    - move header dropdown to non-route utilities (theme/account)
  - ensure current route indication remains in one location only
- UX tasks:
  - verify icon+label readability and selected state contrast
- Test tasks:
  - update bottom-nav/header tests for mobile route visibility rules
- Acceptance criteria:
  - no duplicate route nav systems on mobile
  - all four route destinations remain reachable within one tap

### P1-2 backlog (community filter discoverability)
- Scope:
  - `src/pages/Community.tsx`
  - optional shared filter component under `src/components/community/`
- Engineering tasks:
  - implement mobile filter variant:
    - category `Select`
    - compact sort pills or segmented control
    - optional filter summary label
  - keep current desktop chip rail
  - preserve existing filter/query logic and URL/state compatibility
- UX tasks:
  - validate first-screen scanability on 360px and 390px widths
- Test tasks:
  - add tests for mobile filter controls changing sort/category correctly
- Acceptance criteria:
  - user can discover category + sort controls without horizontal scrolling

### P1-3 backlog (state pattern standardization)
- Scope:
  - `src/components/community/CommunityFeed.tsx`
  - `src/pages/CommunityPost.tsx`
  - `src/pages/Library.tsx`
  - `src/components/VersionHistory.tsx`
  - `src/pages/NotFound.tsx`
  - new shared state component, e.g., `src/components/ui/state-card.tsx`
- Engineering tasks:
  - create reusable state component with variants (`empty`, `error`, `auth`)
  - migrate route-level states to shared pattern
  - tune microcopy for action clarity and consistency
- UX tasks:
  - define message framework:
    - what happened
    - what user can do now
    - clear CTA labels
- Test tasks:
  - route-level snapshot/behavior tests for each state variant
- Acceptance criteria:
  - consistent state presentation and action hierarchy across all target routes

### P1-4 backlog (form validation UX in save/share dialogs)
- Scope:
  - `src/components/OutputPanel.tsx`
- Engineering tasks:
  - migrate Save and Save & Share forms to structured form state (recommended: `react-hook-form` + `zod`)
  - display inline required errors for:
    - prompt title
    - use case (share flow)
    - safety confirmation
  - keep existing submit side effects and toast behavior
- UX tasks:
  - add concise helper copy near required fields
- Test tasks:
  - validation tests for submit blocking and visible inline errors
- Acceptance criteria:
  - user can immediately see missing fields and recover without guessing

### P1-5 backlog (touch target and typography normalization)
- Scope:
  - `src/components/community/CommunityPostCard.tsx`
  - `src/pages/Library.tsx`
  - `src/components/BottomNav.tsx`
  - `src/index.css` (token/util additions)
- Engineering tasks:
  - introduce mobile control sizing tokens/util classes
  - increase tap area for action-heavy controls
  - normalize metadata text scale on mobile
- UX tasks:
  - verify target sizes against 44x44 guidance for primary interactions
- Test tasks:
  - visual regression checks on 360/390/430 widths
- Acceptance criteria:
  - action controls are comfortably tappable; metadata remains legible at mobile widths

### P1-6 backlog (semantics and live announcements)
- Scope:
  - `src/components/PromptInput.tsx`
  - `src/components/BuilderTabs.tsx`
  - `src/components/OutputPanel.tsx`
- Engineering tasks:
  - associate prompt label with textarea via `id/htmlFor`
  - replace raw constraint string IDs with sanitized stable IDs
  - add polite live region to announce enhance phase/status transitions
- Test tasks:
  - screen-reader/DOM-level checks for label association and live region updates
- Acceptance criteria:
  - form controls have explicit label relationships
  - enhance status transitions are announced to assistive tech

### P2-1 backlog (performance)
- Scope:
  - `src/hooks/usePromptBuilder.ts`
  - `src/components/community/CommunityFeed.tsx`
  - `src/components/community/CommunityPostCard.tsx`
- Engineering tasks:
  - memoize expensive derived values (`builtPrompt`, `score`) when practical
  - memoize heavy card subtrees and callbacks where profiling justifies
  - evaluate virtualization threshold for large feed sizes
- Test tasks:
  - add simple render-count/profiling checks in dev workflow notes
- Acceptance criteria:
  - no visible typing lag in builder and smooth scroll/load behavior in larger feeds

### P2-2 backlog (hook and style maintainability)
- Scope:
  - `src/hooks/usePromptBuilder.ts`
  - shared component/style layer
- Engineering tasks:
  - split `usePromptBuilder` by domain responsibility
  - centralize repeated card/state styling variants
- Test tasks:
  - preserve current behavior with targeted regression tests per extracted module
- Acceptance criteria:
  - reduced hook complexity and clearer ownership boundaries without behavior regression

### P2-3 backlog (cleanup)
- Scope:
  - `src/App.css`
- Engineering tasks:
  - confirm no imports/references
  - remove file
- Acceptance criteria:
  - no dead style assets in active app surface

---

## 4) QA matrix (required before each phase sign-off)

### Device breakpoints
- Mobile:
  - 360x800
  - 390x844
  - 430x932
- Tablet:
  - 768x1024
- Desktop:
  - 1280x800
  - 1440x900

### Route checks
- `/`:
  - keyboard navigation through builder sections
  - enhance flow states (idle/starting/streaming/settling/done)
  - drawer open/close behavior on mobile
- `/community`:
  - signed-out load with optional vote-state failure
  - filter controls on mobile and desktop
  - empty/error state action hierarchy
- `/community/:postId`:
  - unavailable/invalid states
  - actions (copy, remix, save-to-library) and disabled-state clarity
- `/library`:
  - empty state and bulk-edit readiness
  - control tap targets at 360px
- `/history`:
  - empty state CTA clarity
- `*`:
  - 404 messaging and recovery CTA behavior

### Accessibility checks
- keyboard-only navigation order
- visible focus rings
- label associations
- live region status announcement
- contrast spot checks for primary/destructive/muted text
- reduced motion behavior for animated elements

---

## 5) Suggested timeline and sequencing

### Week 1
- complete Phase 0 + begin P0 work
- deliver:
  - baseline metrics/screenshots
  - P0-1 implementation + tests

### Week 2
- complete P0-2 and P1-1/P1-2
- deliver:
  - mobile nav simplification
  - community mobile filter improvement

### Week 3
- complete P1-3/P1-4/P1-5/P1-6
- deliver:
  - shared state cards
  - form validation improvements
  - touch target and semantic a11y fixes

### Week 4
- complete P2-1/P2-2/P2-3
- deliver:
  - performance optimization pass
  - maintainability refactor
  - cleanup tasks

---

## 6) Definition of done
- all P0/P1 acceptance criteria pass.
- no regressions in existing unit/integration tests.
- new tests cover:
  - non-blocking community auth edge cases
  - keyboard focus visibility in builder accordion
  - mobile filter interaction paths
  - dialog validation error visibility
  - semantic label/live-region behavior
- screenshots updated for all primary routes across mobile + desktop.
- lint + test + build succeed (`npm run check:prod`).

