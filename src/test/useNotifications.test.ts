import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Notification } from "@/lib/notifications";

const mocks = vi.hoisted(() => ({
  user: { current: { id: "user-1" } as { id: string } | null },
  visibilityState: "visible" as DocumentVisibilityState,
  loadNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));

const intervalCallbacks: Array<() => void> = [];

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

async function flushNotificationsWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.current = { id: "user-1" };
    mocks.visibilityState = "visible";
    intervalCallbacks.splice(0, intervalCallbacks.length);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => mocks.visibilityState,
    });
    vi.spyOn(globalThis, "setInterval").mockImplementation((fn: TimerHandler) => {
      intervalCallbacks.push(fn as () => void);
      return intervalCallbacks.length as unknown as ReturnType<typeof setInterval>;
    });
    vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads initial notifications and refreshes on polling interval", async () => {
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

    await flushNotificationsWork();
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);

    await act(async () => {
      intervalCallbacks[0]?.();
    });

    await flushNotificationsWork();
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
  });

  it("pauses polling while hidden and resumes with immediate refresh when visible", async () => {
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

    await flushNotificationsWork();
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);

    act(() => {
      mocks.visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      intervalCallbacks[0]?.();
      intervalCallbacks[0]?.();
      intervalCallbacks[0]?.();
    });

    expect(mocks.loadNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.getUnreadCount).toHaveBeenCalledTimes(1);

    act(() => {
      mocks.visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await flushNotificationsWork();
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
  });

  it("marks a single notification as read and updates local unread count", async () => {
    mocks.loadNotifications.mockResolvedValue([buildNotification()]);
    mocks.getUnreadCount.mockResolvedValue(1);
    mocks.markAsRead.mockResolvedValue(true);

    const { useNotifications } = await import("@/hooks/useNotifications");
    const { result } = renderHook(() => useNotifications());

    await flushNotificationsWork();
    expect(result.current.unreadCount).toBe(1);

    await act(async () => {
      await result.current.markAsRead("notif-1");
    });

    await flushNotificationsWork();
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0]?.readAt).not.toBeNull();
  });

  it("clears notifications state when user is signed out", async () => {
    mocks.loadNotifications.mockResolvedValue([buildNotification()]);
    mocks.getUnreadCount.mockResolvedValue(1);

    const { useNotifications } = await import("@/hooks/useNotifications");
    const { result, rerender } = renderHook(() => useNotifications());

    await flushNotificationsWork();
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);

    mocks.user.current = null;
    rerender();

    await flushNotificationsWork();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });
});
