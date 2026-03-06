import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/base/tabs";

describe("Tabs API", () => {
  it("reflects controlled value changes across triggers and content", () => {
    const { rerender } = render(
      <Tabs value="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview content</TabsContent>
        <TabsContent value="settings">Settings content</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toBeVisible();

    rerender(
      <Tabs value="settings">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview content</TabsContent>
        <TabsContent value="settings">Settings content</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("tabpanel", { name: "Settings" })).toBeVisible();
  });

  it("supports disabled triggers", () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history" disabled>
            History
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview content</TabsContent>
        <TabsContent value="history">History content</TabsContent>
      </Tabs>,
    );

    const historyTab = screen.getByRole("tab", { name: "History" });
    expect(historyTab).toBeDisabled();
    expect(historyTab).toHaveAttribute("data-disabled");
  });
});
