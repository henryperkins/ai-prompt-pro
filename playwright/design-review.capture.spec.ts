import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";

const DESIGN_REVIEW_STAMP = "2026-03-13";
const OUTPUT_ROOT = "output/playwright";
const REVIEW_OUTPUT_ROOT = `${OUTPUT_ROOT}/design-ux-review-${DESIGN_REVIEW_STAMP}`;
const DESKTOP_OUTPUT_ROOT = `${REVIEW_OUTPUT_ROOT}/desktop`;
const MOBILE_OUTPUT_ROOT = `${REVIEW_OUTPUT_ROOT}/mobile`;
const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
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

interface CaptureRecord {
  artifactPath: string;
  route: string;
  viewport: string;
  state: string;
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

function toIso(offsetMinutes: number): string {
  return new Date(TIMESTAMP_BASE + offsetMinutes * 60_000).toISOString();
}

const AUTH_USER = {
  id: "design-reviewer-1",
  aud: "authenticated",
  role: "authenticated",
  email: "design-reviewer@example.com",
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
  access_token: "design-review-access-token",
  refresh_token: "design-review-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: AUTH_USER,
};

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
    remixed_from: "11111111-1111-1111-1111-111111111111",
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

function fulfillJson(
  route: Route,
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(payload),
  });
}

function buildContentRange(count: number): string {
  if (count <= 0) return "0-0/0";
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
  if (searchMatch?.[1]) {
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

async function installReviewMocks(page: Page): Promise<void> {
  const followingRows: Array<{ id: string; follower_id: string; followed_user_id: string; created_at: string }> = [];
  const blockRows: Array<{ id: string; blocker_id: string; blocked_user_id: string; created_at: string }> = [];
  const votes: Array<{ id: string; post_id: string; user_id: string; vote_type: "upvote" | "verified" }> = [];
  const ratings: Array<{ post_id: string; user_id: string; rating: number }> = [];

  await page.route("**/auth/get-session", (route) =>
    fulfillJson(route, { session: AUTH_SESSION, user: AUTH_USER }),
  );
  await page.route("**/auth/token/anonymous", (route) =>
    fulfillJson(route, { token: "header.payload.signature", expires_at: AUTH_SESSION.expires_at }),
  );
  await page.route("**/auth/v1/user", (route) =>
    fulfillJson(route, { user: AUTH_USER }),
  );
  await page.route("**/auth/get-user", (route) =>
    fulfillJson(route, { user: AUTH_USER }),
  );

  await page.route("**/rest/v1/drafts**", async (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "HEAD") {
      await fulfillJson(route, null);
      return;
    }
    await fulfillJson(route, []);
  });
  await page.route("**/rest/v1/saved_prompts**", (route) =>
    fulfillJson(route, [], 200, { "content-range": "0-0/0" }),
  );
  await page.route("**/rest/v1/prompt_versions**", (route) =>
    fulfillJson(route, [], 200, { "content-range": "0-0/0" }),
  );
  await page.route("**/rest/v1/notifications**", (route) =>
    fulfillJson(route, [], 200, { "content-range": "0-0/0" }),
  );
  await page.route("**/infer-builder-fields", (route) =>
    fulfillJson(route, {
      inferredUpdates: {},
      inferredFields: [],
      suggestionChips: [
        {
          id: "append-evidence",
          label: "Add evidence requirements",
          description: "What should back the claims?",
          action: {
            type: "append_prompt",
            text: "\nEvidence: [cite sources, use data, include examples]",
          },
        },
        {
          id: "append-comparison-framework",
          label: "Add comparison framework",
          description: "Define the baseline, segments, or time periods to compare.",
          action: {
            type: "append_prompt",
            text: "\nComparison framework: [baseline, segments, cohorts, or time periods to compare]",
          },
        },
      ],
    }),
  );

  await page.route("**/rest/v1/rpc/community_profiles_by_ids**", async (route) => {
    let ids: string[];
    try {
      const payload = route.request().postDataJSON() as { input_ids?: string[] };
      ids = payload?.input_ids ?? [];
    } catch {
      ids = [];
    }

    const idSet = new Set(ids);
    await fulfillJson(route, PROFILE_ROWS.filter((row) => idSet.has(row.id)));
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
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-range": buildContentRange(filtered.length),
        },
      });
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
      const postId = row?.post_id ?? "";
      const voteUserId = row?.user_id ?? AUTH_USER.id;
      const voteType = row?.vote_type ?? "upvote";
      const existing = votes.find((entry) => {
        return entry.user_id === voteUserId && entry.post_id === postId && entry.vote_type === voteType;
      });

      if (existing) {
        await fulfillJson(route, { id: existing.id });
        return;
      }

      const created = {
        id: `vote-${votes.length + 1}`,
        post_id: postId,
        user_id: voteUserId,
        vote_type: voteType,
      };
      votes.push(created);
      await fulfillJson(route, { id: created.id });
      return;
    }

    await fulfillJson(route, votes.filter((row) => {
      return row.user_id === userId && (postIds.length === 0 || postIds.includes(row.post_id));
    }));
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

      ratings.push({ post_id: postId, user_id: ratingUserId, rating: nextRating });
      await fulfillJson(route, { rating: nextRating });
      return;
    }

    await fulfillJson(route, ratings.filter((row) => {
      return row.user_id === userId && (postIds.length === 0 || postIds.includes(row.post_id));
    }));
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

