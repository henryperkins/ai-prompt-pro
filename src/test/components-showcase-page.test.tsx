import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ComponentsShowcase from "@/pages/ComponentsShowcase";

vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <main data-testid="page-shell">{children}</main>,
  PageHero: ({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) => (
    <header>
      {eyebrow ? <p>{eyebrow}</p> : null}
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  ),
}));

vi.mock("@/components/application/activity-feeds/activity-feeds", () => ({
  ActivityFeedsBlock: () => <div>Activity feed stub</div>,
}));

vi.mock("@/components/application/code-snippet/code-snippet", () => ({
  CodeSnippetTabs: () => <div>Code snippet stub</div>,
}));

vi.mock("@/components/application/lists/feed-list", () => ({
  FeedListBlock: () => <div>Feed list stub</div>,
}));

vi.mock("@/components/application/progress-steps/progress-steps", () => ({
  ProgressSteps: () => <div>Progress steps stub</div>,
}));

vi.mock("@/components/application/tables/team-members-table", () => ({
  TeamMembersTableBlock: () => <div>Team members table stub</div>,
}));

describe("ComponentsShowcase", () => {
  it("keeps the branded surface checkpoint and accessible progress examples in the route showcase", () => {
    render(<ComponentsShowcase />);

    expect(screen.getByRole("heading", { name: "Branded Surface Checkpoint" })).toBeInTheDocument();
    expect(screen.getByText("Legendary Creator")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Overall upload progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ari Flint" })).toBeInTheDocument();
  });
});
