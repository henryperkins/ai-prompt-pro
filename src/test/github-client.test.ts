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

  it("retries the GitHub install flow with a refreshed session token after a stale-session 401", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    mocks.getSession.mockImplementation(async (options?: { forceFetch?: boolean }) => ({
      data: {
        session: options?.forceFetch
          ? {
            access_token: "refreshed-token",
            expires_at: nowSeconds + 3600,
          }
          : {
            access_token: "stale-token",
            expires_at: nowSeconds + 3600,
          },
      },
      error: null,
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid or expired auth session." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          installUrl: "https://github.com/apps/promptforge/installations/new",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { getGitHubInstallUrl } = await import("@/lib/github-client");
    await expect(getGitHubInstallUrl()).resolves.toBe(
      "https://github.com/apps/promptforge/installations/new",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.getSession).toHaveBeenCalledWith({ forceFetch: true });

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>;

    expect(firstHeaders.Authorization).toBe("Bearer stale-token");
    expect(firstHeaders.apikey).toBeUndefined();
    expect(secondHeaders.Authorization).toBe("Bearer refreshed-token");
    expect(secondHeaders.apikey).toBeUndefined();
  });

  it("does not retry GitHub requests with the same stale session token when refresh cannot recover", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    mocks.getSession.mockImplementation(async (options?: { forceFetch?: boolean }) => ({
      data: {
        session: options?.forceFetch
          ? null
          : {
            access_token: "stale-token",
            expires_at: nowSeconds + 3600,
          },
      },
      error: null,
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid or expired auth session." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { getGitHubInstallUrl } = await import("@/lib/github-client");

    await expect(getGitHubInstallUrl()).rejects.toMatchObject({
      code: "auth_required",
      message: "Sign in required.",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).toHaveBeenCalledWith({ forceFetch: true });

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(firstHeaders.Authorization).toBe("Bearer stale-token");
    expect(firstHeaders.apikey).toBeUndefined();
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
