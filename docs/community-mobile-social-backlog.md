# Community Mobile Social Backlog

Last updated: 2026-02-26

This file tracks the current backlog after the initial community-mobile rollout.

Archived baseline plan: `docs/reviews/community-mobile-social-backlog-2026-02.md`

## Status Snapshot

| Item | Status | Notes |
| --- | --- | --- |
| CMOB-101 notification deep link to comment composer | Completed | Notification links now include `source=notification` and `openComments=1`; post detail auto-opens comments for notification entry. |
| CMOB-102 quick reply chips in comment composer | Completed | Quick-reply chips are implemented in `CommunityComments`. |
| CMOB-103 mobile telemetry taxonomy alignment | Completed | `community_mobile_interaction` tracks `comment/reaction/share/save` with `sourceSurface` (`feed`/`post_detail`/`notification`). |
| CMOB-104 notification prioritization (unread + social urgency) | Pending | Notifications are still primarily ordered by `created_at`; prioritize unread + comment/remix ranking. |
| CMOB-105 Sprint 1 regression coverage | Completed | Unit tests and mobile Playwright coverage exist for comments drawer and telemetry behavior. |
| CMOB-201 creator quick profile sheet | Pending | Not implemented. |
| CMOB-202 follow nudge after meaningful action | Pending | Not implemented. |
| CMOB-203 new-from-following indicator | Pending | Not implemented. |
| CMOB-204 civility nudge for borderline comments | Pending | Not implemented. |
| CMOB-205 comments/remixes-only notification preference | Pending | Not implemented. |

## Active Backlog

### CMOB-104 - Notification prioritization for mobile social actions
- Type: UX enhancement
- Priority: P0
- Target files:
  - `src/hooks/useNotifications.ts`
  - `src/lib/notifications.ts`
  - `src/components/NotificationPanel.tsx`
- Acceptance criteria:
  - Unread notifications appear before read notifications.
  - Within unread items, `comment` and `remix` rank above `upvote`/`verified`.
  - Existing mark-read and mark-all-read behavior remains unchanged.

### CMOB-201 - Creator quick profile sheet
- Type: Feature
- Priority: P1
- Target files:
  - `src/components/community/CommunityPostCard.tsx`
  - `src/components/community/CommunityComments.tsx`
  - `src/pages/Community.tsx`
  - `src/lib/community.ts`
- Acceptance criteria:
  - Mobile avatar/name tap opens a sheet with creator summary and follow CTA.
  - Follow/unfollow actions update feed state without full route transition.

### CMOB-202 - Follow nudge after meaningful action
- Type: Feature
- Priority: P1
- Target files:
  - `src/pages/Community.tsx`
  - `src/pages/CommunityPost.tsx`
  - `src/components/community/CommunityComments.tsx`
- Acceptance criteria:
  - Nudge appears only after successful comment/remix by non-following users.
  - Nudge is suppressed for own posts and already-followed authors.

### CMOB-203 - New from following indicator
- Type: Feature
- Priority: P1
- Target files:
  - `src/hooks/useNewPostsIndicator.ts`
  - `src/pages/Community.tsx`
  - `src/components/community/CommunityFeed.tsx`
- Acceptance criteria:
  - Indicator appears when unseen posts exist from followed creators.
  - Indicator clears once following-feed items are viewed.
  - Polling/refresh load remains bounded.

### CMOB-204 - Civility nudge for risky comments
- Type: Safety UX
- Priority: P2
- Target files:
  - `src/lib/community-moderation.ts`
  - `src/components/community/CommunityComments.tsx`
- Acceptance criteria:
  - Existing blocked-content moderation remains enforced.
  - Borderline-language path shows an optional rephrase nudge before submit.

### CMOB-205 - Notification preference for high-signal interactions
- Type: Feature
- Priority: P2
- Target files:
  - `src/components/NotificationPanel.tsx`
  - `src/hooks/useNotifications.ts`
  - `src/lib/notifications.ts`
- Acceptance criteria:
  - User preference to hide lower-signal reaction notifications is persisted.
  - Notification count behavior is clearly defined for filtered vs total items.

## Definition of Done

- Feature works with `VITE_COMMUNITY_MOBILE_ENHANCEMENTS=true` with no regressions when false.
- Unit tests and mobile Playwright checks cover primary and fallback paths.
- Telemetry events are emitted for key funnel steps and validated in tests.
- `docs/community-mobile-qa-checklist.md` is updated for any new interaction flows.
