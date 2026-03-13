import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";

const MOBILE_WIDTHS = [320, 375, 390, 428] as const;
const VIEWPORT_HEIGHT = 900;

const TIMESTAMP_BASE = Date.UTC(2026, 0, 20, 12, 0, 0);

interface CommunityPostRow {
  id: string;
  saved_prompt_id: string;
  author_id: string;
  title: string;
  enhanced_prompt: string;
  description: string;
  use_case: string;
  category: string;
  tags: string[];
  target_model: string;
  is_public: boolean;
  public_config: Record<string, unknown>;
  starter_prompt: string;
  remixed_from: string | null;
  remix_note: string;
  remix_diff: Record<string, unknown> | null;
  upvote_count: number;
  verified_count: number;
  remix_count: number;
  comment_count: number;
  rating_count?: number;
  rating_avg?: number;
  created_at: string;
  updated_at: string;
}

interface CommunityProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface CommunityCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface BaselineMetric {
  route: string;
  width: number;
  viewportHeight: number;
  documentScrollWidth: number;
  hasHorizontalOverflow: boolean;
  navHeight: number;
  pageShellPaddingBottom: number;
  bottomNavSafeAreaPadding: number;
  bottomNavOverlapPx: number;
  lastActionableBottom: number | null;
  bottomNavTop: number | null;
  controlsUnder44px: Array<{ testId: string; width: number; height: number }>;
  drawerControlsUnder44px: Array<{ testId: string; width: number; height: number }>;
  commentsSheetOffscreenPx: number;
  commentsComposerHeight: number | null;
  commentsComposerOverlapPx: number;
  commentsComposerOutsideViewportPx: number;
  commentsRequiresSignIn: boolean;
}

const PUBLIC_CONFIG_FIXTURE = {
  originalPrompt: "Plan a backend migration safely.",
  role: "Senior backend engineer",
  task: "Generate a migration plan with rollback.",
  tone: "clear",
  complexity: "high",
  lengthPreference: "medium",
  format: "checklist",
  constraints: ["No downtime", "Include rollback"],
  examples: [],
  contextConfig: {
    sources: [],
    databaseConnections: [],
    rag: { enabled: false, topK: 5, threshold: 0.2 },
    structuredOutput: {
      enabled: false,
      format: "json",
      schemaName: "",
      schemaText: "",
    },
    interviewMode: {
      enabled: false,
      prompt: "",
      expectedFields: [],
    },
    projectNotes: "",
  },
};

const AUTH_USER = {
  id: "viewer-1",
  aud: "authenticated",
  role: "authenticated",
  email: "viewer@example.com",
  app_metadata: {
    provider: "email",
    providers: ["email"],
  },
  user_metadata: {
    display_name: "Taylor Reviewer",
    full_name: "Taylor Reviewer",
    avatar_url: null,
  },
  created_at: toIso(-1440),
};

const AUTH_SESSION = {
  access_token: "auth-access-token",
  refresh_token: "auth-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: AUTH_USER,
};

function toIso(offsetMinutes: number): string {
  return new Date(TIMESTAMP_BASE + offsetMinutes * 60_000).toISOString();
}

const FEED_POSTS: CommunityPostRow[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    saved_prompt_id: "saved-1111",
    author_id: "author-1",
    title: "Backend migration helper",
    enhanced_prompt: "Create a zero-downtime migration plan with rollback and phased rollout.",
    description: "",
    use_case: "Schema migration checklist",
    category: "backend",
    tags: ["migration", "postgres"],
    target_model: "gpt-5-mini",
    is_public: true,
    public_config: PUBLIC_CONFIG_FIXTURE,
    starter_prompt: "Help me migrate my production database safely.",
    remixed_from: null,
    remix_note: "",
    remix_diff: null,
    upvote_count: 8,
    verified_count: 3,
    remix_count: 2,
    comment_count: 2,
    rating_count: 0,
    rating_avg: 0,
    created_at: toIso(0),
    updated_at: toIso(0),
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    saved_prompt_id: "saved-2222",
    author_id: "author-2",
    title: "Frontend accessibility audit",
    enhanced_prompt: "Audit this component set for WCAG 2.2 AA and return prioritized fixes.",
    description: "",
    use_case: "A11y review",
    category: "frontend",
    tags: ["accessibility", "audit"],
    target_model: "gpt-5-mini",
    is_public: true,
    public_config: PUBLIC_CONFIG_FIXTURE,
    starter_prompt: "Review my UI for accessibility issues.",
    remixed_from: null,
    remix_note: "",
    remix_diff: null,
    upvote_count: 5,
    verified_count: 2,
    remix_count: 1,
    comment_count: 1,
    rating_count: 0,
    rating_avg: 0,
    created_at: toIso(-60),
    updated_at: toIso(-60),
  },
];

