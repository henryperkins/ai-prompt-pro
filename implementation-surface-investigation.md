# Implementation Surface Investigation
**Date:** 2024
**Purpose:** Exact implementation details for upcoming community mobile enhancements

---

## 1. Share Infrastructure

### ✅ clipboard.ts exists and is ready
**Location:** `src/lib/clipboard.ts`

**Function:** `copyTextToClipboard(text: string): Promise<void>` (lines 29-44)
- Uses modern `navigator.clipboard.writeText()` API
- Falls back to `document.execCommand("copy")` for iOS/webview contexts
- Throws error if clipboard access is blocked
- Already used in Community.tsx (line 285-288) with toast success feedback

### ❌ No existing navigator.share usage
- Search result: No matches found in codebase
- This is a **new implementation** needed

### Vote Button Row Structure (CommunityPostCard.tsx, lines 269-327)

**Parent container:**
```tsx
<div
  className={cn(
    "type-meta gap-2 text-muted-foreground",
    isMobile ? "grid grid-cols-3" : "flex flex-wrap items-center",
  )}
>
```

**Button pattern (3 buttons: Upvote, Verified, Comment):**
```tsx
<Button
  type="button"
  size="sm"
  color={voteState?.upvote ? "primary" : "secondary"}
  className="type-button-label interactive-chip h-11 min-w-11 gap-1.5 px-3 sm:h-9 sm:min-w-9 sm:gap-1 sm:px-2.5"
  disabled={!canVote}
  onClick={() => onToggleVote(post.id, "upvote")}
>
  <ArrowUp className="h-3.5 w-3.5" />
  <span className="type-numeric">{post.upvoteCount}</span>
</Button>
```

**Layout behavior:**
- Mobile: `grid grid-cols-3` (3 equal columns)
- Desktop: `flex flex-wrap items-center`
- Gap: `gap-2` (0.5rem)
- Button heights: `h-11` mobile, `h-9` desktop

---

## 2. Save/Bookmark from Feed

### Function: `remixToLibrary` (community.ts, lines 1237-1280)

**Signature:**
```typescript
export async function remixToLibrary(
  postId: string,
  options?: { title?: string; remixNote?: string },
): Promise<SavedPromptRecord>
```

**What it does:**
1. Fetches public community post by ID
2. Normalizes the prompt config from `public_config`
3. Creates a new entry in `saved_prompts` table with:
   - User ID (current user)
   - Title: `options?.title || "Remix of ${post.title}"`
   - Description, category, tags from post
   - Config from post's `public_config`
   - `is_shared: false` (saves privately)
   - `remixed_from: post.id` (tracks lineage)
   - `remix_note: options?.remixNote` (user-provided note)
   - `remix_diff: null`
4. Returns the created SavedPromptRecord

**Key behavior:**
- This is **NOT a bookmark** — it creates a full copy in your library
- It's a "save as template" operation
- Always saves as private (`is_shared: false`)

### "Save to Library" UX in CommunityPostDetail.tsx (lines 200-217)

**Button markup:**
```tsx
<Button
  type="button"
  color="tertiary"
  size="sm"
  className="type-button-label h-11 w-full gap-1.5 sm:h-9 sm:w-auto"
  disabled={!canSaveToLibrary}
  onClick={() => onSaveToLibrary(post.id)}
>
  <BookmarkPlus className="h-3.5 w-3.5" />
  Save to Library
</Button>
```

**Props interface (lines 50-54):**
```typescript
canSaveToLibrary: boolean;
onSaveToLibrary: (postId: string) => void;
```

**Icon:** `BookmarkPlus` from lucide-react (imported line 5)

### ❌ No separate "bookmark" concept
- Only "Save to Library" exists (which calls `remixToLibrary`)
- No lightweight bookmark/save-for-later feature
- No database table for bookmarks
- If you need quick "save for later" vs "add to library", this is a **new feature**

---

## 3. Infinite Scroll

### Pagination State in Community.tsx (lines 85-91)

```typescript
const [loading, setLoading] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(false);
const [page, setPage] = useState(0);
```

**Constants:**
- `FEED_PAGE_SIZE = 20` (line 53)

### `handleLoadMore` function (lines 225-267)

**Signature:**
```typescript
const handleLoadMore = useCallback(() => {
  if (loading || isLoadingMore || !hasMore) return;
  // ...
}, [loading, isLoadingMore, hasMore, page, sort, category, query, /* ... */]);
```

