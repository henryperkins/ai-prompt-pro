export const AUTH_TOKEN_STORAGE_KEY = "pf_tokens";
const AUTH_BASE_PATH = "/auth";
const ACCESS_TOKEN_REFRESH_GRACE_SECONDS = 30;

export interface StoredAuthTokens {
  accessToken?: string;
  refreshToken?: string;
}

export interface BrowserAuthUser {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface BrowserAuthSession {
  user: BrowserAuthUser;
  accessToken: string;
  refreshToken: string;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  if (typeof atob === "function") {
    return atob(`${normalized}${padding}`);
  }

  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

export function resolveRequestUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!path.startsWith("/")) return path;
  if (typeof window === "undefined" || !window.location?.origin) return path;
  return new URL(path, window.location.origin).toString();
}

export function loadStoredTokens(): StoredAuthTokens | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as StoredAuthTokens) : null;
  } catch {
    return null;
  }
}

export function saveStoredTokens(accessToken: string, refreshToken?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    const existing = loadStoredTokens();
    const nextTokens: StoredAuthTokens = { accessToken };
    const effectiveRefreshToken = refreshToken ?? existing?.refreshToken;
    if (effectiveRefreshToken) {
      nextTokens.refreshToken = effectiveRefreshToken;
    }
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, JSON.stringify(nextTokens));
  } catch {
    // Ignore localStorage failures and fail closed on the next auth read.
  }
}

export function clearStoredTokens(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getStoredAccessToken(): string | null {
  return loadStoredTokens()?.accessToken ?? null;
}

export function getStoredRefreshToken(): string | null {
  return loadStoredTokens()?.refreshToken ?? null;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getStoredAccessTokenExpiry(accessToken?: string | null): number | null {
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  return typeof payload?.exp === "number" ? payload.exp : null;
}

export function getStoredUserId(accessToken?: string | null): string | null {
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  return typeof payload?.sub === "string" ? payload.sub : null;
}

function tokenNeedsRefresh(accessToken: string, minValiditySeconds = ACCESS_TOKEN_REFRESH_GRACE_SECONDS): boolean {
  const expiresAt = getStoredAccessTokenExpiry(accessToken);
  if (typeof expiresAt !== "number") return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowSeconds + minValiditySeconds;
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(resolveRequestUrl(path), options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = (body as { error?: string }).error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return body as T;
}

export async function fetchAuthSession(
  accessToken: string,
): Promise<{ authenticated: boolean; user?: BrowserAuthUser }> {
  const response = await fetch(resolveRequestUrl(`${AUTH_BASE_PATH}/session`), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return { authenticated: false };
  }

  return response.json() as Promise<{ authenticated: boolean; user?: BrowserAuthUser }>;
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshStoredAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearStoredTokens();
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const result = await requestJson<{ accessToken?: string }>(`${AUTH_BASE_PATH}/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!result.accessToken) {
          clearStoredTokens();
          return null;
        }

        saveStoredTokens(result.accessToken, refreshToken);
        return result.accessToken;
      } catch {
        clearStoredTokens();
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function getValidAccessToken(
  options: { forceRefresh?: boolean; minValiditySeconds?: number } = {},
): Promise<string | null> {
  const accessToken = getStoredAccessToken();

  if (!options.forceRefresh && accessToken && !tokenNeedsRefresh(accessToken, options.minValiditySeconds)) {
    return accessToken;
  }

  if (!accessToken && !getStoredRefreshToken()) {
    return null;
  }

  return refreshStoredAccessToken();
}

export async function restoreStoredAuthSession(): Promise<BrowserAuthSession | null> {
  let accessToken = await getValidAccessToken();
  const refreshToken = getStoredRefreshToken();

  if (!accessToken && refreshToken) {
    accessToken = await refreshStoredAccessToken();
  }

  if (!accessToken) {
    clearStoredTokens();
    return null;
  }

  let sessionResponse = await fetchAuthSession(accessToken);
  if (!sessionResponse.authenticated || !sessionResponse.user) {
    const refreshedAccessToken = await refreshStoredAccessToken();
    if (!refreshedAccessToken) {
      clearStoredTokens();
      return null;
    }

    accessToken = refreshedAccessToken;
    sessionResponse = await fetchAuthSession(accessToken);
  }

  if (!sessionResponse.authenticated || !sessionResponse.user) {
    clearStoredTokens();
    return null;
  }

  saveStoredTokens(accessToken, refreshToken);

  return {
    user: sessionResponse.user,
    accessToken,
    refreshToken: refreshToken ?? "",
  };
}

export async function logoutStoredSession(): Promise<void> {
  const refreshToken = getStoredRefreshToken();
  clearStoredTokens();

  if (!refreshToken) return;

  await fetch(resolveRequestUrl(`${AUTH_BASE_PATH}/logout`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {});
}
