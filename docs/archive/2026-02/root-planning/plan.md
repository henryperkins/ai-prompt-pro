# Social Features Uplift — Implementation Plan

## Overview
Full social layer uplift across the Profile page and Community Feed. Transform the minimal profile into a rich creator identity surface and make the feed more visually dynamic with better social engagement patterns.

---

## Phase A: Shared Utilities & Foundations

### A1. Extract `getInitials` to shared utility
- **New file**: `src/lib/community-utils.ts`
- Export `getInitials(name: string): string` (currently duplicated in 4 files)
- Export `estimateTokens(text: string): string` (currently in CommunityPostCard only)
- Export `toProfileMap` and `toParentTitleMap` (duplicated in Community.tsx and Profile.tsx)
- Update imports in: `CommunityPostCard.tsx`, `CommunityPostDetail.tsx`, `CommunityComments.tsx`, `NotificationPanel.tsx`, `Community.tsx`, `Profile.tsx`

### A2. Add `ProfileStats` type to community types
- Add to `src/lib/community.ts`: a `ProfileActivityStats` type with `totalPosts`, `totalUpvotes`, `totalVerified`, `averageRating`
- Add `loadProfileActivityStats(userId: string)` API function — aggregates from `community_posts` where `author_id = userId`
- This powers the new profile activity summary

---

## Phase B: Profile Page Redesign (`src/pages/Profile.tsx`)

### B1. Profile Hero Section
Replace the generic `PageHero` + flat `Card` with a dedicated profile hero:

- **New component**: `src/components/community/ProfileHero.tsx`
- Large avatar (`h-20 w-20`) with a rarity-colored ring border based on the user's highest-rarity post (uses `getCommunityPostRarity` logic against their best post)
- Display name in `pf-text-display` (Cinzel) font
- Join date displayed as "Member since {month} {year}" in `type-meta text-muted-foreground`
- Follower / Following counts as side-by-side stat cells (not inline badges)
- Follow/Unfollow button (larger, `h-10`) or "You" badge for own profile
- Background: `pf-gilded-frame` with `pf-hero-surface` overlay — profile-specific variant with a subtler gradient

### B2. Activity Summary Strip
Below the hero, a horizontal stat bar:

- 4 stat cells in a `grid grid-cols-2 sm:grid-cols-4` layout
- Each cell: icon + numeric value + label (e.g. Flame icon + "47" + "Upvotes Earned")
- Stats: Total Posts, Total Upvotes, Verified Badges, Avg Rating
- Uses `pf-card` styling with `border-border/60` for a subtle container
- Data from `loadProfileActivityStats()` (new API function from A2)

### B3. Top Prompt Highlight
If the user has any epic or legendary rarity post, feature it:

- Check rarity of all loaded posts via `getCommunityPostRarity`
- If a legendary or epic post exists, render it at the top with `isFeatured=true` styling and a "Top Prompt" badge
- Uses existing `CommunityPostCard` with `isFeatured` — no new component needed
- Remaining posts render in the standard grid below

### B4. Profile-Specific Post Header
Add a section header between the hero and posts:

- "Published Prompts" heading with post count badge
- Subtle `pf-divider` separator line (gold-to-teal gradient)

---

## Phase C: Community Feed Enhancement

### C1. Clickable Tag Filtering
In `CommunityPostCard.tsx`:

- Wrap each tag `Badge` in a `<button>` or make the Badge itself clickable
- `onClick` calls a new `onTagClick?: (tag: string) => void` prop
- In `Community.tsx`: `handleTagClick` sets the search query to the clicked tag value and scrolls to top
- Pass `onTagClick` through `CommunityFeed` to each card

### C2. Engagement Pulse on High-Rarity Cards
In `src/styles/promptforge-fantasy.css`:

- Add a subtle CSS `@keyframes` pulse animation on `.pf-rarity-legendary` and `.pf-rarity-epic` cards
- Legendary: slow gold border-glow pulse (`box-shadow` oscillation over 4s)
- Epic: slower, subtler ember glow pulse (6s cycle)
- Uses `prefers-reduced-motion: reduce` media query to disable for accessibility
- Keep animation very subtle — just enough to draw eye without being distracting

### C3. Token Estimate Tooltip
In `CommunityPostCard.tsx`:

- Wrap the token estimate `<span>` in a `Tooltip` from the existing tooltip component
- Tooltip content: "Estimated token count (~1.35x word count)"
- Simple change, improves discoverability

### C4. Rating UX Cleanup
In `CommunityPostCard.tsx`:

- Visually separate the read-only rating display from the interactive star picker
- Move the community average display inline with the action bar (near upvote/verified)
- Keep the interactive star picker on its own line below, with a "Your rating" label prefix
- Add a subtle `border-t border-border/40` separator if both are present

### C5. Improved Empty States
Standardize empty states across community surfaces:

- **Comments empty state** (`CommunityComments.tsx`): Replace bare text with a small `MessageCircle` icon + "No comments yet" + "Be the first to share your thoughts" subtext
- **Notification panel empty state** (`NotificationPanel.tsx`): Replace bare text with `Bell` icon + "No notifications yet" + "You'll be notified when others interact with your prompts"
- Style both to match `StateCard` patterns: centered icon in a round badge, title, description

---

## Phase D: Social Polish

### D1. Comment Auth Nudge
In `CommunityComments.tsx`:

- When user is not authenticated, replace the disabled textarea with a styled prompt:
  - `MessageCircle` icon + "Sign in to join the conversation"
  - A `Button` with `color="primary"` linking to sign-in flow
  - Wrapped in a `rounded-lg border border-border/60 bg-background/70 p-3` container matching comment style

### D2. Notification Panel Typography
In `NotificationPanel.tsx`:

- Replace all raw `text-sm` usages with appropriate `type-*` semantic tokens
- `text-sm font-semibold` → `type-post-title`
- `text-sm leading-5` → `type-post-body`
- `text-sm text-muted-foreground` → `type-meta text-muted-foreground`
- `text-xs` → `type-timestamp`
- Ensures consistency with the community typography system

---

## File Change Summary

| File | Change Type |
|---|---|
| `src/lib/community-utils.ts` | **New** — shared utilities |
| `src/lib/community.ts` | **Edit** — add `ProfileActivityStats` type + `loadProfileActivityStats` |
| `src/components/community/ProfileHero.tsx` | **New** — profile hero component |
| `src/pages/Profile.tsx` | **Edit** — major redesign using ProfileHero + activity stats + top prompt |
| `src/components/community/CommunityPostCard.tsx` | **Edit** — clickable tags, tooltip, rating cleanup |
| `src/components/community/CommunityFeed.tsx` | **Edit** — pass `onTagClick` prop through |
| `src/pages/Community.tsx` | **Edit** — handle tag click filtering |
| `src/components/community/CommunityComments.tsx` | **Edit** — auth nudge, improved empty state |
| `src/components/NotificationPanel.tsx` | **Edit** — typography tokens, improved empty state |
| `src/styles/promptforge-fantasy.css` | **Edit** — rarity pulse animations |
| `src/components/community/CommunityPostDetail.tsx` | **Edit** — use shared utils |

## Implementation Order
A1 → A2 → B1 → B2 → B3 → B4 → C1 → C2 → C3 → C4 → C5 → D1 → D2

Phases are sequential but each step within a phase is independently shippable.