**Logic:**
1. Guard: return if `loading`, `isLoadingMore`, or `!hasMore`
2. Increment page: `const nextPage = page + 1;`
3. Call `loadFeed({ sort, category, search, limit: FEED_PAGE_SIZE, page: nextPage })`
4. Dedupe posts against existing state
5. Update: `setPosts([...previous, ...dedupedPosts])`
6. Update: `setPage(nextPage)`
7. Update: `setHasMore(nextPagePosts.length === FEED_PAGE_SIZE)`
8. Hydrate context for new posts (authors, votes, ratings)

**Error handling:**
- Shows toast: "Could not load more posts" (lines 257-261)

### "Load more" button in CommunityFeed.tsx (lines 201-214)

```tsx
{hasMore && onLoadMore && (
  <div className="flex justify-center pt-1 lg:col-span-2">
    <Button
      type="button"
      color="secondary"
      size="sm"
      onClick={onLoadMore}
      disabled={isLoadingMore}
      className="type-button-label h-11 px-4 sm:h-9 sm:px-3"
    >
      {isLoadingMore ? "Loading more..." : "Load more"}
    </Button>
  </div>
)}
```

**Props (lines 33-36):**
```typescript
hasMore?: boolean;
isLoadingMore?: boolean;
onLoadMore?: () => void;
```

**Parent grid:** `lg:col-span-2` (spans both columns on desktop 2-col layout)

### ❌ No existing IntersectionObserver usage
- Search result: No matches in codebase
- This is a **new implementation** if you want auto-trigger on scroll

---

## 4. Follow System

### All follow functions exist in community.ts

**1. `loadFollowingUserIds()` (lines 727-744)**
```typescript
export async function loadFollowingUserIds(): Promise<string[]>
```
- Returns: array of user IDs the current user follows
- Query: `community_user_follows` WHERE `follower_id = currentUser.id`

**2. `loadFollowStats(userId: string)` (lines 833-861)**
```typescript
export async function loadFollowStats(userId: string): Promise<FollowStats>

export interface FollowStats {
  followersCount: number;
  followingCount: number;
}
```
- Returns: follower/following counts for a given user
- Two queries: count WHERE `followed_user_id = userId` and WHERE `follower_id = userId`

**3. `isFollowingCommunityUser(targetUserId: string)` (lines 863-882)**
```typescript
export async function isFollowingCommunityUser(targetUserId: string): Promise<boolean>
```
- Returns: `true` if current user follows targetUserId
- Returns `false` if targetUserId is current user or not authenticated

**4. `followCommunityUser(targetUserId: string)` (lines 884-922)**
```typescript
export async function followCommunityUser(targetUserId: string): Promise<boolean>
```
- Throws error if trying to follow yourself
- Uses `upsert` with `onConflict: "follower_id,followed_user_id"`
- Returns `true` on success

**5. `unfollowCommunityUser(targetUserId: string)` (lines 924-940)**
```typescript
export async function unfollowCommunityUser(targetUserId: string): Promise<boolean>
```
- Deletes follow record
- Returns `true` if row was deleted

### Feed.tsx uses `loadPersonalFeed` (lines 19, 169, 205)

**Function signature:**
```typescript
loadPersonalFeed(options: { page?: number; limit?: number }): Promise<CommunityPost[]>
```

**Implementation (community.ts lines 746-760+):**
1. Calls `loadFollowingUserIds()` to get followed users
2. Builds `authorIds = [currentUser, ...followedUserIds]`
3. Queries `community_posts` WHERE `author_id IN (authorIds)`
4. Ordered by `created_at DESC`
5. Paginated with `limit` and `page`

**Key difference from Community.tsx:**
- **Community.tsx:** calls `loadFeed({ sort, category, search, limit, page })` - global feed with filters
- **Feed.tsx:** calls `loadPersonalFeed({ limit, page })` - posts from followed users + self only

### ✅ Profile.tsx has Follow button (lines 269-303, 473-479)

**State (lines 77-78):**
```typescript
const [isFollowing, setIsFollowing] = useState(false);
const [followPending, setFollowPending] = useState(false);
```

