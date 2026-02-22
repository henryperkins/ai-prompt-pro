import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  templates: [
    {
      id: "baseline-preset",
      name: "Baseline Preset",
      category: "general",
      description: "Baseline template",
      starterPrompt: "Draft an onboarding email.",
      role: "Writer",
      task: "Create onboarding copy",
      context: "SaaS product",
      format: ["Markdown"],
      lengthPreference: "standard",
      tone: "Professional",
      complexity: "Moderate",
      constraints: [],
      examples: "",
    },
    {
      id: "id with/slash & space",
      name: "Encoded Preset",
      category: "testing",
      description: "Template with special characters in id",
      starterPrompt: "Review a flaky test suite.",
      role: "QA Engineer",
      task: "Review tests",
      context: "CI pipeline",
      format: ["Bullet points"],
      lengthPreference: "brief",
      tone: "Technical",
      complexity: "Advanced",
      constraints: ["Think step-by-step"],
      examples: "",
    },
  ],
}));

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHero: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  ),
}));

vi.mock("@/lib/templates", () => ({
  templates: fixtures.templates,
  categoryLabels: {
    general: "General",
    testing: "Testing",
  },
  promptCategorySkins: {
    general: {
      card: "",
      iconWrap: "",
      badge: "",
      action: "",
    },
    testing: {
      card: "",
      iconWrap: "",
      badge: "",
      action: "",
    },
  },
}));

async function renderPresets() {
  const { default: Presets } = await import("@/pages/Presets");

  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
  }

  render(
    <MemoryRouter initialEntries={["/presets"]}>
      <Routes>
        <Route
          path="*"
          element={(
            <>
              <Presets />
              <LocationProbe />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Presets page", () => {
  it("exposes an accessible search label and selected-state semantics for category filters", async () => {
    await renderPresets();

    expect(screen.getByRole("textbox", { name: "Search presets" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filter presets by category" })).toBeInTheDocument();

    const allButton = screen.getByRole("button", { name: "All" });
    const testingButton = screen.getByRole("button", { name: /Testing/i });

    expect(allButton).toHaveAttribute("aria-pressed", "true");
    expect(testingButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(testingButton);

    expect(testingButton).toHaveAttribute("aria-pressed", "true");
    expect(allButton).toHaveAttribute("aria-pressed", "false");
  });

  it("encodes preset ids when navigating to the builder", async () => {
    await renderPresets();

    const usePresetButtons = screen.getAllByRole("button", { name: "Use preset" });
    fireEvent.click(usePresetButtons[1]);

    expect(screen.getByTestId("location")).toHaveTextContent("/?preset=id+with%2Fslash+%26+space");
  });
});
