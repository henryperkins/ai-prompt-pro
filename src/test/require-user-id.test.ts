import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertBackendConfigured: vi.fn(),
}));

vi.mock("@/lib/backend-config", () => ({
  assertBackendConfigured: (...args: unknown[]) => mocks.assertBackendConfigured(...args),
}));

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function setAccessToken(payload?: Record<string, unknown>): string | null {
  if (!payload) {
    window.localStorage.removeItem("pf_tokens");
    return null;
  }

  const token = buildUnsignedJwt(payload);
  window.localStorage.setItem("pf_tokens", JSON.stringify({ accessToken: token }));
  return token;
}

describe("requireUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setAccessToken({ sub: "user-1" });
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

  it("throws when there is no signed-in user token", async () => {
    window.localStorage.clear();

    const { requireUserId } = await import("@/lib/require-user-id");

    await expect(requireUserId("Notifications")).rejects.toThrow("Sign in required.");
  });

  it("throws when the stored token payload does not contain a user id", async () => {
    setAccessToken({ role: "authenticated" });

    const { requireUserId } = await import("@/lib/require-user-id");

    await expect(requireUserId("Community prompts")).rejects.toThrow("Sign in required.");
  });

  it("uses the default feature label for account actions", async () => {
    const { requireUserId } = await import("@/lib/require-user-id");

    await requireUserId();

    expect(mocks.assertBackendConfigured).toHaveBeenCalledWith("Account actions");
  });
});
