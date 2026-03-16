import { neon } from "@/integrations/neon/client";

const ACCESS_TOKEN_REFRESH_GRACE_SECONDS = 30;
const PUBLISHABLE_KEY_AUTH_FALLBACK_WINDOW_MS = 2 * 60_000;

interface SessionRecord {
  access_token?: string;
  expires_at?: number | null;
}

interface SessionResult {
  data: { session: SessionRecord | null };
  error: unknown;
}

interface AuthClient {
  getSession: () => Promise<SessionResult>;
  refreshSession: () => Promise<SessionResult>;
}

export interface ServiceAuthAccessTokenOptions {
  forceRefresh?: boolean;
  allowSessionToken?: boolean;
  allowPublicKeyFallback?: boolean;
}

export interface ServiceAuthOptions {
  serviceUrl?: string;
  publishableKey?: string;
  authClient?: AuthClient;
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

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "Unknown error";
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

export function createServiceAuth({
  serviceUrl,
  publishableKey,
  authClient = neon.auth,
}: ServiceAuthOptions = {}) {
  let bootstrapTokenPromise: Promise<string> | null = null;
  let publishableKeyFallbackUntilMs = 0;

  function assertConfigured(): void {
    if (!serviceUrl) {
      throw new Error("Missing function runtime env. Set VITE_AGENT_SERVICE_URL.");
    }
  }

  function shouldPreferPublishableKeyFallback(): boolean {
    return Boolean(publishableKey) && publishableKeyFallbackUntilMs > Date.now();
  }

  function markPublishableKeyFallbackWindow(): void {
    if (!publishableKey) return;
    publishableKeyFallbackUntilMs = Date.now() + PUBLISHABLE_KEY_AUTH_FALLBACK_WINDOW_MS;
  }

  function clearPublishableKeyFallbackWindow(): void {
    publishableKeyFallbackUntilMs = 0;
  }

  async function clearLocalSession(): Promise<void> {
    markPublishableKeyFallbackWindow();
  }

  async function refreshSessionAccessToken(
    options: { allowPublicKeyFallback?: boolean } = {},
  ): Promise<string | null> {
    try {
      const {
        data: { session },
        error,
      } = await authClient.refreshSession();
      if (error) return null;
      if (session?.access_token) {
        clearPublishableKeyFallbackWindow();
        return session.access_token;
      }
      return null;
    } catch (error) {
      if (options.allowPublicKeyFallback !== false && isRetryableAuthSessionError(error)) {
        await clearLocalSession();
      }
      return null;
    }
  }

  async function getAccessToken({
    forceRefresh = false,
    allowSessionToken = true,
    allowPublicKeyFallback = true,
  }: ServiceAuthAccessTokenOptions = {}): Promise<string> {
    assertConfigured();

    if (forceRefresh) {
      const forcedToken = await refreshSessionAccessToken({ allowPublicKeyFallback });
      if (forcedToken) return forcedToken;
    }

    if (
      !forceRefresh &&
      allowSessionToken &&
      allowPublicKeyFallback &&
      shouldPreferPublishableKeyFallback() &&
      publishableKey
    ) {
      return publishableKey;
    }

    let sessionResult: SessionResult;
    try {
      sessionResult = await authClient.getSession();
    } catch (sessionError) {
      if (isRetryableAuthSessionError(sessionError) && allowPublicKeyFallback) {
        await clearLocalSession();
        if (publishableKey) return publishableKey;
      }
      throw createErrorWithCause(
        `Could not read auth session: ${errorMessage(sessionError)}`,
        sessionError,
      );
    }

    const {
      data: { session },
      error: sessionError,
    } = sessionResult;
    if (sessionError) {
      if (isRetryableAuthSessionError(sessionError) && allowPublicKeyFallback) {
        await clearLocalSession();
        if (publishableKey) return publishableKey;
      }
      throw createErrorWithCause(
        `Could not read auth session: ${errorMessage(sessionError)}`,
        sessionError,
      );
    }

    if (session?.access_token) {
      if (!allowSessionToken) {
        if (allowPublicKeyFallback) {
          await clearLocalSession();
        }
      } else {
        if (sessionExpiresSoon(session.expires_at)) {
          const refreshedToken = await refreshSessionAccessToken({ allowPublicKeyFallback });
          if (refreshedToken) return refreshedToken;
        }
        return session.access_token;
      }
    }

    if (allowPublicKeyFallback && publishableKey) return publishableKey;
    throw new Error("Sign in required.");
  }

  async function getAccessTokenWithBootstrap(
    options: ServiceAuthAccessTokenOptions = {},
  ): Promise<string> {
    if (options.forceRefresh || options.allowSessionToken === false || options.allowPublicKeyFallback === false) {
      bootstrapTokenPromise = null;
      return getAccessToken(options);
    }

    if (!bootstrapTokenPromise) {
      bootstrapTokenPromise = getAccessToken(options).finally(() => {
        bootstrapTokenPromise = null;
      });
    }
    return bootstrapTokenPromise;
  }

  function headersWithAccessToken(accessToken: string): Record<string, string> {
    assertConfigured();
    if (isPublicCredential(accessToken)) {
      return {
        "Content-Type": "application/json",
        apikey: accessToken,
      };
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }

  function headersWithPublishableKey(): Record<string, string> {
    if (!publishableKey) {
      throw new Error("Sign in required.");
    }
    return headersWithAccessToken(publishableKey);
  }

  async function getHeaders(
    options: ServiceAuthAccessTokenOptions = {},
  ): Promise<Record<string, string>> {
    const accessToken = await getAccessTokenWithBootstrap(options);
    return headersWithAccessToken(accessToken);
  }

  function isPublicCredential(accessToken: string): boolean {
    return Boolean(publishableKey && accessToken === publishableKey);
  }

  return {
    clearLocalSession,
    getAccessToken,
    getAccessTokenWithBootstrap,
    getHeaders,
    headersWithAccessToken,
    headersWithPublishableKey,
    isPublicCredential,
  };
}
