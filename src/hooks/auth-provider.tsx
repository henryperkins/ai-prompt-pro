import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AuthContext } from "@/hooks/auth-context";
import {
  clearStoredTokens,
  getValidAccessToken,
  logoutStoredSession,
  resolveRequestUrl,
  restoreStoredAuthSession,
  saveStoredTokens,
  type BrowserAuthSession,
  type BrowserAuthUser,
} from "@/lib/browser-auth";
import {
  normalizeDisplayName,
  resolveSignUpDisplayName,
  validateDisplayName,
} from "@/lib/profile";

export type AuthUser = BrowserAuthUser & {
  user_metadata?: {
    display_name?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  };
};

export interface AuthSession extends BrowserAuthSession {
  user: AuthUser;
}

export type AuthOAuthProvider = "apple" | "github" | "google";

export interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error: string | null; session: AuthSession | null; user: AuthUser | null }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; session: AuthSession | null; user: AuthUser | null }>;
  signInWithOAuth: (
    provider: AuthOAuthProvider,
  ) => Promise<{ error: string | null; session: null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null; user: AuthUser | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const AUTH_BASE = "/auth";

function enrichUser(raw: BrowserAuthUser): AuthUser {
  return {
    ...raw,
    user_metadata: {
      display_name: raw.displayName ?? null,
      full_name: raw.displayName ?? null,
      avatar_url: raw.avatarUrl ?? null,
    },
  };
}

async function requestAuthJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(resolveRequestUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || `Request failed (${response.status})`);
  }

  return payload as T;
}

async function apiRegister(email: string, password: string, displayName?: string) {
  return requestAuthJson<{ user: BrowserAuthUser; accessToken: string; refreshToken: string }>(
    `${AUTH_BASE}/register`,
    { email, password, displayName },
  );
}

async function apiLogin(email: string, password: string) {
  return requestAuthJson<{ user: BrowserAuthUser; accessToken: string; refreshToken: string }>(
    `${AUTH_BASE}/login`,
    { email, password },
  );
}

async function apiDeleteAccount(accessToken: string) {
  const response = await fetch(resolveRequestUrl(`${AUTH_BASE}/account`), {
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

async function apiUpdateProfile(accessToken: string, displayName: string) {
  const response = await fetch(resolveRequestUrl("/api/profile/me"), {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void restoreStoredAuthSession()
      .then((restoredSession) => {
        if (!isMounted) return;
        if (!restoredSession) {
          setLoading(false);
          return;
        }

        const restoredUser = enrichUser(restoredSession.user);
        setUser(restoredUser);
        setSession({
          user: restoredUser,
          accessToken: restoredSession.accessToken,
          refreshToken: restoredSession.refreshToken,
        });
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        clearStoredTokens();
        setUser(null);
        setSession(null);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const normalizedDisplayName = normalizeDisplayName(displayName);
    if (normalizedDisplayName) {
      const validationError = validateDisplayName(normalizedDisplayName);
      if (validationError) {
        return { error: validationError, session: null, user: null };
      }
    }

    const safeName = resolveSignUpDisplayName(email, normalizedDisplayName);

    try {
      const { user: rawUser, accessToken, refreshToken } = await apiRegister(email, password, safeName);
      saveStoredTokens(accessToken, refreshToken);

      const nextUser = enrichUser(rawUser);
      const nextSession: AuthSession = {
        user: nextUser,
        accessToken,
        refreshToken,
      };

      setUser(nextUser);
      setSession(nextSession);
      return { error: null, session: nextSession, user: nextUser };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Registration failed.", session: null, user: null };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { user: rawUser, accessToken, refreshToken } = await apiLogin(email, password);
      saveStoredTokens(accessToken, refreshToken);

      const nextUser = enrichUser(rawUser);
      const nextSession: AuthSession = {
        user: nextUser,
        accessToken,
        refreshToken,
      };

      setUser(nextUser);
      setSession(nextSession);
      return { error: null, session: nextSession, user: nextUser };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Sign in failed.", session: null, user: null };
    }
  }, []);

  const signInWithOAuth = useCallback(async (_provider: AuthOAuthProvider) => {
    return {
      error: "OAuth sign in is not available in this build.",
      session: null,
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutStoredSession();
    } finally {
      setUser(null);
      setSession(null);
    }
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const normalized = normalizeDisplayName(displayName);
    const validationError = validateDisplayName(normalized);
    if (validationError) {
      return { error: validationError, user: null };
    }

    if (!user) {
      return { error: "Sign in required.", user: null };
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return { error: "Sign in required.", user: null };
    }

    try {
      await apiUpdateProfile(accessToken, normalized);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to update display name.", user: null };
    }

    const updatedUser = enrichUser({
      ...user,
      displayName: normalized,
    });

    setUser(updatedUser);
    setSession((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        accessToken,
        user: updatedUser,
      };
    });

    return { error: null, user: updatedUser };
  }, [user]);

  const deleteAccount = useCallback(async () => {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return { error: "Sign in required." };
    }

    try {
      await apiDeleteAccount(accessToken);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Failed to delete account." };
    }

    clearStoredTokens();
    setUser(null);
    setSession(null);
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut, updateDisplayName, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}
