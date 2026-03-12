import { expect, test, type Page, type Route } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 900 } as const;
const AUTH_EXPIRES_AT = Math.floor(Date.now() / 1000) + 3600;
const LONG_ROLE =
  "Senior UX auditor and design systems strategist for AI-assisted product experiences";

const AUTH_USER = {
  id: "builder-desktop-1",
  aud: "authenticated",
  role: "authenticated",
  email: "builder-desktop@example.com",
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
  access_token: "builder-desktop-access-token",
  refresh_token: "builder-desktop-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: AUTH_EXPIRES_AT,
  user: AUTH_USER,
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
  await page.route("**/auth/get-session", async (route) => {
    await fulfillJson(route, { session: AUTH_SESSION, user: AUTH_USER });
  });

  await page.route("**/auth/token/anonymous", async (route) => {
    await fulfillJson(route, {
      token: "header.payload.signature",
      expires_at: AUTH_EXPIRES_AT,
    });
  });

  await page.route("**/auth/v1/user", async (route) => {
    await fulfillJson(route, { user: AUTH_USER });
  });

  await page.route("**/auth/get-user", async (route) => {
    await fulfillJson(route, { user: AUTH_USER });
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

  await page.route("**/infer-builder-fields", async (route) => {
    await fulfillJson(route, {
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
          description:
            "Define the baseline, segments, or time periods to compare.",
          action: {
            type: "append_prompt",
            text: "\nComparison framework: [baseline, segments, cohorts, or time periods to compare]",
          },
        },
      ],
    });
  });
}

test("builder desktop smart suggestions and detail summaries stay within layout bounds", async ({
  page,
}) => {
  await installBuilderDesktopMocks(page);
  await page.setViewportSize(DESKTOP_VIEWPORT);
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

  const adjustDetails = page.getByRole("button", { name: "Adjust details" });
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
          current.rect.left < other.rect.right
          && current.rect.right > other.rect.left
          && current.rect.top < other.rect.bottom
          && current.rect.bottom > other.rect.top;
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
        roleRect
        && triggerRect
        && roleRect.right > triggerRect.right - 24,
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
});
