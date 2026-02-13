import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";
import type { Database } from "./types";

function normalizeEnvValue(value?: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const hasDoubleQuotes = trimmed.startsWith("\"") && trimmed.endsWith("\"");
  const hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
  if (hasDoubleQuotes || hasSingleQuotes) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted || undefined;
  }

  return trimmed;
}

const NEON_DATA_API_URL = normalizeEnvValue(import.meta.env.VITE_NEON_DATA_API_URL);
const NEON_AUTH_URL = normalizeEnvValue(import.meta.env.VITE_NEON_AUTH_URL);
const IS_TEST_ENV = import.meta.env.MODE === "test" || import.meta.env.VITEST === true;

const TEST_DATA_API_URL = "https://neon.test/neondb/rest/v1";
const TEST_AUTH_URL = "https://neon.test/neondb/auth";

if ((!NEON_DATA_API_URL || !NEON_AUTH_URL) && !IS_TEST_ENV) {
  throw new Error(
    "Missing Neon env. Set VITE_NEON_DATA_API_URL and VITE_NEON_AUTH_URL.",
  );
}

const DATA_API_URL = NEON_DATA_API_URL ?? TEST_DATA_API_URL;
const AUTH_URL = NEON_AUTH_URL ?? TEST_AUTH_URL;

export const neon = createClient<Database>({
  auth: {
    adapter: SupabaseAuthAdapter(),
    url: AUTH_URL,
    allowAnonymous: true,
  },
  dataApi: {
    url: DATA_API_URL,
  },
});
