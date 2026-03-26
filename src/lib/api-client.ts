import {
  decodeJwtPayload,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUserId,
  getValidAccessToken,
  resolveRequestUrl,
} from "@/lib/browser-auth";

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: { cause?: unknown }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    if (options?.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
  }
}

export function getStoredTokens() {
  return {
    accessToken: getStoredAccessToken() ?? undefined,
    refreshToken: getStoredRefreshToken() ?? undefined,
  };
}

export function getAccessToken(): string | null {
  return getStoredAccessToken();
}

export function getCurrentUserId(): string | null {
  return getStoredUserId(getStoredAccessToken());
}

export function getCurrentTokenPayload(): Record<string, unknown> | null {
  const accessToken = getStoredAccessToken();
  return accessToken ? decodeJwtPayload(accessToken) : null;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return `Request failed (${response.status})`;
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

function buildHeaders(token: string | null, headers?: HeadersInit): Record<string, string> {
  const result = headersToRecord(headers);

  if (!("Content-Type" in result) && !("content-type" in result)) {
    result["Content-Type"] = "application/json";
  }
  if (token) {
    result.Authorization = `Bearer ${token}`;
  }

  return result;
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const requestUrl = resolveRequestUrl(path);
  const firstToken = await getValidAccessToken();
  const firstResponse = await fetch(requestUrl, {
    ...options,
    headers: buildHeaders(firstToken, options.headers),
  });

  if (firstResponse.status !== 401 || !getStoredRefreshToken()) {
    return firstResponse;
  }

  const refreshedToken = await getValidAccessToken({ forceRefresh: true });
  if (!refreshedToken || refreshedToken === firstToken) {
    return firstResponse;
  }

  return fetch(requestUrl, {
    ...options,
    headers: buildHeaders(refreshedToken, options.headers),
  });
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetchWithAuth(path, options);

  if (!response.ok) {
    throw new ApiClientError(await parseErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}

export async function apiFetchOptional<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  const response = await fetchWithAuth(path, options);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ApiClientError(await parseErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}
