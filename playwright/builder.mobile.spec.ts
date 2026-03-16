import { writeFile } from "node:fs/promises";
import { expect, test, type Page, type Route } from "@playwright/test";

const MOBILE_WIDTHS = [360, 390, 428] as const;
const DEVTOOLS_MOBILE_WIDTHS = [320, 375, 390, 428] as const;
const VIEWPORT_HEIGHT = 900;
const AUTH_EXPIRES_AT = Math.floor(Date.now() / 1000) + 3600;
const DEVELOPER_TOOL_MENU_ITEMS = [
  "Copy Codex exec command",
  "Copy Codex TUI command",
  "Copy app server command",
  "Copy skill scaffold",
  "Download SKILL.md",
  "Download AGENTS.md",
  "Download AGENTS.override.md",
  "Copy telemetry log (JSON)",
  "Download telemetry log",
  "Copy latest enhance session summary",
] as const;

const AUTH_USER = {
  id: "builder-viewer-1",
  aud: "authenticated",
  role: "authenticated",
  email: "builder-viewer@example.com",
  app_metadata: {
    provider: "email",
    providers: ["email"],
  },
  user_metadata: {
    display_name: "Taylor Builder",
    full_name: "Taylor Builder",
    avatar_url: null,
  },
  created_at: "2026-01-20T12:00:00.000Z",
};

const AUTH_SESSION = {
  access_token: "builder-auth-access-token",
  refresh_token: "builder-auth-refresh-token",
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

interface BuilderMobileMetric {
  width: number;
  viewportHeight: number;
  hasHorizontalOverflow: boolean;
  stickyBarHeightPx: number;
  stickyOverlapWithBottomNavPx: number;
  stickySecondaryControlsGapPx: number;
  controlsUnder44px: Array<{ testId: string; width: number; height: number }>;
}

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

async function installBuilderAuthMocks(
  page: Page,
  { authenticated = false }: { authenticated?: boolean } = {},
): Promise<void> {
  const authUser = authenticated ? AUTH_USER : null;
  const authSession = authenticated ? AUTH_GET_SESSION_RESPONSE.session : null;
  const authSessionUser = authenticated ? AUTH_GET_SESSION_RESPONSE.user : null;

  await page.route("**/auth/get-session", async (route) => {
    await fulfillJson(route, { session: authSession, user: authSessionUser });
  });

  await page.route("**/auth/token/anonymous", async (route) => {
    await fulfillJson(route, {
      token: "header.payload.signature",
      expires_at: AUTH_EXPIRES_AT,
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

  await page.route("**/rest/v1/drafts**", async (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "HEAD") {
      await fulfillJson(route, null);
      return;
    }
    await fulfillJson(route, []);
  });

  await page.route("**/rest/v1/saved_prompts**", async (route) => {
    await fulfillJson(route, [], 200, { "content-range": "0-0/0" });
  });

  await page.route("**/rest/v1/community_posts**", async (route) => {
    await fulfillJson(route, [], 200, { "content-range": "0-0/0" });
  });

  await page.route("**/rest/v1/prompt_versions**", async (route) => {
    await fulfillJson(route, [], 200, { "content-range": "0-0/0" });
  });

  await page.route("**/rest/v1/notifications**", async (route) => {
    await fulfillJson(route, [], 200, { "content-range": "0-0/0" });
  });
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
      url.includes("/github/");
    if (!targetsBuilderDataPlane) return;

    const errorText = request.failure()?.errorText ?? "unknown_error";
    unexpectedFailures.push(`${url} :: ${errorText}`);
  });
  return unexpectedFailures;
}

async function attachGitHubReadme(page: Page): Promise<void> {
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
}

test("captures Builder mobile sticky-bar ergonomics at 360-430px widths", async ({ page }, testInfo) => {
  const baseline: BuilderMobileMetric[] = [];

  for (const width of MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto("/");

    await expect(
      page.getByRole("textbox", { name: /What should the model do\?/i }),
    ).toBeVisible();
    await expect(page.getByTestId("builder-mobile-sticky-bar")).toBeVisible();
    await expect(page.getByTestId("builder-mobile-preview-trigger")).toBeVisible();
    await expect(page.getByTestId("builder-mobile-settings-trigger")).toBeVisible();
    await expect(page.getByTestId("builder-mobile-enhance-button")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-testid='builder-mobile-preview-trigger'], [data-testid='builder-mobile-settings-trigger'], [data-testid='builder-mobile-enhance-button']",
        ),
      );
      const controlsUnder44px = controls
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            testId: element.dataset.testid || element.getAttribute("role") || "unknown",
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        })
        .filter((entry) => entry.width < 44 || entry.height < 44);

      const sticky = document.querySelector<HTMLElement>("[data-testid='builder-mobile-sticky-bar']");
      const mobileNav = document.querySelector<HTMLElement>("[aria-label='Mobile navigation']");
      const previewTrigger = document.querySelector<HTMLElement>("[data-testid='builder-mobile-preview-trigger']");
      const settingsTrigger = document.querySelector<HTMLElement>("[data-testid='builder-mobile-settings-trigger']");
      const enhanceButton = document.querySelector<HTMLElement>("[data-testid='builder-mobile-enhance-button']");

      const stickyRect = sticky?.getBoundingClientRect() || null;
      const navRect = mobileNav?.getBoundingClientRect() || null;
      const previewRect = previewTrigger?.getBoundingClientRect() || null;
      const settingsRect = settingsTrigger?.getBoundingClientRect() || null;

      const stickyOverlapWithBottomNavPx =
        stickyRect && navRect ? Math.max(0, Math.round(stickyRect.bottom - navRect.top)) : 0;
      const stickyBarHeightPx = stickyRect ? Math.round(stickyRect.height) : 0;
      const stickySecondaryControlsGapPx =
        previewRect && settingsRect ? Math.max(0, Math.round(settingsRect.left - previewRect.right)) : 0;

      return {
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        stickyBarHeightPx,
        stickyOverlapWithBottomNavPx,
        stickySecondaryControlsGapPx,
        controlsUnder44px,
      };
    });

    baseline.push({
      width,
      viewportHeight: VIEWPORT_HEIGHT,
      hasHorizontalOverflow: metrics.hasHorizontalOverflow,
      stickyBarHeightPx: metrics.stickyBarHeightPx,
      stickyOverlapWithBottomNavPx: metrics.stickyOverlapWithBottomNavPx,
      stickySecondaryControlsGapPx: metrics.stickySecondaryControlsGapPx,
      controlsUnder44px: metrics.controlsUnder44px,
    });

    await page.screenshot({
      path: testInfo.outputPath(`builder-mobile-${width}.png`),
      fullPage: true,
    });
  }

  const baselinePath = testInfo.outputPath("builder-mobile-baseline.json");
  await writeFile(baselinePath, JSON.stringify(baseline, null, 2), "utf8");
  await testInfo.attach("builder-mobile-baseline", {
    path: baselinePath,
    contentType: "application/json",
  });

  expect(baseline).toHaveLength(MOBILE_WIDTHS.length);
  for (const metric of baseline) {
    expect(metric.hasHorizontalOverflow, `width ${metric.width} should not overflow horizontally`).toBeFalsy();
    expect(metric.controlsUnder44px, `width ${metric.width} has controls below 44px`).toEqual([]);
    expect(
      metric.stickyBarHeightPx,
      `width ${metric.width} sticky bar should stay compact enough to preserve builder space`,
    ).toBeLessThanOrEqual(104);
    expect(
      metric.stickyOverlapWithBottomNavPx,
      `width ${metric.width} has sticky controls overlapping bottom navigation`,
    ).toBe(0);
    expect(
      metric.stickySecondaryControlsGapPx,
      `width ${metric.width} needs more spacing between preview and settings controls`,
    ).toBeGreaterThanOrEqual(4);
  }
});

