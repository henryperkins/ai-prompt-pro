import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuthenticatedUser } from "../../archive/supabase/functions/_shared/security";

type DenoEnvMap = Record<string, string | undefined>;

declare global {
  // Minimal Deno surface needed by the auth helper during tests.
  var Deno: { env: { get: (key: string) => string | undefined } };
}

function stubDenoEnv(values: DenoEnvMap) {
  const get = vi.fn((key: string) => values[key]);
  vi.stubGlobal("Deno", { env: { get } });
  return get;
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe("requireAuthenticatedUser", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts authenticated bearer tokens via Neon Auth", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
      NEON_PUBLISHABLE_KEY: "anon-key",
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "user-1", is_anonymous: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { authorization: "Bearer token123" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "user-1", isAnonymous: false });
    expect(fetchMock).toHaveBeenCalledWith("https://project.neon.tech/neondb/auth/v1/user", {
      headers: {
        Authorization: "Bearer token123",
        apikey: "anon-key",
      },
    });
  });

  it("rejects invalid bearer tokens", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
      NEON_PUBLISHABLE_KEY: "anon-key",
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { authorization: "Bearer badtoken" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("Invalid or expired auth session.");
    }
  });

  it("returns 503 when bearer auth is enabled but Neon env vars are missing", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: undefined,
      NEON_PUBLISHABLE_KEY: undefined,
      ALLOW_UNVERIFIED_JWT_FALLBACK: undefined,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { authorization: "Bearer some-session-token" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Authentication service is unavailable because Neon auth is not configured.");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("supports optional decoded-JWT fallback when Neon auth config is missing", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: undefined,
      NEON_PUBLISHABLE_KEY: undefined,
      ALLOW_UNVERIFIED_JWT_FALLBACK: "true",
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const token = buildUnsignedJwt({
      sub: "user-local-dev",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new Request("http://example.test", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "user-local-dev", isAnonymous: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks decoded-JWT fallback in production unless explicitly overridden", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: undefined,
      NEON_PUBLISHABLE_KEY: undefined,
      ALLOW_UNVERIFIED_JWT_FALLBACK: "true",
      ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION: undefined,
      NODE_ENV: "production",
    });

    const token = buildUnsignedJwt({
      sub: "user-prod",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new Request("http://example.test", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Authentication service is unavailable because Neon auth is not configured.");
    }
  });

  it("allows decoded-JWT fallback in production only with explicit override", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: undefined,
      NEON_PUBLISHABLE_KEY: undefined,
      ALLOW_UNVERIFIED_JWT_FALLBACK: "true",
      ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION: "true",
      NODE_ENV: "production",
    });

    const token = buildUnsignedJwt({
      sub: "user-prod-override",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new Request("http://example.test", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "user-prod-override", isAnonymous: false });
  });

  it("returns 503 when Neon auth is unavailable and fallback is disabled", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
      NEON_PUBLISHABLE_KEY: "anon-key",
      ALLOW_UNVERIFIED_JWT_FALLBACK: undefined,
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { authorization: "Bearer token123" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Authentication service is temporarily unavailable. Please try again.");
    }
  });

  it("supports optional decoded-JWT fallback when Neon auth is unavailable", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
      NEON_PUBLISHABLE_KEY: "anon-key",
      ALLOW_UNVERIFIED_JWT_FALLBACK: "true",
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    const token = buildUnsignedJwt({
      sub: "user-fallback",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new Request("http://example.test", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "user-fallback", isAnonymous: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts anonymous access via apikey when no bearer token", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
      NEON_PUBLISHABLE_KEY: "\"anon-key\"",
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { apikey: "anon-key" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "anon", isAnonymous: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts publishable-format keys if no anon key is configured", async () => {
    stubDenoEnv({
      NEON_AUTH_URL: "https://project.neon.tech/neondb/auth",
      NEON_PUBLISHABLE_KEY: undefined,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { apikey: "sb_publishable_test_key" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "anon", isAnonymous: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
