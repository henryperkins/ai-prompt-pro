import { neon } from "@/integrations/neon/client";

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

function parsePositiveInteger(value?: string): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

const AGENT_SERVICE_URL = normalizeEnvValue(import.meta.env.VITE_AGENT_SERVICE_URL);
const PUBLIC_FUNCTION_API_KEY =
  normalizeEnvValue(import.meta.env.VITE_NEON_PUBLISHABLE_KEY);
const configuredEnhanceRequestTimeoutMs = parsePositiveInteger(
  normalizeEnvValue(import.meta.env.VITE_ENHANCE_REQUEST_TIMEOUT_MS),
);
const configuredEnhanceTransport = normalizeEnvValue(import.meta.env.VITE_ENHANCE_TRANSPORT);
const configuredEnhanceWebSocketConnectTimeoutMs = parsePositiveInteger(
  normalizeEnvValue(import.meta.env.VITE_ENHANCE_WS_CONNECT_TIMEOUT_MS),
);

let bootstrapTokenPromise: Promise<string> | null = null;
let publishableKeyFallbackUntilMs = 0;
const ACCESS_TOKEN_REFRESH_GRACE_SECONDS = 30;
const FUNCTION_NETWORK_RETRY_DELAY_MS = 250;
const PUBLISHABLE_KEY_AUTH_FALLBACK_WINDOW_MS = 2 * 60_000;
const DEFAULT_ENHANCE_REQUEST_TIMEOUT_MS = 90_000;
export const ENHANCE_REQUEST_TIMEOUT_MS =
  configuredEnhanceRequestTimeoutMs ?? DEFAULT_ENHANCE_REQUEST_TIMEOUT_MS;
const DEFAULT_ENHANCE_WS_CONNECT_TIMEOUT_MS = 3_500;
const ENHANCE_WS_CONNECT_TIMEOUT_MS =
  configuredEnhanceWebSocketConnectTimeoutMs ?? DEFAULT_ENHANCE_WS_CONNECT_TIMEOUT_MS;
const ENHANCE_WS_PROTOCOL = "promptforge.enhance.v1";

type EnhanceTransportMode = "auto" | "sse" | "ws";

function normalizeEnhanceTransportMode(value: string | undefined): EnhanceTransportMode {
  if (!value) return "auto";
  const normalized = value.trim().toLowerCase();
  if (normalized === "ws" || normalized === "websocket") return "ws";
  if (normalized === "sse" || normalized === "http") return "sse";
  return "auto";
}

const ENHANCE_TRANSPORT_MODE = normalizeEnhanceTransportMode(configuredEnhanceTransport);

export type AIClientErrorCode =
  | "unknown"
  | "network_unavailable"
  | "auth_required"
  | "auth_session_invalid"
  | "request_aborted"
  | "request_timeout"
  | "rate_limited"
  | "service_error"
  | "bad_response";

interface AIClientErrorInit {
  message: string;
  code: AIClientErrorCode;
  status?: number;
  retryable?: boolean;
  cause?: unknown;
}

export class AIClientError extends Error {
  readonly code: AIClientErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor({ message, code, status, retryable = false, cause }: AIClientErrorInit) {
    super(message);
    this.name = "AIClientError";
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

export function isAIClientError(error: unknown): error is AIClientError {
  return error instanceof AIClientError;
}

function sessionExpiresSoon(expiresAt: number | null | undefined): boolean {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowSeconds + ACCESS_TOKEN_REFRESH_GRACE_SECONDS;
}

function isRetryableAuthSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; status?: unknown; code?: unknown; name?: unknown };
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
    message.includes("load failed")
  );
}

function getAbortSignalReason(signal?: AbortSignal): unknown {
  if (!signal) return undefined;
  return (signal as AbortSignal & { reason?: unknown }).reason;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" && name.toLowerCase().includes("abort");
}

function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(getAbortSignalReason(signal) ?? new AIClientError({
        message: "Request was cancelled.",
        code: "request_aborted",
      }));
      return;
    }

    let timer: ReturnType<typeof globalThis.setTimeout> | null = null;

    const onAbort = () => {
      if (timer !== null) {
        globalThis.clearTimeout(timer);
      }
      signal?.removeEventListener("abort", onAbort);
      reject(getAbortSignalReason(signal) ?? new AIClientError({
        message: "Request was cancelled.",
        code: "request_aborted",
      }));
    };

    timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isTimeoutLikeErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("timeout") || normalized.includes("timed out");
}

function isNetworkLikeErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network request failed") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed") ||
    normalized.includes("connection") ||
    normalized.includes("offline") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  );
}

function isRetryableFunctionRequestError(error: unknown): boolean {
  if (isAIClientError(error)) {
    return error.retryable;
  }
  if (isRetryableAuthSessionError(error)) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; name?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const name = typeof candidate.name === "string" ? candidate.name.toLowerCase() : "";
  if (name.includes("abort")) return false;
  return isNetworkLikeErrorMessage(message);
}

function isLikelyLocalhostTarget(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("://localhost") ||
    normalized.includes("://127.0.0.1") ||
    normalized.includes("://[::1]")
  );
}

function getConfiguredServiceOrigin(): string | null {
  if (!AGENT_SERVICE_URL) return null;
  try {
    return new URL(AGENT_SERVICE_URL).origin;
  } catch {
    return AGENT_SERVICE_URL;
  }
}

