import type { BrowserAuthUser } from "@/lib/browser-auth";
import { resolveApiUrl, resolveAuthUrl } from "@/lib/worker-endpoints";

export type AuthOAuthProvider = "apple" | "github" | "google";

export interface AuthCapabilities {
  oauthProviders: AuthOAuthProvider[];
  passwordResetEnabled: boolean;
  passwordResetSupportUrl: string | null;
}

function normalizeOAuthProviders(value: unknown): AuthOAuthProvider[] {
  if (!Array.isArray(value)) return [];
  return value.filter((provider): provider is AuthOAuthProvider =>
    provider === "apple" || provider === "github" || provider === "google"
  );
}

async function requestAuthJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(resolveAuthUrl(path), init);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || `Request failed (${response.status})`);
  }

  return payload as T;
}

export async function fetchAuthCapabilities(): Promise<AuthCapabilities> {
  const payload = await requestAuthJson<{
    oauthProviders?: unknown;
    passwordResetEnabled?: unknown;
    passwordResetSupportUrl?: unknown;
  }>("/auth/capabilities");

  return {
    oauthProviders: normalizeOAuthProviders(payload.oauthProviders),
    passwordResetEnabled: payload.passwordResetEnabled === true,
    passwordResetSupportUrl:
      typeof payload.passwordResetSupportUrl === "string" && payload.passwordResetSupportUrl.trim()
        ? payload.passwordResetSupportUrl
        : null,
  };
}

export async function apiRegister(email: string, password: string, displayName?: string) {
  return requestAuthJson<{ user: BrowserAuthUser; accessToken: string; refreshToken: string }>(
    "/auth/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, displayName }),
    },
  );
}

export async function apiLogin(email: string, password: string) {
  return requestAuthJson<{ user: BrowserAuthUser; accessToken: string; refreshToken: string }>(
    "/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function apiRequestPasswordReset(email: string) {
  return requestAuthJson<{ accepted: boolean }>(
    "/auth/reset-password",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    },
  );
}

export async function apiConfirmPasswordReset(token: string, password: string) {
  return requestAuthJson<{ reset: boolean }>(
    "/auth/reset-password/confirm",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, password }),
    },
  );
}

export async function apiDeleteAccount(accessToken: string) {
  const response = await fetch(resolveAuthUrl("/auth/account"), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || "Failed to delete account.");
  }
}

export async function apiUpdateProfile(accessToken: string, displayName: string) {
  const response = await fetch(resolveApiUrl("/api/profile/me"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ display_name: displayName }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || "Failed to update display name.");
  }
}