test("lets mobile users change enhancement settings before running enhance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto("/");

  await expect(
    page.getByRole("textbox", { name: /What should the model do\?/i }),
  ).toBeVisible();
  await expect(page.getByTestId("builder-mobile-settings-trigger")).toBeVisible();

  await page.getByTestId("builder-mobile-settings-trigger").click();

  const settingsSheet = page.getByTestId("builder-mobile-settings-sheet");
  await expect(settingsSheet).toBeVisible();
  await expect(page.getByTestId("builder-mobile-settings-sheet-summary")).toContainText(
    "Structured rewrite · Balanced · Infer conservatively",
  );

  await settingsSheet.getByRole("button", { name: "Expert prompt" }).click();
  await settingsSheet.getByRole("button", { name: "Preserve wording" }).click();
  await settingsSheet.getByRole("button", { name: "Ask me" }).click();

  await expect(page.getByTestId("builder-mobile-settings-sheet-summary")).toContainText(
    "Expert prompt · Preserve wording · Ask me",
  );

  await settingsSheet.getByRole("button", { name: "Done" }).click();

  await page
    .getByRole("textbox", { name: /What should the model do\?|Your Prompt/i })
    .fill("Rewrite this rough prompt into an expert instruction set");
  await page.getByTestId("builder-mobile-preview-trigger").click();

  const previewDialog = page.getByRole("dialog", {
    name: /Draft prompt|Enhanced prompt|No preview yet/i,
  });
  await expect(previewDialog).toBeVisible();
  await expect(
    previewDialog
      .getByTestId("output-panel-state-banner")
      .getByText("Draft prompt", { exact: true }),
  ).toBeVisible();
  await expect(previewDialog.getByRole("button", { name: "Copy draft" })).toBeVisible();
  await expect(
    page.getByTestId("output-panel-enhancement-settings-summary"),
  ).toContainText("Expert prompt · Preserve wording · Ask me");
  await expect(
    page.getByTestId("enhancement-preferences-reset-row"),
  ).toHaveCount(0);

  await previewDialog.getByRole("button", { name: "Edit settings" }).click();
  await expect(
    page.getByTestId("enhancement-preferences-reset-row"),
  ).toBeVisible();
});

