import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "@/lib/notifications";

const mocks = vi.hoisted(() => ({
  user: { current: { id: "user-1", is_anonymous: false } as { id: string; is_anonymous?: boolean } | null },
  loadNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  removeChannel: vi.fn(),
  insertHandler: null as ((payload: unknown) => void) | null,
  updateHandler: null as ((payload: unknown) => void) | null,
  channelInstance: null as Record<string, unknown> | null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user.current,
  }),
}));

vi.mock("@/lib/notifications", () => ({
  loadNotifications: (...args: unknown[]) => mocks.loadNotifications(...args),
  getUnreadCount: (...args: unknown[]) => mocks.getUnreadCount(...args),
  markAsRead: (...args: unknown[]) => mocks.markAsRead(...args),
  markAllAsRead: (...args: unknown[]) => mocks.markAllAsRead(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn((_kind: string, filter: { event?: string }, callback: (payload: unknown) => void) => {
          if (filter.event === "INSERT") mocks.insertHandler = callback;
          if (filter.event === "UPDATE") mocks.updateHandler = callback;
          return channel;
        }),
        subscribe: vi.fn(() => channel),
      };
      mocks.channelInstance = channel;
      return channel;
    }),
    removeChannel: (...args: unknown[]) => mocks.removeChannel(...args),
  },
}));

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
    postTitle: "Post title",
    ...overrides,
  };
}

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.current = { id: "user-1", is_anonymous: false };
    mocks.insertHandler = null;
    mocks.updateHandler = null;
    mocks.channelInstance = null;
  });

  it("loads initial notifications and refreshes on realtime insert", async () => {
    const first = [buildNotification()];
    const second = [buildNotification(), buildNotification({ id: "notif-2" })];

    mocks.loadNotifications
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    mocks.getUnreadCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const { useNotifications } = await import("@/hooks/useNotifications");
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.unreadCount).toBe(1);
    });

    await act(async () => {
      mocks.insertHandler?.({});
    });

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.unreadCount).toBe(2);
    });
  });

  it("marks a single notification as read and updates local unread count", async () => {
    mocks.loadNotifications.mockResolvedValue([buildNotification()]);
    mocks.getUnreadCount.mockResolvedValue(1);
    mocks.markAsRead.mockResolvedValue(true);

    const { useNotifications } = await import("@/hooks/useNotifications");
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });

    await act(async () => {
      await result.current.markAsRead("notif-1");
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
    expect(result.current.notifications[0]?.readAt).not.toBeNull();
  });

  it("clears notifications state when user is signed out", async () => {
    mocks.loadNotifications.mockResolvedValue([buildNotification()]);
    mocks.getUnreadCount.mockResolvedValue(1);

    const { useNotifications } = await import("@/hooks/useNotifications");
    const { result, rerender } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.unreadCount).toBe(1);
    });

    mocks.user.current = null;
    rerender();

    await waitFor(() => {
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });
  });
});
