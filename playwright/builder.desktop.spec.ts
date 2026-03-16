import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";

const AUTH_EXPIRES_AT = Math.floor(Date.now() / 1000) + 3600;

const AUTH_USER = {
  id: "builder-desktop-1",
  aud: "authenticated",
  role: "authenticated",
  email: "builder-desktop@example.com",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {
    display_name: "Taylor Builder",
    full_name: "Taylor Builder",
    avatar_url: null,
  },
  created_at: "2026-01-20T12:00:00.000Z",
};

const AUTH_SESSION = {
  access_token: "builder-desktop-access-token",
  refresh_token: "builder-desktop-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: AUTH_EXPIRES_AT,
  user: AUTH_USER,
};

const AUTH_GET_SESSION_RESPONSE = {
  session: {
    token: AUTH_SESSION.access_token,
    expiresAt: new Date(AUTH_EXPIRES_AT * 1000).toISOString(),
  },
  user: {
    id: AUTH_USER.id,
    email: AUTH_USER.email,
    name: AUTH_USER.user_metadata.display_name,
    image: AUTH_USER.user_metadata.avatar_url,
    emailVerified: true,
    createdAt: AUTH_USER.created_at,
    updatedAt: AUTH_USER.created_at,
  },
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

async function installBuilderDesktopMocks(page: Page): Promise<void> {
  await page.route("**/auth/get-session", (route) =>
    fulfillJson(route, AUTH_GET_SESSION_RESPONSE),
  );
  await page.route("**/auth/token/anonymous", (route) =>
    fulfillJson(route, { token: "header.payload.signature", expires_at: AUTH_EXPIRES_AT }),
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
  await page.route("**/rest/v1/community_posts**", (route) =>
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
}

async function installGitHubContextMocks(page: Page): Promise<void> {
  const installation = {
    id: "inst-rec-1",
    githubInstallationId: 9001,
    githubAccountId: 9101,
    githubAccountLogin: "promptforge-org",
    githubAccountType: "Organization",
    repositoriesMode: "selected",
    permissions: {
      contents: "read",
    },
    installedAt: "2026-03-16T00:00:00.000Z",
    lastSeenAt: "2026-03-16T00:00:00.000Z",
  };
  const connection = {
    id: "conn-1",
    githubRepoId: 4242,
    ownerLogin: "promptforge-org",
    repoName: "ai-prompt-pro",
    fullName: "promptforge-org/ai-prompt-pro",
    defaultBranch: "main",
    visibility: "private",
    isPrivate: true,
    installationRecordId: "inst-rec-1",
    lastSelectedAt: "2026-03-16T00:00:00.000Z",
  };
  const repositories = [
    {
      id: 4242,
      ownerLogin: "promptforge-org",
      repoName: "ai-prompt-pro",
      fullName: "promptforge-org/ai-prompt-pro",
      defaultBranch: "main",
      visibility: "private",
      isPrivate: true,
      connected: false,
      connectionId: null,
    },
  ];
  const fileResults = [
    {
      path: "README.md",
      name: "README.md",
      extension: "md",
      directory: "",
      size: 2048,
      sha: "sha-readme",
      language: "Markdown",
      binary: false,
      generated: false,
      vendored: false,
      recommendedRank: 12,
    },
    {
      path: "src/lib/github-client.ts",
      name: "github-client.ts",
      extension: "ts",
      directory: "src/lib",
      size: 4096,
      sha: "sha-client",
      language: "TypeScript",
      binary: false,
      generated: false,
      vendored: false,
      recommendedRank: 10,
    },
  ];
  const preview = {
    path: "README.md",
    language: "Markdown",
    size: 2048,
    sha: "sha-readme",
    truncated: false,
    locator: "promptforge-org/ai-prompt-pro:README.md",
    content: "# PromptForge GitHub context\nUse repository files as builder context.",
    originalCharCount: 68,
  };
  const sources = [
    {
      id: "github:4242:tree-sha:README.md",
      type: "github",
      title: "promptforge-org/ai-prompt-pro:README.md",
      rawContent: "# PromptForge GitHub context\nUse repository files as builder context.",
      rawContentTruncated: false,
      originalCharCount: 68,
      expandable: true,
      summary: "Path: README.md\nGitHub context setup instructions.",
      addedAt: Date.now(),
      reference: {
        kind: "github",
        refId: "github:4242:tree-sha:README.md",
        locator: "promptforge-org/ai-prompt-pro@tree-sha:README.md",
        permissionScope: "github-installation:9001",
      },
      validation: {
        status: "valid",
        checkedAt: Date.now(),
      },
    },
  ];

  await page.route(/\/github\/installations(?:\?.*)?$/, (route) =>
    fulfillJson(route, { installations: [installation] }),
  );
  await page.route(/\/github\/connections(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      await fulfillJson(route, { connection });
      return;
    }
    await fulfillJson(route, { connections: [] });
  });
  await page.route(/\/github\/installations\/9001\/repositories(?:\?.*)?$/, (route) =>
    fulfillJson(route, {
      installation: {
        id: installation.id,
        githubInstallationId: installation.githubInstallationId,
        githubAccountLogin: installation.githubAccountLogin,
        githubAccountType: installation.githubAccountType,
      },
      repositories,
      nextCursor: null,
    }),
  );
  await page.route(/\/github\/connections\/conn-1\/search(?:\?.*)?$/, (route) =>
    fulfillJson(route, {
      results: fileResults,
      staleFallback: false,
    }),
  );
  await page.route(/\/github\/connections\/conn-1\/file(?:\?.*)?$/, (route) =>
    fulfillJson(route, { file: preview }),
  );
  await page.route(/\/github\/connections\/conn-1\/context-sources(?:\?.*)?$/, (route) =>
    fulfillJson(route, { sources }),
  );
}

function trackUnexpectedNetworkFailures(page: Page): string[] {
  const unexpectedFailures: string[] = [];
  page.on("requestfailed", (request) => {
    const url = request.url();
    const targetsBuilderDataPlane =
      url.includes("neon.test") ||
      url.includes("/auth/get-session") ||
      url.includes("/auth/token/anonymous") ||
      url.includes("/rest/v1/") ||
      url.includes("/infer-builder-fields") ||
      url.includes("/github/");
    if (!targetsBuilderDataPlane) return;

    const errorText = request.failure()?.errorText ?? "unknown_error";
    unexpectedFailures.push(`${url} :: ${errorText}`);
  });
  return unexpectedFailures;
}

const LONG_ROLE =
  "Senior UX auditor and design systems strategist for AI-assisted product experiences";

const DESKTOP_VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
] as const;

type BuilderDesktopMetric = {
  viewport: string;
  hasHorizontalOverflow: boolean;
  bannerTop: number;
  previewTop: number;
  compactControlsTop: number;
  actionsTop: number;
  reviewActionsWrapped: boolean;
};

test.beforeEach(async ({ page }) => {
  await installBuilderDesktopMocks(page);
});

test("keeps the desktop output rail preview-first at common review widths", async ({ page }, testInfo) => {
  const unexpectedFailures = trackUnexpectedNetworkFailures(page);
  const baseline: BuilderDesktopMetric[] = [];

  for (const viewport of DESKTOP_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const promptInput = page.getByRole("textbox", {
      name: /What should the model do\?|Your Prompt/i,
    });
    await expect(promptInput).toBeVisible();

    await promptInput.fill(
      "Rewrite these launch notes into a concise release plan with owners, milestones, and risks.",
    );

    await expect(page.getByText("Builder readiness", { exact: true })).toBeVisible();
    await expect(page.getByTestId("builder-readiness-summary-grid")).toBeVisible();
    await expect(
      page.getByTestId("builder-readiness-breakdown-disclosure"),
    ).not.toHaveAttribute("open", "");
    await expect(page.getByTestId("builder-readiness-breakdown")).toBeHidden();
    await expect(page.getByTestId("output-panel-state-banner")).toBeVisible();
    await expect(page.getByTestId("output-panel-preview-card")).toBeVisible();
    await expect(
      page.getByTestId("output-panel-enhancement-settings-summary"),
    ).toBeVisible();
    await expect(page.getByTestId("output-panel-review-actions")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy draft" })).toBeVisible();
    await expect(
      page.getByTestId("builder-suggestion-chip-append-evidence"),
    ).toBeVisible();
    await expect(
      page.getByText("Structured rewrite · Balanced · Infer conservatively"),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "Depth" })).toHaveCount(0);

    const metrics = await page.evaluate(() => {
      const banner = document.querySelector<HTMLElement>(
        "[data-testid='output-panel-state-banner']",
      );
      const preview = document.querySelector<HTMLElement>(
        "[data-testid='output-panel-preview-card']",
      );
      const compactControls = document.querySelector<HTMLElement>(
        "[data-testid='output-panel-enhance-controls-compact']",
      );
      const actions = document.querySelector<HTMLElement>(
        "[data-testid='output-panel-review-actions']",
      );

      if (!banner || !preview || !compactControls || !actions) {
        return null;
      }

      const actionsRect = actions.getBoundingClientRect();

      return {
        hasHorizontalOverflow:
          document.documentElement.scrollWidth > window.innerWidth,
        bannerTop: Math.round(banner.getBoundingClientRect().top),
        previewTop: Math.round(preview.getBoundingClientRect().top),
        compactControlsTop: Math.round(
          compactControls.getBoundingClientRect().top,
        ),
        actionsTop: Math.round(actionsRect.top),
        reviewActionsWrapped: Math.round(actionsRect.height) > 120,
      };
    });

    expect(metrics, `${viewport.width}x${viewport.height} should expose the desktop review surfaces`).not.toBeNull();
    expect(metrics!.hasHorizontalOverflow, `${viewport.width}x${viewport.height} should not overflow horizontally`).toBeFalsy();
    expect(metrics!.bannerTop, `${viewport.width}x${viewport.height} banner should precede preview`).toBeLessThan(metrics!.previewTop);
    expect(
      metrics!.previewTop,
      `${viewport.width}x${viewport.height} preview should precede compact enhancement controls`,
    ).toBeLessThan(metrics!.compactControlsTop);
    expect(
      metrics!.compactControlsTop,
      `${viewport.width}x${viewport.height} compact enhancement controls should precede review actions`,
    ).toBeLessThan(metrics!.actionsTop);
    expect(metrics!.reviewActionsWrapped, `${viewport.width}x${viewport.height} action row should stay compact`).toBeFalsy();

    baseline.push({
      viewport: `${viewport.width}x${viewport.height}`,
      ...metrics!,
    });

    await page.screenshot({
      path: testInfo.outputPath(`builder-desktop-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Edit settings" }).click();
    await expect(page.getByRole("group", { name: "Depth" })).toBeVisible();
    await page.getByText("View breakdown").click();
    await expect(page.getByTestId("builder-readiness-breakdown")).toBeVisible();
  }

  const baselinePath = testInfo.outputPath("builder-desktop-baseline.json");
  await writeFile(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
  await testInfo.attach("builder-desktop-baseline", {
    path: baselinePath,
    contentType: "application/json",
  });
  expect(
    unexpectedFailures,
    "Builder desktop review-layout test should not leak unmocked auth/data requests.",
  ).toEqual([]);
});

test("builder desktop smart suggestions and detail summaries stay within layout bounds", async ({
  page,
}) => {
  const unexpectedFailures = trackUnexpectedNetworkFailures(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const prompt = page.getByRole("textbox", {
    name: /What should the model do\?/i,
  });
  await expect(prompt).toBeVisible();

  await prompt.fill(
    "Review the prompt builder interface, compare the visible flows, and summarize the highest-impact UX improvements.",
  );

  const comparisonSuggestion = page.getByTestId(
    "builder-suggestion-chip-append-comparison-framework",
  );
  await expect(comparisonSuggestion).toBeVisible();
  await expect(
    page.getByTestId("builder-suggestion-chip-append-evidence"),
  ).toBeVisible();

  const showAdvancedControls = page.getByRole("button", {
    name: "Show advanced controls",
  });
  if (await showAdvancedControls.isVisible()) {
    await showAdvancedControls.click();
  }

  const adjustDetails = page.getByRole("button", { name: "Prompt details" });
  await expect(adjustDetails).toBeVisible();
  await adjustDetails.click();

  const customRole = page.getByLabel("Custom role");
  await expect(customRole).toBeVisible();
  await customRole.fill(LONG_ROLE);

  await adjustDetails.click();
  await expect(
    page.getByTestId("builder-adjust-details-selected-role"),
  ).toBeVisible();

  const metrics = await page.evaluate(() => {
    const suggestionButtons = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-testid^='builder-suggestion-chip-']",
      ),
    );
    const roleSummary = document.querySelector<HTMLElement>(
      "[data-testid='builder-adjust-details-selected-role']",
    );
    const adjustTrigger = roleSummary?.closest("button");
    const overlapPairs: string[] = [];

    const rects = suggestionButtons.map((button) => ({
      id: button.dataset.testid ?? "unknown",
      rect: button.getBoundingClientRect(),
    }));

    for (let index = 0; index < rects.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < rects.length; otherIndex += 1) {
        const current = rects[index];
        const other = rects[otherIndex];
        const overlaps =
          current.rect.left < other.rect.right &&
          current.rect.right > other.rect.left &&
          current.rect.top < other.rect.bottom &&
          current.rect.bottom > other.rect.top;
        if (overlaps) {
          overlapPairs.push(`${current.id}::${other.id}`);
        }
      }
    }

    const roleRect = roleSummary?.getBoundingClientRect() ?? null;
    const triggerRect = adjustTrigger?.getBoundingClientRect() ?? null;

    return {
      buttonCount: suggestionButtons.length,
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > window.innerWidth,
      overlapPairs,
      roleSummaryClientWidth: roleSummary?.clientWidth ?? 0,
      roleSummaryScrollWidth: roleSummary?.scrollWidth ?? 0,
      roleSummaryEscapesTrigger: Boolean(
        roleRect &&
          triggerRect &&
          roleRect.right > triggerRect.right - 24,
      ),
    };
  });

  expect(metrics.buttonCount).toBe(2);
  expect(metrics.hasHorizontalOverflow).toBeFalsy();
  expect(metrics.overlapPairs).toEqual([]);
  expect(metrics.roleSummaryScrollWidth).toBeGreaterThan(
    metrics.roleSummaryClientWidth,
  );
  expect(metrics.roleSummaryEscapesTrigger).toBeFalsy();
  expect(
    unexpectedFailures,
    "Builder desktop interaction test should not leak unmocked auth/data requests.",
  ).toEqual([]);
});

test("shows one non-blocking degraded smart suggestion message on desktop", async ({
  page,
}) => {
  const unexpectedFailures = trackUnexpectedNetworkFailures(page);
  const fallbackMessage =
    "Using local suggestions while AI suggestions reconnect. We'll retry automatically.";
  let inferRequestCount = 0;

  await page.unroute("**/infer-builder-fields");
  await page.route("**/infer-builder-fields", async (route) => {
    inferRequestCount += 1;
    await fulfillJson(
      route,
      { error: "Inference service temporarily unavailable." },
      503,
    );
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const promptInput = page.getByRole("textbox", {
    name: /What should the model do\?|Your Prompt/i,
  });
  await expect(promptInput).toBeVisible();

  await promptInput.fill(
    "Rewrite these launch notes into a concise release plan with owners, milestones, and risks.",
  );

  const suggestionStatus = page.getByTestId("builder-suggestions-status");
  await expect(suggestionStatus).toBeVisible();
  await expect(suggestionStatus).toContainText(fallbackMessage);
  await expect(page.getByText(fallbackMessage)).toHaveCount(1);
  await expect(page.getByText("Smart suggestions", { exact: true })).toBeVisible();

  await promptInput.fill(
    "Rewrite these launch notes into a concise release plan with owners, milestones, risks, and rollback steps.",
  );
  await page.waitForTimeout(1_000);

  expect(
    inferRequestCount,
    "Builder should back off remote retries instead of re-requesting suggestions on every edit.",
  ).toBe(1);
  await expect(promptInput).toHaveValue(
    "Rewrite these launch notes into a concise release plan with owners, milestones, risks, and rollback steps.",
  );
  expect(
    unexpectedFailures,
    "Builder desktop degraded-suggestions test should not leak unmocked auth/data requests.",
  ).toEqual([]);
});

test("lets signed-in desktop users attach GitHub repository files as builder context", async ({
  page,
}) => {
  const unexpectedFailures = trackUnexpectedNetworkFailures(page);
  await installGitHubContextMocks(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const promptInput = page.getByRole("textbox", {
    name: /What should the model do\?|Your Prompt/i,
  });
  await expect(promptInput).toBeVisible();
  await promptInput.fill("Use repository context to tighten this implementation plan.");

  const showAdvancedControls = page.getByRole("button", {
    name: "Show advanced controls",
  });
  if (await showAdvancedControls.isVisible()) {
    await showAdvancedControls.click();
  }

  await page.getByRole("button", { name: "Context and sources" }).click();
  await expect(page.getByText("GitHub repository context")).toBeVisible();

  await page.getByRole("button", { name: "Add from GitHub" }).click();
  const dialog = page.getByRole("dialog", { name: "Add from GitHub" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Active installation:")).toBeVisible();
  const repositoryButton = dialog.getByRole("button", {
    name: /promptforge-org\/ai-prompt-pro/i,
  }).first();
  await expect(repositoryButton).toBeVisible();

  await repositoryButton.click();
  await expect(
    dialog.getByRole("button", { name: "Connect selected repo" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Connect selected repo" }).click();

  await expect(dialog.getByLabel("Search repository files")).toBeEnabled();
  await expect(dialog.getByRole("checkbox", { name: "Select README.md" })).toBeVisible();

  await dialog.getByRole("button", { name: "Preview" }).first().click();
  await expect(dialog.getByText(/PromptForge GitHub context/i)).toBeVisible();

  await dialog.getByRole("checkbox", { name: "Select README.md" }).check({ force: true });
  await expect(
    dialog.getByText("1 file selected from promptforge-org/ai-prompt-pro."),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Attach selected files" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", {
      name: "Remove promptforge-org/ai-prompt-pro:README.md",
    }),
  ).toBeVisible();
  expect(
    unexpectedFailures,
    "Builder desktop GitHub picker test should not leak unmocked auth/data requests.",
  ).toEqual([]);
});
