import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const ROUTE_READY_TIMEOUT_MS = 15_000;

const ROUTE_CASES = [
  {
    label: "builder",
    pathname: "/",
    waitForReady: async () => {
      await screen.findByTestId("builder-hero", {}, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "community",
    pathname: "/community",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Community Remix Feed" }, { timeout: ROUTE_READY_TIMEOUT_MS });
      await screen.findByTestId("community-search-shell", {}, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "feed",
    pathname: "/feed",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Community Remix Feed" }, { timeout: ROUTE_READY_TIMEOUT_MS });
      await screen.findByTestId("community-auth-discovery", {}, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "library",
    pathname: "/library",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Prompt Library" }, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "library bulk edit",
    pathname: "/library/bulk-edit",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Prompt Library" }, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "presets",
    pathname: "/presets",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Presets" }, { timeout: ROUTE_READY_TIMEOUT_MS });
      await screen.findByTestId("preset-results-summary", {}, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "history",
    pathname: "/history",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Version History" }, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "reset password",
    pathname: "/reset-password?token=test-reset-token",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Reset password" }, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "privacy",
    pathname: "/privacy",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Privacy Policy" }, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "terms",
    pathname: "/terms",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Terms of Use" }, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "contact",
    pathname: "/contact",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Get in touch" }, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "support inbox",
    pathname: "/support/inbox",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Support Inbox" }, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "components showcase",
    pathname: "/components-showcase",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Untitled UI Component Showcase" }, { timeout: ROUTE_READY_TIMEOUT_MS });
    },
  },
  {
    label: "not found",
    pathname: "/does-not-exist",
    waitForReady: async () => {
      await screen.findByRole("heading", { name: "Page not found" }, { timeout: ROUTE_READY_TIMEOUT_MS });
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
    requestPasswordReset: vi.fn(),
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
      await screen.findByTestId("page-shell", {}, { timeout: ROUTE_READY_TIMEOUT_MS });
      await waitFor(() => {
        expect(screen.queryByTestId("route-fallback-root")).not.toBeInTheDocument();
      }, { timeout: ROUTE_READY_TIMEOUT_MS });
      await routeCase.waitForReady();

      await waitForSettledUi();
      await waitFor(() => {
        expect(readUnexpectedConsoleErrors()).toEqual([]);
      });

      const results = await axe(document.body);
      expect(results.violations).toEqual([]);
    }, 30_000);
  }
});
