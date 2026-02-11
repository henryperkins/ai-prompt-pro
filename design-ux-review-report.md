# PromptForge Design + UX Review

## First Impressions (30 seconds)

Product feels clean, credible, and utility-first. The Builder CTA is visible quickly, but the experience gets high-friction in three places: technical error copy on post detail, dead-end empty states (Community/History), and mobile discoverability (icon-only controls/tabs and hidden nav actions).

New user can find the primary action on `/` within 10 seconds; on `/community` and `/history` they’re more likely to stall because the next step is not explicitly guided.

Assumption: this review is based on provided screenshots + source, not live interaction telemetry.

## Prioritized Changes

### P0 (must fix)

#### 1) Community post detail leaks backend error text
- **Problem (what/where):** Raw DB error strings are surfaced to users (`invalid input syntax for type uuid...`) in `src/pages/CommunityPost.tsx:101` and `src/lib/community.ts:631`.
- **Why it matters (user impact):** Breaks trust, looks unstable, and confuses non-technical users.
- **Recommendation (specific change):** Validate `postId` client-side before querying and replace raw errors with user-safe messages.
- **Implementation hint (React/CSS approach):** Add `isUuid(postId)` guard in `src/pages/CommunityPost.tsx:46` and return a friendly state ("This link is invalid or expired."). In `src/lib/community.ts:643`, map PostgREST UUID errors to a generic message instead of passing through `error.message`.
- **Before/after behavior:** Before users see DB syntax errors; after they see a clear "invalid link" message with recovery CTA.

#### 2) Destructive delete action has no confirmation
- **Problem (what/where):** Saved prompt deletion is one tap on a tiny icon in `src/components/PromptLibrary.tsx:495`.
- **Why it matters (user impact):** High accidental-loss risk, especially on mobile touch targets.
- **Recommendation (specific change):** Add confirm dialog (`AlertDialog`) and optional undo toast.
- **Implementation hint (React/CSS approach):** Replace direct `onDeleteSaved(prompt.id)` with `pendingDeleteId` + `<AlertDialog>` confirm flow; keep prompt name in dialog title.
- **Before/after behavior:** Before accidental delete is immediate; after deletion is deliberate and reversible.

#### 3) Mobile auth/account controls are not fully accessible
- **Problem (what/where):** Icon-only auth triggers lack explicit accessible names in `src/components/Header.tsx:147` and `src/components/Header.tsx:165`.
- **Why it matters (user impact):** Screen-reader users can’t reliably discover sign-in/account actions.
- **Recommendation (specific change):** Add `aria-label` to avatar trigger and sign-in button; include `sr-only` text for icon-only states.
- **Implementation hint (React/CSS approach):** `aria-label="Open account menu"` on avatar button; `aria-label="Sign in"` on sign-in button when label is hidden on small screens.
- **Before/after behavior:** Before controls are ambiguous in assistive tech; after they’re discoverable and operable.

### P1 (should fix)

#### 1) Builder has competing primary actions and premature preview content
- **Problem (what/where):** Both "Enhance now" and "Enhance with AI" compete (`src/pages/Index.tsx:451`, output panel CTA), and preview shows constraints before user input due default tone/complexity inclusion (`src/lib/prompt-builder.ts`).
- **Why it matters (user impact):** Increases cognitive load; users may not understand what actually drives output.
- **Recommendation (specific change):** Keep one clear primary enhance CTA per viewport and show a true empty preview until meaningful input exists.
- **Implementation hint (React/CSS approach):** Gate "Enhance first" helper card more strictly and conditionally include default tone/complexity constraints only after user edits those fields or enters base prompt.
- **Before/after behavior:** Before UI feels busy/auto-filled; after flow is clearer: input → enhance → refine.

#### 2) Mobile Builder tabs are icon-only (low discoverability)
- **Problem (what/where):** Tab labels are hidden on small screens in `src/components/BuilderTabs.tsx:41-60`.
- **Why it matters (user impact):** New users can’t infer tab purpose quickly from icons alone.
- **Recommendation (specific change):** Keep short labels on mobile (2–4 chars) or switch to horizontally scrollable labeled chips.
- **Implementation hint (React/CSS approach):** Replace `hidden sm:inline` with always-visible short text (`Role`, `Task`, etc.) or use responsive truncation.
- **Before/after behavior:** Before users guess icon meaning; after tab intent is obvious at a glance.

