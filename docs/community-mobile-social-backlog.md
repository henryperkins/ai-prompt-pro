# Community Mobile Social Backlog (2-Sprint Plan)

## Objective
Increase meaningful mobile social actions on Community (comment, follow, remix) by reducing interaction friction and improving creator discovery loops.

## Scope and Constraints
- Mobile-first scope for `/community`, `/community/:postId`, and related notification entry points.
- Rollout remains gated by `VITE_COMMUNITY_MOBILE_ENHANCEMENTS`.
- Preserve existing moderation and accessibility behavior while improving interaction speed.
- Keep desktop behavior stable unless explicitly called out.

## Success Metrics (Sprint 2 Exit)
- `+15%` comments per mobile community session.
- `+20%` notification-to-comment conversion.
- `+12%` follow actions per mobile community DAU.
- `+8%` D7 retention for users with at least one mobile community action.
- Guardrails: no greater than `+5%` increase in reports per 1k comments; no regression in crash/error-toast rates.

## Sprint 1 Backlog (Weeks 1-2)

### CMOB-101 - Notification deep link to comment composer
- Type: Feature
- Estimate: 5 points
- Files:
  - `src/components/NotificationPanel.tsx`
  - `src/pages/CommunityPost.tsx`
  - `src/components/community/CommunityPostDetail.tsx`
  - `src/components/community/CommunityComments.tsx`
- Description:
  - Opening a comment notification on mobile routes users directly to the post with the comments sheet open and composer focused.
- Acceptance criteria:
  - From a comment notification tap, user lands on the correct post detail route.
  - Comments sheet is open without extra taps.
  - Composer receives focus and keyboard opens on supported mobile browsers.
  - If deep-link context is missing, route gracefully falls back to normal post detail.
- QA cases:
  - iOS Safari and Android Chrome at 320/375/390/428 widths.
  - Signed-in and signed-out flows.

### CMOB-102 - Quick reply chips in comment composer
- Type: Feature
- Estimate: 3 points
- Files:
  - `src/components/community/CommunityComments.tsx`
  - `src/components/community/CommunityPostCard.tsx`
- Description:
  - Add tappable starter chips that prefill the composer with short reply scaffolds.
- Acceptance criteria:
  - At least 3 chips are visible above composer when comments sheet opens.
  - Chip tap inserts text into the textarea and positions cursor at the end.
  - Chip use does not bypass existing moderation checks.
  - Chips are keyboard-accessible and announce labels to assistive tech.
- QA cases:
  - Chip tap, edit, submit, and cancel behavior.
  - Reduced motion and dark mode parity.

### CMOB-103 - Mobile telemetry taxonomy alignment
- Type: Instrumentation
- Estimate: 3 points
- Files:
  - `src/hooks/useCommunityMobileTelemetry.ts`
  - `src/lib/community-telemetry.ts`
  - `src/pages/Community.tsx`
  - `src/pages/CommunityPost.tsx`
- Description:
  - Align tracked interaction types with actual events, including save/share and notification-to-reply funnel steps.
- Acceptance criteria:
  - `trackInteraction` supports all emitted interaction kinds used by Community pages.
  - New event payload captures source surface (`feed`, `post_detail`, `notification`).
  - Event schema is documented in code and covered by unit tests.

### CMOB-104 - Notification prioritization for mobile social actions
- Type: UX enhancement
- Estimate: 3 points
- Files:
  - `src/hooks/useNotifications.ts`
  - `src/lib/notifications.ts`
  - `src/components/NotificationPanel.tsx`
- Description:
  - Sort and present notifications by social urgency (comment/remix first, then reaction), with unread-first behavior.
- Acceptance criteria:
  - Unread entries always render before read entries.
  - Within unread entries: comment/remix outrank vote events.
  - Mark-all and per-item mark-read behavior remains unchanged.

### CMOB-105 - Sprint 1 mobile regression coverage
- Type: Test
- Estimate: 5 points
- Files:
  - `src/test/header-mobile-notifications.test.tsx`
  - `src/test/community-mobile-ux.test.tsx`
  - `src/test/useCommunityMobileTelemetry.test.ts`
  - `playwright/community.mobile.spec.ts`