function buildNetworkHint(name: "enhance-prompt" | "extract-url" | "infer-builder-fields"): string | null {
  if (typeof window === "undefined" || !AGENT_SERVICE_URL) return null;
  const appProtocol = window.location.protocol.toLowerCase();
  const appHost = window.location.hostname.toLowerCase();
  const serviceValue = AGENT_SERVICE_URL.toLowerCase();

  if (appProtocol === "https:" && serviceValue.startsWith("http://")) {
    if (name === "enhance-prompt") {
      return "The app is loaded over HTTPS but the enhancement service URL is HTTP. Configure VITE_AGENT_SERVICE_URL with an HTTPS endpoint.";
    }
    if (name === "extract-url") {
      return "The app is loaded over HTTPS but the URL extraction service URL is HTTP. Configure VITE_AGENT_SERVICE_URL with an HTTPS endpoint.";
    }
    return "The app is loaded over HTTPS but the inference service URL is HTTP. Configure VITE_AGENT_SERVICE_URL with an HTTPS endpoint.";
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(appHost) && isLikelyLocalhostTarget(serviceValue)) {
    if (name === "enhance-prompt") {
      return "The configured enhancement service points to localhost, which is not reachable from this deployed app.";
    }
    if (name === "extract-url") {
      return "The configured URL extraction service points to localhost, which is not reachable from this deployed app.";
    }
    return "The configured inference service points to localhost, which is not reachable from this deployed app.";
  }

  return null;
}

function serviceUnavailableMessage(name: "enhance-prompt" | "extract-url" | "infer-builder-fields"): string {
  const serviceOrigin = getConfiguredServiceOrigin();
  const destinationText = serviceOrigin ? ` at ${serviceOrigin}` : "";
  const hint = buildNetworkHint(name);

  if (name === "enhance-prompt") {
    return `Could not reach the enhancement service${destinationText}. ${hint || "Check your connection and try again."}`;
  }
  if (name === "extract-url") {
    return `Could not reach the URL extraction service${destinationText}. ${hint || "Check your connection and try again."}`;
  }
  return `Could not reach the inference service${destinationText}. ${hint || "Check your connection and try again."}`;
}

function timeoutMessage(name: "enhance-prompt" | "extract-url" | "infer-builder-fields"): string {
  if (name === "enhance-prompt") {
    return "Enhancement timed out. Please try again.";
  }
  if (name === "extract-url") {
    return "URL extraction timed out. Please try again.";
  }
  return "Inference timed out. Please try again.";
}

function errorCodeFromStatus(status: number | undefined): AIClientErrorCode {
  if (status === 401) return "auth_session_invalid";
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 504) return "request_timeout";
  if (typeof status === "number" && status >= 500) return "service_error";
  return "bad_response";
}

function messageLooksLikeAuthError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("sign in required") ||
    normalized.includes("auth session") ||
    normalized.includes("invalid or expired auth session")
  );
}

function messageLooksLikeRateLimitError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("rate limit") || normalized.includes("too many requests") || normalized.includes("429");
}

function messageLooksLikeServiceError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("service unavailable") || normalized.includes("temporarily unavailable");
}

function normalizeClientError(
  name: "enhance-prompt" | "extract-url" | "infer-builder-fields",
  error: unknown,
  options: { status?: number; code?: AIClientErrorCode } = {},
): AIClientError {
  if (isAIClientError(error)) return error;

  if (isAbortError(error)) {
    return new AIClientError({
      message: "Request was cancelled.",
      code: "request_aborted",
      status: options.status,
      retryable: true,
      cause: error,
    });
  }

  const rawMessage = errorMessage(error);
  const message = rawMessage.trim() || "Unexpected error from AI service.";
  const status = options.status;

  if (options.code) {
    return new AIClientError({
      message,
      code: options.code,
      status,
      retryable: options.code === "network_unavailable" || options.code === "rate_limited" || options.code === "service_error" || options.code === "request_timeout",
      cause: error,
    });
  }

  if (messageLooksLikeAuthError(message)) {
    return new AIClientError({
      message,
      code: message.toLowerCase().includes("sign in required") ? "auth_required" : "auth_session_invalid",
      status,
      cause: error,
    });
  }

  if (messageLooksLikeRateLimitError(message) || status === 429) {
    return new AIClientError({
      message,
      code: "rate_limited",
      status,
      retryable: true,
      cause: error,
    });
  }

  if (isTimeoutLikeErrorMessage(message) || status === 408 || status === 504) {
    return new AIClientError({
      message: timeoutMessage(name),
      code: "request_timeout",
      status,
      retryable: true,
      cause: error,
    });
  }

  if (isNetworkLikeErrorMessage(message)) {
    return new AIClientError({
      message: serviceUnavailableMessage(name),
      code: "network_unavailable",
      status,
      retryable: true,
      cause: error,
    });
  }

  if (messageLooksLikeServiceError(message) || (typeof status === "number" && status >= 500)) {
    return new AIClientError({
      message,
      code: "service_error",
      status,
      retryable: true,
      cause: error,
    });
  }

  return new AIClientError({
    message,
    code: errorCodeFromStatus(status),
    status,
    retryable: typeof status === "number" && status >= 500,
    cause: error,
  });
}

function errorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return "Unexpected error from AI service.";
}

function createErrorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  Object.defineProperty(error, "cause", {
    value: cause,
    enumerable: false,
    configurable: true,
    writable: true,
  });
  return error;
}

function shouldPreferPublishableKeyFallback(): boolean {
  return Boolean(PUBLIC_FUNCTION_API_KEY) && publishableKeyFallbackUntilMs > Date.now();
}

