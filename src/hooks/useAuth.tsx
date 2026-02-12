import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session, Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { validateDisplayName } from "@/lib/profile";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; session: Session | null; user: User | null }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; session: Session | null; user: User | null }>;
  signInWithOAuth: (provider: Provider) => Promise<{ error: string | null; session: Session | null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null; user: User | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (!isMounted) return;
        // Ignore anonymous sessions — treat them as unauthenticated
        if (s?.user?.is_anonymous) {
          setSession(null);
          setUser(null);
        } else {
          setSession(s);
          setUser(s?.user ?? null);
        }
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
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!isMounted) return;
      if (s?.user?.is_anonymous) {
        setSession(null);
        setUser(null);
      } else {
        setSession(s);
        setUser(s?.user ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return {
      error: error?.message ?? null,
      session: data.session,
      user: data.user,
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return {
      error: error?.message ?? null,
      session: data.session,
      user: data.user,
    };
  }, []);

  const signInWithOAuth = useCallback(async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null, session: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const normalized = displayName.trim();
    const validationError = validateDisplayName(normalized);
    if (validationError) {
      return { error: validationError, user: null };
    }

    if (!user || user.is_anonymous) {
      return { error: "Sign in required.", user: null };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: normalized })
      .eq("id", user.id);
    if (profileError) {
      return { error: profileError.message || "Failed to update display name.", user: null };
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: normalized },
    });
    if (error) {
      return { error: error.message || "Failed to update display name.", user: null };
    }

    const nextUser = data.user ?? user;
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