- Description:
  - Add tests for deep-link + composer focus + reply chips + telemetry schema.
- Acceptance criteria:
  - New unit tests cover routing state and event payload shape.
  - Playwright covers notification-entry comment flow on mobile widths.
  - Existing mobile flag-on and flag-off tests remain green.

## Sprint 2 Backlog (Weeks 3-4)

### CMOB-201 - Creator quick profile sheet
- Type: Feature
- Estimate: 5 points
- Files:
  - `src/components/community/CommunityPostCard.tsx`
  - `src/components/community/CommunityComments.tsx`
  - `src/pages/Community.tsx`
  - `src/lib/community.ts`
- Description:
  - Tapping avatar/name on mobile opens a bottom sheet with creator stats and follow CTA, avoiding route churn.
- Acceptance criteria:
  - Sheet renders display name, joined date, post count, and follow state.
  - Follow/unfollow works directly from sheet and updates feed state.
  - Option to navigate to full profile remains available.

### CMOB-202 - Follow nudge after meaningful action
- Type: Feature
- Estimate: 3 points
- Files:
  - `src/pages/Community.tsx`
  - `src/pages/CommunityPost.tsx`
  - `src/components/community/CommunityComments.tsx`
- Description:
  - After successful comment/remix, show lightweight CTA to follow the author when user is not already following.
- Acceptance criteria:
  - Nudge appears only after successful action, not on failure.
  - Nudge is suppressed for own posts and already-followed authors.
  - Dismissed nudge does not reappear in same session for same author.

### CMOB-203 - New from following indicator
- Type: Feature
- Estimate: 3 points
- Files:
  - `src/hooks/useNewPostsIndicator.ts`
  - `src/pages/Community.tsx`
  - `src/components/community/CommunityFeed.tsx`
- Description:
  - Add lightweight tab-level indicator for fresh posts from followed creators.
- Acceptance criteria:
  - Indicator appears when followed-authors feed has unseen posts.
  - Indicator clears when user views following tab content.
  - Indicator logic does not create excess polling load.

### CMOB-204 - Civility nudge for risky comments
- Type: Safety UX
- Estimate: 3 points
- Files:
  - `src/lib/content-moderation.ts`
  - `src/components/community/CommunityComments.tsx`
- Description:
  - For borderline language patterns, show a pre-send rephrase prompt without blocking safe submissions.
- Acceptance criteria:
  - Blocked content remains blocked by existing rules.
  - Borderline content path displays optional rephrase nudge.
  - User can edit and submit or cancel safely.

### CMOB-205 - Notification preference: comments/remixes only
- Type: Feature
- Estimate: 5 points
- Files:
  - `src/components/NotificationPanel.tsx`
  - `src/hooks/useNotifications.ts`
  - `src/lib/notifications.ts`
- Description:
  - Add mobile-facing preference to suppress lower-signal reaction notifications.
- Acceptance criteria:
  - Preference toggle persists per user.
  - When enabled, vote notifications are hidden from panel.
  - Existing unread count logic reflects filtered state or clearly labels total vs shown.

## Delivery Order
1. CMOB-103 before CMOB-101 and CMOB-102 (telemetry contract first).
2. CMOB-101 and CMOB-102 in parallel after CMOB-103 lands.
3. CMOB-104 and CMOB-105 finish Sprint 1 hardening.
4. Sprint 2 starts with CMOB-201, then CMOB-202 and CMOB-203.
5. CMOB-204 and CMOB-205 complete Sprint 2 with safety and quality guardrails.

## Definition of Done
- Feature works behind `VITE_COMMUNITY_MOBILE_ENHANCEMENTS=true` with no regressions when false.
- Unit and mobile Playwright tests cover happy path and fallback path.
- Telemetry events are emitted for key funnel steps and validated in tests.
- Manual QA checklist updated in `docs/community-mobile-qa-checklist.md` for any new mobile interactions.