function markPublishableKeyFallbackWindow(): void {
  if (!PUBLIC_FUNCTION_API_KEY) return;
  publishableKeyFallbackUntilMs = Date.now() + PUBLISHABLE_KEY_AUTH_FALLBACK_WINDOW_MS;
}

function clearPublishableKeyFallbackWindow(): void {
  publishableKeyFallbackUntilMs = 0;
}

async function refreshSessionAccessToken(): Promise<string | null> {
  try {
    const {
      data: { session },
      error,
    } = await neon.auth.refreshSession();
    if (error) return null;
    if (session?.access_token) {
      clearPublishableKeyFallbackWindow();
      return session.access_token;
    }
    return null;
  } catch (error) {
    if (isRetryableAuthSessionError(error)) {
      await clearLocalSession();
    }
    return null;
  }
}

async function clearLocalSession(): Promise<void> {
  // Prefer the publishable-key fallback path for a short window instead of
  // trying Neon Auth sign-out here, which can emit noisy 5xx errors when
  // auth infrastructure is degraded.
  markPublishableKeyFallbackWindow();
}

function assertFunctionRuntimeEnv(): void {
  if (!AGENT_SERVICE_URL) {
    throw new Error(
      "Missing function runtime env. Set VITE_AGENT_SERVICE_URL.",
    );
  }
}

function functionUrl(name: "enhance-prompt" | "extract-url" | "infer-builder-fields"): string {
  assertFunctionRuntimeEnv();
  const base = (AGENT_SERVICE_URL as string).replace(/\/+$/, "");
  const route =
    name === "enhance-prompt"
      ? "enhance"
      : name;
  return `${base}/${route}`;
}

function enhanceWebSocketUrl(): string {
  const httpUrl = functionUrl("enhance-prompt");
  const parsed = new URL(httpUrl);
  if (parsed.protocol === "https:") {
    parsed.protocol = "wss:";
  } else if (parsed.protocol === "http:") {
    parsed.protocol = "ws:";
  }

  parsed.pathname = parsed.pathname.replace(/\/enhance$/, "/enhance/ws");
  return parsed.toString();
}

function buildEnhanceWebSocketProtocols(): string[] {
  return [ENHANCE_WS_PROTOCOL];
}

function buildEnhanceWebSocketStartMessage(
  payload: Record<string, unknown>,
  accessToken: string,
): Record<string, unknown> {
  return {
    type: "enhance.start",
    auth: {
      bearer_token: accessToken,
      ...(PUBLIC_FUNCTION_API_KEY ? { apikey: PUBLIC_FUNCTION_API_KEY } : {}),
    },
    payload,
  };
}

async function getAccessToken({
  forceRefresh = false,
  allowSessionToken = true,
}: {
  forceRefresh?: boolean;
  allowSessionToken?: boolean;
} = {}): Promise<string> {
  assertFunctionRuntimeEnv();

  if (forceRefresh) {
    const forcedToken = await refreshSessionAccessToken();
    if (forcedToken) return forcedToken;
  }

  if (!forceRefresh && allowSessionToken && shouldPreferPublishableKeyFallback() && PUBLIC_FUNCTION_API_KEY) {
    return PUBLIC_FUNCTION_API_KEY;
  }

  let sessionResult!: {
    data: { session: { access_token?: string; expires_at?: number | null } | null };
    error: unknown;
  };

  try {
    sessionResult = await neon.auth.getSession();
  } catch (sessionError) {
    if (isRetryableAuthSessionError(sessionError)) {
      await clearLocalSession();
      if (PUBLIC_FUNCTION_API_KEY) return PUBLIC_FUNCTION_API_KEY;
      throw createErrorWithCause(`Could not read auth session: ${errorMessage(sessionError)}`, sessionError);
    }
    throw createErrorWithCause(`Could not read auth session: ${errorMessage(sessionError)}`, sessionError);
  }

  const {
    data: { session },
    error: sessionError,
  } = sessionResult;
  if (sessionError) {
    if (isRetryableAuthSessionError(sessionError)) {
      await clearLocalSession();
      if (PUBLIC_FUNCTION_API_KEY) return PUBLIC_FUNCTION_API_KEY;
      throw createErrorWithCause(`Could not read auth session: ${errorMessage(sessionError)}`, sessionError);
    }
    throw createErrorWithCause(`Could not read auth session: ${errorMessage(sessionError)}`, sessionError);
  }
  if (session?.access_token) {
    if (!allowSessionToken) {
      await clearLocalSession();
    } else {
      if (sessionExpiresSoon(session.expires_at)) {
        const refreshedToken = await refreshSessionAccessToken();
        if (refreshedToken) return refreshedToken;
      }
      return session.access_token;
    }
  }

  if (PUBLIC_FUNCTION_API_KEY) return PUBLIC_FUNCTION_API_KEY;
  throw new Error("Sign in required.");
}

async function getAccessTokenWithBootstrap({
  forceRefresh = false,
  allowSessionToken = true,
}: {
  forceRefresh?: boolean;
  allowSessionToken?: boolean;
} = {}): Promise<string> {
  if (forceRefresh || !allowSessionToken) {
    bootstrapTokenPromise = null;
    return getAccessToken({ forceRefresh, allowSessionToken });
  }

  if (!bootstrapTokenPromise) {
    bootstrapTokenPromise = getAccessToken().finally(() => {
      bootstrapTokenPromise = null;
    });
  }
  return bootstrapTokenPromise;
}

