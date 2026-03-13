import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHero } from "@/components/PageShell";

describe("PageHero", () => {
  it("uses the collection pattern and shows the wordmark by default", () => {
    render(
      <PageHero
        eyebrow="PromptForge"
        title="Prompt Library"
        subtitle="Track saved prompts and remix history."
      />,
    );

    expect(screen.getByTestId("page-hero")).toHaveAttribute("data-page-hero-pattern", "collection");
    expect(screen.getByTestId("page-hero")).toHaveAttribute("data-page-hero-wordmark", "shown");
    expect(screen.getByTestId("page-hero-wordmark")).toBeInTheDocument();
  });

  it("uses the utility pattern and hides the wordmark by default", () => {
    render(
      <PageHero
        pattern="utility"
        title="Privacy Policy"
        subtitle="How PromptForge handles account and usage data."
      />,
    );

    expect(screen.getByTestId("page-hero")).toHaveAttribute("data-page-hero-pattern", "utility");
    expect(screen.getByTestId("page-hero")).toHaveAttribute("data-page-hero-wordmark", "hidden");
    expect(screen.queryByTestId("page-hero-wordmark")).not.toBeInTheDocument();
  });
});
