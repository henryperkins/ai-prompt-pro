import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityFeedsBlock } from "@/components/application/activity-feeds/activity-feeds";
import { TeamMembersTableBlock } from "@/components/application/tables/team-members-table";

describe("Untitled UI showcase blocks", () => {
  it("switches activity feed mode between activity and messages", () => {
    render(<ActivityFeedsBlock />);

    expect(screen.getByText("Activity feed")).toBeInTheDocument();
    expect(screen.getByText("4 items")).toBeInTheDocument();
    expect(screen.getByText("added a file to")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Messages" }));

    expect(screen.getByText("Messages feed")).toBeInTheDocument();
    expect(screen.getByText("Looks good!")).toBeInTheDocument();
    expect(screen.queryByText("added a file to")).toBeNull();
  });

  it("supports table selection and pagination controls", () => {
    render(<TeamMembersTableBlock />);

    const selectAll = screen.getByRole("checkbox", { name: "Select all team members" });
    const nextButton = screen.getByRole("button", { name: "Next" });
    const previousButton = screen.getByRole("button", { name: "Previous" });

    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(selectAll);

    expect(screen.getByRole("checkbox", { name: "Select Olivia Rhye" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Select Phoenix Baker" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Select Lana Steiner" })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Olivia Rhye" }));
    expect(selectAll).toHaveAttribute("data-state", "indeterminate");

    fireEvent.click(nextButton);

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(previousButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();
    expect(screen.queryByText("Olivia Rhye")).toBeNull();
    expect(screen.getByText("Candice Wu")).toBeInTheDocument();
  });
});
