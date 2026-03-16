import { describe, expect, it, vi } from "vitest";
import { createServiceAuth } from "@/lib/service-auth";

function createAuthClient(overrides: {
  getSession?: (options?: { forceFetch?: boolean }) => Promise<{
    data: { session: { access_token?: string; expires_at?: number | null } | null };
    error: unknown;
  }>;
  refreshSession?: () => Promise<{
    data: { session: { access_token?: string; expires_at?: number | null } | null };
    error: unknown;
  }>;
  signOut?: () => Promise<unknown>;
} = {}) {
  return {
    getSession: vi.fn(
      overrides.getSession
        || (async () => ({ data: { session: null }, error: null })),
    ),
    refreshSession: vi.fn(
      overrides.refreshSession
        || (async () => ({ data: { session: null }, error: null })),
    ),
    signOut: vi.fn(
      overrides.signOut
        || (async () => ({ error: null })),
    ),
  };
}

describe("service-auth", () => {
  it("keeps user JWT auth in strict mode when a session token exists", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const authClient = createAuthClient({
      getSession: async () => ({
        data: {
          session: {
            access_token: "user-session-token",
            expires_at: nowSeconds + 3600,
          },
        },
        error: null,
      }),
    });

    const serviceAuth = createServiceAuth({
      serviceUrl: "https://agent.test",
      publishableKey: "sb_publishable_test",
      authClient,
    });

    const headers = await serviceAuth.getHeaders({ allowPublicKeyFallback: false });

    expect(headers.Authorization).toBe("Bearer user-session-token");
    expect(headers.apikey).toBeUndefined();
  });

  it("fails closed in strict mode when no user session exists", async () => {
    const serviceAuth = createServiceAuth({
      serviceUrl: "https://agent.test",
      publishableKey: "sb_publishable_test",
      authClient: createAuthClient(),
    });

    await expect(
      serviceAuth.getHeaders({ allowPublicKeyFallback: false }),
    ).rejects.toThrow("Sign in required.");
  });

  it("does not silently downgrade retryable session read failures to publishable-key auth in strict mode", async () => {
    const serviceAuth = createServiceAuth({
      serviceUrl: "https://agent.test",
      publishableKey: "sb_publishable_test",
      authClient: createAuthClient({
        getSession: async () => {
          throw new Error("Failed to fetch");
        },
      }),
    });

    await expect(
      serviceAuth.getHeaders({ allowPublicKeyFallback: false }),
    ).rejects.toThrow("Could not read auth session: Failed to fetch");
  });

  it("does not reuse a cached session token when forced revalidation finds no session", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const authClient = createAuthClient({
      getSession: async (options?: { forceFetch?: boolean }) => ({
        data: {
          session: options?.forceFetch
            ? null
            : {
              access_token: "stale-token",
              expires_at: nowSeconds + 3600,
            },
        },
        error: null,
      }),
    });

    const serviceAuth = createServiceAuth({
      serviceUrl: "https://agent.test",
      publishableKey: "sb_publishable_test",
      authClient,
    });

    await expect(
      serviceAuth.getHeaders({
        forceRefresh: true,
        allowPublicKeyFallback: false,
      }),
    ).rejects.toThrow("Sign in required.");

    expect(authClient.getSession).toHaveBeenCalledTimes(1);
    expect(authClient.getSession).toHaveBeenCalledWith({ forceFetch: true });
  });

  it("can reuse a cached non-expiring session token after an empty forced revalidation when explicitly allowed", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const authClient = createAuthClient({
      getSession: async (options?: { forceFetch?: boolean }) => ({
        data: {
          session: options?.forceFetch
            ? null
            : {
              access_token: "cached-token",
              expires_at: nowSeconds + 3600,
            },
        },
        error: null,
      }),
    });

    const serviceAuth = createServiceAuth({
      serviceUrl: "https://agent.test",
      publishableKey: "sb_publishable_test",
      authClient,
    });

    await expect(
      serviceAuth.getHeaders({
        forceRefresh: true,
        allowPublicKeyFallback: false,
        allowCachedSessionFallbackOnForceRefresh: true,
      }),
    ).resolves.toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer cached-token",
    });

    expect(authClient.getSession).toHaveBeenCalledTimes(2);
    expect(authClient.getSession).toHaveBeenNthCalledWith(1, { forceFetch: true });
    expect(authClient.getSession).toHaveBeenNthCalledWith(2, undefined);
  });

  it("opens a soft publishable-key fallback window without signing the user out", async () => {
    const authClient = createAuthClient({
      getSession: async () => ({
        data: {
          session: {
            access_token: "user-session-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      }),
    });

    const serviceAuth = createServiceAuth({
      serviceUrl: "https://agent.test",
      publishableKey: "sb_publishable_test",
      authClient,
    });

    await serviceAuth.markSoftSessionFailure();

    await expect(serviceAuth.getHeaders()).resolves.toEqual({
      "Content-Type": "application/json",
      apikey: "sb_publishable_test",
    });
    expect(authClient.signOut).not.toHaveBeenCalled();
    expect(authClient.getSession).not.toHaveBeenCalled();
  });

  it("hard-invalidates the local session and opens the publishable-key fallback window", async () => {
    const authClient = createAuthClient({
      getSession: async () => ({
        data: {
          session: {
            access_token: "stale-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    });

    const serviceAuth = createServiceAuth({
      serviceUrl: "https://agent.test",
      publishableKey: "sb_publishable_test",
      authClient,
    });

    await serviceAuth.hardInvalidateSession();

    await expect(serviceAuth.getHeaders()).resolves.toEqual({
      "Content-Type": "application/json",
      apikey: "sb_publishable_test",
    });
    expect(authClient.signOut).toHaveBeenCalledTimes(1);
    expect(authClient.getSession).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent forced refresh attempts", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    let resolveRefresh:
      | ((value: {
        data: {
          session: { access_token?: string; expires_at?: number | null } | null;
        };
        error: unknown;
      }) => void)
      | null = null;

    const authClient = createAuthClient({
      getSession: (options?: { forceFetch?: boolean }) => {
        if (!options?.forceFetch) {
          return Promise.resolve({ data: { session: null }, error: null });
        }
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      },
      refreshSession: () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    });

    const serviceAuth = createServiceAuth({
      serviceUrl: "https://agent.test",
      authClient,
    });

    const firstHeadersPromise = serviceAuth.getHeaders({
      forceRefresh: true,
      allowSessionToken: false,
      allowPublicKeyFallback: false,
    });
    const secondHeadersPromise = serviceAuth.getHeaders({
      forceRefresh: true,
      allowSessionToken: false,
      allowPublicKeyFallback: false,
    });

    expect(authClient.getSession).toHaveBeenCalledTimes(1);
    expect(authClient.getSession).toHaveBeenCalledWith({ forceFetch: true });

    resolveRefresh?.({
      data: {
        session: {
          access_token: "refreshed-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    await expect(firstHeadersPromise).resolves.toMatchObject({
      Authorization: "Bearer refreshed-token",
    });
    await expect(secondHeadersPromise).resolves.toMatchObject({
      Authorization: "Bearer refreshed-token",
    });
    expect(authClient.getSession).toHaveBeenCalledTimes(1);
  });
});