async function functionHeaders({
  forceRefresh = false,
  allowSessionToken = true,
}: {
  forceRefresh?: boolean;
  allowSessionToken?: boolean;
} = {}): Promise<Record<string, string>> {
  assertFunctionRuntimeEnv();
  const accessToken = await getAccessTokenWithBootstrap({ forceRefresh, allowSessionToken });
  return functionHeadersWithAccessToken(accessToken);
}

function functionHeadersWithAccessToken(accessToken: string): Record<string, string> {
  assertFunctionRuntimeEnv();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
  if (PUBLIC_FUNCTION_API_KEY) {
    headers.apikey = PUBLIC_FUNCTION_API_KEY;
  }
  return headers;
}

function functionHeadersWithPublishableKey(): Record<string, string> {
  if (!PUBLIC_FUNCTION_API_KEY) {
    throw new Error("Sign in required.");
  }
  return functionHeadersWithAccessToken(PUBLIC_FUNCTION_API_KEY);
}

function normalizeServerErrorCode(code: unknown): AIClientErrorCode | undefined {
  if (typeof code !== "string" || !code.trim()) return undefined;
  const normalized = code.trim().toLowerCase().replace(/[/.\s-]/g, "_");
  if (normalized.includes("rate_limit") || normalized === "429") return "rate_limited";
  if (normalized.includes("timeout")) return "request_timeout";
  if (
    normalized === "auth_required"
    || normalized.includes("sign_in_required")
    || normalized.includes("missing_bearer")
    || normalized.includes("missing_token")
    || normalized.includes("unauthenticated")
  ) {
    return "auth_required";
  }
  if (normalized.includes("auth") || normalized.includes("session")) return "auth_session_invalid";
  if (normalized.includes("network")) return "network_unavailable";
  if (normalized.includes("service")) return "service_error";
  if (normalized.includes("bad") || normalized.includes("invalid")) return "bad_response";
  return undefined;
}

async function readFunctionError(resp: Response): Promise<{ message: string; code?: AIClientErrorCode }> {
  const fallbackMessage = `Request failed with status ${resp.status}.`;
  const errorData = await resp.json().catch(() => null);
  if (!errorData || typeof errorData !== "object") {
    return { message: fallbackMessage };
  }

  const normalizedCode = normalizeServerErrorCode((errorData as { code?: unknown }).code);

  const maybeError = (errorData as { error?: unknown }).error;
  if (typeof maybeError === "string" && maybeError.trim()) {
    return {
      message: maybeError.trim(),
      code: normalizedCode,
    };
  }

  const maybeDetail = (errorData as { detail?: unknown }).detail;
  if (typeof maybeDetail === "string" && maybeDetail.trim()) {
    return {
      message: maybeDetail.trim(),
      code: normalizedCode,
    };
  }

  return {
    message: fallbackMessage,
    code: normalizedCode,
  };
}

function isInvalidAuthSessionError(status: number, errorMessage: string): boolean {
  if (status !== 401) return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("invalid or expired auth session") ||
    (normalized.includes("invalid") && normalized.includes("session")) ||
    (normalized.includes("expired") && normalized.includes("session"))
  );
}

function isRecoverableAuthServiceError(status: number, errorMessage: string): boolean {
  if (status !== 503) return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("authentication service is unavailable because neon auth is not configured") ||
    normalized.includes("authentication service is temporarily unavailable")
  );
}

async function postFunctionWithAuthRecovery(
  name: "enhance-prompt" | "extract-url" | "infer-builder-fields",
  payload: Record<string, unknown>,
  options: { signal?: AbortSignal } = {},
): Promise<Response> {
  const request = (headers: Record<string, string>) =>
    fetch(functionUrl(name), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: options.signal,
    });
  const requestWithRetry = async (headers: Record<string, string>): Promise<Response> => {
    try {
      return await request(headers);
    } catch (firstError) {
      if (!isRetryableFunctionRequestError(firstError)) {
        throw firstError;
      }

      await waitFor(FUNCTION_NETWORK_RETRY_DELAY_MS, options.signal);
      return request(headers);
    }
  };

  try {
    let response = await requestWithRetry(await functionHeaders());
    if (response.ok) return response;

    let errorDetails = await readFunctionError(response);
    let errorMessage = errorDetails.message;
    const firstFailureWasAuth =
      response.status === 401
      || isInvalidAuthSessionError(response.status, errorMessage)
      || isRecoverableAuthServiceError(response.status, errorMessage);
    if (!firstFailureWasAuth) {
      throw normalizeClientError(name, errorMessage, {
        status: response.status,
        code: errorDetails.code,
      });
    }

    response = await requestWithRetry(await functionHeaders({ forceRefresh: true, allowSessionToken: false }));
    if (response.ok) return response;

    errorDetails = await readFunctionError(response);
    errorMessage = errorDetails.message;
    const secondFailureWasAuth =
      response.status === 401
      || isInvalidAuthSessionError(response.status, errorMessage)
      || isRecoverableAuthServiceError(response.status, errorMessage);
    if (!secondFailureWasAuth) {
      throw normalizeClientError(name, errorMessage, {
        status: response.status,
        code: errorDetails.code,
      });
    }

    // If refresh returned another unusable session token, force a deterministic API-key retry.
    await clearLocalSession();
    response = await requestWithRetry(functionHeadersWithPublishableKey());
    if (response.ok) return response;

    errorDetails = await readFunctionError(response);
    throw normalizeClientError(name, errorDetails.message, {
      status: response.status,
      code: errorDetails.code,
    });
  } catch (error) {
    throw normalizeClientError(name, error);
  }
}

