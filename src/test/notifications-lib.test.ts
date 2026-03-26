import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function setAccessToken(sub: string): string {
  const token = buildUnsignedJwt({ sub });
  window.localStorage.setItem("pf_tokens", JSON.stringify({ accessToken: token }));
  return token;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function getRequestDetails(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url: new URL(String(url), window.location.origin),
    init,
    headers: (init.headers ?? {}) as Record<string, string>,
  };
}

describe("notifications API helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads notifications with actor profile and post title context from the Worker API", async () => {
    const token = setAccessToken("user-1");
    const createdAt = Math.floor(new Date("2026-02-11T10:00:00.000Z").getTime() / 1000);
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          id: "notif-1",
          user_id: "user-1",
          actor_id: "actor-1",
          type: "comment",
          post_id: "post-1",
          comment_id: "comment-1",
          read_at: null,
          created_at: createdAt,
          actor_display_name: "Alice",
          actor_avatar_url: "https://example.com/alice.png",
          post_title: "Post title",
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

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
    expect(notifications[0]?.createdAt).toBe(new Date("2026-02-11T10:00:00.000Z").getTime());

    const { url, headers } = getRequestDetails(fetchMock);
    expect(url.pathname).toBe("/api/notifications");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("offset")).toBe("0");
    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("returns unread notification count for current user", async () => {
    const token = setAccessToken("user-1");
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ count: 7 }));
    vi.stubGlobal("fetch", fetchMock);

    const { getUnreadCount } = await import("@/lib/notifications");
    await expect(getUnreadCount()).resolves.toBe(7);

    const { url, headers } = getRequestDetails(fetchMock);
    expect(url.pathname).toBe("/api/notifications/unread-count");
    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("marks all unread notifications as read and returns affected row count", async () => {
    const token = setAccessToken("user-1");
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ changed: 2 }));
    vi.stubGlobal("fetch", fetchMock);

    const { markAllAsRead } = await import("@/lib/notifications");
    await expect(markAllAsRead()).resolves.toBe(2);

    const { url, init, headers } = getRequestDetails(fetchMock);
    expect(url.pathname).toBe("/api/notifications/read-all");
    expect(init.method).toBe("POST");
    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });
});
