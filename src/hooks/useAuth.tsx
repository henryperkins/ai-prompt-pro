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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      // Ignore anonymous sessions — treat them as unauthenticated
      if (s?.user?.is_anonymous) {
        setSession(null);
        setUser(null);
      } else {
        setSession(s);
        setUser(s?.user ?? null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user?.is_anonymous) {
        setSession(null);
        setUser(null);
      } else {
        setSession(s);
        setUser(s?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
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

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut }}
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