function extractSseErrorDetails(payload: unknown): {
  message: string;
  code?: AIClientErrorCode;
  status?: number;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as { error?: unknown; code?: unknown; status?: unknown };

  if (typeof data.error === "string" && data.error.trim()) {
    const status = typeof data.status === "number" ? data.status : undefined;
    return {
      message: data.error.trim(),
      status,
      code: normalizeServerErrorCode(data.code),
    };
  }

  if (data.error && typeof data.error === "object") {
    const errObject = data.error as { message?: unknown; code?: unknown; status?: unknown };
    const message =
      typeof errObject.message === "string" && errObject.message.trim()
        ? errObject.message.trim()
        : null;
    if (!message) return null;

    const status =
      typeof errObject.status === "number"
        ? errObject.status
        : typeof data.status === "number"
          ? data.status
          : undefined;
    return {
      message,
      status,
      code: normalizeServerErrorCode(errObject.code ?? data.code),
    };
  }

  return null;
}

function extractTextValue(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (!value || typeof value !== "object") return null;
  const obj = value as { text?: unknown; content?: unknown; output_text?: unknown; delta?: unknown };
  if (typeof obj.text === "string" && obj.text) return obj.text;
  if (typeof obj.content === "string" && obj.content) return obj.content;
  if (typeof obj.output_text === "string" && obj.output_text) return obj.output_text;
  if (typeof obj.delta === "string" && obj.delta) return obj.delta;
  return null;
}

function isItemDeltaEventType(eventType: string | null): boolean {
  if (!eventType) return false;
  if (eventType === "item/delta" || eventType === "item.delta") return true;
  if (/^item\/[^/]+\/delta$/.test(eventType)) return true;
  if (/^item\.[^.]+\.delta$/.test(eventType)) return true;
  return false;
}

function isItemCompletedEventType(eventType: string | null): boolean {
  if (!eventType) return false;
  if (eventType === "item/completed" || eventType === "item.completed") return true;
  if (/^item\/[^/]+\/completed$/.test(eventType)) return true;
  if (/^item\.[^.]+\.completed$/.test(eventType)) return true;
  return false;
}

function isResponseOutputTextDelta(responseType: string | null): boolean {
  return responseType === "response.output_text.delta";
}

function isResponseOutputTextDone(responseType: string | null): boolean {
  return responseType === "response.output_text.done";
}

export interface EnhanceThreadOptions {
  modelReasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  webSearchEnabled?: boolean;
}

export interface EnhanceBuilderFields {
  role: string;
  context: string;
  task: string;
  outputFormat: string;
  examples: string;
  guardrails: string;
}

function isRenderableItemType(itemType: string | null): boolean {
  if (!itemType) return true;
  const normalized = itemType.trim().toLowerCase();
  if (!normalized) return true;

  return (
    normalized === "agent_message" ||
    normalized === "assistant_message" ||
    normalized === "enhancement" ||
    normalized === "output_text" ||
    normalized === "text" ||
    normalized === "message"
  );
}

function shouldEmitSseText(meta: {
  eventType: string | null;
  responseType: string | null;
  itemType: string | null;
}): boolean {
  if (isResponseOutputTextDelta(meta.responseType) || isResponseOutputTextDone(meta.responseType)) {
    return true;
  }

  if (isItemDeltaEventType(meta.eventType) || isItemCompletedEventType(meta.eventType)) {
    return isRenderableItemType(meta.itemType);
  }

  return true;
}

export function extractSseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    choices?: Array<{ delta?: { content?: unknown } }>;
    event?: unknown;
    type?: unknown;
    delta?: unknown;
    output_text?: unknown;
    text?: unknown;
    payload?: unknown;
    item?: unknown;
  };

  const chatCompletionsDelta = data.choices?.[0]?.delta?.content;
  if (typeof chatCompletionsDelta === "string" && chatCompletionsDelta) {
    return chatCompletionsDelta;
  }

  // Codex-style turn/item streaming event shape.
  const eventType =
    typeof data.event === "string"
      ? data.event
      : typeof data.type === "string"
        ? data.type
        : null;
  const responseType = typeof data.type === "string" ? data.type : null;

  if (isItemDeltaEventType(eventType) || isResponseOutputTextDelta(responseType)) {
    return (
      extractTextValue(data.delta) ||
      extractTextValue((data.item as { delta?: unknown } | undefined)?.delta) ||
      extractTextValue((data.payload as { delta?: unknown } | undefined)?.delta) ||
      extractTextValue(data.item)
    );
  }

  if (isItemCompletedEventType(eventType) || isResponseOutputTextDone(responseType)) {
    return (
      extractTextValue(data.text) ||
      extractTextValue((data.payload as { text?: unknown; output_text?: unknown } | undefined)?.text) ||
      extractTextValue(
        (data.payload as { text?: unknown; output_text?: unknown } | undefined)?.output_text,
      ) ||
      extractTextValue((data.item as { text?: unknown; output_text?: unknown } | undefined)?.text) ||
      extractTextValue((data.item as { text?: unknown; output_text?: unknown } | undefined)?.output_text) ||
      extractTextValue(data.output_text)
    );
  }

  // Responses API streaming event shape.
  if (isResponseOutputTextDelta(responseType) && typeof data.delta === "string" && data.delta) {
    return data.delta;
  }

  // Fallback for any adapter that emits output_text directly.
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  return null;
}

