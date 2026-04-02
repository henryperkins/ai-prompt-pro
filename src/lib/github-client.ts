import type { ContextSource } from "@/lib/context-types";
import { createServiceAuth } from "@/lib/service-auth";

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

function normalizeBooleanEnv(value?: string): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const AGENT_SERVICE_URL = normalizeEnvValue(import.meta.env.VITE_AGENT_SERVICE_URL);
export const GITHUB_CONTEXT_ENABLED = normalizeBooleanEnv(
  normalizeEnvValue(import.meta.env.VITE_GITHUB_CONTEXT_ENABLED),
);
const serviceAuth = createServiceAuth({
  serviceUrl: AGENT_SERVICE_URL,
});

export interface GitHubInstallation {
  id: string;
  githubInstallationId: number;
  githubAccountId: number | null;
  githubAccountLogin: string;
  githubAccountType: string;
  repositoriesMode: string;
  permissions: Record<string, string>;
  installedAt: string | null;
  lastSeenAt: string | null;
}

export interface GitHubRepository {
  id: number;
  ownerLogin: string;
  repoName: string;
  fullName: string;
  defaultBranch: string;
  visibility: string;
  isPrivate: boolean;
  connected: boolean;
  connectionId: string | null;
}

export interface GitHubConnection {
  id: string;
  githubRepoId: number;
  ownerLogin: string;
  repoName: string;
  fullName: string;
  defaultBranch: string;
  visibility: string;
  isPrivate: boolean;
  installationRecordId: string;
  lastSelectedAt: string | null;
  installationId?: number;
}

export interface GitHubManifestEntry {
  path: string;
  name: string;
  extension: string;
  directory: string;
  size: number;
  sha: string;
  language: string;
  binary: boolean;
  generated: boolean;
  vendored: boolean;
  recommendedRank: number;
}

export interface GitHubFilePreview {
  path: string;
  language: string;
  size: number;
  sha: string;
  truncated: boolean;
  locator: string;
  content: string;
  originalCharCount: number;
}

export interface GitHubClientErrorInit {
  message: string;
  code: string;
  status?: number;
  retryable?: boolean;
  cause?: unknown;
}

export class GitHubClientError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor({
    message,
    code,
    status,
    retryable = false,
    cause,
  }: GitHubClientErrorInit) {
    super(message);
    this.name = "GitHubClientError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;

    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: cause,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
  }
}

export function isGitHubClientError(error: unknown): error is GitHubClientError {
  return error instanceof GitHubClientError;
}

interface GitHubRequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

interface GitHubErrorPayload {
  error?: unknown;
  code?: unknown;
  detail?: unknown;
  message?: unknown;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" && name.toLowerCase().includes("abort");
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    message?: unknown;
    status?: unknown;
    code?: unknown;
    name?: unknown;
  };
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const name = typeof candidate.name === "string" ? candidate.name.toLowerCase() : "";
  const status = typeof candidate.status === "number" ? candidate.status : null;

  if (status === 0) return true;
  if (name.includes("retryable") || name.includes("fetch")) return true;
  if (code.includes("retryable") || code.includes("fetch")) return true;

  return (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("network request failed") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "GitHub request failed.";
}

function classifyAuthErrorCode(status: number, message: string): string {
  if (status !== 401) return "service_error";
  const normalized = message.toLowerCase();
  if (
    normalized.includes("missing bearer token") ||
    normalized.includes("missing token") ||
    normalized.includes("sign in required")
  ) {
    return "auth_required";
  }
  return "auth_session_invalid";
}

function classifyResponseErrorCode(status: number, message: string, code?: string): string {
  if (code) return code;
  if (status === 401) return classifyAuthErrorCode(status, message);
  if (status === 404) return "not_found";
  if (status === 405) return "method_not_allowed";
  if (status === 409) return "conflict";
  if (status === 413) return "payload_too_large";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "service_unavailable";
  return "service_error";
}

function classifyLocalErrorCode(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("sign in required")) return "auth_required";
  if (
    normalized.includes("invalid or expired auth session") ||
    normalized.includes("could not read auth session")
  ) {
    return "auth_session_invalid";
  }
  if (normalized.includes("missing function runtime env")) {
    return "service_unconfigured";
  }
  return "network_error";
}

function buildServiceUrl(path: string): string {
  const baseUrl = AGENT_SERVICE_URL?.trim();
  if (!baseUrl) {
    throw new Error("Missing function runtime env. Set VITE_AGENT_SERVICE_URL.");
  }
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, normalizedBaseUrl).toString();
}

function appendQuery(
  url: URL,
  query?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!query) return;
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    url.searchParams.set(key, normalized);
  });
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text.trim() ? { error: text.trim() } : null;
}

