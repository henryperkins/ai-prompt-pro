import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { AuthContext } from "@/hooks/auth-context";
import {
  register,
  login,
  logout,
  getSession,
  refreshToken as refreshAccessToken,
  deleteAccount as deleteAccountApi,
  type AuthUser,
  type AuthSession,
} from "@/lib/cf-api-client";
import {
  normalizeDisplayName,
  resolveSignUpDisplayName,
  validateDisplayName,
} from "@/lib/profile";

const AUTH_WORKER_URL = import.meta.env.VITE_AUTH_WORKER_URL;

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
    provider: string,
  ) => Promise<{ error: string | null; session: null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null; user: AuthUser | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const AUTH_UNAVAILABLE_MESSAGE = AUTH_WORKER_URL ? "" : "Authentication service not configured. Set VITE_AUTH_WORKER_URL.";

function isBackendConfigured(): boolean {
  return !!AUTH_WORKER_URL;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured());

  useEffect(() => {
    if (!isBackendConfigured()) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Try to get session from stored tokens
    const storedTokens = loadStoredTokens();

    if (storedTokens?.accessToken) {
      getSession(storedTokens.accessToken)
        .then(({ authenticated, user: fetchedUser }) => {
          if (!isMounted) return;

          if (authenticated && fetchedUser) {
            setUser(fetchedUser);
            setSession({
              user: fetchedUser,
              accessToken: storedTokens.accessToken,
              refreshToken: storedTokens.refreshToken,
            });
            setLoading(false);
          } else {
            // Token expired, try refresh
            if (storedTokens.refreshToken) {
              refreshAccessToken(storedTokens.refreshToken)
                .then(({ accessToken }) => {
                  if (!isMounted) return;
                  saveTokens(accessToken, storedTokens.refreshToken);
                  getSession(accessToken).then(({ user }) => {
                    if (!isMounted) return;
                    if (user) {
                      setUser(user);
                      setSession({ user, accessToken, refreshToken: storedTokens.refreshToken });
                    }
                    setLoading(false);
                  });
                })
                .catch(() => {
                  if (!isMounted) return;
                  clearStoredTokens();
                  setUser(null);
                  setSession(null);
                  setLoading(false);
                });
            } else {
              setLoading(false);
            }
          }
        })
        .catch(() => {
          if (!isMounted) return;
          clearStoredTokens();
          setUser(null);
          setSession(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    if (!isBackendConfigured()) {
      return { error: AUTH_UNAVAILABLE_MESSAGE, session: null, user: null };
    }

    const normalizedDisplayName = normalizeDisplayName(displayName);
    if (normalizedDisplayName) {
      const validationError = validateDisplayName(normalizedDisplayName);
      if (validationError) {
        return { error: validationError, session: null, user: null };
      }
    }

    const safeName = resolveSignUpDisplayName(email, normalizedDisplayName);

    try {
      const { user: newUser, accessToken, refreshToken } = await register(email, password, safeName);

      saveTokens(accessToken, refreshToken);

      const newSession: AuthSession = {
        user: newUser,
        accessToken,
        refreshToken,
      };

      setUser(newUser);
      setSession(newSession);

      return { error: null, session: newSession, user: newUser };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      return { error: errorMessage, session: null, user: null };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isBackendConfigured()) {
      return { error: AUTH_UNAVAILABLE_MESSAGE, session: null, user: null };
    }

    try {
      const { user: loggedInUser, accessToken, refreshToken } = await login(email, password);

      saveTokens(accessToken, refreshToken);

      const newSession: AuthSession = {
        user: loggedInUser,
        accessToken,
        refreshToken,
      };

      setUser(loggedInUser);
      setSession(newSession);

      return { error: null, session: newSession, user: loggedInUser };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sign in failed";
      return { error: errorMessage, session: null, user: null };
    }
  }, []);

  const signInWithOAuth = useCallback(async (_provider: string) => {
    if (!isBackendConfigured()) {
      return { error: AUTH_UNAVAILABLE_MESSAGE, session: null };
    }

    // OAuth not yet implemented in worker
    return { error: "OAuth sign in not yet implemented", session: null };
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = session?.refreshToken;

    try {
      await logout(refreshToken);
    } catch {
      // Best-effort remote sign-out; local state is still cleared
    } finally {
      clearStoredTokens();
      setSession(null);
      setUser(null);
    }
  }, [session]);

  const updateDisplayName = useCallback(async (displayName: string) => {
    if (!isBackendConfigured()) {
      return { error: AUTH_UNAVAILABLE_MESSAGE, user: null };
    }

    const normalized = normalizeDisplayName(displayName);
    const validationError = validateDisplayName(normalized);
    if (validationError) {
      return { error: validationError, user: null };
    }

    if (!user) {
      return { error: "Sign in required.", user: null };
    }

    // Note: Profile update would call the API worker
    // For now, just update local state
    const updatedUser = { ...user, displayName: normalized };
    setUser(updatedUser);
    setSession((previous) => {
      if (!previous) return previous;
      return { ...previous, user: updatedUser };
    });

    return { error: null, user: updatedUser };
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (!isBackendConfigured()) {
      return { error: AUTH_UNAVAILABLE_MESSAGE };
    }

    if (!session?.accessToken) {
      return { error: "Sign in required." };
    }

    try {
      await deleteAccountApi(session.accessToken);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete account.";
      return { error: errorMessage };
    }

    clearStoredTokens();
    setSession(null);
    setUser(null);
    return { error: null };
  }, [session]);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut, updateDisplayName, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// Token Storage (localStorage for tokens)
// ============================================================

const TOKEN_KEY = "pf_tokens";

interface StoredTokens {
  accessToken?: string;
  refreshToken?: string;
}

function loadStoredTokens(): StoredTokens | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveTokens(accessToken: string, refreshToken: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken, refreshToken }));
  } catch {
    // Quota errors are intentionally ignored
  }
}

function clearStoredTokens(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}
