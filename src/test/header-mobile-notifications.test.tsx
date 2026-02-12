import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type { Notification } from "@/lib/notifications";

const mocks = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  signOut: vi.fn(),
  updateDisplayName: vi.fn(),
  refreshNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    signOut: mocks.signOut,
    updateDisplayName: mocks.updateDisplayName,
  }),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [
      {
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
        postTitle: "Useful post",
      } satisfies Notification,
    ],
    unreadCount: 1,
    loading: false,
    refresh: mocks.refreshNotifications,
    markAsRead: mocks.markNotificationAsRead,
    markAllAsRead: mocks.markAllNotificationsAsRead,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/AuthDialog", () => ({
  AuthDialog: () => null,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    onClick,
    ...props
  }: {
    children: ReactNode;
    onSelect?: (event: Event) => void;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        onSelect?.({ preventDefault() {} } as unknown as Event);
      }}
      {...props}
    >
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <div role="separator" />,
  DropdownMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children, ...props }: { children: ReactNode }) => (
    <button type="button" {...props}>{children}</button>
  ),
  DropdownMenuSubContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/NotificationPanel", () => ({
  NotificationPanel: () => <div data-testid="notification-panel">Notification panel</div>,
}));

vi.mock("@/lib/gravatar", () => ({
  getGravatarUrl: vi.fn().mockResolvedValue(null),
}));

async function renderHeader(flagEnabled = true) {
  vi.resetModules();
  vi.stubEnv("VITE_COMMUNITY_MOBILE_ENHANCEMENTS", flagEnabled ? "true" : "false");

  const { Header } = await import("@/components/Header");

  render(
    <MemoryRouter>
      <Header isDark={false} onToggleTheme={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("Header mobile notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: "user-1",
      email: "user@example.com",
      user_metadata: { display_name: "Prompt User" },
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("opens mobile notifications drawer with one tap when the flag is enabled", async () => {
    await renderHeader(true);

    fireEvent.click(screen.getByTestId("mobile-notifications-trigger"));

    expect(mocks.refreshNotifications).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId("mobile-notifications-sheet")).toBeVisible();
    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
  });

  it("keeps notifications reachable from the utilities menu when the flag is disabled", async () => {
    await renderHeader(false);

    expect(screen.queryByTestId("mobile-notifications-trigger")).toBeNull();
    expect(screen.queryByTestId("mobile-notifications-sheet")).toBeNull();

    const menuItem = screen.getByTestId("mobile-notifications-menu-item");
    expect(menuItem).toBeInTheDocument();
    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
  });
});
