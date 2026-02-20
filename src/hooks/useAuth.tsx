import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { neon } from "@/integrations/neon/client";
import { getBackendConfigErrorMessage, isBackendConfigured } from "@/lib/backend-config";
import { validateDisplayName } from "@/lib/profile";

type SessionResult = Awaited<ReturnType<typeof neon.auth.getSession>>;
export type AuthSession = SessionResult["data"]["session"];
export type AuthUser = NonNullable<NonNullable<AuthSession>["user"]>;
export type AuthOAuthProvider = Parameters<typeof neon.auth.signInWithOAuth>[0]["provider"];

interface AuthContextValue {
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

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_UNAVAILABLE_MESSAGE = getBackendConfigErrorMessage("Authentication");

function resolveSignUpName(email: string, displayName?: string): string {
  const trimmedDisplayName = displayName?.trim();
  if (trimmedDisplayName) {
    return trimmedDisplayName;
  }

  const emailLocalPart = email.split("@")[0]?.trim();
  if (emailLocalPart) {
    return emailLocalPart;
  }

  return "Member";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isBackendConfigured) {
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Get initial session
    neon.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (!isMounted) return;
        setSession(s);
        setUser((s?.user ?? null) as AuthUser | null);
        setLoading(false);
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

    const safeName = resolveSignUpName(email, displayName);
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

    await neon.auth.signOut();
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    if (!isBackendConfigured) {
      return { error: AUTH_UNAVAILABLE_MESSAGE, user: null };
    }

    const normalized = displayName.trim();
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

    await neon.auth.signOut();
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
