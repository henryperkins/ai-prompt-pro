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

export interface BackendConfigInput {
  dataApiUrl?: string;
  authUrl?: string;
  mode?: string;
  vitest?: boolean;
}

export interface BackendConfigResolution {
  dataApiUrl?: string;
  authUrl?: string;
  hasBackendEnvConfig: boolean;
  isBackendConfigured: boolean;
}

export function resolveBackendConfig(input: BackendConfigInput): BackendConfigResolution {
  const dataApiUrl = normalizeEnvValue(input.dataApiUrl);
  const authUrl = normalizeEnvValue(input.authUrl);
  const isTestEnv = input.mode === "test" || input.vitest === true;
  const hasBackendEnvConfig = Boolean(dataApiUrl && authUrl);

  return {
    dataApiUrl,
    authUrl,
    hasBackendEnvConfig,
    isBackendConfigured: hasBackendEnvConfig || isTestEnv,
  };
}

export const TEST_DATA_API_URL = "https://neon.test/neondb/rest/v1";
export const TEST_AUTH_URL = "https://neon.test/neondb/auth";

const runtimeBackendConfig = resolveBackendConfig({
  dataApiUrl: import.meta.env.VITE_NEON_DATA_API_URL,
  authUrl: import.meta.env.VITE_NEON_AUTH_URL,
  mode: import.meta.env.MODE,
  vitest: import.meta.env.VITEST,
});

export const NEON_DATA_API_URL = runtimeBackendConfig.dataApiUrl;
export const NEON_AUTH_URL = runtimeBackendConfig.authUrl;
export const hasBackendEnvConfig = runtimeBackendConfig.hasBackendEnvConfig;
export const isBackendConfigured = runtimeBackendConfig.isBackendConfigured;

export function getBackendConfigErrorMessage(featureLabel: string): string {
  return `${featureLabel} is unavailable because backend is not configured. Set VITE_NEON_DATA_API_URL and VITE_NEON_AUTH_URL.`;
}

export function assertBackendConfigured(featureLabel: string): void {
  if (!isBackendConfigured) {
    throw new Error(getBackendConfigErrorMessage(featureLabel));
  }
}
