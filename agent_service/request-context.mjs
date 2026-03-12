/**
 * Request lifecycle context and observability helpers.
 *
 * A `RequestContext` tracks timing, auth, usage, errors, and status for a
 * single HTTP / SSE / WebSocket request so that the `request_end` log event
 * captures everything needed for dashboards and alerts.
 *
 * @module request-context
 */

import { createHash } from "node:crypto";
import { cleanLogFields, logEvent } from "./logging.mjs";
import { toFiniteNumber } from "./env-parse.mjs";
import { resolveRequestCompletionStatus } from "./stream-errors.mjs";

// ---------------------------------------------------------------------------
// Request context factory
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RequestContext
 * @property {string} requestId
 * @property {string} endpoint
 * @property {string} method
 * @property {string} transport - "http" | "sse" | "ws"
 * @property {number} startedAt
 * @property {number} retryCount
 * @property {string} circuitState
 * @property {string | undefined} userIdHash
 * @property {string | undefined} authMode
 * @property {number | undefined} usageInputTokens
 * @property {number | undefined} usageOutputTokens
 * @property {string | undefined} errorCode
 * @property {string | undefined} errorMessage
 * @property {number | undefined} statusCode
 * @property {boolean} completed
 */

/**
 * Create a new request context.
 *
 * @param {string} requestId
 * @param {string} endpoint
 * @param {string} method
 * @param {string} transport
 * @returns {RequestContext}
 */
export function createRequestContext(requestId, endpoint, method, transport) {
  return {
    requestId,
    endpoint,
    method,
    transport,
    startedAt: Date.now(),
    retryCount: 0,
    circuitState: "closed",
    userIdHash: undefined,
    authMode: undefined,
    usageInputTokens: undefined,
    usageOutputTokens: undefined,
    errorCode: undefined,
    errorMessage: undefined,
    statusCode: undefined,
    completed: false,
  };
}

// ---------------------------------------------------------------------------
// Error tracking
// ---------------------------------------------------------------------------

/**
 * Map an HTTP status code to a canonical error code.
 *
 * @param {number | undefined} statusCode
 * @returns {string | undefined}
 */
export function inferErrorCodeFromStatus(statusCode) {
  if (!Number.isFinite(statusCode)) return undefined;
  if (statusCode === 401) return "auth_session_invalid";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 404) return "not_found";
  if (statusCode === 405) return "method_not_allowed";
  if (statusCode === 408 || statusCode === 504) return "request_timeout";
  if (statusCode === 413) return "payload_too_large";
  if (statusCode === 422) return "bad_response";
  if (statusCode === 429) return "rate_limited";
  if (statusCode === 499) return "request_aborted";
  if (statusCode === 503) return "service_unavailable";
  if (statusCode >= 500) return "service_error";
  if (statusCode >= 400) return "bad_request";
  return undefined;
}

/**
 * Record an error against a request context.
 *
 * @param {RequestContext | undefined} requestContext
 * @param {string} errorCode
 * @param {string} [errorMessage]
 * @param {number} [statusCode]
 */
export function setRequestError(requestContext, errorCode, errorMessage, statusCode) {
  if (!requestContext) return;
  if (typeof errorCode === "string" && errorCode.trim()) {
    requestContext.errorCode = errorCode.trim();
  }
  if (typeof errorMessage === "string" && errorMessage.trim()) {
    requestContext.errorMessage = errorMessage.trim().slice(0, 400);
  }
  if (Number.isFinite(statusCode)) {
    requestContext.statusCode = statusCode;
  }
}

/**
 * Finalise and log a request context.
 *
 * @param {RequestContext | undefined} requestContext
 * @param {number} [statusCode]
 */
