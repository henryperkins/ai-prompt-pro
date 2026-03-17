import { describe, expect, it, vi } from "vitest";
import {
  createAuthService,
  resolveAuthConfig,
} from "../../agent_service/auth.mjs";

function createRequest(headers: Record<string, string>) {
  return { headers };
}

function createAuthServiceOptions(overrides: Record<string, unknown> = {}) {
  return {
    env: {},
    authConfig: resolveAuthConfig({}),
    strictPublicApiKey: true,
    serviceToken: undefined,
    getClientIp: () => "203.0.113.10",
    fetchImpl: vi.fn(),
    logEvent: vi.fn(),
    ...overrides,
  };
}

function createJwt(claims: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `header.${encoded}.signature`;
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

  it("returns a controlled auth failure when NEON_JWKS_URL is malformed", async () => {
    const logEvent = vi.fn();
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        NEON_JWKS_URL: "not a url",
      },
      authConfig: resolveAuthConfig({
        NEON_JWKS_URL: "not a url",
      }),
      logEvent,
    }));

    await expect(authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer header.payload.signature",
      }),
      {},
      { allowPublicKey: false, allowServiceToken: false, allowUserJwt: true },
    )).resolves.toMatchObject({
      ok: false,
      status: 503,
      error: "Authentication service is unavailable because Neon auth is not configured.",
    });

    expect(logEvent).toHaveBeenCalledWith(
      "error",
      "auth_config_warning",
      expect.objectContaining({
        error_code: "auth_config_invalid",
      }),
    );
  });

  it("falls back to Neon auth API when NEON_JWKS_URL is malformed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "user-auth-api", is_anonymous: false }),
    });
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        NEON_JWKS_URL: "not a url",
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      },
      authConfig: resolveAuthConfig({
        NEON_JWKS_URL: "not a url",
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      }),
      fetchImpl,
    }));

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer header.payload.signature",
      }),
      {},
      { allowPublicKey: false, allowServiceToken: false, allowUserJwt: true },
    );

    expect(result).toMatchObject({
      ok: true,
      userId: "user-auth-api",
      isAnonymous: false,
      authMode: "user_session",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project.neon.tech/neondb/auth/v1/user",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer header.payload.signature",
          apikey: "neon-auth-key",
        },
      }),
    );
  });

  it("requires active session revalidation for routes that opt in", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "user-123", is_anonymous: false }),
    });
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      },
      authConfig: resolveAuthConfig({
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      }),
      fetchImpl,
      createRemoteJWKSetImpl: vi.fn(() => Symbol("jwks")),
      jwtVerifyImpl: vi.fn().mockResolvedValue({
        payload: { sub: "user-123" },
      }),
    }));

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer header.payload.signature",
      }),
      {},
      {
        allowPublicKey: false,
        allowServiceToken: false,
        allowUserJwt: true,
        requireActiveSession: true,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      userId: "user-123",
      isAnonymous: false,
      authMode: "user_session",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project.neon.tech/neondb/auth/v1/user",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer header.payload.signature",
          apikey: "neon-auth-key",
        },
      }),
    );
  });

  it("rejects active-session routes when the verified JWT user does not match the live Neon session", async () => {
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      },
      authConfig: resolveAuthConfig({
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      }),
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "different-user", is_anonymous: false }),
      }),
      createRemoteJWKSetImpl: vi.fn(() => Symbol("jwks")),
      jwtVerifyImpl: vi.fn().mockResolvedValue({
        payload: { sub: "user-123" },
      }),
    }));

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer header.payload.signature",
      }),
      {},
      {
        allowPublicKey: false,
        allowServiceToken: false,
        allowUserJwt: true,
        requireActiveSession: true,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 401,
      error: "Invalid or expired auth session.",
    });
  });

  it("fails closed when active-session routes cannot revalidate the live Neon session", async () => {
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      },
      authConfig: resolveAuthConfig({
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      }),
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: "upstream unavailable" }),
      }),
      createRemoteJWKSetImpl: vi.fn(() => Symbol("jwks")),
      jwtVerifyImpl: vi.fn().mockResolvedValue({
        payload: { sub: "user-123" },
      }),
    }));

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer header.payload.signature",
      }),
      {},
      {
        allowPublicKey: false,
        allowServiceToken: false,
        allowUserJwt: true,
        requireActiveSession: true,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 503,
      error: "Authentication service is temporarily unavailable. Please try again.",
    });
  });

  it("accepts public-key auth when JWT auth is disabled for the route", async () => {
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        FUNCTION_PUBLIC_API_KEY: "public-key",
      },
      authConfig: resolveAuthConfig({
        FUNCTION_PUBLIC_API_KEY: "public-key",
      }),
    }));

    const result = await authService.authenticateRequestContext(
      createRequest({
        apikey: "public-key",
      }),
      {},
      { allowPublicKey: true, allowServiceToken: false, allowUserJwt: false },
    );

    expect(result).toMatchObject({
      ok: true,
      authMode: "public_key",
      isAnonymous: true,
      minuteRateKey: "public:203.0.113.10",
      dayRateKey: "public:203.0.113.10",
    });
  });

  it("still rejects bearer auth when JWT auth is disabled even if a public key is present", async () => {
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        FUNCTION_PUBLIC_API_KEY: "public-key",
      },
      authConfig: resolveAuthConfig({
        FUNCTION_PUBLIC_API_KEY: "public-key",
      }),
    }));

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer header.payload.signature",
        apikey: "public-key",
      }),
      {},
      { allowPublicKey: true, allowServiceToken: false, allowUserJwt: false },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 401,
      error: "Sign in required.",
    });
  });

  it("preserves anonymous semantics for verified JWT sessions", async () => {
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
      },
      authConfig: resolveAuthConfig({
        NEON_JWKS_URL: "https://auth.example.com/jwks.json",
      }),
      createRemoteJWKSetImpl: vi.fn(() => Symbol("jwks")),
      jwtVerifyImpl: vi.fn().mockResolvedValue({
        payload: {
          sub: "anon-user-123",
          role: "anon",
        },
      }),
    }));

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer header.payload.signature",
      }),
      {},
      { allowPublicKey: false, allowServiceToken: false, allowUserJwt: true },
    );

    expect(result).toMatchObject({
      ok: true,
      userId: "anon-user-123",
      isAnonymous: true,
      authMode: "user_jwt",
      minuteRateKey: "anon-user-123:203.0.113.10",
      dayRateKey: "anon-user-123:203.0.113.10",
    });
  });

  it("preserves anonymous semantics for Neon auth API sessions", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "anon-session-42", is_anonymous: true }),
    });
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      },
      authConfig: resolveAuthConfig({
        NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
        NEON_AUTH_API_KEY: "neon-auth-key",
      }),
      fetchImpl,
    }));

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: "Bearer opaque-session-token",
      }),
      {},
      { allowPublicKey: false, allowServiceToken: false, allowUserJwt: true },
    );

    expect(result).toMatchObject({
      ok: true,
      userId: "anon-session-42",
      isAnonymous: true,
      authMode: "user_session",
      minuteRateKey: "anon-session-42:203.0.113.10",
      dayRateKey: "anon-session-42:203.0.113.10",
    });
  });

  it("preserves anonymous semantics for unverified JWT fallback sessions", async () => {
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        ALLOW_UNVERIFIED_JWT_FALLBACK: "true",
      },
      authConfig: resolveAuthConfig({}),
    }));

    const result = await authService.authenticateRequestContext(
      createRequest({
        authorization: `Bearer ${createJwt({
          sub: "anon-fallback-7",
          role: "anon",
          exp: Math.floor(Date.now() / 1000) + 60,
        })}`,
      }),
      {},
      { allowPublicKey: false, allowServiceToken: false, allowUserJwt: true },
    );

    expect(result).toMatchObject({
      ok: true,
      userId: "anon-fallback-7",
      isAnonymous: true,
      authMode: "jwt_fallback",
      minuteRateKey: "anon-fallback-7:203.0.113.10",
      dayRateKey: "anon-fallback-7:203.0.113.10",
    });
  });

  it("does not report JWT validation as configured when the JWKS URL is malformed", () => {
    const authService = createAuthService(createAuthServiceOptions({
      env: {
        FUNCTION_PUBLIC_API_KEY: "public-key",
        NEON_JWKS_URL: "not a url",
      },
      authConfig: resolveAuthConfig({
        FUNCTION_PUBLIC_API_KEY: "public-key",
        NEON_JWKS_URL: "not a url",
      }),
    }));

    expect(authService.getReadiness()).toMatchObject({
      publicKeyEnabled: true,
      jwtValidationConfigured: false,
    });
    expect(authService.getReadiness().warnings).toContain("neon_jwks_url_invalid");
    expect(authService.getReadiness().warnings).toContain("user_auth_validation_unconfigured");
    expect(authService.getReadiness().authModes).toEqual(["public_key"]);
  });
});
