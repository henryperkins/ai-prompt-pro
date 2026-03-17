import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertBackendConfigured: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/backend-config", () => ({
  assertBackendConfigured: (...args: unknown[]) => mocks.assertBackendConfigured(...args),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    auth: {
      getUser: (...args: unknown[]) => mocks.getUser(...args),
    },
  },
}));

describe("requireUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
        },
      },
      error: null,
    });
  });

  it("returns the authenticated user id", async () => {
    const { requireUserId } = await import("@/lib/require-user-id");

    await expect(requireUserId("Community prompts")).resolves.toBe("user-1");
  });

  it("passes the feature label into the backend assertion", async () => {
    const { requireUserId } = await import("@/lib/require-user-id");

    await requireUserId("Community moderation");

    expect(mocks.assertBackendConfigured).toHaveBeenCalledWith("Community moderation");
  });

  it("surfaces auth error messages from neon.auth.getUser()", async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: {
        message: "Session expired.",
      },
    });
    const { requireUserId } = await import("@/lib/require-user-id");

    await expect(requireUserId("Notifications")).rejects.toThrow("Session expired.");
  });

  it("throws when the authenticated user id is missing", async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    });
    const { requireUserId } = await import("@/lib/require-user-id");

    await expect(requireUserId("Community prompts")).rejects.toThrow("Sign in required.");
  });

  it("uses the default feature label for account actions", async () => {
    const { requireUserId } = await import("@/lib/require-user-id");

    await requireUserId();

    expect(mocks.assertBackendConfigured).toHaveBeenCalledWith("Account actions");
  });
});
