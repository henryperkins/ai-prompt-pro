/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEON_PROJECT_ID?: string;
  readonly VITE_NEON_DATA_API_URL?: string;
  readonly VITE_NEON_AUTH_URL?: string;
  readonly VITE_AGENT_PUBLIC_API_KEY?: string;
  readonly VITE_NEON_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_AGENT_SERVICE_URL?: string;
  readonly VITE_ENHANCE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_ENHANCE_TRANSPORT?: string;
  readonly VITE_ENHANCE_WS_CONNECT_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
