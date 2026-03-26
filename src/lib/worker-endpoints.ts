function normalizeBaseUrl(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function normalizeRoutePath(path: string, prefix: "/auth" | "/api"): string {
  if (/^https?:\/\//i.test(path)) return path;

  const trimmed = path.trim();
  if (!trimmed) {
    return prefix;
  }

  if (trimmed.startsWith(prefix)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return `${prefix}/${trimmed.replace(/^\/+/, "")}`;
}

function resolveWorkerUrl(path: string, baseUrl: string | null, prefix: "/auth" | "/api"): string {
  const normalizedPath = normalizeRoutePath(path, prefix);
  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (!baseUrl) {
    return normalizedPath;
  }

  return new URL(normalizedPath, `${baseUrl}/`).toString();
}

const AUTH_WORKER_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_AUTH_WORKER_URL);
const API_WORKER_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_WORKER_URL);

export function resolveAuthUrl(path: string): string {
  return resolveWorkerUrl(path, AUTH_WORKER_BASE_URL, "/auth");
}

export function resolveApiUrl(path: string): string {
  return resolveWorkerUrl(path, API_WORKER_BASE_URL, "/api");
}
