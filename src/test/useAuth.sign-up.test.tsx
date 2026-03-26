import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/hooks/auth-provider-cf";
import { useAuth } from "@/hooks/useAuth";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    status: init.status ?? 200,
  });
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function seedTokens(payload?: Record<string, unknown>, refreshToken = "refresh-token") {
  if (!payload) {
    window.localStorage.removeItem("pf_tokens");
    return;
  }

  window.localStorage.setItem("pf_tokens", JSON.stringify({
    accessToken: buildUnsignedJwt(payload),
    refreshToken,
  }));
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends a non-empty name derived from email when display name is missing", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      user: { id: "user-1", email: "jane.doe@example.com", displayName: "jane.doe" },
      accessToken: "access-token",
      refreshToken: "refresh-token",
    }, { status: 201 }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signUp("jane.doe@example.com", "Passw0rd!");
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/auth/register");
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      email: "jane.doe@example.com",
      password: "Passw0rd!",
      displayName: "jane.doe",
    });
  });

  it("normalizes complex email local parts into a safe signup fallback", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      user: { id: "user-1", email: "jane+team@example.com", displayName: "jane team" },
      accessToken: "access-token",
      refreshToken: "refresh-token",
    }, { status: 201 }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signUp("jane+team@example.com", "Passw0rd!");
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      displayName: "jane team",
    });
  });

  it("prefers provided display name when signing up", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      user: { id: "user-1", email: "jane.doe@example.com", displayName: "Jane Doe" },
      accessToken: "access-token",
      refreshToken: "refresh-token",
    }, { status: 201 }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signUp("jane.doe@example.com", "Passw0rd!", "  Jane Doe  ");
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      displayName: "Jane Doe",
    });
  });

  it("rejects hidden display name characters before calling sign up", async () => {
    const fetchMock = vi.mocked(fetch);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const signUpResult = await result.current.signUp(
      "jane.doe@example.com",
      "Passw0rd!",
      "Jane\u200BDoe",
    );

    expect(signUpResult).toEqual({
      error: "Display name cannot include hidden or control characters.",
      session: null,
      user: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears local session even when remote sign-out fails", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    seedTokens({ sub: "user-1", email: "user-1@example.com", exp: nowSeconds + 3600 });

    const fetchMock = vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        authenticated: true,
        user: { id: "user-1", email: "user-1@example.com" },
      }))
      .mockRejectedValueOnce(new Error("auth service unavailable"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe("user-1");

    await act(async () => {
      await expect(result.current.signOut()).resolves.toBeUndefined();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem("pf_tokens")).toBeNull();
    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  it("deletes the account with a valid bearer token and clears local auth state", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    seedTokens({ sub: "user-1", email: "user-1@example.com", exp: nowSeconds + 3600 });

    const fetchMock = vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        authenticated: true,
        user: { id: "user-1", email: "user-1@example.com" },
      }))
      .mockResolvedValueOnce(jsonResponse({ deleted: true }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let deleteResult: { error: string | null } | null = null;
    await act(async () => {
      deleteResult = await result.current.deleteAccount();
    });

    expect(deleteResult).toEqual({ error: null });
    const [, init] = fetchMock.mock.calls[1] ?? [];
    expect((init as RequestInit).method).toBe("DELETE");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: expect.stringContaining("Bearer "),
    });
    expect(window.localStorage.getItem("pf_tokens")).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("refreshes an expired bootstrap token before restoring the session", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    seedTokens({ sub: "user-1", email: "user-1@example.com", exp: nowSeconds - 60 });

    const fetchMock = vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ accessToken: buildUnsignedJwt({
        sub: "user-1",
        email: "user-1@example.com",
        exp: nowSeconds + 3600,
      }) }))
      .mockResolvedValueOnce(jsonResponse({
        authenticated: true,
        user: { id: "user-1", email: "user-1@example.com", displayName: "User One" },
      }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/auth/session"),
      expect.any(Object),
    );
    expect(result.current.user).toMatchObject({
      id: "user-1",
      displayName: "User One",
    });
  });

  it("requests a password reset against the worker auth endpoint", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ accepted: true }, { status: 202 }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resetResult: { error: string | null } | null = null;
    await act(async () => {
      resetResult = await result.current.requestPasswordReset("user@example.com");
    });

    expect(resetResult).toEqual({ error: null });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/auth/reset-password");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
    });
  });
});