export function readSseEventMeta(payload: unknown): {
  eventType: string | null;
  responseType: string | null;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  itemType: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return {
      eventType: null,
      responseType: null,
      threadId: null,
      turnId: null,
      itemId: null,
      itemType: null,
    };
  }

  const data = payload as {
    event?: unknown;
    type?: unknown;
    thread_id?: unknown;
    turn_id?: unknown;
    item_id?: unknown;
    item_type?: unknown;
    item?: unknown;
  };
  const responseType =
    typeof data.type === "string" && data.type.startsWith("response.") ? data.type : null;
  const eventType =
    typeof data.event === "string"
      ? data.event
      : responseType ||
      (typeof data.type === "string"
        ? data.type
        : null);

  const threadId = typeof data.thread_id === "string" ? data.thread_id : null;
  const turnId = typeof data.turn_id === "string" ? data.turn_id : null;

  const itemId =
    typeof data.item_id === "string"
      ? data.item_id
      : typeof (data.item as { id?: unknown } | undefined)?.id === "string"
        ? ((data.item as { id?: unknown } | undefined)?.id as string)
        : null;

  const itemType =
    typeof data.item_type === "string"
      ? data.item_type
      : typeof (data.item as { type?: unknown } | undefined)?.type === "string"
        ? ((data.item as { type?: unknown } | undefined)?.type as string)
        : null;

  return { eventType, responseType, threadId, turnId, itemId, itemType };
}

type WebSocketEnhanceOutcome =
  | { outcome: "completed" }
  | { outcome: "aborted" }
  | { outcome: "fallback" }
  | { outcome: "error"; error: AIClientError };

async function streamEnhanceViaWebSocket({
  payload,
  signal,
  didTimeout,
  connectTimeoutMs,
  onDelta,
  onEvent,
}: {
  payload: Record<string, unknown>;
  signal: AbortSignal;
  didTimeout: () => boolean;
  connectTimeoutMs: number;
  onDelta: (text: string) => void;
  onEvent?: (event: {
    eventType: string | null;
    responseType: string | null;
    threadId: string | null;
    turnId: string | null;
    itemId: string | null;
    itemType: string | null;
    payload: unknown;
  }) => void;
}): Promise<WebSocketEnhanceOutcome> {
  if (typeof globalThis.WebSocket !== "function") {
    return { outcome: "fallback" };
  }

  let accessToken: string;
  try {
    accessToken = await getAccessTokenWithBootstrap();
  } catch (error) {
    return {
      outcome: "error",
      error: normalizeClientError("enhance-prompt", error),
    };
  }

  const url = enhanceWebSocketUrl();
  const protocols = buildEnhanceWebSocketProtocols();
  const requestBody = buildEnhanceWebSocketStartMessage(payload, accessToken);

  return new Promise<WebSocketEnhanceOutcome>((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, protocols);
    } catch {
      resolve({ outcome: "fallback" });
      return;
    }

    let resolved = false;
    let sawPayload = false;
    let hasOpened = false;
    let streamDone = false;
    let terminalError: AIClientError | null = null;
    let connectTimeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
    const deltaItemIds = new Set<string>();

    const resolveOnce = (value: WebSocketEnhanceOutcome) => {
      if (resolved) return;
      resolved = true;
      signal.removeEventListener("abort", onAbort);
      if (connectTimeoutHandle !== null) {
        globalThis.clearTimeout(connectTimeoutHandle);
        connectTimeoutHandle = null;
      }
      resolve(value);
    };

    const onAbort = () => {
      const abortReason = getAbortSignalReason(signal);
      let abortOutcome: WebSocketEnhanceOutcome;

      if (
        (isAIClientError(abortReason) && abortReason.code === "request_timeout")
        || didTimeout()
      ) {
        const timeoutError = isAIClientError(abortReason)
          ? abortReason
          : new AIClientError({
            message: timeoutMessage("enhance-prompt"),
            code: "request_timeout",
            retryable: true,
          });
        abortOutcome = { outcome: "error", error: timeoutError };
      } else {
        abortOutcome = { outcome: "aborted" };
      }

      resolveOnce(abortOutcome);
      try {
        ws.close(1000, "client_abort");
      } catch {
        // Ignore close races.
      }
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });

    connectTimeoutHandle = globalThis.setTimeout(() => {
      if (resolved || hasOpened || sawPayload) return;
      resolveOnce({ outcome: "fallback" });
      try {
        ws.close(1000, "connect_timeout");
      } catch {
        // Ignore close races.
      }
    }, connectTimeoutMs);

    ws.addEventListener("open", () => {
      hasOpened = true;
      if (signal.aborted) {
        onAbort();
        return;
      }
      ws.send(JSON.stringify(requestBody));
    });

    ws.addEventListener("message", (event) => {
      sawPayload = true;
      const rawData = typeof event.data === "string" ? event.data : "";
      if (!rawData) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawData);
      } catch {
        return;
      }

      const streamType = (parsed as { type?: unknown }).type;
      if (streamType === "stream.done") {
        streamDone = true;
        try {
          ws.close(1000, "done");
        } catch {
          // Ignore close races.
        }
        return;
      }

      const parsedError = extractSseErrorDetails(parsed);
      if (parsedError) {
        terminalError = normalizeClientError("enhance-prompt", parsedError.message, {
          status: parsedError.status,
          code: parsedError.code,
        });
        try {
          ws.close(1011, "turn_error");
        } catch {
          // Ignore close races.
        }
        return;
      }

      const meta = readSseEventMeta(parsed);
      onEvent?.({ ...meta, payload: parsed });

      if (isItemDeltaEventType(meta.eventType) || isResponseOutputTextDelta(meta.responseType)) {
        if (meta.itemId) deltaItemIds.add(meta.itemId);
      }
      if (
        (isItemCompletedEventType(meta.eventType) || isResponseOutputTextDone(meta.responseType)) &&
        meta.itemId &&
        deltaItemIds.has(meta.itemId)
      ) {
        return;
      }

      if (!shouldEmitSseText(meta)) {
        return;
      }

      const content = extractSseText(parsed);
      if (content) onDelta(content);
    });

    ws.addEventListener("close", () => {
      if (signal.aborted) {
        resolveOnce({ outcome: "aborted" });
        return;
      }

      if (terminalError) {
        resolveOnce({ outcome: "error", error: terminalError });
        return;
      }

      if (streamDone) {
        resolveOnce({ outcome: "completed" });
        return;
      }

      if (!sawPayload) {
        resolveOnce({ outcome: "fallback" });
        return;
      }

      resolveOnce({
        outcome: "error",
        error: new AIClientError({
          message: serviceUnavailableMessage("enhance-prompt"),
          code: "network_unavailable",
          retryable: true,
        }),
      });
    });

    ws.addEventListener("error", () => {
      if (!sawPayload) {
        try {
          ws.close();
        } catch {
          // Ignore close races.
        }
      }
    });
  });
}


