import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { NotificationPanel } from "@/components/NotificationPanel";
import type { Notification } from "@/lib/notifications";

function buildNotification(overrides?: Partial<Notification>): Notification {
  return {
    id: "notif-1",
    userId: "user-1",
    actorId: "actor-1",
    type: "comment",
    postId: "post-1",
    commentId: "comment-1",
    readAt: null,
    createdAt: Date.now(),
    actorDisplayName: "Alice",
    actorAvatarUrl: null,
    postTitle: "Helpful post",
    ...overrides,
  };
}

describe("NotificationPanel", () => {
  it("renders notifications and marks an item as read when opened", () => {
    const onMarkAsRead = vi.fn();
    const onMarkAllAsRead = vi.fn();

    render(
      <MemoryRouter>
        <NotificationPanel
          notifications={[buildNotification()]}
          unreadCount={1}
          loading={false}
          onMarkAsRead={onMarkAsRead}
          onMarkAllAsRead={onMarkAllAsRead}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Helpful post")).toBeInTheDocument();

    const itemLink = screen.getByRole("link");
    expect(itemLink.className).toContain("focus-visible:ring-2");
    expect(itemLink.className).toContain("focus-visible:ring-ring");
    expect(itemLink.className).toContain("focus-visible:ring-offset-2");

    fireEvent.click(itemLink);
    expect(onMarkAsRead).toHaveBeenCalledWith("notif-1");
  });

  it("shows empty state and disables mark-all action when there are no unread items", () => {
    render(
      <MemoryRouter>
        <NotificationPanel
          notifications={[]}
          unreadCount={0}
          loading={false}
          onMarkAsRead={vi.fn()}
          onMarkAllAsRead={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    expect(screen.getByText("You'll be notified when others interact with your prompts.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  });
});
