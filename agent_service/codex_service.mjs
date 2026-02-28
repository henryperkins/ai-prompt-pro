import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";
import { Codex } from "@openai/codex-sdk";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { WebSocketServer } from "ws";
import { isConfiguredPublicApiKey as matchesConfiguredPublicApiKey } from "./public-api-key.mjs";
import {
  buildEnhancementMetaPrompt,
  detectEnhancementContext,
  parseEnhancementRequestBuilderFields,
  parseEnhancementRequestMode,
  pickPrimaryAgentMessageText,
  postProcessEnhancementResponse,
} from "./enhancement-pipeline.mjs";
import { extractThreadOptions } from "./thread-options.mjs";
import {
  loadCodexConfig,
  resolveApiKey,
  isAzureProvider,
  resolveProviderConfig,
} from "./codex-config.mjs";
import {
  assertPublicHttpTarget,
  createUrlNotAllowedError,
  isPrivateHost,
  isRedirectStatus,
  isUrlNotAllowedError,
  normalizeIpAddress,
  resolveClientIp,
} from "./network-security.mjs";
import { runGuardedAsync } from "./async-guard.mjs";
import { isPayloadTooLargeError, readBodyJsonWithLimit } from "./http-body.mjs";
import { computeStreamTextUpdate, extractItemText } from "./stream-text.mjs";

// ---------------------------------------------------------------------------
// Resolve provider from ~/.codex/config.toml (preferred) or CODEX_CONFIG_JSON.
// ---------------------------------------------------------------------------
const CODEX_CONFIG_OVERRIDES = parseJsonObjectEnv("CODEX_CONFIG_JSON") || {};
const CODEX_CONFIG_FROM_TOML = await loadCodexConfig();
const CODEX_CONFIG_FROM_ENV = resolveProviderConfig(CODEX_CONFIG_OVERRIDES);
const CODEX_CONFIG = CODEX_CONFIG_FROM_TOML || CODEX_CONFIG_FROM_ENV;
const CODEX_CONFIG_SOURCE = CODEX_CONFIG_FROM_TOML
  ? "config_toml"
  : (CODEX_CONFIG_FROM_ENV ? "codex_config_json" : "fallback");
const IS_AZURE_PROVIDER = isAzureProvider(CODEX_CONFIG);
const RESOLVED_API_KEY = CODEX_CONFIG ? resolveApiKey(CODEX_CONFIG) : null;
const REQUIRE_PROVIDER_CONFIG = normalizeBool(process.env.REQUIRE_PROVIDER_CONFIG, false);
const RESOLVED_CODEX_MODEL = resolveConfiguredCodexModel();
const HAS_MISSING_AZURE_MODEL = IS_AZURE_PROVIDER && !RESOLVED_CODEX_MODEL;

if (CODEX_CONFIG) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "provider_config_resolved",
    service: "ai-prompt-pro-codex-service",
    config_source: CODEX_CONFIG_SOURCE,
    provider: CODEX_CONFIG.provider,
    provider_name: CODEX_CONFIG.name,
    base_url: CODEX_CONFIG.baseUrl,
    env_key: CODEX_CONFIG.envKey,
    api_key_resolved: !!RESOLVED_API_KEY,
    is_azure: IS_AZURE_PROVIDER,
  }));
} else {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "warn",
    event: "provider_config_not_found",
    service: "ai-prompt-pro-codex-service",
    message: "No model provider config found in ~/.codex/config.toml or CODEX_CONFIG_JSON. Falling back to OPENAI_API_KEY.",
    codex_config_json_set: Object.keys(CODEX_CONFIG_OVERRIDES).length > 0,
    openai_api_key_set: !!process.env.OPENAI_API_KEY,
  }));
}

if (REQUIRE_PROVIDER_CONFIG && !CODEX_CONFIG) {
  throw new Error(
    "REQUIRE_PROVIDER_CONFIG is true, but no provider config was found in ~/.codex/config.toml or CODEX_CONFIG_JSON.",
  );
}

const MAX_PROMPT_CHARS = Number.parseInt(process.env.MAX_PROMPT_CHARS || "16000", 10);
if (!Number.isFinite(MAX_PROMPT_CHARS) || MAX_PROMPT_CHARS <= 0) {
  throw new Error("MAX_PROMPT_CHARS must be a positive integer.");
}

const MAX_INFERENCE_PROMPT_CHARS = Number.parseInt(process.env.MAX_INFERENCE_PROMPT_CHARS || "12000", 10);
if (!Number.isFinite(MAX_INFERENCE_PROMPT_CHARS) || MAX_INFERENCE_PROMPT_CHARS <= 0) {
  throw new Error("MAX_INFERENCE_PROMPT_CHARS must be a positive integer.");
}

const MAX_URL_CHARS = Number.parseInt(process.env.MAX_URL_CHARS || "2048", 10);
if (!Number.isFinite(MAX_URL_CHARS) || MAX_URL_CHARS <= 0) {
  throw new Error("MAX_URL_CHARS must be a positive integer.");
}

const FETCH_TIMEOUT_MS = Number.parseInt(process.env.EXTRACT_FETCH_TIMEOUT_MS || "15000", 10);
if (!Number.isFinite(FETCH_TIMEOUT_MS) || FETCH_TIMEOUT_MS <= 0) {
  throw new Error("EXTRACT_FETCH_TIMEOUT_MS must be a positive integer.");
}

const MAX_RESPONSE_BYTES = Number.parseInt(
  process.env.EXTRACT_MAX_RESPONSE_BYTES || String(1024 * 1024),
  10,
);
if (!Number.isFinite(MAX_RESPONSE_BYTES) || MAX_RESPONSE_BYTES <= 0) {
  throw new Error("EXTRACT_MAX_RESPONSE_BYTES must be a positive integer.");
}

const ENHANCE_PER_MINUTE = Number.parseInt(process.env.ENHANCE_PER_MINUTE || "12", 10);
const ENHANCE_PER_DAY = Number.parseInt(process.env.ENHANCE_PER_DAY || "300", 10);
const EXTRACT_PER_MINUTE = Number.parseInt(process.env.EXTRACT_PER_MINUTE || "6", 10);
const EXTRACT_PER_DAY = Number.parseInt(process.env.EXTRACT_PER_DAY || "120", 10);
const INFER_PER_MINUTE = Number.parseInt(process.env.INFER_PER_MINUTE || "15", 10);
const INFER_PER_DAY = Number.parseInt(process.env.INFER_PER_DAY || "400", 10);
const ENHANCE_WS_INITIAL_MESSAGE_TIMEOUT_MS = parsePositiveIntegerEnv(
  "ENHANCE_WS_INITIAL_MESSAGE_TIMEOUT_MS",
  5000,
);
const ENHANCE_WS_MAX_PAYLOAD_BYTES = parsePositiveIntegerEnv(
  "ENHANCE_WS_MAX_PAYLOAD_BYTES",
  64 * 1024,
);
const MAX_HTTP_BODY_BYTES = parsePositiveIntegerEnv(
  "MAX_HTTP_BODY_BYTES",
  256 * 1024,
);
const ENHANCE_WS_MAX_CONNECTIONS_PER_IP = parsePositiveIntegerEnv(
  "ENHANCE_WS_MAX_CONNECTIONS_PER_IP",
  10,
);
const SHUTDOWN_DRAIN_TIMEOUT_MS = parsePositiveIntegerEnv(
  "SHUTDOWN_DRAIN_TIMEOUT_MS",
  10_000,
);
const EXTRACT_URL_CACHE_TTL_MS = parsePositiveIntegerEnv(
  "EXTRACT_URL_CACHE_TTL_MS",
  600_000,
);
const EXTRACT_URL_CACHE_MAX_ENTRIES = parsePositiveIntegerEnv(
  "EXTRACT_URL_CACHE_MAX_ENTRIES",
  200,
);

const OPENAI_API_BASE_URL = (CODEX_CONFIG?.baseUrl ? CODEX_CONFIG.baseUrl.replace(/\/+$/, "") : null)
  || process.env.OPENAI_BASE_URL?.trim()
  || "https://api.openai.com/v1";
const EXTRACT_MODEL = normalizeEnvValue("EXTRACT_MODEL")
  || RESOLVED_CODEX_MODEL
  || (!IS_AZURE_PROVIDER ? "gpt-4.1-mini" : undefined);

// ---------------------------------------------------------------------------
// 429 retry configuration
// ---------------------------------------------------------------------------
const CODEX_429_MAX_RETRIES = (() => {
  const raw = process.env.CODEX_429_MAX_RETRIES;
  if (!raw) return 2;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("CODEX_429_MAX_RETRIES must be a non-negative integer.");
  }
  return parsed;
})();

const CODEX_429_BACKOFF_BASE_SECONDS = (() => {
  const raw = process.env.CODEX_429_BACKOFF_BASE_SECONDS;
  if (!raw) return 1.0;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("CODEX_429_BACKOFF_BASE_SECONDS must be a non-negative number.");
  }
  return parsed;
})();

const CODEX_429_BACKOFF_MAX_SECONDS = (() => {
  const raw = process.env.CODEX_429_BACKOFF_MAX_SECONDS;
  if (!raw) return 20.0;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("CODEX_429_BACKOFF_MAX_SECONDS must be a non-negative number.");
  }
  return parsed;
})();

const SANDBOX_MODES = new Set(["read-only", "workspace-write", "danger-full-access"]);
const REASONING_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);
const REASONING_SUMMARIES = new Set(["auto", "concise", "detailed"]);
const WEB_SEARCH_MODES = new Set(["disabled", "cached", "live"]);
const APPROVAL_POLICIES = new Set(["never", "on-request", "on-failure", "untrusted"]);
const SERVICE_NAME = "ai-prompt-pro-codex-service";

if (HAS_MISSING_AZURE_MODEL) {
  logEvent("warn", "provider_model_not_set", {
    error_code: "provider_model_not_set",
    message:
      "Azure provider is configured but no model deployment name was resolved. "
      + "Set CODEX_MODEL (or AZURE_OPENAI_DEPLOYMENT) to a valid Azure deployment name.",
    provider: CODEX_CONFIG?.provider,
    config_source: CODEX_CONFIG_SOURCE,
  });
}