**Handler (lines 269-303):**
```typescript
const handleToggleFollow = useCallback(async () => {
  if (!profileUserId || isOwnProfile) return;
  if (!user) {
    toast({ title: "Sign in required", description: "Sign in to follow creators." });
    return;
  }
  setFollowPending(true);
  try {
    if (isFollowing) {
      await unfollowCommunityUser(profileUserId);
      setIsFollowing(false);
      setProfileStats((previous) => ({
        ...previous,
        followersCount: Math.max(0, previous.followersCount - 1),
      }));
    } else {
      await followCommunityUser(profileUserId);
      setIsFollowing(true);
      setProfileStats((previous) => ({
        ...previous,
        followersCount: previous.followersCount + 1,
      }));
    }
  } catch (error) {
    toast({
      title: "Follow action failed",
      description: error instanceof Error ? error.message : "Unexpected error",
      variant: "destructive",
    });
  } finally {
    setFollowPending(false);
  }
}, [isFollowing, isOwnProfile, profileUserId, toast, user]);
```

**Button (lines 473-479):**
```tsx
<Button
  type="button"
  color={isFollowing ? "secondary" : "primary"}
  className="type-button-label h-11 sm:h-9"
  onClick={() => void handleToggleFollow()}
  disabled={followPending}
>
  {followPending ? "Saving..." : isFollowing ? "Following" : "Follow"}
</Button>
```

---

## 5. Star Rating Structure

### Rating Display + Input (CommunityPostCard.tsx, lines 329-368)

**Parent container (line 329):**
```tsx
<div className="type-meta flex flex-wrap items-center gap-2 text-muted-foreground">
```
- Type class: `type-meta`
- Layout: `flex flex-wrap items-center gap-2`
- Text color: `text-muted-foreground`

**Rating summary (lines 330-342):**
```tsx
<span
  aria-label={ratingSummaryAriaLabel}
  className="inline-flex items-center gap-1.5 rounded-full border border-border/65 bg-background/65 px-2 py-1"
>
  <Star
    className={cn(
      "h-3.5 w-3.5",
      ratingCount > 0 ? "fill-primary text-primary" : "text-muted-foreground",
    )}
  />
  <span className="type-numeric">{ratingAverage.toFixed(1)}</span>
  <span className="type-numeric text-muted-foreground/80">({ratingCount})</span>
</span>
```
- Shape: rounded pill with border
- Icon: 3.5×3.5 star (filled if ratings > 0)
- Shows: `4.2 (12)` format

**Interactive rating (lines 343-367):**
```tsx
{canRate && onRatePrompt && (
  <div className="inline-flex items-center gap-0.5 rounded-full border border-border/65 bg-background/65 p-0.5">
    {[1, 2, 3, 4, 5].map((value) => {
      const isActive = (ratingValue ?? 0) >= value;
      return (
        <Button
          key={`${post.id}-rate-${value}`}
          type="button"
          color="tertiary"
          size="sm"
          className="h-7 w-7 rounded-full p-0 sm:h-7 sm:w-7"
          aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
          onClick={() => onRatePrompt(post.id, ratingValue === value ? null : value)}
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              isActive ? "fill-primary text-primary" : "text-muted-foreground",
            )}
          />
        </Button>
      );
    })}
  </div>
)}
```

**Structure:**
- 5 circular buttons in a pill container
- Button size: `h-7 w-7 rounded-full`
- Star icon: `h-4 w-4`
- Gap between stars: `gap-0.5`
- Container padding: `p-0.5`
- Click toggles: clicking same rating clears it (`ratingValue === value ? null : value`)

**Visual:**
```
[★ 4.2 (12)]  [○ ○ ○ ★ ★]
 summary       interactive rating
```

---

## 6. Bottom Nav Consolidation

### Full navigation.ts content (25 lines)

```typescript
import { BookOpen, History, Layers, Newspaper, PenSquare, Users, type LucideIcon } from "lucide-react";

export interface AppRouteNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  ariaLabel: string;
}

export const APP_ROUTE_NAV_ITEMS: ReadonlyArray<AppRouteNavItem> = [
  { to: "/", label: "Builder", icon: PenSquare, ariaLabel: "Open builder" },
  { to: "/presets", label: "Presets", icon: Layers, ariaLabel: "Browse preset templates" },
  { to: "/community", label: "Community", icon: Users, ariaLabel: "Open community" },
  { to: "/feed", label: "Feed", icon: Newspaper, ariaLabel: "Open personal feed" },
  { to: "/library", label: "Library", icon: BookOpen, ariaLabel: "Open prompt library" },
  { to: "/history", label: "History", icon: History, ariaLabel: "Open version history" },
];

export const BOTTOM_NAV_ITEMS: ReadonlyArray<AppRouteNavItem> = APP_ROUTE_NAV_ITEMS;

export function isRouteActive(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname.startsWith(route);
}
```