test("lets signed-in mobile users open the Codex session drawer from settings and keep carry-forward edits", async ({
  page,
}) => {
  await installBuilderAuthMocks(page, { authenticated: true });
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto("/");

  await expect(
    page.getByRole("textbox", { name: /What should the model do\?/i }),
  ).toBeVisible();

  await page.getByTestId("builder-mobile-settings-trigger").click();

  const settingsSheet = page.getByTestId("builder-mobile-settings-sheet");
  await expect(settingsSheet).toBeVisible();
  await expect(
    settingsSheet.getByTestId("builder-mobile-codex-session-section"),
  ).toBeVisible();
  await expect(
    settingsSheet.getByTestId("builder-mobile-codex-session-summary"),
  ).toContainText(
    "Open the drawer to add supplemental context before the next enhancement pass.",
  );

  await settingsSheet.getByRole("button", { name: "Open session" }).click();

  const contextSummary = page.getByLabel("Outside context summary");
  const carryForwardPrompt = page.getByLabel("Carry-forward prompt");
  await expect(contextSummary).toBeVisible();
  await expect(carryForwardPrompt).toBeVisible();

  await contextSummary.fill(
    "Bring in the launch brief, beta feedback, and the legal review notes.",
  );
  await carryForwardPrompt.fill(
    "Carry forward the partner launch prompt with the revised compliance guardrails.",
  );

  await page.getByRole("button", { name: "Done" }).click();
  await expect(contextSummary).toHaveCount(0);

  await page.getByTestId("builder-mobile-settings-trigger").click();
  await expect(
    settingsSheet.getByTestId("builder-mobile-codex-session-summary"),
  ).toContainText("Manual carry-forward is ready for the next Codex turn.");

  await settingsSheet.getByRole("button", { name: "Open session" }).click();
  await expect(contextSummary).toHaveValue(
    "Bring in the launch brief, beta feedback, and the legal review notes.",
  );
  await expect(carryForwardPrompt).toHaveValue(
    "Carry forward the partner launch prompt with the revised compliance guardrails.",
  );
});

test("lets signed-in mobile users attach GitHub repository files as builder context", async ({
  page,
}) => {
  const unexpectedFailures = trackUnexpectedNetworkFailures(page);
  await installBuilderAuthMocks(page, { authenticated: true });
  await installGitHubContextMocks(page);
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto("/");

  const promptInput = page.getByRole("textbox", {
    name: /What should the model do\?|Your Prompt/i,
  });
  await expect(promptInput).toBeVisible();
  await promptInput.fill("Use repository context to tighten this implementation plan.");

  await attachGitHubReadme(page);

  expect(
    unexpectedFailures,
    "Builder mobile GitHub picker test should not leak unmocked auth/data requests.",
  ).toEqual([]);
});

test("keeps adjust details progressive on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: VIEWPORT_HEIGHT });
  await page.goto("/");

  await expect(
    page.getByRole("textbox", { name: /What should the model do\?/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Show advanced controls" }).click();

  const adjustDetails = page.getByRole("button", { name: "Prompt details" });
  const roleGroup = page.getByRole("button", { name: "Role and voice" });
  const outputGroup = page.getByRole("button", { name: "Output shape" });

  await adjustDetails.click();

  await expect(roleGroup).toHaveAttribute("aria-expanded", "true");
  await expect(outputGroup).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Custom role")).toBeVisible();
  await expect(page.getByLabel("Custom format")).toHaveCount(0);

  await outputGroup.click();
  await expect(outputGroup).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Custom format")).toBeVisible();

  await page.getByRole("button", { name: "Professional" }).click();
  await adjustDetails.click();

  await expect(page.getByText(/Professional tone/i)).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBeFalsy();
});

test("keeps Builder developer tools menu fully within mobile viewport", async ({ page }) => {
  for (const width of DEVTOOLS_MOBILE_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto("/");
    await expect(
      page.getByRole("textbox", { name: /What should the model do\?/i }),
    ).toBeVisible();

    await page
      .getByRole("textbox", { name: /What should the model do\?|Your Prompt/i })
      .fill("Plan a weekly engineering sync agenda");
    await page.getByTestId("builder-mobile-preview-trigger").click();

    const previewDialog = page.getByRole("dialog", {
      name: /Draft prompt|Enhanced prompt|No preview yet/i,
    });
    await expect(previewDialog).toBeVisible();

    await previewDialog.getByRole("button", { name: "More" }).click();
    await expect(page.getByText("Developer tools")).toBeVisible();

    for (const itemLabel of DEVELOPER_TOOL_MENU_ITEMS) {
      const item = page.getByRole("menuitem", { name: itemLabel });
      await expect(item, `width ${width}: "${itemLabel}" should be visible`).toBeVisible();

      const box = await item.boundingBox();
      expect(box, `width ${width}: "${itemLabel}" should have a bounding box`).not.toBeNull();
      expect(box!.x, `width ${width}: "${itemLabel}" should not overflow left`).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `width ${width}: "${itemLabel}" should not overflow right`,
      ).toBeLessThanOrEqual(width);
    }

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  }
});