function cleanLogFields(fields) {
  const entries = Object.entries(fields || {});
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

function logEvent(level, event, fields = {}) {
  const payload = cleanLogFields({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: SERVICE_NAME,
    ...fields,
  });
  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function hashUserIdentifier(userId) {
  if (typeof userId !== "string") return undefined;
  const normalized = userId.trim();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function inferErrorCodeFromStatus(statusCode) {
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

function createRequestContext(requestId, endpoint, method, transport) {
  return {
    requestId,
    endpoint,
    method,
    transport,
    startedAt: Date.now(),
    retryCount: 0,
    circuitState: "closed",
    userIdHash: undefined,
    usageInputTokens: undefined,
    usageOutputTokens: undefined,
    errorCode: undefined,
    errorMessage: undefined,
    statusCode: undefined,
    completed: false,
  };
}

function setRequestError(requestContext, errorCode, errorMessage, statusCode) {
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

function completeRequestContext(requestContext, statusCode) {
  if (!requestContext || requestContext.completed) return;
  requestContext.completed = true;
  const durationMs = Math.max(0, Date.now() - requestContext.startedAt);
  const resolvedStatus = Number.isFinite(statusCode)
    ? statusCode
    : Number.isFinite(requestContext.statusCode)
      ? requestContext.statusCode
      : 500;
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

function attachHttpRequestLifecycleLogging(res, requestContext) {
  res.on("finish", () => {
    completeRequestContext(requestContext, res.statusCode);
  });
  res.on("close", () => {
    if (requestContext?.completed) return;
    const closedBeforeFinish = !res.writableEnded;
    if (closedBeforeFinish && !requestContext.errorCode) {
      setRequestError(requestContext, "request_aborted", "Client disconnected before response completed.");
    }
    const statusCode = closedBeforeFinish ? 499 : res.statusCode;
    completeRequestContext(requestContext, statusCode);
  });
}

function transportForEndpoint(endpoint) {
  if (endpoint === "/enhance") return "sse";
  if (endpoint === ENHANCE_WS_PATH) return "ws";
  return "http";
}

function captureUsageMetrics(requestContext, usage) {
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
  if (inputTokens !== undefined) requestContext.usageInputTokens = inputTokens;
  if (outputTokens !== undefined) requestContext.usageOutputTokens = outputTokens;
}

function normalizeEnvValue(name) {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeBool(value, defaultValue = false) {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean value "${value}".`);
}

function parseJsonObjectEnv(name) {
  const raw = normalizeEnvValue(name);
  if (!raw) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} must be valid JSON.`, { cause: error });
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${name} must be a JSON object.`);
  }
  return parsed;
}

function parseStringArrayEnv(name) {
  const raw = normalizeEnvValue(name);
  if (!raw) return undefined;

  if (raw.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${name} must be a JSON array of strings.`, { cause: error });
    }
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
      throw new Error(`${name} must be a JSON array of strings.`);
    }
    const normalized = parsed.map((entry) => entry.trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  const normalized = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function parseEnumEnv(name, allowedValues) {
  const raw = normalizeEnvValue(name);
  if (!raw) return undefined;
  if (!allowedValues.has(raw)) {
    throw new Error(`${name} has invalid value "${raw}".`);
  }
  return raw;
}

function parsePositiveIntegerEnv(name, defaultValue) {
  const raw = normalizeEnvValue(name);
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function resolveConfiguredCodexModel() {
  const explicitModel = normalizeEnvValue("CODEX_MODEL")
    || normalizeEnvValue("AZURE_OPENAI_DEPLOYMENT")
    || normalizeEnvValue("AZURE_OPENAI_DEPLOYMENT_NAME");
  if (explicitModel) return explicitModel;

  const providerModel = typeof CODEX_CONFIG?.model === "string" ? CODEX_CONFIG.model.trim() : "";
  if (providerModel) return providerModel;

  // Use a default model only for non-Azure providers.
  if (!IS_AZURE_PROVIDER) return "gpt-5.2";
  return undefined;
}

function normalizeNeonAuthUrl(rawValue) {
  const raw = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!raw) return undefined;

  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/auth/v1")) {
    return trimmed.slice(0, -"/v1".length);
  }
  return trimmed;
}

function stripInternalPaths(message) {
  return message
    .replace(/(?:\/(?:home|tmp|var|usr|opt|etc|root))\S*/gi, "[path]")
    .replace(/[A-Z]:\\[^\s"')]+/g, "[path]")
    .replace(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(?::\d+)?[^\s"]*/gi, "[internal-url]");
}

function sanitizeCodexExecErrorMessage(message) {
  if (typeof message !== "string") return "Unexpected error from Codex service.";
  const trimmed = message.trim();
  if (!trimmed) return "Unexpected error from Codex service.";
  if (!trimmed.includes("Codex Exec exited with")) {
    return stripInternalPaths(trimmed);
  }

  const stderrSection = trimmed.split(":").slice(1).join(":").trim();
  const lines = stderrSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const meaningfulLines = lines.filter((line) => {
    if (/^reading prompt from stdin/i.test(line)) return false;
    if (/^\{"type":/.test(line)) return false;
    if (/^\d{4}-\d{2}-\d{2}t/i.test(line.toLowerCase())) return false;
    return true;
  });

  const deploymentMissingLine = meaningfulLines.find((line) =>
    /api deployment .* does not exist|deployment .* does not exist/i.test(line));
  if (deploymentMissingLine) {
    return (
      "Codex CLI failed because the configured Azure model deployment was not found. "
      + "Set CODEX_MODEL (or AZURE_OPENAI_DEPLOYMENT) to a valid deployment name."
    );
  }

  const missingApiKeyLine = meaningfulLines.find((line) =>
    /no api key|api key.+(missing|not set|invalid)/i.test(line));
  if (missingApiKeyLine) {
    return (
      "Codex CLI failed because provider credentials are missing or invalid. "
      + "Verify AZURE_OPENAI_API_KEY or OPENAI_API_KEY."
    );
  }

  const fallbackLine = meaningfulLines[meaningfulLines.length - 1];
  if (fallbackLine) {
    return `Codex CLI failed: ${fallbackLine}`;
  }

  return (
    "Codex CLI exited before producing a response. "
    + "Verify CODEX_MODEL, provider endpoint, and API key configuration."
  );
}

function normalizeStringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "string") {
      throw new Error("CODEX_ENV_JSON must contain only string values.");
    }
    record[key] = raw;
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

const SERVICE_CONFIG = (() => {
  const host = normalizeEnvValue("HOST") || "0.0.0.0";
  const portRaw = normalizeEnvValue("PORT") || "8001";
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer. Received "${portRaw}".`);
  }

  return {
    host,
    port,
    token: normalizeEnvValue("AGENT_SERVICE_TOKEN"),
  };
})();

const CORS_CONFIG = (() => {
  const configured = normalizeEnvValue("ALLOWED_ORIGINS");
  if (!configured || configured === "*" || configured.toLowerCase() === "any") {
    return { mode: "any", origins: new Set() };
  }

  const origins = new Set(
    configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  if (origins.size === 0) {
    return { mode: "any", origins };
  }

  return { mode: "set", origins };
})();

const STRICT_PUBLIC_API_KEY = normalizeBool(process.env.STRICT_PUBLIC_API_KEY, true);
const TRUST_PROXY = normalizeBool(process.env.TRUST_PROXY, false);
const TRUSTED_PROXY_IPS = new Set(
  (parseStringArrayEnv("TRUSTED_PROXY_IPS") || [])
    .map((value) => normalizeIpAddress(value))
    .filter((value) => typeof value === "string" && value.length > 0),
);
const EXTRACT_FETCH_MAX_REDIRECTS = parsePositiveIntegerEnv("EXTRACT_FETCH_MAX_REDIRECTS", 5);

if (!STRICT_PUBLIC_API_KEY) {
  logEvent("warn", "strict_public_api_key_disabled", {
    error_code: "auth_config_weak_public_key_matching",
    message:
      "STRICT_PUBLIC_API_KEY is disabled. Publishable-format keys may be accepted without explicit configuration.",
  });
}

const AUTH_CONFIG = (() => {
  const neonAuthUrl = normalizeNeonAuthUrl(normalizeEnvValue("NEON_AUTH_URL"));
  const neonJwksUrl = normalizeEnvValue("NEON_JWKS_URL")
    || (neonAuthUrl ? `${neonAuthUrl}/.well-known/jwks.json` : undefined);

  const configuredKeyValues = [
    normalizeEnvValue("FUNCTION_PUBLIC_API_KEY"),
    normalizeEnvValue("NEON_PUBLISHABLE_KEY"),
    normalizeEnvValue("VITE_NEON_PUBLISHABLE_KEY"),
  ].filter((value) => typeof value === "string" && value.length > 0);
  const configuredKeys = new Set(configuredKeyValues);
  const authValidationApiKey = configuredKeyValues[0];

  return {
    neonAuthUrl,
    neonJwksUrl,
    neonAuthUserUrl: neonAuthUrl ? `${neonAuthUrl}/v1/user` : undefined,
    authValidationApiKey,
    configuredKeys,
  };
})();

const TEXTUAL_CONTENT_TYPES = new Set([
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "application/json",
  "application/ld+json",
  "application/rss+xml",
  "application/atom+xml",
  "application/javascript",
  "application/x-javascript",
  "application/ecmascript",
]);

const INFERENCE_FIELD_LABELS = {
  role: "Set AI persona",
  tone: "Adjust tone",
  lengthPreference: "Tune response length",
  format: "Choose output format",
  constraints: "Add guidance constraints",
};

const INFERENCE_FIELD_CONFIDENCE = {
  role: 0.78,
  tone: 0.72,
  lengthPreference: 0.66,
  format: 0.7,
  constraints: 0.64,
};

const ENHANCE_WS_PATH = "/enhance/ws";
const ENHANCE_WS_PROTOCOL = "promptforge.enhance.v1";
const ENHANCE_WS_BEARER_PROTOCOL_PREFIX = "auth.bearer.";
const ENHANCE_WS_APIKEY_PROTOCOL_PREFIX = "auth.apikey.";
const ENHANCE_WS_SERVICE_PROTOCOL_PREFIX = "auth.service.";

const rateLimitStores = new Map();
const activeEnhanceWebSocketConnectionsByIp = new Map();
const extractUrlCache = new Map();

function getExtractUrlCacheEntry(url) {
  const entry = extractUrlCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > EXTRACT_URL_CACHE_TTL_MS) {
    extractUrlCache.delete(url);
    return null;
  }
  return entry;
}

function setExtractUrlCacheEntry(url, title, content) {
  // Prune expired entries
  for (const [key, entry] of extractUrlCache) {
    if (Date.now() - entry.cachedAt > EXTRACT_URL_CACHE_TTL_MS) {
      extractUrlCache.delete(key);
    }
  }
  // Evict oldest if at capacity
  if (extractUrlCache.size >= EXTRACT_URL_CACHE_MAX_ENTRIES) {
    const oldestKey = extractUrlCache.keys().next().value;
    extractUrlCache.delete(oldestKey);
  }
  extractUrlCache.set(url, { title, content, cachedAt: Date.now() });
}

let neonJwksResolver = null;
let hasLoggedAuthConfigWarning = false;
let hasLoggedJwtFallbackWarning = false;
let hasLoggedJwtFallbackProductionWarning = false;

function headerValue(req, headerName) {
  const rawValue = req.headers[headerName.toLowerCase()];
  if (typeof rawValue === "string") return rawValue;
  if (Array.isArray(rawValue)) return rawValue[0];
  return undefined;
}

function decodeBase64UrlValue(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return Buffer.from(value.trim(), "base64url").toString("utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

function parseWebSocketProtocols(req) {
  const raw = headerValue(req, "sec-websocket-protocol") || "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractWebSocketAuthHeadersFromProtocols(req) {
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

function extractWebSocketAuthHeadersFromPayload(rawAuth) {
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

function createWebSocketRequestView(req, overrideHeaders = {}) {
  return {
    socket: req.socket,
    headers: {
      ...req.headers,
      ...extractWebSocketAuthHeadersFromProtocols(req),
      ...overrideHeaders,
    },
  };
}

function rejectWebSocketUpgrade(socket, status, payload, requestContext) {
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

function baseCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-agent-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function resolveCors(req) {
  const origin = (headerValue(req, "origin") || "").trim();
  if (!origin) {
    return { ok: true, headers: baseCorsHeaders("null"), origin: "null" };
  }

  if (CORS_CONFIG.mode === "set" && !CORS_CONFIG.origins.has(origin)) {
    return {
      ok: false,
      status: 403,
      error: "Origin is not allowed.",
      headers: baseCorsHeaders("null"),
    };
  }

  return { ok: true, headers: baseCorsHeaders(origin), origin };
}

function getClientIp(req, requestContext) {
  const resolvedIp = resolveClientIp({
    forwardedFor: headerValue(req, "x-forwarded-for"),
    realIp: headerValue(req, "x-real-ip"),
    socketRemoteAddress: req?.socket?.remoteAddress,
    trustProxy: TRUST_PROXY,
    trustedProxyIps: TRUSTED_PROXY_IPS,
  });

  if (resolvedIp.ignoredForwarded && resolvedIp.forwardedIp) {
    logEvent("warn", "forwarded_ip_ignored", cleanLogFields({
      request_id: requestContext?.requestId,
      endpoint: requestContext?.endpoint,
      remote_ip: resolvedIp.socketIp,
      forwarded_ip: resolvedIp.forwardedIp,
      reason: TRUST_PROXY ? "untrusted_proxy" : "trust_proxy_disabled",
    }));
  }

  return resolvedIp.ip;
}

function parseBearerToken(req) {
  const authHeader = headerValue(req, "authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function isConfiguredPublicApiKey(value) {
  return matchesConfiguredPublicApiKey(value, {
    configuredKeys: AUTH_CONFIG.configuredKeys,
    strict: STRICT_PUBLIC_API_KEY,
  });
}

function looksLikeJwt(value) {
  return typeof value === "string" && value.split(".").length === 3;
}

function isTruthyEnv(name) {
  return normalizeBool(process.env[name], false);
}

function isProductionEnvironment() {
  if (normalizeEnvValue("DENO_DEPLOYMENT_ID")) return true;

  const envValue = (
    normalizeEnvValue("APP_ENV")
    || normalizeEnvValue("ENVIRONMENT")
    || normalizeEnvValue("NODE_ENV")
    || ""
  )
    .trim()
    .toLowerCase();

  return envValue === "prod" || envValue === "production";
}

function allowUnverifiedJwtFallback() {
  if (!isTruthyEnv("ALLOW_UNVERIFIED_JWT_FALLBACK")) {
    return false;
  }

  if (!isProductionEnvironment()) {
    return true;
  }

  if (isTruthyEnv("ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION")) {
    return true;
  }

  if (!hasLoggedJwtFallbackProductionWarning) {
    hasLoggedJwtFallbackProductionWarning = true;
    logEvent("error", "auth_config_warning", {
      error_code: "auth_config_invalid",
      message:
        "ALLOW_UNVERIFIED_JWT_FALLBACK is ignored in production by default. "
        + "Set ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION=true only for emergency recovery scenarios.",
    });
  }

  return false;
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function numericClaim(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectBooleanFlag(source, key) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return false;
  return source[key] === true;
}

function decodeUserFromJwt(token) {
  const claims = decodeJwtPayload(token.trim());
  if (!claims) return null;

  const subject = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!subject) return null;

  const exp = numericClaim(claims.exp);
  if (exp !== null && Date.now() >= exp * 1000) return null;

  const isAnonymous = (
    claims.role === "anon"
    || claims.is_anonymous === true
    || objectBooleanFlag(claims.app_metadata, "is_anonymous")
    || objectBooleanFlag(claims.user_metadata, "is_anonymous")
  );

  return {
    id: subject,
    isAnonymous,
  };
}

function tryDecodeUserFromJwtFallback(bearerToken, reason) {
  if (!allowUnverifiedJwtFallback()) return null;
  const decodedUser = decodeUserFromJwt(bearerToken);
  if (!decodedUser) return null;

  if (!hasLoggedJwtFallbackWarning) {
    hasLoggedJwtFallbackWarning = true;
    logEvent("warn", "auth_fallback_enabled", {
      error_code: "auth_fallback_unverified_jwt",
      reason,
      message:
        `ALLOW_UNVERIFIED_JWT_FALLBACK is enabled; accepting decoded JWT claims without signature verification (${reason}).`,
    });
  }

  return decodedUser;
}

function getNeonJwksResolver() {
  if (!AUTH_CONFIG.neonJwksUrl) return null;
  if (!neonJwksResolver) {
    neonJwksResolver = createRemoteJWKSet(new URL(AUTH_CONFIG.neonJwksUrl));
  }
  return neonJwksResolver;
}

async function verifyNeonJwt(token) {
  const jwks = getNeonJwksResolver();
  if (!jwks) {
    return { ok: false, reason: "config" };
  }

  try {
    const verifyOptions = {};
    if (AUTH_CONFIG.neonAuthUrl) {
      verifyOptions.issuer = AUTH_CONFIG.neonAuthUrl;
    }
    const { payload } = await jwtVerify(token, jwks, verifyOptions);
    const userId = typeof payload.sub === "string" ? payload.sub.trim() : "";
    if (!userId) {
      return { ok: false, reason: "invalid" };
    }

    return { ok: true, userId };
  } catch (error) {
    const message = toErrorMessage(error).toLowerCase();
    if (message.includes("failed to fetch") || message.includes("network")) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "invalid" };
  }
}

async function verifyNeonSessionWithAuthApi(token) {
  if (!AUTH_CONFIG.neonAuthUserUrl || !AUTH_CONFIG.authValidationApiKey) {
    return { ok: false, reason: "config" };
  }

  try {
    const response = await fetch(AUTH_CONFIG.neonAuthUserUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: AUTH_CONFIG.authValidationApiKey,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "invalid" };
    }
    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }

    const data = await response.json().catch(() => null);
    const userId = typeof data?.id === "string" ? data.id.trim() : "";
    if (!userId) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, userId };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

function buildAuthenticatedUserResult(userId) {
  return {
    ok: true,
    userId,
    isPublicKey: false,
    rateKey: userId,
  };
}

function buildPublicApiKeyAuthResult(apiKey, clientIp) {
  if (!isConfiguredPublicApiKey(apiKey)) return null;
  return {
    ok: true,
    userId: null,
    isPublicKey: true,
    rateKey: `public:${clientIp}`,
  };
}

function authConfigUnavailableResult(apiKey, clientIp, bearerToken) {
  const publicApiResult = buildPublicApiKeyAuthResult(apiKey, clientIp);
  if (publicApiResult) return publicApiResult;

  const fallbackUser = tryDecodeUserFromJwtFallback(bearerToken, "missing_config");
  if (fallbackUser) {
    return buildAuthenticatedUserResult(fallbackUser.id);
  }

  if (!hasLoggedAuthConfigWarning) {
    hasLoggedAuthConfigWarning = true;
    logEvent("error", "auth_config_warning", {
      error_code: "auth_config_missing",
      message:
        "NEON_AUTH_URL or NEON_JWKS_URL is required to validate bearer tokens. "
        + "Set one of those env vars, provide FUNCTION_PUBLIC_API_KEY for anonymous fallback, "
        + "or enable ALLOW_UNVERIFIED_JWT_FALLBACK for local development only.",
    });
  }

  return {
    ok: false,
    status: 503,
    error: "Authentication service is unavailable because Neon auth is not configured.",
  };
}

function authTemporarilyUnavailableResult(apiKey, clientIp, bearerToken) {
  const publicApiResult = buildPublicApiKeyAuthResult(apiKey, clientIp);
  if (publicApiResult) return publicApiResult;

  const fallbackUser = tryDecodeUserFromJwtFallback(bearerToken, "auth_unavailable");
  if (fallbackUser) {
    return buildAuthenticatedUserResult(fallbackUser.id);
  }

  return {
    ok: false,
    status: 503,
    error: "Authentication service is temporarily unavailable. Please try again.",
  };
}

async function requireAuthenticatedUser(req, requestContext) {
  const bearerToken = parseBearerToken(req);
  const apiKey = (headerValue(req, "apikey") || "").trim();
  const clientIp = getClientIp(req, requestContext);

  if (!bearerToken) {
    const publicApiResult = buildPublicApiKeyAuthResult(apiKey, clientIp);
    if (publicApiResult) return publicApiResult;
    return {
      ok: false,
      status: 401,
      error: "Missing bearer token.",
    };
  }

  if (
    isConfiguredPublicApiKey(bearerToken) ||
    (apiKey && apiKey === bearerToken && isConfiguredPublicApiKey(apiKey))
  ) {
    return {
      ok: true,
      userId: null,
      isPublicKey: true,
      rateKey: `public:${clientIp}`,
    };
  }

  if (!looksLikeJwt(bearerToken)) {
    const authApiVerification = await verifyNeonSessionWithAuthApi(bearerToken);
    if (authApiVerification.ok) {
      return buildAuthenticatedUserResult(authApiVerification.userId);
    }
    if (authApiVerification.reason === "config") {
      return authConfigUnavailableResult(apiKey, clientIp, bearerToken);
    }
    if (authApiVerification.reason === "unavailable") {
      return authTemporarilyUnavailableResult(apiKey, clientIp, bearerToken);
    }

    return {
      ok: false,
      status: 401,
      error: "Invalid or expired auth session.",
    };
  }

  const verified = await verifyNeonJwt(bearerToken);
  if (verified.ok) {
    return buildAuthenticatedUserResult(verified.userId);
  }

  const authApiVerification = await verifyNeonSessionWithAuthApi(bearerToken);
  if (authApiVerification.ok) {
    return buildAuthenticatedUserResult(authApiVerification.userId);
  }

  if (verified.reason === "invalid" || authApiVerification.reason === "invalid") {
    return {
      ok: false,
      status: 401,
      error: "Invalid or expired auth session.",
    };
  }

  if (verified.reason === "unavailable" || authApiVerification.reason === "unavailable") {
    return authTemporarilyUnavailableResult(apiKey, clientIp, bearerToken);
  }

  if (verified.reason === "config" || authApiVerification.reason === "config") {
    return authConfigUnavailableResult(apiKey, clientIp, bearerToken);
  }

  return {
    ok: false,
    status: 401,
    error: "Invalid or expired auth session.",
  };
}

async function authenticateRequestContext(req, requestContext) {
  const providedServiceToken = (headerValue(req, "x-agent-token") || "").trim();
  if (providedServiceToken) {
    if (!SERVICE_CONFIG.token || providedServiceToken !== SERVICE_CONFIG.token) {
      return {
        ok: false,
        status: 401,
        error: "Invalid or missing service token.",
      };
    }
    return {
      ok: true,
      userId: "service",
      isPublicKey: false,
      rateKey: `service:${getClientIp(req, requestContext)}`,
    };
  }

  return requireAuthenticatedUser(req, requestContext);
}

function acquireEnhanceWebSocketConnectionSlot(clientIp) {
  const key = clientIp || "unknown";
  const current = activeEnhanceWebSocketConnectionsByIp.get(key) || 0;
  if (current >= ENHANCE_WS_MAX_CONNECTIONS_PER_IP) {
    return false;
  }
  activeEnhanceWebSocketConnectionsByIp.set(key, current + 1);
  return true;
}

function releaseEnhanceWebSocketConnectionSlot(clientIp) {
  const key = clientIp || "unknown";
  const current = activeEnhanceWebSocketConnectionsByIp.get(key) || 0;
  if (current <= 1) {
    activeEnhanceWebSocketConnectionsByIp.delete(key);
    return;
  }
  activeEnhanceWebSocketConnectionsByIp.set(key, current - 1);
}

function getStore(scope) {
  const existing = rateLimitStores.get(scope);
  if (existing) return existing;
  const created = new Map();
  rateLimitStores.set(scope, created);
  return created;
}

function pruneStore(store, now) {
  for (const [key, state] of store.entries()) {
    if (state.resetAt <= now) {
      store.delete(key);
    }
  }
}

function applyRateLimit(options) {
  const { scope, key, limit, windowMs } = options;
  const store = getStore(scope);
  const now = Date.now();

  if (store.size > 5000) {
    pruneStore(store, now);
  }

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  store.set(key, current);
  return { ok: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

const DEFAULT_THREAD_OPTIONS = (() => {
  const options = {};
  if (RESOLVED_CODEX_MODEL) {
    options.model = RESOLVED_CODEX_MODEL;
  }

  const sandboxMode = parseEnumEnv("CODEX_SANDBOX_MODE", SANDBOX_MODES);
  if (sandboxMode) options.sandboxMode = sandboxMode;

  const workingDirectory = normalizeEnvValue("CODEX_WORKING_DIRECTORY");
  if (workingDirectory) options.workingDirectory = workingDirectory;

  const skipGitRepoCheckRaw = normalizeEnvValue("CODEX_SKIP_GIT_REPO_CHECK");
  if (skipGitRepoCheckRaw) {
    options.skipGitRepoCheck = normalizeBool(skipGitRepoCheckRaw, false);
  }

  options.modelReasoningEffort =
    parseEnumEnv("CODEX_MODEL_REASONING_EFFORT", REASONING_EFFORTS) || "high";

  const networkAccessEnabledRaw = normalizeEnvValue("CODEX_NETWORK_ACCESS_ENABLED");
  if (networkAccessEnabledRaw) {
    options.networkAccessEnabled = normalizeBool(networkAccessEnabledRaw, false);
  }

  const webSearchMode = parseEnumEnv("CODEX_WEB_SEARCH_MODE", WEB_SEARCH_MODES);
  if (webSearchMode) options.webSearchMode = webSearchMode;

  const webSearchEnabledRaw = normalizeEnvValue("CODEX_WEB_SEARCH_ENABLED");
  if (webSearchEnabledRaw) {
    options.webSearchEnabled = normalizeBool(webSearchEnabledRaw, false);
  }

  const approvalPolicy = parseEnumEnv("CODEX_APPROVAL_POLICY", APPROVAL_POLICIES);
  if (approvalPolicy) options.approvalPolicy = approvalPolicy;

  const additionalDirectories = parseStringArrayEnv("CODEX_ADDITIONAL_DIRECTORIES");
  if (additionalDirectories) options.additionalDirectories = additionalDirectories;

  return options;
})();

const DEFAULT_CODEX_OPTIONS = (() => {
  const options = {};

  // When a provider config is resolved (config.toml or CODEX_CONFIG_JSON),
  // do NOT pass baseUrl/apiKey directly. Let the Codex CLI resolve provider
  // settings and credentials from its config chain.
  if (!CODEX_CONFIG) {
    const baseUrl = normalizeEnvValue("OPENAI_BASE_URL") || normalizeEnvValue("CODEX_BASE_URL");
    if (baseUrl) options.baseUrl = baseUrl;

    const apiKey = normalizeEnvValue("CODEX_API_KEY") || normalizeEnvValue("OPENAI_API_KEY");
    if (apiKey) options.apiKey = apiKey;
  }

  const codexPathOverride = normalizeEnvValue("CODEX_PATH_OVERRIDE");
  if (codexPathOverride) options.codexPathOverride = codexPathOverride;

  const config = { ...CODEX_CONFIG_OVERRIDES };

  // Forward the provider from config.toml so the CLI subprocess gets it as a
  // --config flag in addition to reading its own config.toml.
  if (CODEX_CONFIG?.provider) {
    config.model_provider = CODEX_CONFIG.provider;
  }

  // Reasoning summary format: auto | concise | detailed
  config.model_reasoning_summary =
    parseEnumEnv("CODEX_MODEL_REASONING_SUMMARY", REASONING_SUMMARIES) || "detailed";

  const maxOutputTokensRaw = normalizeEnvValue("CODEX_MAX_OUTPUT_TOKENS");
  if (maxOutputTokensRaw) {
    const parsed = Number.parseInt(maxOutputTokensRaw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("CODEX_MAX_OUTPUT_TOKENS must be a positive integer.");
    }
    config.max_output_tokens = parsed;
  }
  if (Object.keys(config).length > 0) options.config = config;

  const envConfig = parseJsonObjectEnv("CODEX_ENV_JSON");
  const normalizedEnv = normalizeStringRecord(envConfig);
  if (normalizedEnv) options.env = normalizedEnv;

  return options;
})();

let codexClient = null;

function getCodexClient() {
  if (!codexClient) {
    codexClient = new Codex(DEFAULT_CODEX_OPTIONS);
  }
  return codexClient;
}

function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function beginSse(res, headers = {}) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    ...headers,
  });
}

function writeSse(res, payload) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function endSse(res) {
  if (res.writableEnded) return;
  res.write("data: [DONE]\n\n");
  res.end();
}

function asNonEmptyString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function idFromItem(item) {
  if (!item || typeof item !== "object") return undefined;
  return typeof item.id === "string" ? item.id : undefined;
}

function typeFromItem(item) {
  if (!item || typeof item !== "object") return undefined;
  return typeof item.type === "string" ? item.type : undefined;
}

function normalizeItemType(itemType) {
  return typeof itemType === "string" ? itemType.trim().toLowerCase() : "";
}

function isReasoningItemType(itemType) {
  const normalized = normalizeItemType(itemType);
  if (!normalized) return false;
  return normalized === "reasoning" || /(^|[./_-])reasoning([./_-]|$)/.test(normalized);
}

function isAgentMessageItemType(itemType) {
  const normalized = normalizeItemType(itemType);
  if (!normalized) return false;
  if (
    normalized === "agent_message"
    || normalized === "assistant_message"
    || normalized === "message"
    || normalized === "text"
    || normalized === "output_text"
  ) {
    return true;
  }

  return (
    /(^|[./_-])assistant([./_-]|$)/.test(normalized)
    || /(^|[./_-])agent([./_-]|$)/.test(normalized)
    || /(^|[./_-])message([./_-]|$)/.test(normalized)
    || /(^|[./_-])output[_-]?text([./_-]|$)/.test(normalized)
  );
}

function isStreamedTextItemType(itemType) {
  return isAgentMessageItemType(itemType) || isReasoningItemType(itemType);
}

function toItemDeltaEventType(itemType) {
  if (isReasoningItemType(itemType)) {
    return {
      event: "item/reasoning/delta",
      type: "response.reasoning_summary_text.delta",
    };
  }
  return {
    event: "item/agent_message/delta",
    type: "response.output_text.delta",
  };
}

function toItemDoneEventType(itemType) {
  if (isReasoningItemType(itemType)) {
    return {
      event: "item/completed",
      type: "response.reasoning_summary_text.done",
    };
  }
  return {
    event: "item/completed",
    type: "response.output_text.done",
  };
}

function toErrorMessage(error) {
  const rawMessage =
    (error instanceof Error && typeof error.message === "string")
      ? error.message
      : String(error);
  return sanitizeCodexExecErrorMessage(rawMessage);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasListValue(values) {
  return Array.isArray(values) && values.some((value) => hasText(value));
}

function isLockedToUser(lockMetadata, field) {
  return lockMetadata[field] === "user";
}

function createSuggestionChip(field, updates) {
  return {
    id: `set-${field}`,
    label: INFERENCE_FIELD_LABELS[field],
    description: "Apply AI-inferred details",
    action: {
      type: "set_fields",
      updates,
      fields: [field],
    },
  };
}

function normalizePromptForInference(prompt) {
  return prompt.trim().toLowerCase();
}

function chooseRole(prompt) {
  const normalized = normalizePromptForInference(prompt);
  if (/(code|debug|refactor|typescript|javascript|react|python|api)\b/.test(normalized)) {
    return "Software Developer";
  }
  if (/(analy[sz]e|dashboard|metrics|kpi|sql|cohort|forecast)\b/.test(normalized)) {
    return "Data Analyst";
  }
  if (/(email|announcement|campaign|copy|headline|landing page)\b/.test(normalized)) {
    return "Expert Copywriter";
  }
  if (/(lesson|teach|syllabus|quiz|curriculum)\b/.test(normalized)) {
    return "Teacher";
  }
  return null;
}

function chooseTone(prompt) {
  const normalized = normalizePromptForInference(prompt);
  if (/(friendly|casual|informal|conversational)\b/.test(normalized)) return "Casual";
  if (/(technical|architecture|spec|implementation)\b/.test(normalized)) return "Technical";
  if (/(creative|story|brainstorm|campaign)\b/.test(normalized)) return "Creative";
  if (/(academic|citation|research)\b/.test(normalized)) return "Academic";
  if (/(executive|stakeholder|board|client)\b/.test(normalized)) return "Professional";
  return null;
}

function chooseLengthPreference(prompt) {
  const normalized = normalizePromptForInference(prompt);
  if (/(brief|short|tl;dr|concise|summary)\b/.test(normalized)) return "brief";
  if (/(detailed|deep dive|comprehensive|thorough)\b/.test(normalized)) return "detailed";
  return null;
}

function chooseFormat(prompt) {
  const normalized = normalizePromptForInference(prompt);
  if (/(json)\b/.test(normalized)) return ["JSON"];
  if (/(table|tabular)\b/.test(normalized)) return ["Table"];
  if (/(bullet|bulleted|list|checklist|steps)\b/.test(normalized)) return ["Bullet points"];
  if (/(markdown)\b/.test(normalized)) return ["Markdown"];
  return [];
}

function chooseConstraints(prompt) {
  const normalized = normalizePromptForInference(prompt);
  const values = [];
  if (/(cite|citation|source)\b/.test(normalized)) values.push("Include citations");
  if (/(plain language|simple wording|no jargon)\b/.test(normalized)) values.push("Avoid jargon");
  return values;
}

function inferBuilderFieldUpdates(prompt, currentFields, lockMetadata) {
  const normalizedPrompt = prompt.toLowerCase();
  const inferredUpdates = {};
  const inferredFields = [];
  const suggestionChips = [];
  const confidence = {};

  const role = chooseRole(normalizedPrompt);
  if (role && !hasText(currentFields.role) && !isLockedToUser(lockMetadata, "role")) {
    inferredUpdates.role = role;
    inferredFields.push("role");
    suggestionChips.push(createSuggestionChip("role", { role }));
    confidence.role = INFERENCE_FIELD_CONFIDENCE.role;
  }

  const tone = chooseTone(normalizedPrompt);
  if (tone && !hasText(currentFields.tone) && !isLockedToUser(lockMetadata, "tone")) {
    inferredUpdates.tone = tone;
    inferredFields.push("tone");
    suggestionChips.push(createSuggestionChip("tone", { tone }));
    confidence.tone = INFERENCE_FIELD_CONFIDENCE.tone;
  }

  const lengthPreference = chooseLengthPreference(normalizedPrompt);
  if (
    lengthPreference &&
    !hasText(currentFields.lengthPreference) &&
    !isLockedToUser(lockMetadata, "lengthPreference")
  ) {
    inferredUpdates.lengthPreference = lengthPreference;
    inferredFields.push("lengthPreference");
    suggestionChips.push(createSuggestionChip("lengthPreference", { lengthPreference }));
    confidence.lengthPreference = INFERENCE_FIELD_CONFIDENCE.lengthPreference;
  }

  const format = chooseFormat(normalizedPrompt);
  if (format.length > 0 && !hasListValue(currentFields.format) && !isLockedToUser(lockMetadata, "format")) {
    inferredUpdates.format = format;
    inferredFields.push("format");
    suggestionChips.push(createSuggestionChip("format", { format }));
    confidence.format = INFERENCE_FIELD_CONFIDENCE.format;
  }

  const constraints = chooseConstraints(normalizedPrompt);
  if (
    constraints.length > 0 &&
    !hasListValue(currentFields.constraints) &&
    !isLockedToUser(lockMetadata, "constraints")
  ) {
    inferredUpdates.constraints = constraints;
    inferredFields.push("constraints");
    suggestionChips.push(createSuggestionChip("constraints", { constraints }));
    confidence.constraints = INFERENCE_FIELD_CONFIDENCE.constraints;
  }

  if (suggestionChips.length === 0 && normalizedPrompt.length > 20) {
    suggestionChips.push({
      id: "append-audience",
      label: "Add audience details",
      description: "Append audience and success criteria hints.",
      action: {
        type: "append_prompt",
        text: "\nAudience: [who this is for]\nDesired outcome: [what success looks like]",
      },
    });
  }

  return { inferredUpdates, inferredFields, suggestionChips, confidence };
}

function responseMimeType(resp) {
  const ct = resp.headers.get("content-type") || "";
  return ct.split(";")[0].trim().toLowerCase();
}

function isTextLikeContentType(mimeType) {
  if (!mimeType) return true;
  if (mimeType.startsWith("text/")) return true;
  return TEXTUAL_CONTENT_TYPES.has(mimeType);
}

function isHtmlLikeMimeType(mimeType) {
  return (
    !mimeType
    || mimeType === "text/html"
    || mimeType === "application/xhtml+xml"
    || mimeType === "application/xml"
    || mimeType === "text/xml"
  );
}

function looksLikeBinaryPayload(payload) {
  if (!payload) return true;
  const sample = payload.slice(0, 4096);
  if (sample.includes("\u0000")) return true;

  let suspicious = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    const isAllowedControl = code === 9 || code === 10 || code === 13;
    if (code < 32 && !isAllowedControl) suspicious += 1;
  }

  if (sample.length === 0) return false;
  return suspicious / sample.length > 0.12;
}

async function readBodyWithLimit(resp, maxBytes) {
  if (!resp.body) return "";

  const contentLength = resp.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    await resp.body.cancel();
    throw new Error(`Response too large (${contentLength} bytes).`);
  }

  const reader = resp.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("Response too large.");
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") + decoder.decode();
}

function stripHtml(html) {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractMetaContent(html, matcher) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    if (!matcher.test(tag)) continue;
    const contentMatch = tag.match(/\bcontent=(["'])([\s\S]*?)\1/i);
    if (contentMatch?.[2]) {
      const value = contentMatch[2].replace(/\s+/g, " ").trim();
      if (value) return value;
    }
  }
  return "";
}

function extractTitle(html, url) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 120);
  }
  const ogTitle = extractMetaContent(html, /\bproperty=["']og:title["']/i);
  if (ogTitle) return ogTitle.slice(0, 120);
  const twitterTitle = extractMetaContent(html, /\bname=["']twitter:title["']/i);
  if (twitterTitle) return twitterTitle.slice(0, 120);
  try {
    return new URL(url).hostname;
  } catch {
    return "Extracted content";
  }
}

function extractMetadataText(html) {
  const values = [
    extractMetaContent(html, /\bname=["']description["']/i),
    extractMetaContent(html, /\bproperty=["']og:description["']/i),
    extractMetaContent(html, /\bname=["']twitter:description["']/i),
  ].filter(Boolean);
  return values.join(" ").trim();
}

function normalizeExtractableText(rawBody, mimeType) {
  if (!rawBody) return "";
  if (isHtmlLikeMimeType(mimeType)) {
    const htmlText = stripHtml(rawBody);
    const metadataText = extractMetadataText(rawBody);
    return [htmlText, metadataText].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  return rawBody.replace(/\s+/g, " ").trim();
}

function clampExtractText(text, maxChars = 8000) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function buildPrimaryFetchHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; PromptForge/1.0; +https://promptforge.app)",
    Accept: "text/html,application/xhtml+xml,application/xml,text/plain,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
}

function buildRetryFetchHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
  };
}

async function fetchPageWithHeaderFallback(url, timeoutMs) {
  const attempts = [buildPrimaryFetchHeaders(), buildRetryFetchHeaders()];
  let lastResponse = null;
  let lastError = null;

  for (const headers of attempts) {
    try {
      const response = await fetchWithSafeRedirects(
        url,
        {
          headers,
        },
        timeoutMs,
      );
      if (response.ok) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (isTimeoutError(error)) {
        throw error;
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error("Failed to fetch URL.");
}

async function fetchWithSafeRedirects(url, options, timeoutMs) {
  let currentUrl = url;
  let redirectCount = 0;

  while (true) {
    await assertPublicHttpTarget(currentUrl);
    const response = await fetchWithTimeout(
      currentUrl,
      {
        ...options,
        redirect: "manual",
      },
      timeoutMs,
    );

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    if (redirectCount >= EXTRACT_FETCH_MAX_REDIRECTS) {
      await response.body?.cancel().catch(() => undefined);
      throw createUrlNotAllowedError(
        `Too many redirects while fetching URL. Maximum ${EXTRACT_FETCH_MAX_REDIRECTS} redirects allowed.`,
      );
    }

    const nextUrl = new URL(location, currentUrl);
    await response.body?.cancel().catch(() => undefined);
    currentUrl = nextUrl.toString();
    redirectCount += 1;
  }
}

function parseInputUrl(input) {
  if (!input.trim()) return null;
  const candidate = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isTimeoutError(error) {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "TimeoutError" || error.message.toLowerCase().includes("timed out");
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractTextFromOpenAiContent(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const joined = content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      if (typeof entry.text === "string") return entry.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
  return joined.trim();
}

async function summarizeExtractedText(plainText) {
  if (!EXTRACT_MODEL) {
    throw new Error(
      "No extract model configured for Azure provider. Set EXTRACT_MODEL, CODEX_MODEL, or AZURE_OPENAI_DEPLOYMENT.",
    );
  }

  const apiKey = CODEX_CONFIG
    ? RESOLVED_API_KEY
    : (normalizeEnvValue("OPENAI_API_KEY") || normalizeEnvValue("CODEX_API_KEY"));
  if (!apiKey) {
    if (CODEX_CONFIG?.envKey) {
      throw new Error(`No API key configured for provider '${CODEX_CONFIG.provider}'. Set ${CODEX_CONFIG.envKey}.`);
    }
    throw new Error("No API key configured. Set AZURE_OPENAI_API_KEY (via provider config) or OPENAI_API_KEY.");
  }

  // Azure OpenAI uses `api-key` header; standard OpenAI uses `Authorization: Bearer`.
  const headers = IS_AZURE_PROVIDER
    ? { "api-key": apiKey, "Content-Type": "application/json" }
    : { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const response = await fetchWithTimeout(`${OPENAI_API_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a content extractor. Given raw text from a web page, extract the 5-10 most important and relevant points as concise bullet points. Focus on facts, data, and key claims. Omit navigation text, ads, and boilerplate. Return only bullet points, one per line, prefixed with a bullet character (•).",
        },
        {
          role: "user",
          content: `Extract the key points from this page:\n\n${plainText}`,
        },
      ],
      stream: false,
    }),
  }, FETCH_TIMEOUT_MS);

  if (!response.ok) {
    return { ok: false, status: response.status, errorBody: await response.text() };
  }

  const data = await response.json().catch(() => ({}));
  const content = extractTextFromOpenAiContent(data?.choices?.[0]?.message?.content);
  return { ok: true, content };
}

function parseCurrentFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

// ---------------------------------------------------------------------------
// 429 rate-limit retry helpers
// ---------------------------------------------------------------------------
function isRateLimitError(err) {
  if (!err) return false;
  const status = err.status ?? err.statusCode ?? err.response?.status ?? err.cause?.status ?? err.cause?.statusCode ?? err.cause?.response?.status;
  if (status === 429) return true;

  const code = err.code ?? err.cause?.code;
  if (code === 429 || code === "rate_limit_exceeded") return true;

  const msg = String(err.message ?? err.cause?.message ?? "");
  return /(^|\b)429(\b|$)|rate.limit|too many requests|throttl/i.test(msg);
}

function isRateLimitTurnFailure(event) {
  if (event?.type !== "turn.failed") return false;
  const msg = event.error?.message ?? "";
  return /(^|\b)429(\b|$)|rate.limit|too many requests|throttl/i.test(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStreamedWithRetry(thread, input, turnOptions, telemetry = {}) {
  const requestContext = telemetry.requestContext;
  let attempt = 0;
  while (true) {
    let sawAnyEvent = false;
    try {
      const { events } = await thread.runStreamed(input, turnOptions);
      const iterator = events[Symbol.asyncIterator]();
      const first = await iterator.next();
      sawAnyEvent = !first.done;

      if (!first.done && isRateLimitTurnFailure(first.value) && attempt < CODEX_429_MAX_RETRIES) {
        const backoff = CODEX_429_BACKOFF_BASE_SECONDS * (2 ** attempt);
        const delay = Math.min(Math.random() * backoff, CODEX_429_BACKOFF_MAX_SECONDS) * 1000;
        if (requestContext) {
          requestContext.retryCount = attempt + 1;
        }
        logEvent("warn", "retry_attempt", cleanLogFields({
          request_id: requestContext?.requestId,
          endpoint: requestContext?.endpoint,
          method: requestContext?.method,
          transport: requestContext?.transport,
          retry_count: attempt + 1,
          max_retries: CODEX_429_MAX_RETRIES,
          error_code: "rate_limited",
          backoff_ms: Math.round(delay),
          source: "codex_turn_failed",
        }));
        await sleep(delay);
        attempt++;
        continue;
      }

      // Return a generator that yields the first event then the rest
      async function* replayEvents() {
        if (!first.done) {
          yield first.value;
          while (true) {
            const next = await iterator.next();
            if (next.done) break;
            yield next.value;
          }
        }
      }
      return { events: replayEvents() };
    } catch (err) {
      if (sawAnyEvent || !isRateLimitError(err) || attempt >= CODEX_429_MAX_RETRIES) {
        throw err;
      }
      const backoff = CODEX_429_BACKOFF_BASE_SECONDS * (2 ** attempt);
      const delay = Math.min(Math.random() * backoff, CODEX_429_BACKOFF_MAX_SECONDS) * 1000;
      if (requestContext) {
        requestContext.retryCount = attempt + 1;
      }
      logEvent("warn", "retry_attempt", cleanLogFields({
        request_id: requestContext?.requestId,
        endpoint: requestContext?.endpoint,
        method: requestContext?.method,
        transport: requestContext?.transport,
        retry_count: attempt + 1,
        max_retries: CODEX_429_MAX_RETRIES,
        error_code: "rate_limited",
        backoff_ms: Math.round(delay),
        source: "codex_exception",
      }));
      await sleep(delay);
      attempt++;
    }
  }
}

function buildEnhanceStreamRequest(body) {
  const requestBody = body && typeof body === "object" && !Array.isArray(body)
    ? body
    : {};

  const prompt = asNonEmptyString(requestBody.prompt);
  if (!prompt) {
    return {
      ok: false,
      status: 400,
      detail: "Prompt is required.",
    };
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return {
      ok: false,
      status: 413,
      detail: `Prompt is too large. Maximum ${MAX_PROMPT_CHARS} characters.`,
    };
  }

  const hasThreadIdField = Object.prototype.hasOwnProperty.call(requestBody, "thread_id")
    || Object.prototype.hasOwnProperty.call(requestBody, "threadId");
  const requestedThreadId = asNonEmptyString(requestBody.thread_id) || asNonEmptyString(requestBody.threadId);
  if (hasThreadIdField && !requestedThreadId) {
    return {
      ok: false,
      status: 400,
      detail: "thread_id must be a non-empty string when provided.",
    };
  }

  const requestThreadOptions = extractThreadOptions(requestBody.thread_options || requestBody.threadOptions);
  const threadOptions = { ...DEFAULT_THREAD_OPTIONS, ...requestThreadOptions };
  const builderMode = parseEnhancementRequestMode(requestBody);
  const builderFields = parseEnhancementRequestBuilderFields(requestBody);
  const enhancementContext = detectEnhancementContext(prompt, {
    builderMode,
    builderFields,
  });
  const enhancementInput = buildEnhancementMetaPrompt(prompt, enhancementContext);

  return {
    ok: true,
    requestData: {
      prompt,
      requestedThreadId,
      threadOptions,
      enhancementContext,
      enhancementInput,
      turnId: `turn_${randomUUID().replaceAll("-", "")}`,
    },
  };
}

async function runEnhanceTurnStream(requestData, options) {
  const {
    prompt,
    requestedThreadId,
    threadOptions,
    enhancementContext,
    enhancementInput,
    turnId,
  } = requestData;
  const {
    signal,
    emit,
    isClosed,
    requestContext,
  } = options;

  const stateByItemId = new Map();
  const agentMessageByItemId = new Map();
  const agentMessageItemOrder = [];
  let emittedAgentOutput = false;

  try {
    const codex = getCodexClient();
    const thread = requestedThreadId
      ? codex.resumeThread(requestedThreadId, threadOptions)
      : codex.startThread(threadOptions);
    const { events } = await runStreamedWithRetry(
      thread,
      enhancementInput,
      { signal },
      { requestContext },
    );

    let activeThreadId = requestedThreadId || null;
    let turnFailed = false;
    let turnError = false;

    for await (const event of events) {
      if (signal.aborted || isClosed()) break;

      if (event.type === "thread.started") {
        activeThreadId = event.thread_id;
        emit({
          event: "thread.started",
          type: "thread.started",
          thread_id: activeThreadId,
        });
        continue;
      }

      if (event.type === "turn.started") {
        emit({
          event: "turn.started",
          type: "response.created",
          turn_id: turnId,
          thread_id: activeThreadId,
          kind: "enhance",
        });
        continue;
      }

      if (event.type === "turn.completed") {
        captureUsageMetrics(requestContext, event.usage);
        emit({
          event: "turn.completed",
          type: "response.completed",
          turn_id: turnId,
          thread_id: activeThreadId,
          usage: event.usage,
          response: {
            id: turnId,
            status: "completed",
          },
        });
        continue;
      }

      if (event.type === "turn.failed") {
        turnFailed = true;
        const failureMessage = toErrorMessage(event.error);
        const failureCode = /(^|\b)429(\b|$)|rate.limit|too many requests|throttl/i.test(failureMessage.toLowerCase())
          ? "rate_limited"
          : "service_error";
        setRequestError(requestContext, failureCode, failureMessage);
        emit({
          event: "turn.failed",
          type: "turn.failed",
          turn_id: turnId,
          thread_id: activeThreadId,
          error: failureMessage,
        });
        continue;
      }

      if (event.type === "error") {
        turnError = true;
        const threadErrorMessage = toErrorMessage(event.message);
        setRequestError(requestContext, "service_error", threadErrorMessage);
        emit({
          event: "thread.error",
          type: "error",
          turn_id: turnId,
          thread_id: activeThreadId,
          error: threadErrorMessage,
        });
        continue;
      }

      if (event.type === "item.started") {
        const itemId = idFromItem(event.item);
        const itemType = typeFromItem(event.item);
        emit({
          event: "item.started",
          type: "response.output_item.added",
          turn_id: turnId,
          thread_id: activeThreadId,
          item_id: itemId,
          item_type: itemType,
          item: event.item,
        });
        continue;
      }

      if (event.type === "item.updated") {
        const itemId = idFromItem(event.item);
        const itemType = typeFromItem(event.item);
        const isAgentMessage = isAgentMessageItemType(itemType);

        if (isStreamedTextItemType(itemType)) {
          const previousText = itemId ? stateByItemId.get(itemId) || "" : "";
          const { nextText: currentText, delta } = computeStreamTextUpdate(previousText, event.item);

          if (itemId) {
            stateByItemId.set(itemId, currentText);
          }

          if (isAgentMessage) {
            const agentItemKey = itemId || "__agent_message__";
            if (!agentMessageByItemId.has(agentItemKey)) {
              agentMessageItemOrder.push(agentItemKey);
            }
            agentMessageByItemId.set(agentItemKey, currentText);
            if (hasText(currentText)) {
              emittedAgentOutput = true;
            }
          }

          if (delta) {
            const eventShape = toItemDeltaEventType(itemType);
            emit({
              event: eventShape.event,
              type: eventShape.type,
              turn_id: turnId,
              thread_id: activeThreadId,
              item_id: itemId,
              item_type: itemType,
              delta,
              ...(isAgentMessage ? { choices: [{ delta: { content: delta } }] } : {}),
              item: event.item,
            });
            if (isAgentMessage) {
              emittedAgentOutput = true;
            }
          }
          continue;
        }

        emit({
          event: "item.updated",
          type: "response.output_item.updated",
          turn_id: turnId,
          thread_id: activeThreadId,
          item_id: itemId,
          item_type: itemType,
          item: event.item,
        });
        continue;
      }

      if (event.type === "item.completed") {
        const itemId = idFromItem(event.item);
        const itemType = typeFromItem(event.item);
        const isAgentMessage = isAgentMessageItemType(itemType);

        if (isStreamedTextItemType(itemType)) {
          const previousText = itemId ? stateByItemId.get(itemId) || "" : "";
          const { nextText: completedText, delta: completedDelta } = computeStreamTextUpdate(previousText, event.item);
          const text = extractItemText(event.item) || completedText || previousText;
          if (itemId) {
            stateByItemId.set(itemId, text);
          }

          if (isAgentMessage) {
            const agentItemKey = itemId || "__agent_message__";
            if (!agentMessageByItemId.has(agentItemKey)) {
              agentMessageItemOrder.push(agentItemKey);
            }
            agentMessageByItemId.set(agentItemKey, text);
            if (hasText(text)) {
              emittedAgentOutput = true;
            }
          }

          if (completedDelta) {
            const deltaShape = toItemDeltaEventType(itemType);
            emit({
              event: deltaShape.event,
              type: deltaShape.type,
              turn_id: turnId,
              thread_id: activeThreadId,
              item_id: itemId,
              item_type: itemType,
              delta: completedDelta,
              ...(isAgentMessage ? { choices: [{ delta: { content: completedDelta } }] } : {}),
              item: event.item,
            });
            if (isAgentMessage) {
              emittedAgentOutput = true;
            }
          }

          const eventShape = toItemDoneEventType(itemType);
          emit({
            event: eventShape.event,
            type: eventShape.type,
            turn_id: turnId,
            thread_id: activeThreadId,
            item_id: itemId,
            item_type: itemType,
            payload: { text },
            text,
            output_text: text,
            item: event.item,
          });
          continue;
        }

        emit({
          event: "item.completed",
          type: "response.output_item.done",
          turn_id: turnId,
          thread_id: activeThreadId,
          item_id: itemId,
          item_type: itemType,
          item: event.item,
        });
      }
    }

    if (!signal.aborted && !isClosed() && !turnFailed && !turnError) {
      const rawEnhancerOutput = pickPrimaryAgentMessageText(agentMessageByItemId, agentMessageItemOrder);
      const postProcessed = postProcessEnhancementResponse({
        llmResponseText: rawEnhancerOutput,
        userInput: prompt,
        context: enhancementContext,
      });
      const finalEnhancedPrompt = postProcessed.enhanced_prompt?.trim() || rawEnhancerOutput.trim();

      if (finalEnhancedPrompt && !emittedAgentOutput) {
        const syntheticItemId = `item_enhanced_${randomUUID().replaceAll("-", "")}`;
        emit({
          event: "item/agent_message/delta",
          type: "response.output_text.delta",
          turn_id: turnId,
          thread_id: activeThreadId,
          item_id: syntheticItemId,
          item_type: "agent_message",
          delta: finalEnhancedPrompt,
          choices: [{ delta: { content: finalEnhancedPrompt } }],
          item: { id: syntheticItemId, type: "agent_message", delta: finalEnhancedPrompt },
        });
        emit({
          event: "item/completed",
          type: "response.output_text.done",
          turn_id: turnId,
          thread_id: activeThreadId,
          item_id: syntheticItemId,
          item_type: "agent_message",
          payload: { text: finalEnhancedPrompt },
          text: finalEnhancedPrompt,
          output_text: finalEnhancedPrompt,
          item: { id: syntheticItemId, type: "agent_message", text: finalEnhancedPrompt },
        });
      }

      emit({
        event: "enhance/metadata",
        type: "enhance.metadata",
        turn_id: turnId,
        thread_id: activeThreadId,
        payload: postProcessed,
      });
    }
  } catch (error) {
    setRequestError(requestContext, "service_error", toErrorMessage(error), 500);
    if (!isClosed()) {
      const message = toErrorMessage(error);
      emit({
        event: "turn/error",
        type: "turn/error",
        turn_id: turnId,
        error: message,
        code: "service_error",
      });
    }
  }
}

async function streamWithCodex(req, res, body, corsHeaders, requestContext) {
  const preparedRequest = buildEnhanceStreamRequest(body);
  if (!preparedRequest.ok) {
    setRequestError(
      requestContext,
      inferErrorCodeFromStatus(preparedRequest.status),
      preparedRequest.detail,
      preparedRequest.status,
    );
    json(res, preparedRequest.status, { detail: preparedRequest.detail }, corsHeaders);
    return;
  }

  const controller = new AbortController();
  req.on("aborted", () => {
    setRequestError(requestContext, "request_aborted", "Client disconnected.", 499);
    controller.abort("Client disconnected");
  });
  res.on("close", () => {
    if (!res.writableEnded) {
      setRequestError(requestContext, "request_aborted", "Client disconnected.", 499);
      controller.abort("Client disconnected");
    }
  });

  beginSse(res, corsHeaders);
  await runEnhanceTurnStream(preparedRequest.requestData, {
    signal: controller.signal,
    emit: (payload) => writeSse(res, payload),
    isClosed: () => res.writableEnded,
    requestContext,
  });
  endSse(res);
}

function isWebSocketOpen(ws) {
  return ws && ws.readyState === 1;
}

function writeWebSocketEvent(ws, payload) {
  if (!isWebSocketOpen(ws)) return;
  ws.send(JSON.stringify(payload));
}

function closeWebSocket(ws, code = 1000, reason = "done") {
  if (typeof ws.readyState === "number" && ws.readyState >= 2) return;
  ws.close(code, reason);
}

function writeWebSocketError(ws, options) {
  const {
    message,
    status,
    code,
    retryAfterSeconds,
  } = options;
  writeWebSocketEvent(ws, {
    event: "turn/error",
    type: "turn/error",
    error: message,
    ...(typeof status === "number" ? { status } : {}),
    ...(typeof code === "string" ? { code } : {}),
    ...(typeof retryAfterSeconds === "number" ? { retry_after_seconds: retryAfterSeconds } : {}),
  });
}

function classifyWebSocketAuthErrorCode(status, message) {
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

function classifyHttpAuthErrorCode(status, message) {
  if (status === 401) {
    return classifyWebSocketAuthErrorCode(status, message);
  }
  if (status === 503) return "service_unavailable";
  return "service_error";
}

async function handleEnhanceWebSocketConnection(ws, request, requestContext) {
  const clientIp = getClientIp(request, requestContext);
  if (!acquireEnhanceWebSocketConnectionSlot(clientIp)) {
    setRequestError(
      requestContext,
      "rate_limited",
      "Too many concurrent websocket connections.",
      429,
    );
    writeWebSocketError(ws, {
      message: "Too many concurrent websocket connections. Please retry shortly.",
      status: 429,
      code: "rate_limited",
    });
    closeWebSocket(ws, 1008, "too_many_connections");
    completeRequestContext(requestContext, 429);
    return;
  }

  let releasedConnectionSlot = false;
  const releaseConnectionSlot = () => {
    if (releasedConnectionSlot) return;
    releasedConnectionSlot = true;
    releaseEnhanceWebSocketConnectionSlot(clientIp);
  };
  ws.on("close", releaseConnectionSlot);

  try {
    const controller = new AbortController();
    let receivedStartMessage = false;
    const firstMessageTimeoutHandle = globalThis.setTimeout(() => {
      if (receivedStartMessage || !isWebSocketOpen(ws)) return;
      setRequestError(
        requestContext,
        "request_timeout",
        "Timed out waiting for websocket start payload.",
        408,
      );
      writeWebSocketError(ws, {
        message: "Timed out waiting for websocket start payload.",
        status: 408,
        code: "request_timeout",
      });
      closeWebSocket(ws, 1008, "start_timeout");
    }, ENHANCE_WS_INITIAL_MESSAGE_TIMEOUT_MS);

    ws.on("close", () => {
      globalThis.clearTimeout(firstMessageTimeoutHandle);
      if (!controller.signal.aborted) {
        controller.abort("Client disconnected");
      }
      const closeStatus = Number.isFinite(requestContext?.statusCode)
        ? requestContext.statusCode
        : requestContext?.errorCode
          ? 400
          : 200;
      completeRequestContext(requestContext, closeStatus);
    });

    ws.once("message", (rawData, isBinary) => {
      receivedStartMessage = true;
      globalThis.clearTimeout(firstMessageTimeoutHandle);
      runGuardedAsync(async () => {
        if (isBinary) {
          setRequestError(requestContext, "bad_response", "Invalid websocket payload.", 400);
          writeWebSocketError(ws, {
            message: "Invalid websocket payload.",
            status: 400,
            code: "bad_response",
          });
          closeWebSocket(ws, 1003, "invalid_payload");
          return;
        }

        const rawText = typeof rawData === "string"
          ? rawData
          : Buffer.from(rawData).toString("utf8");

        let messageBody;
        try {
          messageBody = JSON.parse(rawText);
        } catch {
          setRequestError(requestContext, "bad_response", "Invalid JSON body.", 400);
          writeWebSocketError(ws, {
            message: "Invalid JSON body.",
            status: 400,
            code: "bad_response",
          });
          closeWebSocket(ws, 1003, "invalid_json");
          return;
        }

        const hasStartEnvelope =
          messageBody
          && typeof messageBody === "object"
          && !Array.isArray(messageBody)
          && messageBody.type === "enhance.start";
        const payload =
          hasStartEnvelope
            ? messageBody.payload
            : messageBody;
        const rawAuthPayload =
          hasStartEnvelope
            ? messageBody.auth
            : (
              messageBody
              && typeof messageBody === "object"
              && !Array.isArray(messageBody)
            )
              ? (messageBody.auth ?? messageBody.authentication)
              : undefined;

        const req = createWebSocketRequestView(
          request,
          extractWebSocketAuthHeadersFromPayload(rawAuthPayload),
        );
        const auth = await authenticateRequestContext(req, requestContext);
        if (!auth.ok) {
          setRequestError(
            requestContext,
            classifyHttpAuthErrorCode(auth.status, auth.error),
            auth.error,
            auth.status,
          );
          writeWebSocketError(ws, {
            message: auth.error,
            status: auth.status,
            code: classifyWebSocketAuthErrorCode(auth.status, auth.error),
          });
          closeWebSocket(ws, 1008, "auth_failed");
          return;
        }
        if (requestContext) {
          requestContext.userIdHash = hashUserIdentifier(auth.userId);
        }

        const rateLimit = checkEnhanceRateLimits(auth, clientIp);
        if (!rateLimit.ok) {
          setRequestError(requestContext, "rate_limited", rateLimit.error, rateLimit.status);
          writeWebSocketError(ws, {
            message: rateLimit.error,
            status: rateLimit.status,
            code: "rate_limited",
            retryAfterSeconds: rateLimit.retryAfterSeconds,
          });
          closeWebSocket(ws, 1008, "rate_limited");
          return;
        }

        const preparedRequest = buildEnhanceStreamRequest(payload || {});
        if (!preparedRequest.ok) {
          setRequestError(
            requestContext,
            inferErrorCodeFromStatus(preparedRequest.status),
            preparedRequest.detail,
            preparedRequest.status,
          );
          writeWebSocketError(ws, {
            message: preparedRequest.detail,
            status: preparedRequest.status,
            code: "bad_response",
          });
          closeWebSocket(ws, 1008, "invalid_request");
          return;
        }

        await runEnhanceTurnStream(preparedRequest.requestData, {
          signal: controller.signal,
          emit: (eventPayload) => writeWebSocketEvent(ws, eventPayload),
          isClosed: () => !isWebSocketOpen(ws),
          requestContext,
        });

        if (!controller.signal.aborted && isWebSocketOpen(ws)) {
          writeWebSocketEvent(ws, {
            event: "stream.done",
            type: "stream.done",
          });
          closeWebSocket(ws, 1000, "done");
        }
      }, (error) => {
        setRequestError(requestContext, "service_error", toErrorMessage(error), 500);
        if (isWebSocketOpen(ws)) {
          writeWebSocketError(ws, {
            message: toErrorMessage(error),
            status: 500,
            code: "service_error",
          });
          closeWebSocket(ws, 1011, "internal_error");
        }
      });
    });
  } catch (error) {
    setRequestError(requestContext, "service_error", toErrorMessage(error), 500);
    writeWebSocketError(ws, {
      message: toErrorMessage(error),
      status: 500,
      code: "service_error",
    });
    closeWebSocket(ws, 1011, "internal_error");
    releaseConnectionSlot();
    completeRequestContext(requestContext, 500);
  }
}

function enforceRateLimit(res, corsHeaders, options, failureMessage, requestContext) {
  const result = applyRateLimit(options);
  if (result.ok) return true;
  setRequestError(requestContext, "rate_limited", failureMessage, 429);
  json(
    res,
    429,
    { error: failureMessage },
    {
      ...corsHeaders,
      "Retry-After": String(result.retryAfterSeconds),
    },
  );
  return false;
}

function checkRateLimit(options, failureMessage) {
  const result = applyRateLimit(options);
  if (result.ok) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 429,
    error: failureMessage,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

function checkEnhanceRateLimits(auth, clientIp) {
  const minuteWindow = checkRateLimit({
    scope: "enhance-minute",
    key: `${auth.rateKey}:${clientIp}`,
    limit: ENHANCE_PER_MINUTE,
    windowMs: 60_000,
  }, "Rate limit exceeded. Please try again later.");
  if (!minuteWindow.ok) {
    return minuteWindow;
  }

  return checkRateLimit({
    scope: "enhance-day",
    key: auth.rateKey,
    limit: ENHANCE_PER_DAY,
    windowMs: 86_400_000,
  }, "Daily quota exceeded. Please try again tomorrow.");
}

async function authenticateRequest(req, res, corsHeaders, requestContext) {
  const auth = await authenticateRequestContext(req, requestContext);
  if (!auth.ok) {
    setRequestError(
      requestContext,
      classifyHttpAuthErrorCode(auth.status, auth.error),
      auth.error,
      auth.status,
    );
    json(res, auth.status, { error: auth.error }, corsHeaders);
    return null;
  }
  if (requestContext) {
    requestContext.userIdHash = hashUserIdentifier(auth.userId);
  }
  return auth;
}

async function handleEnhance(req, res, body, corsHeaders, requestContext) {
  const auth = await authenticateRequest(req, res, corsHeaders, requestContext);
  if (!auth) return;

  const clientIp = getClientIp(req, requestContext);
  const rateLimit = checkEnhanceRateLimits(auth, clientIp);
  if (!rateLimit.ok) {
    setRequestError(requestContext, "rate_limited", rateLimit.error, rateLimit.status);
    json(
      res,
      rateLimit.status,
      { error: rateLimit.error },
      {
        ...corsHeaders,
        ...(rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : {}),
      },
    );
    return;
  }

  await streamWithCodex(req, res, body, corsHeaders, requestContext);
}

async function handleExtractUrl(req, res, body, corsHeaders, requestContext) {
  const auth = await authenticateRequest(req, res, corsHeaders, requestContext);
  if (!auth) return;

  const clientIp = getClientIp(req, requestContext);
  if (!enforceRateLimit(res, corsHeaders, {
    scope: "extract-minute",
    key: `${auth.rateKey}:${clientIp}`,
    limit: EXTRACT_PER_MINUTE,
    windowMs: 60_000,
  }, "Rate limit exceeded. Please try again later.", requestContext)) {
    return;
  }

  if (!enforceRateLimit(res, corsHeaders, {
    scope: "extract-day",
    key: auth.rateKey,
    limit: EXTRACT_PER_DAY,
    windowMs: 86_400_000,
  }, "Daily quota exceeded. Please try again tomorrow.", requestContext)) {
    return;
  }

  const rawUrl = body?.url;
  const urlInput = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!urlInput) {
    json(res, 400, { error: "A valid URL is required." }, corsHeaders);
    return;
  }
  if (urlInput.length > MAX_URL_CHARS) {
    json(
      res,
      413,
      { error: `URL is too large. Maximum ${MAX_URL_CHARS} characters.` },
      corsHeaders,
    );
    return;
  }

  const parsedUrl = parseInputUrl(urlInput);
  if (!parsedUrl) {
    json(res, 400, { error: "Invalid URL format." }, corsHeaders);
    return;
  }

  if (isPrivateHost(parsedUrl.hostname)) {
    json(res, 400, { error: "URLs pointing to private or internal hosts are not allowed." }, corsHeaders);
    return;
  }

  const cachedEntry = getExtractUrlCacheEntry(parsedUrl.href);
  if (cachedEntry) {
    logEvent("info", "extract_url_cache_hit", {
      request_id: requestContext?.requestId,
      url: parsedUrl.href,
    });
    json(res, 200, { title: cachedEntry.title, content: cachedEntry.content }, corsHeaders);
    return;
  }

  let pageResponse;
  try {
    pageResponse = await fetchPageWithHeaderFallback(parsedUrl.href, FETCH_TIMEOUT_MS);
  } catch (error) {
    if (isTimeoutError(error)) {
      json(res, 504, { error: "Timed out while fetching the URL." }, corsHeaders);
      return;
    }
    if (isUrlNotAllowedError(error)) {
      json(
        res,
        400,
        {
          error: toErrorMessage(error),
        },
        corsHeaders,
      );
      return;
    }
    throw error;
  }

  if (!pageResponse.ok) {
    json(
      res,
      422,
      {
        error: `Could not fetch URL (status ${pageResponse.status}). The target site may block automated access.`,
      },
      corsHeaders,
    );
    return;
  }

  let bodyText;
  try {
    bodyText = await readBodyWithLimit(pageResponse, MAX_RESPONSE_BYTES);
  } catch {
    json(res, 413, { error: "Response body is too large to process." }, corsHeaders);
    return;
  }

  const mimeType = responseMimeType(pageResponse);
  if (!isTextLikeContentType(mimeType) && looksLikeBinaryPayload(bodyText)) {
    json(
      res,
      422,
      {
        error:
          "The URL appears to be non-text or binary content. Provide a page URL with readable text, or paste content manually.",
      },
      corsHeaders,
    );
    return;
  }

  const title = extractTitle(bodyText, parsedUrl.href);
  let plainText = normalizeExtractableText(bodyText, mimeType);
  plainText = clampExtractText(plainText, 8000);

  if (plainText.length < 50) {
    json(
      res,
      422,
      {
        error:
          "Page had too little readable text content (often caused by script-only pages or anti-bot blocks). You can still paste text manually.",
      },
      corsHeaders,
    );
    return;
  }

  let summaryResult;
  try {
    summaryResult = await summarizeExtractedText(plainText);
  } catch (error) {
    if (isTimeoutError(error)) {
      json(res, 504, { error: "Timed out while extracting content." }, corsHeaders);
      return;
    }
    throw error;
  }

  if (!summaryResult.ok) {
    const errText = summaryResult.errorBody.trim();
    if (summaryResult.status === 429) {
      setRequestError(requestContext, "rate_limited", "Rate limit exceeded while extracting content.", 429);
      json(res, 429, { error: "Rate limit exceeded. Please try again in a moment." }, corsHeaders);
      return;
    }
    if (summaryResult.status === 402) {
      setRequestError(requestContext, "quota_exceeded", "AI credits depleted.", 402);
      json(res, 402, { error: "AI credits depleted. Please add funds to continue." }, corsHeaders);
      return;
    }
    setRequestError(
      requestContext,
      inferErrorCodeFromStatus(summaryResult.status) || "service_error",
      errText || "OpenAI extraction request failed.",
      summaryResult.status,
    );
    logEvent("error", "extract_url_openai_error", cleanLogFields({
      request_id: requestContext?.requestId,
      endpoint: requestContext?.endpoint,
      status_code: summaryResult.status,
      error_code: requestContext?.errorCode || inferErrorCodeFromStatus(summaryResult.status) || "service_error",
      error_message: errText || "OpenAI extraction request failed.",
    }));
    json(res, 500, { error: "Failed to extract content from the page." }, corsHeaders);
    return;
  }

  setExtractUrlCacheEntry(parsedUrl.href, title, summaryResult.content);
  json(res, 200, { title, content: summaryResult.content }, corsHeaders);
}

async function handleInferBuilderFields(req, res, body, corsHeaders, requestContext) {
  const auth = await authenticateRequest(req, res, corsHeaders, requestContext);
  if (!auth) return;

  const clientIp = getClientIp(req, requestContext);
  if (!enforceRateLimit(res, corsHeaders, {
    scope: "infer-minute",
    key: `${auth.rateKey}:${clientIp}`,
    limit: INFER_PER_MINUTE,
    windowMs: 60_000,
  }, "Rate limit exceeded. Please try again later.", requestContext)) {
    return;
  }

  if (!enforceRateLimit(res, corsHeaders, {
    scope: "infer-day",
    key: auth.rateKey,
    limit: INFER_PER_DAY,
    windowMs: 86_400_000,
  }, "Daily quota exceeded. Please try again tomorrow.", requestContext)) {
    return;
  }

  const promptRaw = body?.prompt;
  const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
  if (!prompt) {
    json(res, 400, { error: "Prompt is required." }, corsHeaders);
    return;
  }
  if (prompt.length > MAX_INFERENCE_PROMPT_CHARS) {
    json(
      res,
      413,
      { error: `Prompt is too large. Maximum ${MAX_INFERENCE_PROMPT_CHARS} characters.` },
      corsHeaders,
    );
    return;
  }

  const currentFields = parseCurrentFields(body?.current_fields ?? body?.currentFields);
  const lockMetadata = parseCurrentFields(body?.lock_metadata ?? body?.lockMetadata);

  const inference = inferBuilderFieldUpdates(prompt, currentFields, lockMetadata);
  json(res, 200, inference, corsHeaders);
}

async function requestHandler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const rawRequestId = (headerValue(req, "x-request-id") || "").trim();
  const requestId = rawRequestId || `req_${randomUUID().replaceAll("-", "")}`;
  const method = typeof req.method === "string" ? req.method : "GET";
  const requestContext = createRequestContext(
    requestId,
    url.pathname,
    method,
    transportForEndpoint(url.pathname),
  );
  res.setHeader("x-request-id", requestId);
  attachHttpRequestLifecycleLogging(res, requestContext);
  logEvent("info", "request_start", {
    request_id: requestContext.requestId,
    endpoint: requestContext.endpoint,
    method: requestContext.method,
    transport: requestContext.transport,
  });

  if (req.method === "GET" && url.pathname === "/") {
    json(res, 200, {
      service: "ai-prompt-pro-codex-service",
      provider: "codex-sdk",
      status: "running",
      health: "/health",
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, {
      ok: true,
      provider: "codex-sdk",
      provider_source: CODEX_CONFIG_SOURCE,
      provider_name: CODEX_CONFIG?.name || "OpenAI",
      provider_base_url: OPENAI_API_BASE_URL,
      model: DEFAULT_THREAD_OPTIONS.model || null,
      sandbox_mode: DEFAULT_THREAD_OPTIONS.sandboxMode || null,
      strict_public_api_key: STRICT_PUBLIC_API_KEY,
      trust_proxy: TRUST_PROXY,
    });
    return;
  }

  const isFunctionPath = (
    url.pathname === "/enhance"
    || url.pathname === "/extract-url"
    || url.pathname === "/infer-builder-fields"
  );

  if (isFunctionPath) {
    const cors = resolveCors(req);
    if (req.method === "OPTIONS") {
      if (!cors.ok) {
        setRequestError(requestContext, inferErrorCodeFromStatus(cors.status), cors.error, cors.status);
        json(res, cors.status, { error: cors.error }, cors.headers);
        return;
      }
      res.writeHead(200, cors.headers);
      res.end("ok");
      return;
    }

    if (!cors.ok) {
      setRequestError(requestContext, inferErrorCodeFromStatus(cors.status), cors.error, cors.status);
      json(res, cors.status, { error: cors.error }, cors.headers);
      return;
    }

    if (req.method !== "POST") {
      setRequestError(requestContext, inferErrorCodeFromStatus(405), "Method not allowed.", 405);
      json(res, 405, { error: "Method not allowed." }, cors.headers);
      return;
    }

    let body;
    try {
      body = await readBodyJsonWithLimit(req, { maxBytes: MAX_HTTP_BODY_BYTES });
    } catch (error) {
      const statusCode = isPayloadTooLargeError(error) ? 413 : 400;
      const errorCode = statusCode === 413 ? "payload_too_large" : "bad_request";
      const errorMessage = toErrorMessage(error);
      setRequestError(requestContext, errorCode, errorMessage, statusCode);
      json(res, statusCode, { error: errorMessage }, cors.headers);
      return;
    }

    try {
      if (url.pathname === "/enhance") {
        await handleEnhance(req, res, body, cors.headers, requestContext);
        return;
      }
      if (url.pathname === "/extract-url") {
        await handleExtractUrl(req, res, body, cors.headers, requestContext);
        return;
      }
      if (url.pathname === "/infer-builder-fields") {
        await handleInferBuilderFields(req, res, body, cors.headers, requestContext);
        return;
      }
    } catch (error) {
      setRequestError(requestContext, "service_error", toErrorMessage(error), 500);
      logEvent("error", "request_handler_exception", cleanLogFields({
        request_id: requestContext.requestId,
        endpoint: requestContext.endpoint,
        method: requestContext.method,
        transport: requestContext.transport,
        error_code: requestContext.errorCode || "service_error",
        error_message: requestContext.errorMessage,
      }));
      json(
        res,
        500,
        { error: requestContext.errorMessage || "Internal server error." },
        cors.headers,
      );
      return;
    }
  }

  setRequestError(requestContext, inferErrorCodeFromStatus(404), "Not found.", 404);
  json(res, 404, { detail: "Not found." });
}

const enhanceWebSocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: ENHANCE_WS_MAX_PAYLOAD_BYTES,
  handleProtocols: (protocols) => {
    if (protocols.has(ENHANCE_WS_PROTOCOL)) {
      return ENHANCE_WS_PROTOCOL;
    }
    return false;
  },
});

const websocketRequestContextByRequest = new WeakMap();

enhanceWebSocketServer.on("connection", (ws, req) => {
  const requestContext = websocketRequestContextByRequest.get(req)
    || createRequestContext(
      `req_${randomUUID().replaceAll("-", "")}`,
      ENHANCE_WS_PATH,
      "GET",
      "ws",
    );
  websocketRequestContextByRequest.delete(req);
  void handleEnhanceWebSocketConnection(ws, req, requestContext);
});

const server = createServer((req, res) => {
  void requestHandler(req, res);
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", "http://localhost");
  const rawRequestId = (headerValue(req, "x-request-id") || "").trim();
  const requestId = rawRequestId || `req_${randomUUID().replaceAll("-", "")}`;
  const requestContext = createRequestContext(
    requestId,
    url.pathname || ENHANCE_WS_PATH,
    typeof req.method === "string" ? req.method : "GET",
    "ws",
  );
  logEvent("info", "request_start", {
    request_id: requestContext.requestId,
    endpoint: requestContext.endpoint,
    method: requestContext.method,
    transport: requestContext.transport,
  });
  if (url.pathname !== ENHANCE_WS_PATH) {
    socket.destroy();
    setRequestError(requestContext, "not_found", "Not found.", 404);
    completeRequestContext(requestContext, 404);
    return;
  }

  if (req.method !== "GET") {
    rejectWebSocketUpgrade(socket, 405, { error: "Method not allowed." }, requestContext);
    return;
  }

  const offeredProtocols = parseWebSocketProtocols(req);
  if (!offeredProtocols.includes(ENHANCE_WS_PROTOCOL)) {
    rejectWebSocketUpgrade(socket, 400, {
      error: `Missing websocket protocol ${ENHANCE_WS_PROTOCOL}.`,
    }, requestContext);
    return;
  }

  const cors = resolveCors(req);
  if (!cors.ok) {
    rejectWebSocketUpgrade(
      socket,
      cors.status || 403,
      { error: cors.error || "Origin is not allowed." },
      requestContext,
    );
    return;
  }

  enhanceWebSocketServer.handleUpgrade(req, socket, head, (ws) => {
    websocketRequestContextByRequest.set(req, requestContext);
    enhanceWebSocketServer.emit("connection", ws, req);
  });
});

server.listen(SERVICE_CONFIG.port, SERVICE_CONFIG.host, () => {
  logEvent("info", "service_start", {
    host: SERVICE_CONFIG.host,
    port: SERVICE_CONFIG.port,
    provider_source: CODEX_CONFIG_SOURCE,
    provider: CODEX_CONFIG?.provider || "openai",
    provider_name: CODEX_CONFIG?.name || "OpenAI",
    provider_base_url: CODEX_CONFIG?.baseUrl || "https://api.openai.com/v1",
    model: DEFAULT_THREAD_OPTIONS.model || null,
    extract_model: EXTRACT_MODEL,
    sandbox_mode: DEFAULT_THREAD_OPTIONS.sandboxMode || null,
    strict_public_api_key: STRICT_PUBLIC_API_KEY,
    trust_proxy: TRUST_PROXY,
    trusted_proxy_ip_count: TRUSTED_PROXY_IPS.size,
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logEvent("info", "service_shutdown_start", { signal });

  server.close(() => {
    logEvent("info", "service_shutdown_http_closed", { signal });
  });

  for (const ws of enhanceWebSocketServer.clients) {
    try {
      ws.send(JSON.stringify({
        event: "stream.error",
        type: "error",
        error: "Server is shutting down.",
      }));
      ws.close(1001, "Server is shutting down.");
    } catch {
      // ignore errors on already-closing sockets
    }
  }

  const drainTimer = setTimeout(() => {
    logEvent("warn", "service_shutdown_drain_timeout", {
      signal,
      timeout_ms: SHUTDOWN_DRAIN_TIMEOUT_MS,
    });
    process.exit(1);
  }, SHUTDOWN_DRAIN_TIMEOUT_MS);
  drainTimer.unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