const PROFILE_ROWS: CommunityProfileRow[] = [
  { id: "author-1", display_name: "Alex Backend", avatar_url: null },
  { id: "author-2", display_name: "Jamie Frontend", avatar_url: null },
  { id: "commenter-1", display_name: "Morgan Ops", avatar_url: null },
];

const COMMENT_ROWS: Record<string, CommunityCommentRow[]> = {
  "11111111-1111-1111-1111-111111111111": [
    {
      id: "comment-1",
      post_id: "11111111-1111-1111-1111-111111111111",
      user_id: "commenter-1",
      body: "Use transactions for reliability.",
      created_at: toIso(20),
      updated_at: toIso(20),
    },
    {
      id: "comment-2",
      post_id: "11111111-1111-1111-1111-111111111111",
      user_id: "author-2",
      body: "Canary rollout helped us avoid regressions.",
      created_at: toIso(10),
      updated_at: toIso(10),
    },
  ],
  "22222222-2222-2222-2222-222222222222": [
    {
      id: "comment-3",
      post_id: "22222222-2222-2222-2222-222222222222",
      user_id: "author-1",
      body: "Great checklist, thanks for sharing.",
      created_at: toIso(15),
      updated_at: toIso(15),
    },
  ],
};

function fulfillJson(route: Route, payload: unknown, status = 200, headers: Record<string, string> = {}): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(payload),
  });
}

function buildContentRange(count: number): string {
  if (count <= 0) {
    return "0-0/0";
  }
  return `0-${Math.max(count - 1, 0)}/${count}`;
}

function parseEqValue(input: string | null): string | null {
  if (!input || !input.startsWith("eq.")) return null;
  return decodeURIComponent(input.slice(3));
}

function parseInValues(input: string | null): string[] {
  if (!input || !input.startsWith("in.(") || !input.endsWith(")")) return [];
  return decodeURIComponent(input.slice(4, -1))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseContainsTagValue(input: string | null): string | null {
  if (!input) return null;
  const decoded = decodeURIComponent(input);
  const match = decoded.match(/^cs\.\{"?([^",}]+)"?\}$/i);
  return match?.[1]?.trim().toLowerCase() ?? null;
}