#### 3) Empty states don’t route users to next action
- **Problem (what/where):** Community/History/Library empty states mostly explain absence but don’t move users forward (`src/components/community/CommunityFeed.tsx`, `src/components/VersionHistory.tsx`, `src/components/PromptLibrary.tsx:367`).
- **Why it matters (user impact):** Dead-end screens reduce task completion and sharing behavior.
- **Recommendation (specific change):** Add direct CTAs ("Create a prompt", "Share your first prompt", "Go to Builder").
- **Implementation hint (React/CSS approach):** In each empty state card, add primary/secondary buttons linking to `/` or opening relevant save/share flow.
- **Before/after behavior:** Before users bounce; after they continue the intended funnel.

#### 4) Mobile scroll trap risk on Library/History
- **Problem (what/where):** Nested fixed-height scroll containers on small screens (`src/pages/Library.tsx:166`, `src/pages/History.tsx:46`).
- **Why it matters (user impact):** Awkward scrolling and content discoverability issues on 360–430px devices.
- **Recommendation (specific change):** Use single-page scroll on mobile; keep constrained inner scroll only on `sm+`.
- **Implementation hint (React/CSS approach):** Change to `sm:max-h[...] sm:overflow-hidden`, remove inner `overflow-y-auto` on mobile.
- **Before/after behavior:** Before users scroll inside cards; after page scroll behavior is natural.

#### 5) Search/filter accessibility and readability need tightening
- **Problem (what/where):** Search inputs rely on placeholder-only labeling (`src/pages/Community.tsx:288`, `src/components/PromptLibrary.tsx:336`), and many `text-[11px] text-muted-foreground` labels are hard to read.
- **Why it matters (user impact):** WCAG and usability risk, especially on mobile + low vision.
- **Recommendation (specific change):** Add semantic labels (`<label className="sr-only">`) and raise smallest body/caption text to 12–13px with stronger contrast token.
- **Implementation hint (React/CSS approach):** Add `id`/`htmlFor` pairs or `aria-label`; define `--muted-foreground` variant for tiny text usage.
- **Before/after behavior:** Before discoverability/readability are marginal; after filters are accessible and legible.

#### 6) Bundle is too large for mobile-first UX
- **Problem (what/where):** Build output shows a single large JS chunk (`dist/assets/index-*.js 818.34 kB`, gzip `238.12 kB`).
- **Why it matters (user impact):** Slower initial load and interaction readiness on mobile networks/devices.
- **Recommendation (specific change):** Route-level code splitting + defer heavy secondary features.
- **Implementation hint (React/CSS approach):** Convert static route imports in `src/App.tsx:8-13` to `React.lazy` + `Suspense`; lazy-load comments/detail extras and Codex export actions in `OutputPanel` via dynamic imports triggered by menu actions.
- **Before/after behavior:** Before first load includes everything; after initial route loads faster and secondary features load on demand.

### P2 (nice to have)

#### 1) Design system consistency debt
- **Problem (what/where):** Mixed small control heights/text sizes (`h-7/h-8/h-9/h-11`, `text-[11px]/text-xs`) and repeated "chip" variants across many files.
- **Why it matters (user impact):** Visual rhythm inconsistency and slower future UI work.
- **Recommendation (specific change):** Define a compact/comfortable control scale and enforce via tokenized utility classes.
- **Implementation hint (React/CSS approach):** Centralize in shared component variants (`button`, badges, tabs) and replace ad-hoc sizing in feature components.

#### 2) App shell duplication
- **Problem (what/where):** Header + page container/hero patterns are repeated across route files.
- **Why it matters (user impact):** Increases maintenance cost and style drift risk.
- **Recommendation (specific change):** Introduce a shared `PageShell` + `PageHero` layout component.
- **Implementation hint (React/CSS approach):** Refactor `src/pages/Index.tsx`, `src/pages/Community.tsx`, `src/pages/Library.tsx`, `src/pages/History.tsx`, `src/pages/NotFound.tsx` to reuse common shell.

#### 3) Mobile navigation speed
- **Problem (what/where):** Primary route switching on mobile is hidden behind menu.
- **Why it matters (user impact):** Slower multi-route workflows (Builder ↔ Library ↔ Community).
- **Recommendation (specific change):** Add a compact bottom nav for top 3 routes (Builder, Community, Library) while keeping menu for secondary actions.
- **Implementation hint (React/CSS approach):** Reuse route state logic from `Header` and `react-router-dom` location matching.

