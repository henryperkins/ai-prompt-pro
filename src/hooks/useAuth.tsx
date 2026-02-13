import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { neon } from "@/integrations/neon/client";
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await neon.auth.signUp({ email, password });
    return {
      error: error?.message ?? null,
      session: data.session,
      user: (data.user ?? null) as AuthUser | null,
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await neon.auth.signInWithPassword({ email, password });
    return {
      error: error?.message ?? null,
      session: data.session,
      user: (data.user ?? null) as AuthUser | null,
    };
  }, []);

  const signInWithOAuth = useCallback(async (provider: AuthOAuthProvider) => {
    const { error } = await neon.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null, session: null };
  }, []);

  const signOut = useCallback(async () => {
    await neon.auth.signOut();
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
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

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut, updateDisplayName }}
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