function applyPostFilters(url: URL, rows: CommunityPostRow[]): CommunityPostRow[] {
  const idEq = parseEqValue(url.searchParams.get("id"));
  if (idEq) {
    return rows.filter((row) => row.id === idEq);
  }

  const idIn = parseInValues(url.searchParams.get("id"));
  if (idIn.length > 0) {
    const idSet = new Set(idIn);
    return rows.filter((row) => idSet.has(row.id));
  }

  const remixedFrom = parseEqValue(url.searchParams.get("remixed_from"));
  if (remixedFrom) {
    return rows.filter((row) => row.remixed_from === remixedFrom);
  }

  const category = parseEqValue(url.searchParams.get("category"));
  let filtered = rows;
  if (category) {
    filtered = filtered.filter((row) => row.category === category);
  }

  const tag = parseContainsTagValue(url.searchParams.get("tags"));
  if (tag) {
    filtered = filtered.filter((row) => row.tags.map((value) => value.toLowerCase()).includes(tag));
  }

  const searchExpr = decodeURIComponent(url.searchParams.get("or") || "");
  const searchMatch = searchExpr.match(/\.ilike\.%(.+)%/i);
  if (searchMatch && searchMatch[1]) {
    const term = searchMatch[1].toLowerCase();
    filtered = filtered.filter((row) => {
      return row.title.toLowerCase().includes(term) || row.use_case.toLowerCase().includes(term);
    });
  }

  const orders = url.searchParams.getAll("order");
  if (orders.some((value) => value.startsWith("upvote_count."))) {
    filtered = [...filtered].sort((a, b) => b.upvote_count - a.upvote_count);
  } else if (orders.some((value) => value.startsWith("remix_count."))) {
    filtered = [...filtered].sort((a, b) => b.remix_count - a.remix_count);
  } else if (orders.some((value) => value.startsWith("verified_count."))) {
    filtered = [...filtered].sort((a, b) => b.verified_count - a.verified_count);
  } else {
    filtered = [...filtered].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }

  const limit = Number(url.searchParams.get("limit"));
  if (Number.isFinite(limit) && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

interface CommunityMockOptions {
  authenticated?: boolean;
}

const PUBLIC_PAGE_CONTROL_SELECTOR = [
  "[data-testid='community-filter-trigger']",
  "[data-testid='community-sort-button']",
  "[data-testid='community-remix-cta']",
  "[data-testid='community-vote-upvote']",
  "[data-testid='community-vote-verified']",
  "[data-testid='community-comment-toggle']",
  "[data-testid='community-comments-thread-trigger']",
].join(", ");

const AUTHENTICATED_PAGE_CONTROL_SELECTOR = [
  PUBLIC_PAGE_CONTROL_SELECTOR,
  "[data-testid='community-card-follow']",
  "[data-testid='community-detail-rating-star-1']",
  "[data-testid='community-detail-rating-star-2']",
  "[data-testid='community-detail-rating-star-3']",
  "[data-testid='community-detail-rating-star-4']",
  "[data-testid='community-detail-rating-star-5']",
  "[data-testid='profile-follow-button']",
].join(", ");

const COMMENTS_DRAWER_CONTROL_SELECTOR = [
  "[data-testid='community-comment-overflow']",
  "[data-testid='community-quick-reply-chip']",
  "[data-testid='community-comment-submit']",
].join(", ");
const PROMPTFORGE_APP_SELECTOR = "[data-app='promptforge']";

async function installCommunityMocks(page: Page, options: CommunityMockOptions = {}): Promise<void> {
  const authenticated = Boolean(options.authenticated);
  const authUser = authenticated ? AUTH_USER : null;
  const authSession = authenticated ? AUTH_SESSION : null;
  const followingRows = authenticated
    ? [
        {
          id: "follow-1",
          follower_id: AUTH_USER.id,
          followed_user_id: "author-1",
          created_at: toIso(-30),
        },
      ]
    : [];
  const followStatsByUser: Record<string, { followersCount: number; followingCount: number }> = {
    "author-1": { followersCount: 128, followingCount: 12 },
    "author-2": { followersCount: 64, followingCount: 8 },
    [AUTH_USER.id]: { followersCount: 0, followingCount: followingRows.length },
  };
  const blockRows: Array<{ id: string; blocker_id: string; blocked_user_id: string; created_at: string }> = [];
  const votes: Array<{ id: string; post_id: string; user_id: string; vote_type: "upvote" | "verified" }> = [];
  const ratings: Array<{ post_id: string; user_id: string; rating: number }> = [];

  await page.route("**/auth/get-session", async (route) => {
    await fulfillJson(route, { session: authSession, user: authUser });
  });

  await page.route("**/auth/token/anonymous", async (route) => {
    await fulfillJson(route, {
      token: "header.payload.signature",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
  });

  await page.route("**/auth/v1/user", async (route) => {
    if (!authenticated) {
      await fulfillJson(route, { code: 401, msg: "JWT missing" }, 401);
      return;
    }
    await fulfillJson(route, { user: authUser });
  });

  await page.route("**/auth/get-user", async (route) => {
    if (!authenticated) {
      await fulfillJson(route, { code: 401, msg: "JWT missing" }, 401);
      return;
    }
    await fulfillJson(route, { user: authUser });
  });

  await page.route("**/rest/v1/rpc/community_profiles_by_ids**", async (route) => {
    let ids: string[];
    try {
      const payload = route.request().postDataJSON() as { input_ids?: string[] };
      ids = payload?.input_ids ?? [];
    } catch {
      ids = [];
    }

    const idSet = new Set(ids);
    const rows = PROFILE_ROWS.filter((row) => idSet.has(row.id));
    await fulfillJson(route, rows);
  });

  await page.route("**/rest/v1/community_user_follows**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const followerId = parseEqValue(url.searchParams.get("follower_id"));
    const followedUserId = parseEqValue(url.searchParams.get("followed_user_id"));
    let filtered = [...followingRows];

    if (followerId) {
      filtered = filtered.filter((row) => row.follower_id === followerId);
    }
    if (followedUserId) {
      filtered = filtered.filter((row) => row.followed_user_id === followedUserId);
    }

    if (request.method() === "HEAD") {
      const count = followedUserId
        ? (followStatsByUser[followedUserId]?.followersCount ?? filtered.length)
        : followerId
          ? (followStatsByUser[followerId]?.followingCount ?? filtered.length)
          : filtered.length;
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-range": buildContentRange(count),
        },
      });
      return;
    }

    if (request.method() === "DELETE") {
      const index = followingRows.findIndex((row) => {
        return row.follower_id === followerId && row.followed_user_id === followedUserId;
      });
      const removed = index >= 0 ? followingRows.splice(index, 1)[0] : null;
      await fulfillJson(route, removed ? { id: removed.id } : null);
      return;
    }

    if (request.method() === "POST") {
      const payload = route.request().postDataJSON() as
        | { follower_id?: string; followed_user_id?: string }
        | Array<{ follower_id?: string; followed_user_id?: string }>;
      const row = Array.isArray(payload) ? payload[0] : payload;
      const follower = row?.follower_id || AUTH_USER.id;
      const followed = row?.followed_user_id || null;
      const existing = followingRows.find((entry) => {
        return entry.follower_id === follower && entry.followed_user_id === followed;
      });

      if (existing) {
        await fulfillJson(route, { id: existing.id });
        return;
      }

      const created = {
        id: `follow-${followingRows.length + 1}`,
        follower_id: follower,
        followed_user_id: followed,
        created_at: toIso(-5),
      };
      followingRows.push(created);
      await fulfillJson(route, { id: created.id });
      return;
    }

    await fulfillJson(route, filtered);
  });

  await page.route("**/rest/v1/community_user_blocks**", async (route) => {
    const url = new URL(route.request().url());
    const blockerId = parseEqValue(url.searchParams.get("blocker_id"));
    const rows = blockerId
      ? blockRows.filter((row) => row.blocker_id === blockerId)
      : blockRows;
    await fulfillJson(route, rows);
  });

  await page.route("**/rest/v1/community_votes**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const userId = parseEqValue(url.searchParams.get("user_id")) ?? AUTH_USER.id;
    const postIds = parseInValues(url.searchParams.get("post_id"));

    if (request.method() === "DELETE") {
      const postId = parseEqValue(url.searchParams.get("post_id"));
      const voteType = parseEqValue(url.searchParams.get("vote_type"));
      const index = votes.findIndex((row) => {
        return row.user_id === userId && row.post_id === postId && row.vote_type === voteType;
      });
      const removed = index >= 0 ? votes.splice(index, 1)[0] : null;
      await fulfillJson(route, removed ? { id: removed.id } : null);
      return;
    }

    if (request.method() === "POST") {
      const payload = route.request().postDataJSON() as
        | { post_id?: string; user_id?: string; vote_type?: "upvote" | "verified" }
        | Array<{ post_id?: string; user_id?: string; vote_type?: "upvote" | "verified" }>;
      const row = Array.isArray(payload) ? payload[0] : payload;
      const postId = row?.post_id ?? null;
      const voteType = row?.vote_type ?? null;
      const voteUserId = row?.user_id ?? AUTH_USER.id;
      const existing = votes.find((entry) => {
        return entry.user_id === voteUserId && entry.post_id === postId && entry.vote_type === voteType;
      });

      if (existing) {
        await fulfillJson(route, { id: existing.id });
        return;
      }

      const created = {
        id: `vote-${votes.length + 1}`,
        post_id: postId ?? "",
        user_id: voteUserId,
        vote_type: voteType ?? "upvote",
      };
      votes.push(created);
      await fulfillJson(route, { id: created.id });
      return;
    }

    const filtered = votes.filter((row) => {
      return row.user_id === userId && (postIds.length === 0 || postIds.includes(row.post_id));
    });
    await fulfillJson(route, filtered);
  });

  await page.route("**/rest/v1/community_prompt_ratings**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const userId = parseEqValue(url.searchParams.get("user_id")) ?? AUTH_USER.id;
    const postIds = parseInValues(url.searchParams.get("post_id"));

    if (request.method() === "DELETE") {
      const postId = parseEqValue(url.searchParams.get("post_id"));
      const index = ratings.findIndex((row) => row.user_id === userId && row.post_id === postId);
      if (index >= 0) {
        ratings.splice(index, 1);
      }
      await fulfillJson(route, []);
      return;
    }

    if (request.method() === "POST") {
      const payload = route.request().postDataJSON() as
        | { post_id?: string; user_id?: string; rating?: number }
        | Array<{ post_id?: string; user_id?: string; rating?: number }>;
      const row = Array.isArray(payload) ? payload[0] : payload;
      const postId = row?.post_id ?? "";
      const ratingUserId = row?.user_id ?? AUTH_USER.id;
      const nextRating = Number(row?.rating ?? 0);
      const existing = ratings.find((entry) => entry.user_id === ratingUserId && entry.post_id === postId);

      if (existing) {
        existing.rating = nextRating;
        await fulfillJson(route, { rating: existing.rating });
        return;
      }

      ratings.push({
        post_id: postId,
        user_id: ratingUserId,
        rating: nextRating,
      });
      await fulfillJson(route, { rating: nextRating });
      return;
    }

    const filtered = ratings.filter((row) => {
      return row.user_id === userId && (postIds.length === 0 || postIds.includes(row.post_id));
    });
    await fulfillJson(route, filtered);
  });

  await page.route("**/rest/v1/community_comments**", async (route) => {
    const url = new URL(route.request().url());
    const postId = parseEqValue(url.searchParams.get("post_id"));
    const rows = postId ? COMMENT_ROWS[postId] || [] : [];
    const sorted = [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const limit = Number(url.searchParams.get("limit"));
    const payload = Number.isFinite(limit) && limit > 0 ? sorted.slice(0, limit) : sorted;
    await fulfillJson(route, payload);
  });

  await page.route("**/rest/v1/community_posts**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const filtered = applyPostFilters(url, FEED_POSTS);
    const select = decodeURIComponent(url.searchParams.get("select") || "");
    const wantsIdOnly = select === "id";
    const wantsSingle = (request.headers().accept || "").includes("application/vnd.pgrst.object+json");
    const mapped = wantsIdOnly ? filtered.map((row) => ({ id: row.id })) : filtered;

    if (wantsSingle) {
      await fulfillJson(route, mapped[0] || null);
      return;
    }

    await fulfillJson(route, mapped);
  });
}

