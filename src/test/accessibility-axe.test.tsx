import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

async function renderAppAt(pathname: string) {
  window.history.pushState({}, "", pathname);
  const { default: App } = await import("@/App");
  render(<App />);
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
