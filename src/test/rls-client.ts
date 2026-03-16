import { createClient as createNeonClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";

type RlsClient = {
  auth: {
    signUp: (args: {
      email: string;
      password: string;
      options?: {
        emailRedirectTo?: string;
      };
    }) => Promise<{
      data: { user: { id: string } | null } | null;
      error: { message?: string } | null;
    }>;
    signInWithPassword: (args: { email: string; password: string }) => Promise<{
      data: { user: { id: string } | null } | null;
      error: { message?: string } | null;
    }>;
    getUser: () => Promise<{
      data: { user: { id: string } | null } | null;
      error: { message?: string } | null;
    }>;
    signOut: () => Promise<unknown>;
  };
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string | boolean) => Promise<{ error: { message?: string } | null }>;
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: Array<{ id: string }> | null; error: { message?: string } | null }>;
    };
  };
};

const NEON_AUTH_URL = process.env.NEON_AUTH_URL;
const NEON_DATA_API_URL = process.env.NEON_DATA_API_URL;
const RLS_SIGNUP_REDIRECT_URL = process.env.RLS_SIGNUP_REDIRECT_URL || "http://localhost:8080/";

const hasNeonEnv = Boolean(NEON_AUTH_URL && NEON_DATA_API_URL);

export const hasRlsEnv = hasNeonEnv;
export const rlsEnvErrorMessage =
  "Missing RLS env vars. Set NEON_AUTH_URL + NEON_DATA_API_URL.";

export function createRlsClient(_prefix: string): RlsClient {
  if (!NEON_AUTH_URL || !NEON_DATA_API_URL) {
    throw new Error("Missing NEON_AUTH_URL or NEON_DATA_API_URL for RLS test client.");
  }

  const neonClient = createNeonClient({
    auth: {
      url: NEON_AUTH_URL,
      adapter: SupabaseAuthAdapter(),
      allowAnonymous: true,
    },
    dataApi: {
      url: NEON_DATA_API_URL,
    },
  });
  return neonClient as unknown as RlsClient;
}

export async function registerAndSignIn(client: RlsClient, email: string, password: string): Promise<string> {
  let signUpResult: {
    data: { user: { id: string } | null } | null;
    error: { message?: string } | null;
  } = { data: null, error: null };

  signUpResult = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: RLS_SIGNUP_REDIRECT_URL,
    },
  });
  const signUpError = signUpResult.error?.message || "";
  const isDuplicate = /already|exists|taken|registered/i.test(signUpError);
  if (signUpResult.error && !isDuplicate) {
    throw new Error(`Failed to sign up ${email}: ${signUpError || "unknown error"}`);
  }

  const signInResult = await client.auth.signInWithPassword({ email, password });
  if (signInResult.error) {
    throw new Error(`Failed to sign in ${email}: ${signInResult.error.message || "unknown error"}`);
  }

  const userId =
    signInResult.data?.user?.id
    || signUpResult.data?.user?.id
    || (await client.auth.getUser()).data?.user?.id;
  if (!userId) {
    throw new Error(`Missing user id after auth flow for ${email}`);
  }
  return userId;
}
