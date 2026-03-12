import { act, cleanup, render, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const ROUTE_CASES = [
  {
    label: "builder",
    pathname: "/",
    waitForReady: async () => {
      await screen.findByTestId("builder-hero");
    },
  },
  {
    label: "community",
    pathname: "/community",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Community Remix Feed" });
      await screen.findByTestId("community-search-shell");
    },
  },
  {
    label: "feed",
    pathname: "/feed",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Community Remix Feed" });
      await screen.findByTestId("community-search-shell");
    },
  },
  {
    label: "library",
    pathname: "/library",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Prompt Library" });
    },
  },
  {
    label: "library bulk edit",
    pathname: "/library/bulk-edit",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Prompt Library" });
    },
  },
  {
    label: "presets",
    pathname: "/presets",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Presets" });
      await screen.findByTestId("preset-results-summary");
    },
  },
  {
    label: "history",
    pathname: "/history",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Version History" });
    },
  },
  {
    label: "privacy",
    pathname: "/privacy",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Privacy Policy" });
    },
  },
  {
    label: "terms",
    pathname: "/terms",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Terms of Use" });
    },
  },
  {
    label: "contact",
    pathname: "/contact",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Get in touch" });
    },
  },
  {
    label: "support inbox",
    pathname: "/support/inbox",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Support Inbox" });
    },
  },
  {
    label: "components showcase",
    pathname: "/components-showcase",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Untitled UI Component Showcase" });
    },
  },
  {
    label: "not found",
    pathname: "/does-not-exist",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Page not found" });
    },
  },
] as const;

const ALLOWED_CONSOLE_ERROR_PATTERNS = [
  /^404 Error: User attempted to access non-existent route:/,
  /^Not implemented: HTMLCanvasElement's getContext\(\) method:/,
] as const;

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

vi.mock("@/hooks/auth-provider", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    updateDisplayName: vi.fn(),
    deleteAccount: vi.fn(),
  }),
}));

vi.mock("@/hooks/useNewPostsIndicator", () => ({
  useNewPostsIndicator: () => ({
    newCount: 0,
    dismiss: vi.fn(),
  }),
}));

function readUnexpectedConsoleErrors() {
  return consoleErrorSpy.mock.calls
    .map((args) => args.map((value) => String(value)).join(" "))
    .filter((message) => !ALLOWED_CONSOLE_ERROR_PATTERNS.some((pattern) => pattern.test(message)));
}

async function waitForSettledUi(delayMs = 300) {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  });
}

async function renderAppAt(pathname: string) {
  window.history.pushState({}, "", pathname);
  const { default: App } = await import("@/App");
  await act(async () => {
    render(<App />);
  });
}

describe("accessibility audits", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    expect(readUnexpectedConsoleErrors()).toEqual([]);
    consoleErrorSpy.mockRestore();
    cleanup();
    window.history.pushState({}, "", "/");
  });

  for (const routeCase of ROUTE_CASES) {
    it(`has no axe violations on the ${routeCase.label} route`, async () => {
      await renderAppAt(routeCase.pathname);
      await screen.findByTestId("page-shell");

      const fallback = screen.queryByTestId("route-fallback-root");
      if (fallback) {
        await waitForElementToBeRemoved(fallback);
      }

      await routeCase.waitForReady();
      await waitForSettledUi();
      await waitFor(() => {
        expect(readUnexpectedConsoleErrors()).toEqual([]);
      });

      const results = await axe(document.body);
      expect(results.violations).toEqual([]);
    }, 15_000);
  }
});