function createResponseError(response: Response, payload: unknown): GitHubClientError {
  const body = payload && typeof payload === "object" ? payload as GitHubErrorPayload : null;
  const message =
    (typeof body?.error === "string" && body.error.trim()) ||
    (typeof body?.detail === "string" && body.detail.trim()) ||
    (typeof body?.message === "string" && body.message.trim()) ||
    `GitHub request failed with status ${response.status}.`;
  const explicitCode =
    typeof body?.code === "string" && body.code.trim() ? body.code.trim() : undefined;

  return new GitHubClientError({
    message,
    code: classifyResponseErrorCode(response.status, message, explicitCode),
    status: response.status,
    retryable: response.status === 429 || response.status >= 500,
  });
}

function createLocalRequestError(error: unknown): GitHubClientError {
  const message = getErrorMessage(error);
  return new GitHubClientError({
    message,
    code: classifyLocalErrorCode(message),
    retryable: isRetryableNetworkError(error),
    cause: error,
  });
}

async function getRequestHeaders(
  options: {
    forceRefresh?: boolean;
    allowSessionToken?: boolean;
  } = {},
): Promise<Record<string, string>> {
  try {
    return await serviceAuth.getHeaders({
      ...options,
      // The backend still enforces an authenticated PromptForge user session.
      // This only smooths over the short post-redirect window where a forced
      // revalidation can momentarily return null while a valid cached session
      // is already present.
      allowCachedSessionFallbackOnForceRefresh: true,
      allowPublicKeyFallback: false,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw createLocalRequestError(error);
  }
}

async function executeRequest(
  method: "GET" | "POST" | "DELETE",
  url: URL,
  headers: Record<string, string>,
  options: GitHubRequestOptions = {},
): Promise<{ response: Response; payload: unknown }> {
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new GitHubClientError({
      message: getErrorMessage(error),
      code: "network_error",
      retryable: isRetryableNetworkError(error),
      cause: error,
    });
  }

  const payload = await parseResponsePayload(response);
  return { response, payload };
}

async function requestJson<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  options: GitHubRequestOptions = {},
): Promise<T> {
  const url = new URL(buildServiceUrl(path));
  appendQuery(url, options.query);

  const requestResult = await executeRequest(
    method,
    url,
    await getRequestHeaders({
      forceRefresh: true,
    }),
    options,
  );

  if (!requestResult.response.ok) {
    if (requestResult.response.status === 401) {
      await serviceAuth.hardInvalidateSession();
    }
    throw createResponseError(requestResult.response, requestResult.payload);
  }

  return (requestResult.payload ?? {}) as T;
}

export async function getGitHubInstallUrl(signal?: AbortSignal): Promise<string> {
  const response = await requestJson<{ installUrl?: string }>("GET", "github/install-url", {
    signal,
  });
  if (!response.installUrl) {
    throw new GitHubClientError({
      message: "GitHub install URL was not returned by the service.",
      code: "bad_response",
    });
  }
  return response.installUrl;
}

export async function listGitHubInstallations(signal?: AbortSignal): Promise<{
  installations: GitHubInstallation[];
}> {
  return requestJson("GET", "github/installations", { signal });
}

export async function listGitHubConnections(signal?: AbortSignal): Promise<{
  connections: GitHubConnection[];
}> {
  return requestJson("GET", "github/connections", { signal });
}

export async function listGitHubInstallationRepositories({
  installationId,
  query,
  cursor,
  limit,
  signal,
}: {
  installationId: number;
  query?: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{
  installation: {
    id: string;
    githubInstallationId: number;
    githubAccountLogin: string;
    githubAccountType: string;
  };
  repositories: GitHubRepository[];
  nextCursor: string | null;
}> {
  return requestJson(
    "GET",
    `github/installations/${installationId}/repositories`,
    {
      query: {
        q: query,
        cursor,
        limit,
      },
      signal,
    },
  );
}

export async function createGitHubConnection({
  installationId,
  ownerLogin,
  repoName,
  signal,
}: {
  installationId: number;
  ownerLogin: string;
  repoName: string;
  signal?: AbortSignal;
}): Promise<{ connection: GitHubConnection }> {
  return requestJson("POST", "github/connections", {
    body: {
      installationId,
      ownerLogin,
      repoName,
    },
    signal,
  });
}

export async function searchGitHubConnectionFiles({
  connectionId,
  query,
  limit,
  signal,
}: {
  connectionId: string;
  query?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{
  results: GitHubManifestEntry[];
  staleFallback: boolean;
}> {
  return requestJson("GET", `github/connections/${connectionId}/search`, {
    query: {
      q: query,
      limit,
    },
    signal,
  });
}

export async function previewGitHubConnectionFile({
  connectionId,
  path,
  signal,
}: {
  connectionId: string;
  path: string;
  signal?: AbortSignal;
}): Promise<{ file: GitHubFilePreview }> {
  return requestJson("GET", `github/connections/${connectionId}/file`, {
    query: { path },
    signal,
  });
}

export async function buildGitHubContextSources({
  connectionId,
  paths,
  signal,
}: {
  connectionId: string;
  paths: string[];
  signal?: AbortSignal;
}): Promise<{ sources: ContextSource[] }> {
  return requestJson("POST", `github/connections/${connectionId}/context-sources`, {
    body: { paths },
    signal,
  });
}