async function waitForCommunityRouteReady(page: Page, route: string, authenticated = false): Promise<void> {
  await expect(page.locator(PROMPTFORGE_APP_SELECTOR)).toHaveCount(1);

  if (route === "/community") {
    await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();
    await expect(page.getByTestId("community-filter-trigger")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Backend migration helper" })).toBeVisible();
    await expect(page.getByTestId("community-comment-toggle").first()).toBeVisible();
    if (authenticated) {
      await expect(page.getByTestId("community-card-follow").first()).toBeVisible();
    }
    return;
  }

  if (route.startsWith("/profile/")) {
    await expect(page.getByRole("heading", { name: "Alex Backend" })).toBeVisible();
    await expect(page.getByTestId("profile-follow-button")).toBeVisible();
    await expect(page.getByTestId("community-comment-toggle").first()).toBeVisible();
    return;
  }

  await expect(page.getByRole("heading", { name: "Backend migration helper" })).toBeVisible();
  await expect(page.getByTestId("community-comments-thread-trigger")).toBeVisible();
  if (authenticated) {
    await expect(page.getByTestId("community-detail-rating-star-5")).toBeVisible();
  }
}

async function collectPageMetrics(page: Page, selector: string) {
  return page.evaluate((controlSelector) => {
    const controls = Array.from(document.querySelectorAll<HTMLElement>(controlSelector));
    const controlsUnder44px = controls
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          testId: element.dataset.testid || "unknown",
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((entry) => entry.width < 44 || entry.height < 44);

    const mobileNav = document.querySelector<HTMLElement>("[aria-label='Mobile navigation']");
    const pageShell = document.querySelector<HTMLElement>("[data-testid='page-shell']");
    const bottomNavSafeAreaPadding = mobileNav
      ? Number.parseFloat(window.getComputedStyle(mobileNav).paddingBottom || "0")
      : 0;
    const navRect = mobileNav?.getBoundingClientRect() || null;
    const navHeight = navRect ? Math.round(navRect.height) : 0;
    const pageShellPaddingBottom = pageShell
      ? Number.parseFloat(window.getComputedStyle(pageShell).paddingBottom || "0")
      : 0;

    const actionableElements = Array.from(
      document.querySelectorAll<HTMLElement>("a[href], button, [role='button'], input, textarea, select"),
    ).filter((element) => {
      if (mobileNav?.contains(element)) return false;
      if (element.getAttribute("aria-hidden") === "true") return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const lastActionable = actionableElements[actionableElements.length - 1] || null;
    const lastActionableBottom = lastActionable
      ? Math.round(lastActionable.getBoundingClientRect().bottom)
      : null;
    const bottomNavTop = navRect ? Math.round(navRect.top) : null;
    const bottomNavOverlapPx =
      lastActionableBottom !== null && bottomNavTop !== null
        ? Math.max(0, lastActionableBottom - bottomNavTop)
        : 0;

    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      navHeight,
      pageShellPaddingBottom,
      bottomNavSafeAreaPadding,
      bottomNavOverlapPx,
      lastActionableBottom,
      bottomNavTop,
      controlsUnder44px,
    };
  }, selector);
}

async function openCommentsSurface(page: Page, route: string): Promise<void> {
  if (route.startsWith("/community/") && route !== "/community") {
    await page.getByTestId("community-comments-thread-trigger").click();
  } else {
    await page.getByTestId("community-comment-toggle").first().click();
  }

  await expect(page.getByTestId("community-comments-sheet")).toBeVisible();
  await expect(page.getByText("Use transactions for reliability.")).toBeVisible();
}

async function collectDrawerMetrics(page: Page, selector: string) {
  return page.evaluate((controlSelector) => {
    const commentsSheets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='community-comments-sheet']"),
    );
    const commentsSheet = commentsSheets.find((sheet) => {
      const rect = sheet.getBoundingClientRect();
      const style = window.getComputedStyle(sheet);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.pointerEvents !== "none"
      );
    }) || null;
    const composer = commentsSheet?.querySelector<HTMLTextAreaElement>("textarea") || null;
    const postButton = commentsSheet
      ? Array.from(commentsSheet.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
          (button.textContent || "").toLowerCase().includes("post comment"),
        ) || null
      : null;
    const signInLink = commentsSheet
      ? Array.from(commentsSheet.querySelectorAll<HTMLAnchorElement>("a")).find((link) =>
          (link.textContent || "").toLowerCase().includes("sign in to comment"),
        ) || null
      : null;
    const drawerControls = commentsSheet
      ? Array.from(commentsSheet.querySelectorAll<HTMLElement>(controlSelector))
      : [];
    const drawerControlsUnder44px = drawerControls
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          testId: element.dataset.testid || "unknown",
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((entry) => entry.width < 44 || entry.height < 44);

    const sheetRect = commentsSheet?.getBoundingClientRect() || null;
    const composerRect = composer?.getBoundingClientRect() || null;
    const postButtonRect = postButton?.getBoundingClientRect() || null;
    const composerBottom = postButtonRect?.bottom ?? composerRect?.bottom ?? null;

    const commentsSheetOffscreenPx = sheetRect ? Math.max(0, Math.round(sheetRect.bottom - window.innerHeight)) : 0;
    const commentsComposerOverlapPx =
      sheetRect && composerBottom !== null ? Math.max(0, Math.round(composerBottom - sheetRect.bottom)) : 0;
    const commentsComposerOutsideViewportPx =
      composerBottom !== null ? Math.max(0, Math.round(composerBottom - window.innerHeight)) : 0;

    return {
      drawerControlsUnder44px,
      commentsSheetOffscreenPx,
      commentsComposerHeight: composerRect ? Math.round(composerRect.height) : null,
      commentsComposerOverlapPx,
      commentsComposerOutsideViewportPx,
      commentsRequiresSignIn: Boolean(signInLink),
    };
  }, selector);
}