**Key points:**
- `BOTTOM_NAV_ITEMS` is an alias for `APP_ROUTE_NAV_ITEMS`
- Currently **6 items** (Builder, Presets, Community, Feed, Library, History)
- Icons from `lucide-react`

### Feed.tsx vs Community.tsx data loading

**Community.tsx (line 194-200):**
```typescript
const firstPage = await loadFeed({
  sort,
  category,
  search: query || undefined,
  limit: FEED_PAGE_SIZE,
  page: 0,
});
```
- Global community feed with sorting/filtering
- User can change sort (popular, new, most_remixed, verified)
- User can filter by category
- User can search

**Feed.tsx (line 169-172):**
```typescript
const firstPage = await loadPersonalFeed({
  limit: FEED_PAGE_SIZE,
  page: 0,
});
```
- Personal feed: posts from followed users + own posts
- No sort/category/search params
- Always chronological (created_at DESC)

**Implication for consolidation:**
- If merging, you need tabs/toggle to switch between "Community" and "Following"
- Or merge into Community with a "Following" sort option

---

## 7. Comment Composer

### Full markup (CommunityComments.tsx, lines 335-368)

**Container:**
```tsx
<Card className="space-y-1.5 sm:space-y-2">
```

**Textarea (lines 339-351):**
```tsx
<Textarea
  value={draft}
  onChange={(event) => setDraft(event.target.value)}
  onKeyDown={(event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
  }}
  placeholder={canComment ? "Write a comment..." : "Sign in to comment"}
  disabled={!canComment || submitting}
  className="type-input type-wrap-safe min-h-19 rounded-lg border-border/70 bg-background/95 sm:min-h-22"
/>
```

**Key features:**
- State: `const [draft, setDraft] = useState("");` (line 72)
- Keyboard shortcut: `Cmd+Enter` or `Ctrl+Enter` submits
- Placeholder changes based on auth state
- Min height: `min-h-19` mobile, `min-h-22` desktop (via `sm:`)
- Rounded: `rounded-lg`
- Semi-transparent bg: `bg-background/95`

**Submit button (lines 352-365):**
```tsx
<div className="flex justify-end">
  <Button
    type="button"
    size="sm"
    color={canComment ? "primary" : "secondary"}
    onClick={handleSubmit}
    disabled={submitDisabled}
    className="type-button-label h-11 gap-1.5 px-4 sm:h-9 sm:px-3"
    data-testid="community-comment-submit"
  >
    <Send className="h-3.5 w-3.5" />
    {submitLabel}
  </Button>
</div>
```

**Variables (computed):**
```typescript
const canComment = Boolean(user);
const submitDisabled = !canComment || submitting || !draft.trim();
const submitLabel = submitting ? "Sending..." : "Comment";
```

**Icon:** `Send` from lucide-react (3.5×3.5)

### ❌ No emoji support
- Search for "emoji" in CommunityComments.tsx: No matches
- This is a **new feature** if needed

---

## 8. Toast/Notification Patterns

### Toast usage in Community.tsx

**Import (line 12):**
```typescript
import { useToast } from "@/hooks/use-toast";
```

**Hook (line 100):**
```typescript
const { toast } = useToast();
```

**Patterns:**

**1. Success (lines 285-288):**
```typescript
toast({
  title: "Prompt copied",
  description: "Prompt text copied with context-ready formatting.",
});
```

**2. Error (lines 290-294):**
```typescript
toast({
  title: "Copy failed",
  description: "Could not access clipboard in this browser context.",
  variant: "destructive",
});
```

**3. Auth required (line 303):**
```typescript
toast({ title: "Sign in required", description: "Create an account to vote." });
```

**4. Action confirmation (lines 422-425):**
```typescript
toast({
  title: "User blocked",
  description: "Posts and comments from this user are now hidden.",
});
```

**Variants:**
- Default: no variant (success/info style)
- `variant: "destructive"` for errors

### useNotifications hook (src/hooks/useNotifications.ts)

**Polling interval (line 22):**
```typescript
const POLL_INTERVAL_MS = 30_000;
```
- **30 seconds** between polls

**Polling logic (lines 127-169):**
1. Only polls when user is signed in
2. Respects page visibility API:
   - Stops polling when tab is hidden
   - Resumes + immediate refresh when tab becomes visible
