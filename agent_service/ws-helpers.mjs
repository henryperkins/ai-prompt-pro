/**
 * WebSocket utility functions for the `/enhance/ws` transport.
 *
 * Covers protocol negotiation, auth-header extraction from subprotocols and
 * message payloads, connection-slot tracking, and send/close helpers.
 *
 * @module ws-helpers
 */

import { asNonEmptyString } from "./env-parse.mjs";
import { headerValue, decodeBase64UrlValue } from "./http-helpers.mjs";
import {
  setRequestError,
  completeRequestContext,
  inferErrorCodeFromStatus,
} from "./request-context.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ENHANCE_WS_PATH = "/enhance/ws";
export const ENHANCE_WS_PROTOCOL = "promptforge.enhance.v1";
export const ENHANCE_WS_BEARER_PROTOCOL_PREFIX = "auth.bearer.";
export const ENHANCE_WS_APIKEY_PROTOCOL_PREFIX = "auth.apikey.";
export const ENHANCE_WS_SERVICE_PROTOCOL_PREFIX = "auth.service.";

// ---------------------------------------------------------------------------
// Protocol parsing
// ---------------------------------------------------------------------------

/**
 * Parse WebSocket subprotocols from upgrade request.
 *
 * @param {import("node:http").IncomingMessage} req
 * @returns {string[]}
 */
