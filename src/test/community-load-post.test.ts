import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/neon/client", () => ({
  supabase: {
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
});
