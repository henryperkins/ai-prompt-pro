import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  loadProfilesByIds: vi.fn(),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    auth: {
      getUser: (...args: unknown[]) => mocks.getUser(...args),
    },
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

vi.mock("@/lib/community", () => ({
  loadProfilesByIds: (...args: unknown[]) => mocks.loadProfilesByIds(...args),
}));

function mockAuthenticatedUser() {
  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: "user-1",
        is_anonymous: false,
      },
    },
    error: null,
  });
}

describe("notifications API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedUser();
  });

  it("loads notifications with actor profile and post title context", async () => {
    const createdAt = "2026-02-11T10:00:00.000Z";

    mocks.from.mockImplementation((table: string) => {
      if (table === "notifications") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                range: async () => ({
                  data: [
                    {
                      id: "notif-1",
                      user_id: "user-1",
                      actor_id: "actor-1",
                      type: "comment",
                      post_id: "post-1",
                      comment_id: "comment-1",
                      read_at: null,
                      created_at: createdAt,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "community_posts") {
        return {
          select: () => ({
            in: async () => ({
              data: [{ id: "post-1", title: "Post title" }],
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mocks.loadProfilesByIds.mockResolvedValue([
      {
        id: "actor-1",
        displayName: "Alice",
        avatarUrl: "https://example.com/alice.png",
      },
    ]);

    const { loadNotifications } = await import("@/lib/notifications");
    const notifications = await loadNotifications(20, 0);

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id: "notif-1",
      userId: "user-1",
      actorId: "actor-1",
      type: "comment",
      postId: "post-1",
      commentId: "comment-1",
      actorDisplayName: "Alice",
      actorAvatarUrl: "https://example.com/alice.png",
      postTitle: "Post title",
      readAt: null,
    });
    expect(notifications[0]?.createdAt).toBe(new Date(createdAt).getTime());
  });

  it("returns unread notification count for current user", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table !== "notifications") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            is: async () => ({
              count: 7,
              error: null,
            }),
          }),
        }),
      };
    });

    const { getUnreadCount } = await import("@/lib/notifications");
    await expect(getUnreadCount()).resolves.toBe(7);
  });

  it("marks all unread notifications as read and returns affected row count", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table !== "notifications") throw new Error(`Unexpected table: ${table}`);
      return {
        update: () => ({
          eq: () => ({
            is: () => ({
              select: async () => ({
                data: [{ id: "a" }, { id: "b" }],
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    const { markAllAsRead } = await import("@/lib/notifications");
    await expect(markAllAsRead()).resolves.toBe(2);
  });
});
