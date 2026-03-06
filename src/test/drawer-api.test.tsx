import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/base/drawer";

describe("Drawer API", () => {
  it("renders drawer content in open state", () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filter prompts</DrawerTitle>
            <DrawerDescription>Choose model and complexity filters.</DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );

    expect(screen.getByText("Filter prompts")).toBeInTheDocument();
    expect(screen.getByText("Choose model and complexity filters.")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <Drawer open={false}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Hidden title</DrawerTitle>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );

    expect(screen.queryByText("Hidden title")).not.toBeInTheDocument();
  });
});