test("captures anonymous mobile community baseline metrics at key widths", async ({ page }, testInfo) => {
  await installCommunityMocks(page);

  const baseline: BaselineMetric[] = [];
  const routes = ["/community", `/community/${FEED_POSTS[0]?.id}`] as const;

  for (const width of MOBILE_WIDTHS) {
    for (const route of routes) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto(route);
      await waitForCommunityRouteReady(page, route);

      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });

      const pageMetrics = await collectPageMetrics(page, PUBLIC_PAGE_CONTROL_SELECTOR);

      const routeId = route.replace(/[^a-z0-9-]/gi, "_");
      await page.screenshot({
        path: testInfo.outputPath(`community-mobile-${routeId}-${width}.png`),
        fullPage: true,
      });

      await openCommentsSurface(page, route);
      const drawerMetrics = await collectDrawerMetrics(page, COMMENTS_DRAWER_CONTROL_SELECTOR);

      baseline.push({
        route,
        width,
        viewportHeight: VIEWPORT_HEIGHT,
        documentScrollWidth: pageMetrics.documentScrollWidth,
        hasHorizontalOverflow: pageMetrics.hasHorizontalOverflow,
        navHeight: pageMetrics.navHeight,
        pageShellPaddingBottom: pageMetrics.pageShellPaddingBottom,
        bottomNavSafeAreaPadding: pageMetrics.bottomNavSafeAreaPadding,
        bottomNavOverlapPx: pageMetrics.bottomNavOverlapPx,
        lastActionableBottom: pageMetrics.lastActionableBottom,
        bottomNavTop: pageMetrics.bottomNavTop,
        controlsUnder44px: pageMetrics.controlsUnder44px,
        drawerControlsUnder44px: drawerMetrics.drawerControlsUnder44px,
        commentsSheetOffscreenPx: drawerMetrics.commentsSheetOffscreenPx,
        commentsComposerHeight: drawerMetrics.commentsComposerHeight,
        commentsComposerOverlapPx: drawerMetrics.commentsComposerOverlapPx,
        commentsComposerOutsideViewportPx: drawerMetrics.commentsComposerOutsideViewportPx,
        commentsRequiresSignIn: drawerMetrics.commentsRequiresSignIn,
      });

      await page.screenshot({
        path: testInfo.outputPath(`community-mobile-${routeId}-comments-${width}.png`),
        fullPage: true,
      });
    }
  }

  const baselinePath = testInfo.outputPath("community-mobile-anonymous-baseline.json");
  await writeFile(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
  await testInfo.attach("community-mobile-anonymous-baseline", {
    path: baselinePath,
    contentType: "application/json",
  });

  expect(baseline).toHaveLength(8);
  for (const metric of baseline) {
    expect(
      metric.hasHorizontalOverflow,
      `${metric.route} width ${metric.width} should not overflow horizontally`,
    ).toBeFalsy();
    expect(
      metric.controlsUnder44px,
      `${metric.route} width ${metric.width} has controls below 44px`,
    ).toEqual([]);
    expect(
      metric.drawerControlsUnder44px,
      `${metric.route} width ${metric.width} has drawer controls below 44px`,
    ).toEqual([]);
    expect(metric.navHeight, `${metric.route} width ${metric.width} should render bottom nav`).toBeGreaterThan(0);
    expect(
      metric.pageShellPaddingBottom,
      `${metric.route} width ${metric.width} should reserve bottom-nav space`,
    ).toBeGreaterThanOrEqual(metric.navHeight - 2);
    expect(
      metric.bottomNavOverlapPx,
      `${metric.route} width ${metric.width} has content clipped under bottom nav`,
    ).toBe(0);
    expect(
      metric.commentsComposerOverlapPx,
      `${metric.route} width ${metric.width} has comment composer clipped by comments sheet`,
    ).toBe(0);
    if (metric.commentsRequiresSignIn) {
      expect(
        metric.commentsComposerHeight,
        `${metric.route} width ${metric.width} should not render a composer when sign-in is required`,
      ).toBeNull();
    } else {
      expect(
        metric.commentsComposerHeight,
        `${metric.route} width ${metric.width} should render visible comment composer`,
      ).not.toBeNull();
      expect(
        metric.commentsComposerHeight ?? 0,
        `${metric.route} width ${metric.width} comment composer should preserve mobile-friendly height`,
      ).toBeGreaterThanOrEqual(72);
    }
  }
});

