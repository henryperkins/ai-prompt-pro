import { describe, expect, it, vi } from "vitest";
import {
  createAuthService,
  resolveAuthConfig,
} from "../../agent_service/auth.mjs";

function createRequest(headers: Record<string, string>) {
  return { headers };
}

describe("agent service auth hardening", () => {
  it("prefers Neon auth validation keys over FUNCTION_PUBLIC_API_KEY", () => {
    const authConfig = resolveAuthConfig({
      FUNCTION_PUBLIC_API_KEY: "public-key",
      NEON_PUBLISHABLE_KEY: "neon-publishable",
    });

    expect(authConfig.authValidationApiKey).toBe("neon-publishable");
    expect(authConfig.authValidationApiKeySource).toBe("NEON_PUBLISHABLE_KEY");
  });

  it("prefers explicit NEON_AUTH_API_KEY when provided", () => {
    const authConfig = resolveAuthConfig({
      FUNCTION_PUBLIC_API_KEY: "public-key",
      NEON_PUBLISHABLE_KEY: "neon-publishable",
      NEON_AUTH_API_KEY: "neon-auth-key",
    });

    expect(authConfig.authValidationApiKey).toBe("neon-auth-key");
    expect(authConfig.authValidationApiKeySource).toBe("NEON_AUTH_API_KEY");
  });

  it("does not downgrade bearer requests to public-key auth when auth config is missing", async () => {
    const authService = createAuthService({
      env: {
        FUNCTION_PUBLIC_API_KEY: "public-key",
      },
      authConfig: resolveAuthConfig({
        FUNCTION_PUBLIC_API_KEY: "public-key",
      }),
      strictPublicApiKey: true,
      serviceToken: undefined,
      getClientIp: () => "203.0.113.10",
      fetchImpl: vi.fn(),
      logEvent: vi.fn(),
    });

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer opaque-session-token",
        apikey: "public-key",
      }),
      {},
      { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toContain("Neon auth is not configured");
    }
  });

  it("accepts explicit public-key auth only when no bearer token is present", async () => {
    const authService = createAuthService({
      env: {
        FUNCTION_PUBLIC_API_KEY: "public-key",
      },
      authConfig: resolveAuthConfig({
        FUNCTION_PUBLIC_API_KEY: "public-key",
      }),
      strictPublicApiKey: true,
      serviceToken: undefined,
      getClientIp: () => "203.0.113.10",
      fetchImpl: vi.fn(),
      logEvent: vi.fn(),
    });

    const result = await authService.authenticateRequestContext(
      createRequest({
        apikey: "public-key",
      }),
      {},
      { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
    );

    expect(result).toMatchObject({
      ok: true,
      authMode: "public_key",
      rateKey: "public:203.0.113.10",
    });
  });

  it("passes configured audience into JWT verification", async () => {
    const createRemoteJwkSetImpl = vi.fn(() => Symbol("jwks"));
    const jwtVerifyImpl = vi.fn().mockResolvedValue({
      payload: { sub: "user-123" },
    });
    const authService = createAuthService({
      env: {
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
        NEON_AUTH_AUDIENCE: "promptforge-web",
      },
      authConfig: resolveAuthConfig({
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
        NEON_AUTH_AUDIENCE: "promptforge-web",
      }),
      strictPublicApiKey: true,
      serviceToken: undefined,
      getClientIp: () => "203.0.113.10",
      fetchImpl: vi.fn(),
      logEvent: vi.fn(),
      createRemoteJWKSetImpl: createRemoteJwkSetImpl,
      jwtVerifyImpl,
    });

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer header.payload.signature",
      }),
      {},
      { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
    );

    expect(result).toMatchObject({
      ok: true,
      userId: "user-123",
      authMode: "user_jwt",
    });
    expect(jwtVerifyImpl).toHaveBeenCalledWith(
      "header.payload.signature",
      expect.anything(),
      expect.objectContaining({
        audience: "promptforge-web",
      }),
    );
  });
});