async function waitForRouteFallbackToDisappear(page: Page): Promise<void> {
  const fallback = page.getByTestId("route-fallback-root");
  if (await fallback.count()) {
    await expect(fallback).toBeHidden();
  }
}

async function waitForUiSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => document.readyState === "complete");
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    }
  });
  await page.waitForTimeout(150);
}

async function gotoAndWait(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByTestId("page-shell")).toBeVisible();
  await waitForRouteFallbackToDisappear(page);
  await waitForUiSettled(page);
}

async function captureFullPage(page: Page, artifactPath: string): Promise<void> {
  await page.screenshot({
    path: artifactPath,
    fullPage: true,
  });
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await installReviewMocks(page);
});

test("captures the builder baselines and design review route pack", async ({ page }, testInfo) => {
  await mkdir(DESKTOP_OUTPUT_ROOT, { recursive: true });
  await mkdir(MOBILE_OUTPUT_ROOT, { recursive: true });

  const captures: CaptureRecord[] = [];

  await page.setViewportSize(DESKTOP_VIEWPORT);

  await gotoAndWait(page, "/?exp_hero=b");
  const desktopPrompt = page.getByRole("textbox", {
    name: /What should the model do\?|Your Prompt/i,
  });
  await expect(desktopPrompt).toBeVisible();
  await desktopPrompt.fill(
    "Rewrite these launch notes into a concise release plan with owners, milestones, and risks.",
  );
  await expect(page.getByTestId("builder-suggestion-chip-append-evidence")).toBeVisible();
  await expect(page.getByText("Builder readiness", { exact: true })).toBeVisible();
  await waitForUiSettled(page);
  await captureFullPage(page, `${OUTPUT_ROOT}/current-builder-desktop-${DESIGN_REVIEW_STAMP}.png`);
  captures.push({
    artifactPath: `${OUTPUT_ROOT}/current-builder-desktop-${DESIGN_REVIEW_STAMP}.png`,
    route: "/?exp_hero=b",
    viewport: `${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}`,
    state: "builder desktop populated",
  });

  await gotoAndWait(page, "/?exp_hero=a");
  await expect(page.getByTestId("builder-hero")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show advanced controls" })).toBeVisible();
  await captureFullPage(page, `${DESKTOP_OUTPUT_ROOT}/home.png`);
  captures.push({
    artifactPath: `${DESKTOP_OUTPUT_ROOT}/home.png`,
    route: "/?exp_hero=a",
    viewport: `${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}`,
    state: "builder desktop empty review state",
  });

  await gotoAndWait(page, "/community");
  await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Backend migration helper" })).toBeVisible();
  await captureFullPage(page, `${DESKTOP_OUTPUT_ROOT}/community.png`);
  captures.push({
    artifactPath: `${DESKTOP_OUTPUT_ROOT}/community.png`,
    route: "/community",
    viewport: `${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}`,
    state: "community desktop feed",
  });

  await gotoAndWait(page, `/community/${FEED_POSTS[0].id}`);
  await expect(page.getByRole("heading", { name: "Backend migration helper" })).toBeVisible();
  await expect(page.getByLabel("Write a comment")).toBeVisible();
  await captureFullPage(page, `${DESKTOP_OUTPUT_ROOT}/community-post-detail.png`);
  captures.push({
    artifactPath: `${DESKTOP_OUTPUT_ROOT}/community-post-detail.png`,
    route: `/community/${FEED_POSTS[0].id}`,
    viewport: `${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}`,
    state: "community desktop detail",
  });

  await gotoAndWait(page, "/library");
  await expect(page.getByRole("heading", { name: "Prompt Library" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Builder" })).toBeVisible();
  await expect(page.getByText("Save your first prompt build")).toBeVisible();
  await captureFullPage(page, `${DESKTOP_OUTPUT_ROOT}/library.png`);
  captures.push({
    artifactPath: `${DESKTOP_OUTPUT_ROOT}/library.png`,
    route: "/library",
    viewport: `${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}`,
    state: "library desktop zero state",
  });

  await gotoAndWait(page, "/history");
  await expect(page.getByRole("heading", { name: "Version History" })).toBeVisible();
  await expect(page.getByText("No saved versions yet")).toBeVisible();
  await captureFullPage(page, `${DESKTOP_OUTPUT_ROOT}/history.png`);
  captures.push({
    artifactPath: `${DESKTOP_OUTPUT_ROOT}/history.png`,
    route: "/history",
    viewport: `${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}`,
    state: "history desktop zero state",
  });

  await gotoAndWait(page, "/not-a-real-route");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await captureFullPage(page, `${DESKTOP_OUTPUT_ROOT}/notfound.png`);
  captures.push({
    artifactPath: `${DESKTOP_OUTPUT_ROOT}/notfound.png`,
    route: "/not-a-real-route",
    viewport: `${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}`,
    state: "not found desktop utility state",
  });

  await page.setViewportSize(MOBILE_VIEWPORT);

  await gotoAndWait(page, "/?exp_hero=b");
  await expect(page.getByTestId("builder-mobile-sticky-bar")).toBeVisible();
  await captureFullPage(page, `${OUTPUT_ROOT}/current-builder-mobile-390-${DESIGN_REVIEW_STAMP}.png`);
  captures.push({
    artifactPath: `${OUTPUT_ROOT}/current-builder-mobile-390-${DESIGN_REVIEW_STAMP}.png`,
    route: "/?exp_hero=b",
    viewport: `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`,
    state: "builder mobile compact sticky bar",
  });

  await page.getByTestId("builder-mobile-settings-trigger").click();
  const settingsSheet = page.getByTestId("builder-mobile-settings-sheet");
  await expect(settingsSheet).toBeVisible();
  await settingsSheet.getByRole("button", { name: "Expert prompt" }).click();
  await settingsSheet.getByRole("button", { name: "Preserve wording" }).click();
  await settingsSheet.getByRole("button", { name: "Ask me" }).click();
  await expect(page.getByTestId("builder-mobile-settings-sheet-summary")).toContainText(
    "Expert prompt · Preserve wording · Ask me",
  );
  await captureFullPage(page, `${OUTPUT_ROOT}/builder-mobile-settings.png`);
  captures.push({
    artifactPath: `${OUTPUT_ROOT}/builder-mobile-settings.png`,
    route: "/?exp_hero=b",
    viewport: `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`,
    state: "builder mobile settings sheet",
  });

  await gotoAndWait(page, "/?exp_hero=a");
  await expect(page.getByTestId("builder-mobile-sticky-bar")).toBeVisible();
  await captureFullPage(page, `${MOBILE_OUTPUT_ROOT}/home.png`);
  captures.push({
    artifactPath: `${MOBILE_OUTPUT_ROOT}/home.png`,
    route: "/?exp_hero=a",
    viewport: `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`,
    state: "builder mobile empty review state",
  });

  await gotoAndWait(page, "/community");
  await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();
  await expect(page.getByTestId("community-filter-trigger")).toBeVisible();
  await captureFullPage(page, `${MOBILE_OUTPUT_ROOT}/community.png`);
  captures.push({
    artifactPath: `${MOBILE_OUTPUT_ROOT}/community.png`,
    route: "/community",
    viewport: `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`,
    state: "community mobile feed",
  });

  await gotoAndWait(page, `/community/${FEED_POSTS[0].id}`);
  await expect(page.getByRole("heading", { name: "Backend migration helper" })).toBeVisible();
  await expect(page.getByTestId("community-detail-participation-actions")).toBeVisible();
  await captureFullPage(page, `${MOBILE_OUTPUT_ROOT}/community-post-detail.png`);
  captures.push({
    artifactPath: `${MOBILE_OUTPUT_ROOT}/community-post-detail.png`,
    route: `/community/${FEED_POSTS[0].id}`,
    viewport: `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`,
    state: "community mobile detail",
  });

  await gotoAndWait(page, "/library");
  await expect(page.getByRole("heading", { name: "Prompt Library" })).toBeVisible();
  await expect(page.getByText("Save your first prompt build")).toBeVisible();
  await captureFullPage(page, `${MOBILE_OUTPUT_ROOT}/library.png`);
  captures.push({
    artifactPath: `${MOBILE_OUTPUT_ROOT}/library.png`,
    route: "/library",
    viewport: `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`,
    state: "library mobile zero state",
  });

  await gotoAndWait(page, "/history");
  await expect(page.getByRole("heading", { name: "Version History" })).toBeVisible();
  await expect(page.getByText("No saved versions yet")).toBeVisible();
  await captureFullPage(page, `${MOBILE_OUTPUT_ROOT}/history.png`);
  captures.push({
    artifactPath: `${MOBILE_OUTPUT_ROOT}/history.png`,
    route: "/history",
    viewport: `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`,
    state: "history mobile zero state",
  });

  await gotoAndWait(page, "/not-a-real-route");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await captureFullPage(page, `${MOBILE_OUTPUT_ROOT}/notfound.png`);
  captures.push({
    artifactPath: `${MOBILE_OUTPUT_ROOT}/notfound.png`,
    route: "/not-a-real-route",
    viewport: `${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`,
    state: "not found mobile utility state",
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    command: "npm run capture:design-review",
    reviewStamp: DESIGN_REVIEW_STAMP,
    captures,
  };
  const manifestPath = `${REVIEW_OUTPUT_ROOT}/capture-manifest.json`;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  await testInfo.attach("design-review-capture-manifest", {
    path: manifestPath,
    contentType: "application/json",
  });

  expect(captures).toHaveLength(15);
});