test("captures authenticated mobile community and profile baseline metrics at key widths", async ({ page }, testInfo) => {
  await installCommunityMocks(page, { authenticated: true });

  const baseline: BaselineMetric[] = [];
  const routes = ["/community", `/community/${FEED_POSTS[0]?.id}`, "/profile/author-1"] as const;

  for (const width of MOBILE_WIDTHS) {
    for (const route of routes) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto(route);
      await waitForCommunityRouteReady(page, route, true);

      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });

      const pageMetrics = await collectPageMetrics(page, AUTHENTICATED_PAGE_CONTROL_SELECTOR);
      const routeId = route.replace(/[^a-z0-9-]/gi, "_");

      await page.screenshot({
        path: testInfo.outputPath(`community-mobile-auth-${routeId}-${width}.png`),
        fullPage: true,
      });

      await openCommentsSurface(page, route);
      const drawerMetrics = await collectDrawerMetrics(page, COMMENTS_DRAWER_CONTROL_SELECTOR);

      baseline.push({
        route,
        width,
        viewportHeight: VIEWPORT_HEIGHT,
        documentScrollWidth: pageMetrics.documentScrollWidth,
        hasHorizontalOverflow: pageMetrics.hasHorizontalOverflow,
        navHeight: pageMetrics.navHeight,
        pageShellPaddingBottom: pageMetrics.pageShellPaddingBottom,
        bottomNavSafeAreaPadding: pageMetrics.bottomNavSafeAreaPadding,
        bottomNavOverlapPx: pageMetrics.bottomNavOverlapPx,
        lastActionableBottom: pageMetrics.lastActionableBottom,
        bottomNavTop: pageMetrics.bottomNavTop,
        controlsUnder44px: pageMetrics.controlsUnder44px,
        drawerControlsUnder44px: drawerMetrics.drawerControlsUnder44px,
        commentsSheetOffscreenPx: drawerMetrics.commentsSheetOffscreenPx,
        commentsComposerHeight: drawerMetrics.commentsComposerHeight,
        commentsComposerOverlapPx: drawerMetrics.commentsComposerOverlapPx,
        commentsComposerOutsideViewportPx: drawerMetrics.commentsComposerOutsideViewportPx,
        commentsRequiresSignIn: drawerMetrics.commentsRequiresSignIn,
      });

      await page.screenshot({
        path: testInfo.outputPath(`community-mobile-auth-${routeId}-comments-${width}.png`),
        fullPage: true,
      });
    }
  }

  const baselinePath = testInfo.outputPath("community-mobile-authenticated-baseline.json");
  await writeFile(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
  await testInfo.attach("community-mobile-authenticated-baseline", {
    path: baselinePath,
    contentType: "application/json",
  });

  expect(baseline).toHaveLength(12);
  for (const metric of baseline) {
    expect(
      metric.hasHorizontalOverflow,
      `${metric.route} width ${metric.width} should not overflow horizontally`,
    ).toBeFalsy();
    expect(
      metric.controlsUnder44px,
      `${metric.route} width ${metric.width} has signed-in controls below 44px`,
    ).toEqual([]);
    expect(
      metric.drawerControlsUnder44px,
      `${metric.route} width ${metric.width} has signed-in drawer controls below 44px`,
    ).toEqual([]);
    expect(metric.navHeight, `${metric.route} width ${metric.width} should render bottom nav`).toBeGreaterThan(0);
    expect(
      metric.pageShellPaddingBottom,
      `${metric.route} width ${metric.width} should reserve bottom-nav space`,
    ).toBeGreaterThanOrEqual(metric.navHeight - 2);
    expect(
      metric.bottomNavOverlapPx,
      `${metric.route} width ${metric.width} has content clipped under bottom nav`,
    ).toBe(0);
    expect(
      metric.commentsComposerOverlapPx,
      `${metric.route} width ${metric.width} has comment composer clipped by comments sheet`,
    ).toBe(0);
    expect(metric.commentsRequiresSignIn, `${metric.route} width ${metric.width} should use an authenticated session`).toBeFalsy();
    expect(
      metric.commentsComposerHeight,
      `${metric.route} width ${metric.width} should render visible comment composer`,
    ).not.toBeNull();
    expect(
      metric.commentsComposerHeight ?? 0,
      `${metric.route} width ${metric.width} comment composer should preserve mobile-friendly height`,
    ).toBeGreaterThanOrEqual(72);
  }
});

