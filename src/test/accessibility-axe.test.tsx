import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

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

  it("has no axe violations on the builder route", async () => {
    await renderAppAt("/");
    await screen.findByTestId("page-shell");

    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  }, 15_000);

  it("has no axe violations on the community route", async () => {
    await renderAppAt("/community");
    await screen.findByTestId("page-shell");

    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });
});
