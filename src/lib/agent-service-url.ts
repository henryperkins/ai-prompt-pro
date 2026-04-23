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

export const AGENT_SERVICE_URL = normalizeEnvValue(import.meta.env.VITE_AGENT_SERVICE_URL);

export function buildAgentServiceUrl(path: string): string {
  const baseUrl = AGENT_SERVICE_URL?.trim();
  if (!baseUrl) {
    throw new Error("Missing function runtime env. Set VITE_AGENT_SERVICE_URL.");
  }
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, normalizedBaseUrl).toString();
}

