import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const ROUTE_CASES = [
  { label: "builder", pathname: "/" },
  { label: "community", pathname: "/community" },
  { label: "feed", pathname: "/feed" },
  { label: "library", pathname: "/library" },
  { label: "library bulk edit", pathname: "/library/bulk-edit" },
  { label: "presets", pathname: "/presets" },
  { label: "history", pathname: "/history" },
  { label: "privacy", pathname: "/privacy" },
  { label: "terms", pathname: "/terms" },
  { label: "contact", pathname: "/contact" },
  { label: "support inbox", pathname: "/support/inbox" },
  { label: "components showcase", pathname: "/components-showcase" },
  { label: "not found", pathname: "/does-not-exist" },
] as const;

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

async function renderAppAt(pathname: string) {
  window.history.pushState({}, "", pathname);
  const { default: App } = await import("@/App");
  await act(async () => {
    render(<App />);
    await Promise.resolve();
  });
}

describe("accessibility audits", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  for (const routeCase of ROUTE_CASES) {
    it(`has no axe violations on the ${routeCase.label} route`, async () => {
      await renderAppAt(routeCase.pathname);
      await screen.findByTestId("page-shell");
      await act(async () => {
        await Promise.resolve();
      });

      const results = await axe(document.body);
      expect(results.violations).toEqual([]);
    }, 15_000);
  }
});