export async function streamEnhance({
  prompt,
  threadId,
  threadOptions,
  builderMode,
  builderFields,
  onDelta,
  onDone,
  onError,
  onEvent,
  signal,
  timeoutMs = ENHANCE_REQUEST_TIMEOUT_MS,
}: {
  prompt: string;
  threadId?: string;
  threadOptions?: EnhanceThreadOptions;
  builderMode?: "quick" | "guided" | "advanced";
  builderFields?: EnhanceBuilderFields;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: AIClientError) => void;
  onEvent?: (event: {
    eventType: string | null;
    responseType: string | null;
    threadId: string | null;
    turnId: string | null;
    itemId: string | null;
    itemType: string | null;
    payload: unknown;
  }) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}) {
  const requestController = new AbortController();
  const linkSignalAbort = (sourceSignal?: AbortSignal) => {
    if (!sourceSignal) return () => undefined;
    if (sourceSignal.aborted) {
      requestController.abort(getAbortSignalReason(sourceSignal));
      return () => undefined;
    }

    const onAbort = () => {
      requestController.abort(getAbortSignalReason(sourceSignal));
    };
    sourceSignal.addEventListener("abort", onAbort, { once: true });
    return () => {
      sourceSignal.removeEventListener("abort", onAbort);
    };
  };

  const unlinkExternalSignal = linkSignalAbort(signal);
  let timeoutTriggered = false;
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutHandle = globalThis.setTimeout(() => {
      timeoutTriggered = true;
      requestController.abort(
        new AIClientError({
          message: timeoutMessage("enhance-prompt"),
          code: "request_timeout",
          retryable: true,
        }),
      );
    }, timeoutMs);
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const payload: Record<string, unknown> = { prompt };
    const normalizedThreadId = typeof threadId === "string" ? threadId.trim() : "";
    if (normalizedThreadId) {
      payload.thread_id = normalizedThreadId;
    }
    if (threadOptions && typeof threadOptions === "object") {
      payload.thread_options = threadOptions;
    }
    if (builderMode) {
      payload.builder_mode = builderMode;
    }
    if (builderFields && typeof builderFields === "object") {
      payload.builder_fields = {
        role: typeof builderFields.role === "string" ? builderFields.role : "",
        context: typeof builderFields.context === "string" ? builderFields.context : "",
        task: typeof builderFields.task === "string" ? builderFields.task : "",
        output_format: typeof builderFields.outputFormat === "string" ? builderFields.outputFormat : "",
        examples: typeof builderFields.examples === "string" ? builderFields.examples : "",
        guardrails: typeof builderFields.guardrails === "string" ? builderFields.guardrails : "",
      };
    }

    const shouldTryWebSocket =
      ENHANCE_TRANSPORT_MODE !== "sse"
      && typeof globalThis.WebSocket === "function";
    if (shouldTryWebSocket) {
      const resolvedConnectTimeoutMs =
        typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
          ? Math.max(250, Math.min(ENHANCE_WS_CONNECT_TIMEOUT_MS, Math.floor(timeoutMs * 0.35)))
          : ENHANCE_WS_CONNECT_TIMEOUT_MS;
      const wsResult = await streamEnhanceViaWebSocket({
        payload,
        signal: requestController.signal,
        didTimeout: () => timeoutTriggered,
        connectTimeoutMs: resolvedConnectTimeoutMs,
        onDelta,
        onEvent,
      });

      if (wsResult.outcome === "completed") {
        onDone();
        return;
      }
      if (wsResult.outcome === "aborted") {
        return;
      }
      if (wsResult.outcome === "error") {
        if (
          ENHANCE_TRANSPORT_MODE === "auto"
          && (
            (wsResult.error.retryable && wsResult.error.code !== "request_timeout")
            || wsResult.error.code === "auth_session_invalid"
            || wsResult.error.code === "auth_required"
          )
        ) {
          // Fall through to SSE transport as a compatibility fallback.
        } else {
          onError(wsResult.error);
          return;
        }
      } else if (wsResult.outcome === "fallback") {
        if (ENHANCE_TRANSPORT_MODE === "ws") {
          onError(new AIClientError({
            message: serviceUnavailableMessage("enhance-prompt"),
            code: "network_unavailable",
            retryable: true,
          }));
          return;
        }
      } else {
        return;
      }
    }

    const resp = await postFunctionWithAuthRecovery("enhance-prompt", payload, {
      signal: requestController.signal,
    });

    if (!resp.body) {
      onError(new AIClientError({
        message: "No response body from enhancement service.",
        code: "bad_response",
      }));
      return;
    }

    reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let terminalError: AIClientError | null = null;
    const deltaItemIds = new Set<string>();

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const parsedError = extractSseErrorDetails(parsed);
          if (parsedError) {
            terminalError = normalizeClientError("enhance-prompt", parsedError.message, {
              status: parsedError.status,
              code: parsedError.code,
            });
            streamDone = true;
            break;
          }

          const meta = readSseEventMeta(parsed);
          onEvent?.({ ...meta, payload: parsed });

          if (isItemDeltaEventType(meta.eventType) || isResponseOutputTextDelta(meta.responseType)) {
            if (meta.itemId) deltaItemIds.add(meta.itemId);
          }
          if (
            (isItemCompletedEventType(meta.eventType) || isResponseOutputTextDone(meta.responseType)) &&
            meta.itemId &&
            deltaItemIds.has(meta.itemId)
          ) {
            continue;
          }

          if (!shouldEmitSseText(meta)) {
            continue;
          }

          const content = extractSseText(parsed);
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (terminalError) {
      onError(terminalError);
      return;
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const parsedError = extractSseErrorDetails(parsed);
          if (parsedError) {
            terminalError = normalizeClientError("enhance-prompt", parsedError.message, {
              status: parsedError.status,
              code: parsedError.code,
            });
            break;
          }

          const meta = readSseEventMeta(parsed);
          onEvent?.({ ...meta, payload: parsed });

          if (isItemDeltaEventType(meta.eventType) || isResponseOutputTextDelta(meta.responseType)) {
            if (meta.itemId) deltaItemIds.add(meta.itemId);
          }
          if (
            (isItemCompletedEventType(meta.eventType) || isResponseOutputTextDone(meta.responseType)) &&
            meta.itemId &&
            deltaItemIds.has(meta.itemId)
          ) {
            continue;
          }

          if (!shouldEmitSseText(meta)) {
            continue;
          }

          const content = extractSseText(parsed);
          if (content) onDelta(content);
        } catch {
          /* ignore */
        }
      }
    }

    if (terminalError) {
      onError(terminalError);
      return;
    }

    onDone();
  } catch (e) {
    const abortReason = requestController.signal.aborted
      ? getAbortSignalReason(requestController.signal)
      : null;
    const normalizedError = normalizeClientError("enhance-prompt", abortReason ?? e);
    if (normalizedError.code === "request_aborted") {
      return;
    }

    console.error("Stream error:", normalizedError);
    onError(normalizedError);
  } finally {
    unlinkExternalSignal();
    if (timeoutHandle !== null) {
      globalThis.clearTimeout(timeoutHandle);
    }
    if (reader) {
      await reader.cancel().catch(() => undefined);
    }
  }
}

