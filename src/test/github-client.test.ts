import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    auth: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
      refreshSession: (...args: unknown[]) => mocks.refreshSession(...args),
    },
  },
}));

describe("github-client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_AGENT_SERVICE_URL", "https://agent.test");
    vi.stubEnv("VITE_NEON_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the signed-in user JWT for GitHub requests without publishable-key fallback", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "user-session-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });
    mocks.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ installations: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listGitHubInstallations } = await import("@/lib/github-client");
    await listGitHubInstallations();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://agent.test/github/installations");

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;

    expect(headers.Authorization).toBe("Bearer user-session-token");
    expect(headers.apikey).toBeUndefined();
  });

  it("fails closed when no signed-in user session exists", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { listGitHubInstallations } = await import("@/lib/github-client");

    await expect(listGitHubInstallations()).rejects.toMatchObject({
      code: "auth_required",
      message: "Sign in required.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
