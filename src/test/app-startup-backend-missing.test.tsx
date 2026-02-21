import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/backend-config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/backend-config")>("@/lib/backend-config");
  return {
    ...actual,
    hasBackendEnvConfig: false,
    isBackendConfigured: false,
    assertBackendConfigured: (featureLabel: string) => {
      throw new Error(actual.getBackendConfigErrorMessage(featureLabel));
    },
  };
});

async function renderAppAt(pathname: string) {
  window.history.pushState({}, "", pathname);
  const { default: App } = await import("@/App");
  render(<App />);
}

describe("app startup when backend is unconfigured", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("keeps Builder route usable instead of crashing", async () => {
    await renderAppAt("/");

    expect(await screen.findByTestId("page-shell")).toBeInTheDocument();
    const hero = await screen.findByTestId("builder-hero", {}, { timeout: 5000 });
    expect(hero).toBeInTheDocument();
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent(/\S+/);
  });

  it("shows actionable Community backend setup state instead of crashing", async () => {
    await renderAppAt("/community");

    expect(await screen.findByText("Community backend is not configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Library" })).toBeInTheDocument();
  });
});