export function completeRequestContext(requestContext, statusCode) {
  if (!requestContext || requestContext.completed) return;
  requestContext.completed = true;
  const durationMs = Math.max(0, Date.now() - requestContext.startedAt);
  const resolvedStatus = resolveRequestCompletionStatus({
    transportStatusCode: statusCode,
    requestStatusCode: requestContext.statusCode,
    errorCode: requestContext.errorCode,
  });
  const resolvedErrorCode = requestContext.errorCode || inferErrorCodeFromStatus(resolvedStatus);
  const basePayload = cleanLogFields({
    request_id: requestContext.requestId,
    endpoint: requestContext.endpoint,
    method: requestContext.method,
    transport: requestContext.transport,
    status_code: resolvedStatus,
    duration_ms: durationMs,
    retry_count: requestContext.retryCount,
    circuit_state: requestContext.circuitState,
    error_code: resolvedErrorCode,
    error_message: requestContext.errorMessage,
    user_id_hash: requestContext.userIdHash,
    auth_mode: requestContext.authMode,
    usage_input_tokens: requestContext.usageInputTokens,
    usage_output_tokens: requestContext.usageOutputTokens,
  });

  if (resolvedErrorCode) {
    const level = resolvedStatus >= 500 ? "error" : "warn";
    logEvent(level, "request_error", basePayload);
  }
  const endLevel = resolvedStatus >= 500 ? "error" : resolvedStatus >= 400 ? "warn" : "info";
  logEvent(endLevel, "request_end", basePayload);
}

/**
 * Attach res finish/close handlers that auto-complete the request context.
 *
 * @param {import("node:http").ServerResponse} res
 * @param {RequestContext} requestContext
 */
export function attachHttpRequestLifecycleLogging(res, requestContext) {
  res.on("finish", () => {
    completeRequestContext(requestContext, res.statusCode);
  });
  res.on("close", () => {
    if (requestContext?.completed) return;
    const closedBeforeFinish = !res.writableEnded;
    if (closedBeforeFinish && !requestContext.errorCode) {
      setRequestError(requestContext, "request_aborted", "Client disconnected before response completed.");
    }
    const status = closedBeforeFinish ? 499 : res.statusCode;
    completeRequestContext(requestContext, status);
  });
}

// ---------------------------------------------------------------------------
// Usage & identity helpers
// ---------------------------------------------------------------------------

/**
 * Accumulate LLM usage metrics onto a request context.
 *
 * @param {RequestContext | undefined} requestContext
 * @param {Record<string, unknown> | undefined} usage
 */
export function captureUsageMetrics(requestContext, usage) {
  if (!requestContext || !usage || typeof usage !== "object") return;
  const inputTokens = toFiniteNumber(
    usage.input_tokens
    ?? usage.inputTokens
    ?? usage.prompt_tokens
    ?? usage.promptTokens,
  );
  const outputTokens = toFiniteNumber(
    usage.output_tokens
    ?? usage.outputTokens
    ?? usage.completion_tokens
    ?? usage.completionTokens,
  );
  if (inputTokens !== undefined) {
    requestContext.usageInputTokens = (requestContext.usageInputTokens || 0) + inputTokens;
  }
  if (outputTokens !== undefined) {
    requestContext.usageOutputTokens = (requestContext.usageOutputTokens || 0) + outputTokens;
  }
}

/**
 * SHA-256 hash a user identifier for logging (first 16 hex chars).
 *
 * @param {string | undefined} userId
 * @returns {string | undefined}
 */
export function hashUserIdentifier(userId) {
  if (typeof userId !== "string") return undefined;
  const normalized = userId.trim();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * SHA-256 hash arbitrary text for log-safe correlation.
 *
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
export function hashTextForLogs(value) {
  if (typeof value !== "string" || !value) return undefined;
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/**
 * Determine transport type from an endpoint path.
 *
 * @param {string} endpoint
 * @param {string} wsPath
 * @returns {string}
 */
export function transportForEndpoint(endpoint, wsPath) {
  if (endpoint === "/enhance") return "sse";
  if (endpoint === wsPath) return "ws";
  return "http";
}