export function parseWebSocketProtocols(req) {
  const raw = headerValue(req, "sec-websocket-protocol") || "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Extract auth headers from WebSocket subprotocol tokens.
 *
 * @param {import("node:http").IncomingMessage} req
 * @returns {Record<string, string>}
 */
export function extractWebSocketAuthHeadersFromProtocols(req) {
  const protocols = parseWebSocketProtocols(req);
  const authHeaders = {};

  for (const protocol of protocols) {
    if (protocol.startsWith(ENHANCE_WS_BEARER_PROTOCOL_PREFIX)) {
      const encodedToken = protocol.slice(ENHANCE_WS_BEARER_PROTOCOL_PREFIX.length);
      const token = decodeBase64UrlValue(encodedToken);
      if (token) {
        authHeaders.authorization = `Bearer ${token}`;
      }
      continue;
    }

    if (protocol.startsWith(ENHANCE_WS_APIKEY_PROTOCOL_PREFIX)) {
      const encodedToken = protocol.slice(ENHANCE_WS_APIKEY_PROTOCOL_PREFIX.length);
      const apiKey = decodeBase64UrlValue(encodedToken);
      if (apiKey) {
        authHeaders.apikey = apiKey;
      }
      continue;
    }

    if (protocol.startsWith(ENHANCE_WS_SERVICE_PROTOCOL_PREFIX)) {
      const encodedToken = protocol.slice(ENHANCE_WS_SERVICE_PROTOCOL_PREFIX.length);
      const serviceToken = decodeBase64UrlValue(encodedToken);
      if (serviceToken) {
        authHeaders["x-agent-token"] = serviceToken;
      }
    }
  }

  return authHeaders;
}

/**
 * Extract auth headers from a WebSocket message auth payload.
 *
 * @param {unknown} rawAuth
 * @returns {Record<string, string>}
 */
export function extractWebSocketAuthHeadersFromPayload(rawAuth) {
  if (!rawAuth || typeof rawAuth !== "object" || Array.isArray(rawAuth)) {
    return {};
  }

  const auth = rawAuth;
  const authHeaders = {};

  const bearerToken =
    asNonEmptyString(auth.bearer_token)
    || asNonEmptyString(auth.bearerToken)
    || asNonEmptyString(auth.access_token)
    || asNonEmptyString(auth.accessToken);
  if (bearerToken) {
    authHeaders.authorization = `Bearer ${bearerToken}`;
  }

  const apiKey =
    asNonEmptyString(auth.apikey)
    || asNonEmptyString(auth.api_key)
    || asNonEmptyString(auth.apiKey);
  if (apiKey) {
    authHeaders.apikey = apiKey;
  }

  const serviceToken =
    asNonEmptyString(auth.service_token)
    || asNonEmptyString(auth.serviceToken);
  if (serviceToken) {
    authHeaders["x-agent-token"] = serviceToken;
  }

  return authHeaders;
}

/**
 * Create a synthetic request-like view for WebSocket auth.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {Record<string, string>} [overrideHeaders]
 * @returns {{ socket: object; headers: Record<string, string> }}
 */
export function createWebSocketRequestView(req, overrideHeaders = {}) {
  return {
    socket: req.socket,
    headers: {
      ...req.headers,
      ...extractWebSocketAuthHeadersFromProtocols(req),
      ...overrideHeaders,
    },
  };
}

// ---------------------------------------------------------------------------
// Connection state helpers
// ---------------------------------------------------------------------------

/**
 * @param {import("ws").WebSocket} ws
 * @returns {boolean}
 */
export function isWebSocketOpen(ws) {
  return ws && ws.readyState === 1;
}

/**
 * @param {import("ws").WebSocket} ws
 * @param {unknown} payload
 */
export function writeWebSocketEvent(ws, payload) {
  if (!isWebSocketOpen(ws)) return;
  ws.send(JSON.stringify(payload));
}

/**
 * @param {import("ws").WebSocket} ws
 * @param {number} [code=1000]
 * @param {string} [reason="done"]
 */
export function closeWebSocket(ws, code = 1000, reason = "done") {
  if (typeof ws.readyState === "number" && ws.readyState >= 2) return;
  ws.close(code, reason);
}

/**
 * @param {import("ws").WebSocket} ws
 * @param {{ message: string; status?: number; code?: string; retryAfterSeconds?: number }} options
 */
export function writeWebSocketError(ws, options) {
  const { message, status, code, retryAfterSeconds } = options;
  writeWebSocketEvent(ws, {
    event: "turn/error",
    type: "turn/error",
    error: message,
    ...(typeof status === "number" ? { status } : {}),
    ...(typeof code === "string" ? { code } : {}),
    ...(typeof retryAfterSeconds === "number" ? { retry_after_seconds: retryAfterSeconds } : {}),
  });
}

// ---------------------------------------------------------------------------
// Auth error classification
// ---------------------------------------------------------------------------

/**
 * @param {number} status
 * @param {string} message
 * @returns {string}
 */
export function classifyWebSocketAuthErrorCode(status, message) {
  if (status !== 401) return "service_error";
  const normalized = typeof message === "string" ? message.toLowerCase() : "";
  if (
    normalized.includes("missing bearer token")
    || normalized.includes("missing token")
    || normalized.includes("sign in required")
  ) {
    return "auth_required";
  }
  return "auth_session_invalid";
}

/**
 * @param {number} status
 * @param {string} message
 * @returns {string}
 */
export function classifyHttpAuthErrorCode(status, message) {
  if (status === 401) {
    return classifyWebSocketAuthErrorCode(status, message);
  }
  if (status === 503) return "service_unavailable";
  return "service_error";
}

// ---------------------------------------------------------------------------
// Heartbeat state
// ---------------------------------------------------------------------------

/**
 * Track websocket heartbeat state independently from general socket activity.
 *
 * @returns {{
 *   onPong: () => void;
 *   onSocketActivity: () => void;
 *   markPingSent: () => void;
 *   isAwaitingPong: () => boolean;
 * }}
 */
export function createWebSocketHeartbeatState() {
  let awaitingPong = false;

  return {
    onPong() {
      awaitingPong = false;
    },

    onSocketActivity() {
      // Socket activity should only reset idle timers. A missing pong must
      // remain visible so the heartbeat can detect dead peers mid-stream.
    },

    markPingSent() {
      awaitingPong = true;
    },

    isAwaitingPong() {
      return awaitingPong;
    },
  };
}

// ---------------------------------------------------------------------------
// Per-IP connection slot tracking
// ---------------------------------------------------------------------------

/**
 * Create a per-IP connection limiter for WebSocket connections.
 *
 * @param {number} maxPerIp
 * @returns {{ acquire: (ip: string) => boolean; release: (ip: string) => void }}
 */
export function createConnectionSlotTracker(maxPerIp) {
  /** @type {Map<string, number>} */
  const connectionsByIp = new Map();

  return {
    acquire(clientIp) {
      const key = clientIp || "unknown";
      const current = connectionsByIp.get(key) || 0;
      if (current >= maxPerIp) return false;
      connectionsByIp.set(key, current + 1);
      return true;
    },

    release(clientIp) {
      const key = clientIp || "unknown";
      const current = connectionsByIp.get(key) || 0;
      if (current <= 1) {
        connectionsByIp.delete(key);
        return;
      }
      connectionsByIp.set(key, current - 1);
    },
  };
}

// ---------------------------------------------------------------------------
// WebSocket upgrade rejection
// ---------------------------------------------------------------------------

/**
 * Reject a WebSocket upgrade with an HTTP error response.
 *
 * @param {import("node:net").Socket} socket
 * @param {number} status
 * @param {Record<string, unknown>} payload
 * @param {object} [requestContext]
 */
export function rejectWebSocketUpgrade(socket, status, payload, requestContext) {
  setRequestError(
    requestContext,
    inferErrorCodeFromStatus(status),
    typeof payload?.error === "string" ? payload.error : undefined,
  );
  const body = JSON.stringify(payload);
  const statusText =
    status === 400
      ? "Bad Request"
      : status === 401
        ? "Unauthorized"
        : status === 403
          ? "Forbidden"
          : status === 405
            ? "Method Not Allowed"
            : status === 429
              ? "Too Many Requests"
              : "Internal Server Error";
  const response =
    `HTTP/1.1 ${status} ${statusText}\r\n`
    + "Connection: close\r\n"
    + "Content-Type: application/json; charset=utf-8\r\n"
    + `Content-Length: ${Buffer.byteLength(body)}\r\n`
    + "\r\n"
    + body;

  socket.write(response);
  socket.destroy();
  completeRequestContext(requestContext, status);
}
