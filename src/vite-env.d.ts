/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEON_PROJECT_ID?: string;
  readonly VITE_NEON_DATA_API_URL?: string;
  readonly VITE_NEON_AUTH_URL?: string;
  readonly VITE_NEON_PUBLISHABLE_KEY?: string;
  readonly VITE_AGENT_SERVICE_URL?: string;
  readonly VITE_ENHANCE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_BUILDER_REDESIGN_PHASE1?: string;
  readonly VITE_BUILDER_REDESIGN_PHASE2?: string;
  readonly VITE_BUILDER_REDESIGN_PHASE3?: string;
  readonly VITE_BUILDER_REDESIGN_PHASE4?: string;
  readonly VITE_COMMUNITY_MOBILE_ENHANCEMENTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