3. Interval ID management with start/stop functions
4. Cleanup on unmount

**How it detects new items:**
- On each poll (every 30s), calls:
  1. `loadNotifications(limit, 0)` - fetches latest N notifications
  2. `getUnreadCount()` - counts unread notifications
- Compares `unreadCount` in state
- UI can show badge/indicator when `unreadCount > 0`

**Interface (lines 11-19):**
```typescript
export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}
```

**Notification types (notifications.ts, line 5):**
```typescript
export type NotificationType = "upvote" | "verified" | "comment" | "remix";
```

---

## 9. Feature Flags

### Full feature-flags.ts content (38 lines)

```typescript
function parseBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export interface BuilderRedesignFlags {
  builderRedesignPhase1: boolean;
  builderRedesignPhase2: boolean;
  builderRedesignPhase3: boolean;
  builderRedesignPhase4: boolean;
}

export const builderRedesignFlags: BuilderRedesignFlags = {
  builderRedesignPhase1: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE1),
  builderRedesignPhase2: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE2),
  builderRedesignPhase3: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE3),
  builderRedesignPhase4: parseBooleanFlag(import.meta.env.VITE_BUILDER_REDESIGN_PHASE4),
};

export interface CommunityFeatureFlags {
  communityMobileEnhancements: boolean;
}

export const communityFeatureFlags: CommunityFeatureFlags = {
  communityMobileEnhancements: parseBooleanFlag(import.meta.env.VITE_COMMUNITY_MOBILE_ENHANCEMENTS),
};

export interface LaunchExperimentFlags {
  launchHeroCopyExperiment: boolean;
  launchPrimaryCtaExperiment: boolean;
}

export const launchExperimentFlags: LaunchExperimentFlags = {
  launchHeroCopyExperiment: parseBooleanFlag(import.meta.env.VITE_LAUNCH_EXPERIMENT_HERO_COPY),
  launchPrimaryCtaExperiment: parseBooleanFlag(import.meta.env.VITE_LAUNCH_EXPERIMENT_PRIMARY_CTA),
};
```

**Existing community flag:**
- `communityFeatureFlags.communityMobileEnhancements`
- Env var: `VITE_COMMUNITY_MOBILE_ENHANCEMENTS`
- Currently used in:
  - `Community.tsx` (lines 21, 103-104)
  - `CommunityPostCard.tsx` (line 21)
  - `CommunityPostDetail.tsx` (line 33)

**Pattern for phase flags:**
- Already uses phase1-4 for builder redesign
- Could add:
  ```typescript
  export interface CommunityMobilePhaseFlags {
    communityMobilePhase1: boolean;
    communityMobilePhase2: boolean;
    communityMobilePhase3: boolean;
  }
  ```

---

## Summary & Recommendations

### ✅ Ready to use as-is:
1. **Clipboard** - `copyTextToClipboard()` works
2. **Follow system** - all functions exist, Profile has working follow button
3. **Pagination** - state + `handleLoadMore` pattern established
4. **Toast** - `useToast` hook ready
5. **Notifications** - polling hook with 30s interval
6. **Feature flags** - phase flag pattern available

### 🆕 New implementations needed:
1. **navigator.share** - no existing usage
2. **IntersectionObserver** - no existing usage (for infinite scroll auto-trigger)
3. **Emoji support** - not in comment composer
4. **Bookmark/save-for-later** - only "Save to Library" exists (creates full copy)

### 🔍 Key architectural notes:
- **Save vs Bookmark:** `remixToLibrary` creates a full copy in user's library, not a lightweight bookmark
- **Feed vs Community:** Different data sources (`loadPersonalFeed` vs `loadFeed`) — consolidation needs tabs/toggle
- **Mobile grid:** Vote buttons use `grid grid-cols-3` on mobile, `flex flex-wrap` on desktop
- **Star rating:** Interactive 5-star uses `gap-0.5` in pill container, buttons are `h-7 w-7`
- **Comment composer:** `Cmd+Enter` submit, no emoji picker currently

### 📦 Component props patterns:
- Booleans: `canVote`, `canRate`, `canSaveToLibrary`, `isFollowing`
- Handlers: `onToggleVote`, `onRatePrompt`, `onSaveToLibrary`, `handleToggleFollow`
- Loading states: `isLoadingMore`, `followPending`, `submitting`
- Pagination: `page`, `hasMore`, `isLoadingMore`, `handleLoadMore`