test("runs mobile smoke flow for feed, filter, post open, and comments", async ({ page }) => {
  await installCommunityMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/community");
  await expect(page.locator(PROMPTFORGE_APP_SELECTOR)).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Backend migration helper" })).toBeVisible();

  const filterTrigger = page.getByTestId("community-filter-trigger");
  await filterTrigger.click();
  await expect(page.getByTestId("community-filter-sheet")).toBeVisible();

  await page.getByRole("button", { name: /^Backend/ }).click();
  await expect(page.getByTestId("community-filter-sheet")).toBeHidden();
  await expect(filterTrigger).toContainText("Backend");

  await page.getByTestId("community-comment-toggle").first().click();
  await expect(page.getByTestId("community-comments-sheet")).toBeVisible();
  await expect(page.getByText("Use transactions for reliability.")).toBeVisible();
  await page.mouse.click(12, 12);
  await expect(page.getByTestId("community-comments-sheet")).toBeHidden();

  await page.getByRole("link", { name: "Open Backend migration helper" }).click();
  await expect(page).toHaveURL(/\/community\/11111111-1111-1111-1111-111111111111$/);
  await expect(page.getByRole("heading", { name: "Backend migration helper" })).toBeVisible();

  await page.getByTestId("community-comments-thread-trigger").click();
  await expect(page.getByTestId("community-comments-sheet")).toBeVisible();
  await expect(page.getByText("Use transactions for reliability.")).toBeVisible();
});

