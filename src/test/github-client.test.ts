import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    auth: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
      refreshSession: (...args: unknown[]) => mocks.refreshSession(...args),
      signOut: (...args: unknown[]) => mocks.signOut(...args),
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
    mocks.getSession.mockImplementation(async (options?: { forceFetch?: boolean }) => ({
      data: {
        session: options?.forceFetch
          ? {
            access_token: "fresh-user-session-token",
            expires_at: nowSeconds + 3600,
          }
          : {
            access_token: "stale-user-session-token",
            expires_at: nowSeconds + 3600,
          },
      },
      error: null,
    }));
    mocks.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });

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

    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).toHaveBeenCalledWith({ forceFetch: true });
    expect(headers.Authorization).toBe("Bearer fresh-user-session-token");
    expect(headers.apikey).toBeUndefined();
  });

  it("revalidates the GitHub session before the first protected request", async () => {
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
    mocks.signOut.mockResolvedValue({ error: null });

    const fetchMock = vi.fn().mockResolvedValueOnce(
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).toHaveBeenCalledWith({ forceFetch: true });

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;

    expect(firstHeaders.Authorization).toBe("Bearer refreshed-token");
    expect(firstHeaders.apikey).toBeUndefined();
  });

  it("fails closed when forced GitHub session revalidation returns no session, even if a cached token exists", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    mocks.getSession.mockImplementation(async (options?: { forceFetch?: boolean }) => ({
      data: {
        session: options?.forceFetch
          ? null
          : {
            access_token: "cached-user-session-token",
            expires_at: nowSeconds + 3600,
          },
      },
      error: null,
    }));
    mocks.signOut.mockResolvedValue({ error: null });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ installations: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listGitHubInstallations } = await import("@/lib/github-client");
    await expect(listGitHubInstallations()).rejects.toMatchObject({
      code: "auth_required",
      message: "Sign in required.",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).toHaveBeenCalledWith({ forceFetch: true });
  });

  it("fails locally before fetch when revalidation cannot recover a user session", async () => {
    mocks.getSession.mockImplementation(async (options?: { forceFetch?: boolean }) => ({
      data: {
        session: null,
      },
      error: null,
    }));
    mocks.signOut.mockResolvedValue({ error: null });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getGitHubInstallUrl } = await import("@/lib/github-client");

    await expect(getGitHubInstallUrl()).rejects.toMatchObject({
      code: "auth_required",
      message: "Sign in required.",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).toHaveBeenCalledWith({ forceFetch: true });
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
    mocks.signOut.mockResolvedValue({ error: null });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { listGitHubInstallations } = await import("@/lib/github-client");

    await expect(listGitHubInstallations()).rejects.toMatchObject({
      code: "auth_required",
      message: "Sign in required.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hard-invalidates the local session when a fresh protected request still returns 401", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "fresh-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid or expired auth session." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getGitHubInstallUrl } = await import("@/lib/github-client");

    await expect(getGitHubInstallUrl()).rejects.toMatchObject({
      code: "auth_session_invalid",
      message: "Invalid or expired auth session.",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).toHaveBeenCalledWith({ forceFetch: true });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});
