import { expect, test, type Page, type Route } from "@playwright/test";

const POST_ID = "11111111-1111-1111-1111-111111111111";
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

const FEED_POSTS: CommunityPostRow[] = [
  {
    id: POST_ID,
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
    created_at: toIso(0),
    updated_at: toIso(0),
  },
];

const PROFILE_ROWS: CommunityProfileRow[] = [
  { id: "author-1", display_name: "Alex Backend", avatar_url: null },
];

const COMMENT_ROWS: Record<string, CommunityCommentRow[]> = {
  [POST_ID]: [
    {
      id: "comment-1",
      post_id: POST_ID,
      user_id: "author-1",
      body: "Use transactions for reliability.",
      created_at: toIso(20),
      updated_at: toIso(20),
    },
  ],
};

function fulfillJson(route: Route, payload: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
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

async function installCommunityMocks(page: Page): Promise<void> {
  await page.route("**/auth/get-session", async (route) => {
    await fulfillJson(route, { session: null, user: null });
  });

  await page.route("**/auth/token/anonymous", async (route) => {
    await fulfillJson(route, {
      token: "header.payload.signature",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
  });

  await page.route("**/auth/v1/user", async (route) => {
    await fulfillJson(route, { code: 401, msg: "JWT missing" }, 401);
  });

  await page.route("**/auth/get-user", async (route) => {
    await fulfillJson(route, { code: 401, msg: "JWT missing" }, 401);
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

  await page.route("**/rest/v1/community_votes**", async (route) => {
    await fulfillJson(route, []);
  });

  await page.route("**/rest/v1/community_comments**", async (route) => {
    const url = new URL(route.request().url());
    const postId = parseEqValue(url.searchParams.get("post_id"));
    const rows = postId ? COMMENT_ROWS[postId] || [] : [];
    const sorted = [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    await fulfillJson(route, sorted);
  });

  await page.route("**/rest/v1/community_posts**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const idEq = parseEqValue(url.searchParams.get("id"));
    const idIn = parseInValues(url.searchParams.get("id"));
    const remixedFrom = parseEqValue(url.searchParams.get("remixed_from"));
    const wantsSingle = (request.headers().accept || "").includes("application/vnd.pgrst.object+json");

    let filtered = FEED_POSTS;
    if (idEq) {
      filtered = FEED_POSTS.filter((row) => row.id === idEq);
    } else if (idIn.length > 0) {
      const idSet = new Set(idIn);
      filtered = FEED_POSTS.filter((row) => idSet.has(row.id));
    } else if (remixedFrom) {
      filtered = FEED_POSTS.filter((row) => row.remixed_from === remixedFrom);
    }

    if (wantsSingle) {
      await fulfillJson(route, filtered[0] || null);
      return;
    }

    await fulfillJson(route, filtered);
  });
}

test.beforeEach(async ({ page }) => {
  await installCommunityMocks(page);
});

test("keeps fallback mobile community UX when rollout flag is off", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/community");

  await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();
  await expect(page.getByTestId("community-filter-trigger")).toHaveCount(0);

  await page.getByRole("link", { name: "Open Backend migration helper" }).click();

  await expect(page.getByRole("heading", { name: "Backend migration helper" })).toBeVisible();
  await expect(page.getByTestId("community-comments-thread-trigger")).toHaveCount(0);
});