export async function extractUrl(url: string): Promise<{ title: string; content: string }> {
  const resp = await postFunctionWithAuthRecovery("extract-url", { url });

  return resp.json();
}

export interface InferBuilderFieldsInput {
  prompt: string;
  sourceSummaries?: string[];
  currentFields?: {
    role?: string;
    tone?: string;
    lengthPreference?: string;
    format?: string[];
    constraints?: string[];
  };
  lockMetadata?: Record<string, "ai" | "user" | "empty">;
}

export interface InferBuilderFieldsOutput {
  inferredUpdates?: {
    role?: string;
    tone?: string;
    lengthPreference?: string;
    format?: string[];
    constraints?: string[];
  };
  inferredFields?: string[];
  suggestionChips?: Array<{
    id?: string;
    label?: string;
    description?: string;
    action?: {
      type?: string;
      updates?: Record<string, unknown>;
      fields?: string[];
      text?: string;
    };
  }>;
  confidence?: Record<string, number>;
}

export async function inferBuilderFields(
  input: InferBuilderFieldsInput,
): Promise<InferBuilderFieldsOutput> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return {
      inferredUpdates: {},
      inferredFields: [],
      suggestionChips: [],
    };
  }

  const payload: Record<string, unknown> = {
    prompt,
  };

  if (Array.isArray(input.sourceSummaries) && input.sourceSummaries.length > 0) {
    payload.source_summaries = input.sourceSummaries;
  }
  if (input.currentFields && typeof input.currentFields === "object") {
    payload.current_fields = input.currentFields;
  }
  if (input.lockMetadata && typeof input.lockMetadata === "object") {
    payload.lock_metadata = input.lockMetadata;
  }

  const resp = await postFunctionWithAuthRecovery("infer-builder-fields", payload);
  const data = await resp.json().catch(() => ({}));

  return data && typeof data === "object"
    ? (data as InferBuilderFieldsOutput)
    : {
      inferredUpdates: {},
      inferredFields: [],
      suggestionChips: [],
    };
}
