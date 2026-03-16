import { createHash } from "node:crypto";
import { createGitHubError } from "./github-errors.mjs";

function normalizeBaseUrl(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "");
}

function normalizeServiceRoleKey(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildQueryString(query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null || entry === "") return;
        params.append(key, String(entry));
      });
      return;
    }
    params.set(key, String(value));
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function compactHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => typeof value === "string" && value.trim()),
  );
}

function textForErrorBody(payload) {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (!payload || typeof payload !== "object") return "";
  const candidate = payload;
  const message = [
    typeof candidate.message === "string" ? candidate.message : "",
    typeof candidate.error === "string" ? candidate.error : "",
    typeof candidate.details === "string" ? candidate.details : "",
    typeof candidate.hint === "string" ? candidate.hint : "",
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
  return message;
}

export function createNeonDataApiClient({
  dataApiUrl,
  serviceRoleKey,
  fetchImpl = globalThis.fetch,
} = {}) {
  const baseUrl = normalizeBaseUrl(dataApiUrl);
  const apiKey = normalizeServiceRoleKey(serviceRoleKey);

  function assertConfigured() {
    if (!baseUrl || !apiKey) {
      throw createGitHubError(
        "GitHub backend storage is not configured.",
        "github_storage_unconfigured",
        503,
      );
    }
  }

  async function requestJson(method, path, {
    query,
    body,
    headers,
    prefer,
  } = {}) {
    assertConfigured();
    if (typeof fetchImpl !== "function") {
      throw createGitHubError(
        "Fetch is unavailable for Neon Data API requests.",
        "github_storage_unavailable",
        503,
      );
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${baseUrl}${normalizedPath}${buildQueryString(query)}`;
    const resolvedHeaders = compactHeaders({
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      apikey: apiKey,
      Prefer: prefer,
      "Content-Type": body === undefined ? undefined : "application/json",
      ...headers,
    });

    const response = await fetchImpl(url, {
      method,
      headers: resolvedHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const responseText = await response.text();
    const payload = responseText
      ? (() => {
        try {
          return JSON.parse(responseText);
        } catch {
          return responseText;
        }
      })()
      : null;

    if (!response.ok) {
      const detail = textForErrorBody(payload);
      throw createGitHubError(
        detail || `Neon Data API request failed with status ${response.status}.`,
        "github_storage_error",
        response.status >= 400 ? response.status : 500,
      );
    }

    return {
      data: payload,
      headers: response.headers,
      etag: response.headers.get("etag") || undefined,
    };
  }

  function hashStateNonce(nonce) {
    return createHash("sha256").update(String(nonce || "")).digest("hex");
  }

  return {
    hashStateNonce,
    requestJson,
  };
}

