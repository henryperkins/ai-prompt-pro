import { describe, expect, it, vi } from "vitest";
import { createServiceAuth } from "@/lib/service-auth";

function createAuthClient(overrides: {
  getSession?: () => Promise<{
    data: { session: { access_token?: string; expires_at?: number | null } | null };
    error: unknown;
  }>;
  refreshSession?: () => Promise<{
    data: { session: { access_token?: string; expires_at?: number | null } | null };
    error: unknown;
  }>;
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

    expect(authClient.refreshSession).toHaveBeenCalledTimes(1);

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
    expect(authClient.refreshSession).toHaveBeenCalledTimes(1);
  });
});
