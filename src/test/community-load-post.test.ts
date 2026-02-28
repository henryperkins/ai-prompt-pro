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
  error: { code: string; message: string; details?: string | null; hint?: string | null } | null;
}

interface QueryResult {
  data: Record<string, unknown> | Record<string, unknown>[] | null;
  error: { code: string; message: string; details?: string | null; hint?: string | null } | null;
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

function buildLegacyCommunityPostRow() {
  return {
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
  } satisfies Record<string, unknown>;
}

function createAwaitableQueryBuilder(result: QueryResult) {
  const builder = Promise.resolve(result) as Promise<QueryResult> &
    Record<string, (...args: unknown[]) => unknown> & {
      maybeSingle: () => Promise<QueryResult>;
      single: () => Promise<QueryResult>;
    };
  const chain = () => builder;
  builder.eq = chain;
  builder.in = chain;
  builder.or = chain;
  builder.lt = chain;
  builder.limit = chain;
  builder.range = chain;
  builder.order = chain;
  builder.maybeSingle = async () => result;
  builder.single = async () => result;
  return builder;
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
                data: buildLegacyCommunityPostRow(),
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

  it("falls back for feed queries when rating columns are missing", async () => {
    const { loadFeed } = await import("@/lib/community");
    const selectCalls: string[] = [];

    fromMock.mockImplementation(() => ({
      select: (selectColumns: string) => {
        selectCalls.push(selectColumns);
        if (selectColumns.includes("rating_count")) {
          return createAwaitableQueryBuilder({
            data: null,
            error: {
              code: "42703",
              message: 'column community_posts.rating_count does not exist',
            },
          });
        }
        return createAwaitableQueryBuilder({
          data: [buildLegacyCommunityPostRow()],
          error: null,
        });
      },
    }));

    const posts = await loadFeed({ limit: 1 });
    expect(posts).toHaveLength(1);
    expect(posts[0]?.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(posts[0]?.ratingCount).toBe(0);
    expect(posts[0]?.ratingAverage).toBe(0);
    expect(selectCalls).toHaveLength(2);
  });

  it("does not retry unrelated missing-column errors", async () => {
    const { loadPost } = await import("@/lib/community");

    mockLoadPostQuery({
      data: null,
      error: {
        code: "42703",
        message: 'column community_posts.unrelated_column does not exist',
      },
    });

    await expect(loadPost("00000000-0000-0000-0000-000000000001")).rejects.toThrow(
      "Failed to load community post.",
    );
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
