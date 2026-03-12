/**
 * HTTP, SSE, and CORS response helpers.
 *
 * Pure utility functions for writing JSON responses, starting/ending SSE
 * streams, reading request headers, and resolving CORS policies.
 *
 * @module http-helpers
 */

/**
 * Send a JSON response.
 *
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 * @param {Record<string, string>} [headers]
 */
export function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

/**
 * Begin an SSE (Server-Sent Events) stream.
 *
 * @param {import("node:http").ServerResponse} res
 * @param {Record<string, string>} [headers]
 */
export function beginSse(res, headers = {}) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    ...headers,
  });
}

/**
 * Write a single SSE data frame.
 *
 * @param {import("node:http").ServerResponse} res
 * @param {unknown} payload
 */
export function writeSse(res, payload) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * End an SSE stream with the `[DONE]` sentinel.
 *
 * @param {import("node:http").ServerResponse} res
 */
export function endSse(res) {
  if (res.writableEnded) return;
  res.write("data: [DONE]\n\n");
  res.end();
}

/**
 * Read a single header value from an HTTP request.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {string} headerName
 * @returns {string | undefined}
 */
export function headerValue(req, headerName) {
  const rawValue = req?.headers?.[headerName.toLowerCase()];
  if (typeof rawValue === "string") return rawValue;
  if (Array.isArray(rawValue)) return rawValue[0];
  return undefined;
}

/**
 * Decode a base64url-encoded string value.
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function decodeBase64UrlValue(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return Buffer.from(value.trim(), "base64url").toString("utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/**
 * Build the base CORS header set for a given origin.
 *
 * @param {string} origin
 * @returns {Record<string, string>}
 */
export function baseCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Resolve CORS for an incoming request.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {{ mode: "any" | "set"; origins: Set<string> }} corsConfig
 * @returns {{ ok: boolean; headers: Record<string, string>; origin?: string; status?: number; error?: string }}
 */
export function resolveCors(req, corsConfig) {
  const origin = (headerValue(req, "origin") || "").trim();
  if (!origin) {
    return { ok: true, headers: baseCorsHeaders("null"), origin: "null" };
  }

  if (corsConfig.mode === "set" && !corsConfig.origins.has(origin)) {
    return {
      ok: false,
      status: 403,
      error: "Origin is not allowed.",
      headers: baseCorsHeaders("null"),
    };
  }

  return { ok: true, headers: baseCorsHeaders(origin), origin };
}
