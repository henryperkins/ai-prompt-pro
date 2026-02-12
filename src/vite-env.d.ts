/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_BUILDER_REDESIGN_PHASE1?: string;
  readonly VITE_BUILDER_REDESIGN_PHASE2?: string;
  readonly VITE_BUILDER_REDESIGN_PHASE3?: string;
  readonly VITE_BUILDER_REDESIGN_PHASE4?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
