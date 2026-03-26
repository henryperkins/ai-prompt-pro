import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function getRequestDetails(fetchMock: ReturnType<typeof vi.fn>) {
  const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
  return new URL(String(url), window.location.origin);
}

function buildWorkerCommunityPostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    saved_prompt_id: "00000000-0000-0000-0000-000000000010",
    author_id: "00000000-0000-0000-0000-000000000011",
    title: "Worker schema post",
    enhanced_prompt: "Prompt",
    description: "Description",
    use_case: "Use case",
    category: "general",
    tags: ["worker"],
    target_model: "gpt-5",
    is_public: true,
    public_config: {},
    starter_prompt: "Starter",
    remixed_from: null,
    remix_note: "",
    remix_diff: null,
    upvote_count: 1,
    verified_count: 0,
    remix_count: 0,
    comment_count: 2,
    rating_count: 3,
    rating_avg: 4.67,
    created_at: Math.floor(new Date("2026-02-21T00:00:00.000Z").getTime() / 1000),
    updated_at: Math.floor(new Date("2026-02-21T00:05:00.000Z").getTime() / 1000),
    ...overrides,
  };
}

describe("community.loadPost", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects invalid post ids before issuing a network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { loadPost } = await import("@/lib/community");

    await expect(loadPost("not-a-uuid")).rejects.toThrow("This link is invalid or expired.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when no public post matches the id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const { loadPost } = await import("@/lib/community");

    await expect(loadPost("00000000-0000-0000-0000-000000000000")).resolves.toBeNull();

    const url = getRequestDetails(fetchMock);
    expect(url.pathname).toBe("/api/community/00000000-0000-0000-0000-000000000000");
  });

  it("maps Worker community post responses including ratings", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(buildWorkerCommunityPostRow()));
    vi.stubGlobal("fetch", fetchMock);

    const { loadPost } = await import("@/lib/community");
    const post = await loadPost("00000000-0000-0000-0000-000000000001");

    expect(post).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      savedPromptId: "00000000-0000-0000-0000-000000000010",
      authorId: "00000000-0000-0000-0000-000000000011",
      title: "Worker schema post",
      tags: ["worker"],
      ratingCount: 3,
      ratingAverage: 4.67,
      commentCount: 2,
    });
    expect(post?.createdAt).toBe(new Date("2026-02-21T00:00:00.000Z").getTime());
    expect(post?.updatedAt).toBe(new Date("2026-02-21T00:05:00.000Z").getTime());
  });

  it("maps feed responses and forwards Worker query params", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        posts: [buildWorkerCommunityPostRow()],
        next_cursor: "2026-02-21T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { loadFeed } = await import("@/lib/community");
    const posts = await loadFeed({
      sort: "popular",
      category: "general",
      tag: "Worker",
      search: "ratings",
      page: 2,
      limit: 1,
    });

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      ratingCount: 3,
      ratingAverage: 4.67,
    });

    const url = getRequestDetails(fetchMock);
    expect(url.pathname).toBe("/api/community");
    expect(url.searchParams.get("sort")).toBe("popular");
    expect(url.searchParams.get("category")).toBe("general");
    expect(url.searchParams.get("tag")).toBe("worker");
    expect(url.searchParams.get("search")).toBe("ratings");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("surfaces Worker API errors for non-404 load failures", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ error: "Database offline" }, { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { loadPost } = await import("@/lib/community");

    await expect(loadPost("00000000-0000-0000-0000-000000000001")).rejects.toThrow("Database offline");
  });
});
