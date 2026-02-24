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
  commentsSheetOffscreenPx: number;
  commentsComposerHeight: number | null;
  commentsComposerOverlapPx: number;
  commentsComposerOutsideViewportPx: number;
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

test.beforeEach(async ({ page }) => {
  await installCommunityMocks(page);
});

test("captures mobile community baseline metrics at key widths", async ({ page }, testInfo) => {
  const baseline: BaselineMetric[] = [];
  const routes = ["/community", `/community/${FEED_POSTS[0]?.id}`] as const;

  for (const width of MOBILE_WIDTHS) {
    for (const route of routes) {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto(route);

      if (route === "/community") {
        await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();
        await expect(page.getByRole("button", { name: /Filter/i })).toBeVisible();
        await expect(page.getByRole("link", { name: "Open Backend migration helper" })).toBeVisible();
        await expect(page.getByTestId("community-comment-toggle").first()).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: "Backend migration helper" })).toBeVisible();
        await expect(page.getByTestId("community-comments-thread-trigger")).toBeVisible();
      }

      await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });

      const pageMetrics = await page.evaluate(() => {
        const controls = Array.from(
          document.querySelectorAll<HTMLElement>(
            "[data-testid='community-filter-trigger'], [data-testid='community-sort-button'], [data-testid='community-remix-cta'], [data-testid='community-vote-upvote'], [data-testid='community-vote-verified'], [data-testid='community-comment-toggle'], [data-testid='community-comments-thread-trigger']",
          ),
        );
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
      });

      const routeId = route.replace(/[^a-z0-9-]/gi, "_");
      await page.screenshot({
        path: testInfo.outputPath(`community-mobile-${routeId}-${width}.png`),
        fullPage: true,
      });

      if (route === "/community") {
        await page.getByTestId("community-comment-toggle").first().click();
      } else {
        await page.getByTestId("community-comments-thread-trigger").click();
      }

      await expect(page.getByTestId("community-comments-sheet")).toBeVisible();
      await expect(page.getByText("Use transactions for reliability.")).toBeVisible();

      const drawerMetrics = await page.evaluate(() => {
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
          commentsSheetOffscreenPx,
          commentsComposerHeight: composerRect ? Math.round(composerRect.height) : null,
          commentsComposerOverlapPx,
          commentsComposerOutsideViewportPx,
        };
      });

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
        commentsSheetOffscreenPx: drawerMetrics.commentsSheetOffscreenPx,
        commentsComposerHeight: drawerMetrics.commentsComposerHeight,
        commentsComposerOverlapPx: drawerMetrics.commentsComposerOverlapPx,
        commentsComposerOutsideViewportPx: drawerMetrics.commentsComposerOutsideViewportPx,
      });

      await page.screenshot({
        path: testInfo.outputPath(`community-mobile-${routeId}-comments-${width}.png`),
        fullPage: true,
      });
    }
  }

  const baselinePath = testInfo.outputPath("community-mobile-baseline.json");
  await writeFile(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
  await testInfo.attach("community-mobile-baseline", {
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
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/community");
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

test("opens comment sheet on notification deep link", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/community/${FEED_POSTS[0]?.id}?source=notification&openComments=1`);
  await expect(page.getByRole("heading", { name: "Backend migration helper" })).toBeVisible();
  await expect(page.getByTestId("community-comments-sheet")).toBeVisible();
  await expect(page.getByText("Use transactions for reliability.")).toBeVisible();

  await expect.poll(async () => {
    return page.evaluate(() => document.activeElement?.tagName || null);
  }).toBe("TEXTAREA");
});

test("supports mobile community in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("promptforge-user-prefs", JSON.stringify({
      theme: "dark",
      webSearchEnabled: false,
      showAdvancedControls: false,
    }));
  });

  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Backend migration helper" })).toBeVisible();

  const darkMetrics = await page.evaluate(() => {
    const rootHasDarkClass = document.documentElement.classList.contains("dark");
    const card = document.querySelector<HTMLElement>(".community-feed-card");
    const cardBackground = card ? window.getComputedStyle(card).backgroundColor : null;
    return { rootHasDarkClass, cardBackground };
  });

  expect(darkMetrics.rootHasDarkClass).toBeTruthy();
  expect(darkMetrics.cardBackground).not.toBeNull();
});

test("respects reduced-motion mode on community mobile surfaces", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/community");
  await expect(page.getByRole("heading", { name: "Community Remix Feed" })).toBeVisible();

  const reducedMotionMetrics = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".community-feed-card");
    return {
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      cardAnimationName: card ? window.getComputedStyle(card).animationName : null,
    };
  });

  expect(reducedMotionMetrics.prefersReducedMotion).toBeTruthy();
  expect(reducedMotionMetrics.cardAnimationName).toBe("none");
});
