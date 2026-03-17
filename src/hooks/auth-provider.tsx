import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { AuthContext } from "@/hooks/auth-context";
import { neon } from "@/integrations/neon/client";
import { getBackendConfigErrorMessage, isBackendConfigured } from "@/lib/backend-config";
import {
  normalizeDisplayName,
  resolveSignUpDisplayName,
  validateDisplayName,
} from "@/lib/profile";

type SessionResult = Awaited<ReturnType<typeof neon.auth.getSession>>;
export type AuthSession = SessionResult["data"]["session"];
export type AuthUser = NonNullable<NonNullable<AuthSession>["user"]>;
export type AuthOAuthProvider = Parameters<typeof neon.auth.signInWithOAuth>[0]["provider"];

export interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ error: string | null; session: AuthSession; user: AuthUser | null }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; session: AuthSession; user: AuthUser | null }>;
  signInWithOAuth: (
    provider: AuthOAuthProvider,
  ) => Promise<{ error: string | null; session: AuthSession }>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null; user: AuthUser | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
}
const AUTH_UNAVAILABLE_MESSAGE = getBackendConfigErrorMessage("Authentication");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession>(null);
  const [loading, setLoading] = useState(isBackendConfigured);

  useEffect(() => {
    if (!isBackendConfigured) return;

    let isMounted = true;

    // Get initial session
    neon.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (!isMounted) return;
        setSession(s);
        setUser((s?.user ?? null) as AuthUser | null);
        setLoading(false);

        if (!s) return;

        void neon.auth.getSession({ forceFetch: true })
          .then(({ data: { session: validatedSession } }) => {
            if (!isMounted) return;
            setSession(validatedSession);
            setUser((validatedSession?.user ?? null) as AuthUser | null);
          })
          .catch((error: unknown) => {
            if (!isMounted) return;
            console.warn("Failed to revalidate auth session:", error);
          });
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        console.error("Failed to initialize auth session:", error);
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = neon.auth.onAuthStateChange((_event, s) => {
      if (!isMounted) return;
      setSession(s);
      setUser((s?.user ?? null) as AuthUser | null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    if (!isBackendConfigured) {
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
    const { data, error } = await neon.auth.signUp({
      email,
      password,
      options: {
        data: {
          displayName: safeName,
          name: safeName,
        },
      },
    });
    return {
      error: error?.message ?? null,
      session: data.session,
      user: (data.user ?? null) as AuthUser | null,
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isBackendConfigured) {
      return { error: AUTH_UNAVAILABLE_MESSAGE, session: null, user: null };
    }

    const { data, error } = await neon.auth.signInWithPassword({ email, password });
    return {
      error: error?.message ?? null,
      session: data.session,
      user: (data.user ?? null) as AuthUser | null,
    };
  }, []);

  const signInWithOAuth = useCallback(async (provider: AuthOAuthProvider) => {
    if (!isBackendConfigured) {
      return { error: AUTH_UNAVAILABLE_MESSAGE, session: null };
    }

    const { error } = await neon.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null, session: null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isBackendConfigured) {
      setSession(null);
      setUser(null);
      return;
    }

    try {
      await neon.auth.signOut();
    } catch {
      // Neon Auth sign-out endpoint can transiently fail (e.g. upstream 5xx).
      // Clear local auth state anyway so user intent (sign out) always succeeds.
    } finally {
      setSession(null);
      setUser(null);
    }
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    if (!isBackendConfigured) {
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

    const { error: profileError } = await neon
      .from("profiles")
      .update({ display_name: normalized })
      .eq("id", user.id);
    if (profileError) {
      return { error: profileError.message || "Failed to update display name.", user: null };
    }

    const { data, error } = await neon.auth.updateUser({
      data: { display_name: normalized },
    });
    if (error) {
      return { error: error.message || "Failed to update display name.", user: null };
    }

    const nextUser = (data.user ?? user) as AuthUser;
    setUser(nextUser);
    setSession((previous) => {
      if (!previous) return previous;
      return { ...previous, user: nextUser };
    });

    return { error: null, user: nextUser };
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (!isBackendConfigured) {
      return { error: AUTH_UNAVAILABLE_MESSAGE };
    }

    if (!user?.id) {
      return { error: "Sign in required." };
    }

    const { error } = await neon.rpc("delete_my_account");
    if (error) {
      return { error: error.message || "Failed to delete account." };
    }

    try {
      await neon.auth.signOut();
    } catch {
      // Best-effort remote sign-out; local state is still cleared below.
    }
    setSession(null);
    setUser(null);
    return { error: null };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut, updateDisplayName, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}
