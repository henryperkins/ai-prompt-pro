import { createClient, SupabaseAuthAdapter } from "@neondatabase/neon-js";
import type { Database } from "./types";
import {
  NEON_AUTH_URL,
  NEON_DATA_API_URL,
  TEST_AUTH_URL,
  TEST_DATA_API_URL,
  hasBackendEnvConfig,
  isBackendConfigured,
} from "@/lib/backend-config";

export { hasBackendEnvConfig, isBackendConfigured };

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