test("runs authenticated mobile smoke flow for profile, rating, and signed-in comment controls", async ({ page }) => {
  await installCommunityMocks(page, { authenticated: true });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/profile/author-1");
  await expect(page.locator(PROMPTFORGE_APP_SELECTOR)).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Alex Backend" })).toBeVisible();
  await expect(page.getByTestId("profile-follow-button")).toBeVisible();

  await page.goto("/community");
  await expect(page.locator(PROMPTFORGE_APP_SELECTOR)).toHaveCount(1);
  await expect(page.getByTestId("community-card-follow").first()).toBeVisible();
  await page.getByTestId("community-comment-toggle").first().click();
  await expect(page.getByTestId("community-comments-sheet")).toBeVisible();
  await expect(page.getByTestId("community-comment-overflow").first()).toBeVisible();
  await expect(page.getByTestId("community-quick-reply-chip").first()).toBeVisible();
  await page.mouse.click(12, 12);
  await expect(page.getByTestId("community-comments-sheet")).toBeHidden();

  await page.goto(`/community/${FEED_POSTS[0]?.id}`);
  await expect(page.getByTestId("community-detail-rating-summary")).toContainText("(0)");
  await page.getByTestId("community-detail-rating-star-5").click();
  await expect(page.getByTestId("community-detail-rating-summary")).toContainText("5.0");
  await expect(page.getByTestId("community-detail-rating-summary")).toContainText("(1)");
});

test("opens comment sheet on notification deep link", async ({ page }) => {
  await installCommunityMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/community/${FEED_POSTS[0]?.id}?source=notification&openComments=1`);
  await expect(page.locator(PROMPTFORGE_APP_SELECTOR)).toHaveCount(1);
  await expect(page.getByText("Backend migration helper")).toBeVisible();
  await expect(page.getByTestId("community-comments-sheet")).toBeVisible();
  await expect(page.getByText("Use transactions for reliability.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to comment" })).toBeVisible();
});

test("supports mobile community in dark mode", async ({ page }) => {
  await installCommunityMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("promptforge-user-prefs", JSON.stringify({
      theme: "midnight",
      webSearchEnabled: false,
      showAdvancedControls: false,
    }));
  });

  await page.goto("/community");
  await expect(page.locator(PROMPTFORGE_APP_SELECTOR)).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Backend migration helper" })).toBeVisible();

  const darkMetrics = await page.evaluate(() => {
    const rootTheme = document.documentElement.dataset.theme || null;
    const card = document.querySelector<HTMLElement>(".community-feed-card");
    const cardBackground = card ? window.getComputedStyle(card).backgroundColor : null;
    return { rootTheme, cardBackground };
  });

  expect(darkMetrics.rootTheme).toBe("midnight");
  expect(darkMetrics.cardBackground).not.toBeNull();
});

test("respects reduced-motion mode on community mobile surfaces", async ({ page }) => {
  await installCommunityMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/community");
  await expect(page.locator(PROMPTFORGE_APP_SELECTOR)).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();

  const reducedMotionMetrics = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".community-feed-card");
    return {
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      cardAnimationName: card ? window.getComputedStyle(card).animationName : null,
    };
  });

  expect(reducedMotionMetrics.prefersReducedMotion).toBeTruthy();
  expect(["none", null]).toContain(reducedMotionMetrics.cardAnimationName);
});
