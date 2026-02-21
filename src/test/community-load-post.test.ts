import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    from: fromMock,
    auth: {
      getUser: vi.fn(),
    },
  },
}));

interface MaybeSingleResult {
  data: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
}

function mockLoadPostQuery(result: MaybeSingleResult) {
  fromMock.mockReturnValueOnce({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  });
}

describe("community.loadPost", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("maps invalid UUID database errors to a user-safe message", async () => {
    const { loadPost } = await import("@/lib/community");

    mockLoadPostQuery({
      data: null,
      error: {
        code: "22P02",
        message: 'invalid input syntax for type uuid: "not-a-uuid"',
      },
    });

    await expect(loadPost("not-a-uuid")).rejects.toThrow("This link is invalid or expired.");
  });

  it("returns null when no public post matches the id", async () => {
    const { loadPost } = await import("@/lib/community");

    mockLoadPostQuery({
      data: null,
      error: null,
    });

    await expect(loadPost("00000000-0000-0000-0000-000000000000")).resolves.toBeNull();
  });

  it("falls back when rating columns are missing in the database schema", async () => {
    const { loadPost } = await import("@/lib/community");

    fromMock.mockImplementation(() => ({
      select: (selectColumns: string) => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (selectColumns.includes("rating_count")) {
                return {
                  data: null,
                  error: {
                    code: "42703",
                    message: 'column community_posts.rating_count does not exist',
                  },
                };
              }

              return {
                data: {
                  id: "00000000-0000-0000-0000-000000000001",
                  saved_prompt_id: "00000000-0000-0000-0000-000000000010",
                  author_id: "00000000-0000-0000-0000-000000000011",
                  title: "Legacy schema post",
                  enhanced_prompt: "Prompt",
                  description: "Description",
                  use_case: "Use case",
                  category: "general",
                  tags: ["legacy"],
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
                  comment_count: 0,
                  created_at: "2026-02-21T00:00:00.000Z",
                  updated_at: "2026-02-21T00:00:00.000Z",
                },
                error: null,
              };
            },
          }),
        }),
      }),
    }));

    const post = await loadPost("00000000-0000-0000-0000-000000000001");
    expect(post?.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(post?.ratingCount).toBe(0);
    expect(post?.ratingAverage).toBe(0);
    expect(fromMock).toHaveBeenCalledTimes(2);
  });
});
