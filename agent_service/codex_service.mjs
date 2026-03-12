import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";
import { Codex } from "@openai/codex-sdk";
import { WebSocketServer } from "ws";

// ── Shared utilities ────────────────────────────────────────────────────────
import {
  normalizeEnvValue,
  normalizeBool,
  parsePositiveIntegerEnv,
  parseJsonObjectEnv,
  parseStringArrayEnv,
  parseEnumEnv,
  toFiniteNumber,
  asNonEmptyString,
  hasText,
  truncateString,
  normalizeStringRecord,
} from "./env-parse.mjs";
import { cleanLogFields, logEvent } from "./logging.mjs";
import {
  createRequestContext,
  setRequestError,
  completeRequestContext,
  attachHttpRequestLifecycleLogging,
  captureUsageMetrics,
  inferErrorCodeFromStatus,
  hashUserIdentifier,
  hashTextForLogs,
  transportForEndpoint,
} from "./request-context.mjs";
import {
  json,
  beginSse,
  writeSse,
  endSse,
  headerValue,
  resolveCors,
  baseCorsHeaders,
} from "./http-helpers.mjs";

// ── Domain modules ──────────────────────────────────────────────────────────
import {
  buildBuilderFieldInferenceResult,
  buildInferUserMessage,
  createEmptyBuilderFieldInferenceResult,
  INFER_BUILDER_FIELDS_SCHEMA,
  INFER_SYSTEM_PROMPT,
} from "./builder-field-inference.mjs";
import {
  buildEnhancementMetaPrompt,
  detectEnhancementContext,
  parseEnhancementRequestAmbiguityMode,
  parseEnhancementRequestBuilderFields,
  parseEnhancementRequestIntentOverride,
  parseEnhancementRequestMode,
  parseEnhancementRequestRewriteStrictness,
  pickPrimaryAgentMessageText,
  postProcessEnhancementResponse,
} from "./enhancement-pipeline.mjs";
import {
  appendContextSourceSummariesToEnhancementInput,
  buildExpandedContextSourceBlock,
  buildSourceExpansionDecisionPrompt,
  normalizeEnhanceContextSources,
  parseSourceExpansionDecision,
  selectContextSourcesForExpansion,
  SOURCE_EXPANSION_DECISION_SCHEMA,
} from "./context-source-expansion.mjs";
import {
  sanitizeEnhanceThreadOptions,
  mergeEnhanceThreadOptions,
} from "./thread-options.mjs";
import {
  loadCodexConfig,
  resolveApiKey,
  isAzureProvider,
  resolveProviderConfig,
} from "./codex-config.mjs";
import {
  isPrivateHost,
  isUrlNotAllowedError,
  normalizeIpAddress,
  resolveClientIp,
} from "./network-security.mjs";
import { runGuardedAsync } from "./async-guard.mjs";
import { isPayloadTooLargeError, readBodyJsonWithLimit } from "./http-body.mjs";
import { extractItemText } from "./stream-text.mjs";
import {
  classifyStreamFailure,
  resolveRequestCompletionStatus,
  statusFromErrorCode,
} from "./stream-errors.mjs";
import {
  createAuthService,
  resolveAuthConfig,
} from "./auth.mjs";
import { createRateLimiter } from "./rate-limit.mjs";
import { resolveActiveCodexThreadId } from "./codex-thread-state.mjs";
import {
  isAbortLikeError,
  throwIfAborted,
} from "./request-abort-utils.mjs";

// ── Extracted domain modules ────────────────────────────────────────────────
import {
  bindAbortControllers,
  fetchPageWithHeaderFallback,
  readBodyWithLimit,
  responseMimeType,
  isTextLikeContentType,
  looksLikeBinaryPayload,
  extractTitle,
  normalizeExtractableText,
  clampExtractText,
  parseInputUrl,
  isTimeoutError,
  summarizeExtractedText,
  createExtractUrlCache,
} from "./url-extract.mjs";
import {
  isAgentMessageItemType,
  isWorkflowWebSearchItemType,
  isCountableWorkflowWebSearchItemType,
  extractWorkflowWebSearchQuery,
  buildAnalyzeRequestWorkflowDetail,
  buildSourceContextWorkflowUpdate,
  buildWebSearchWorkflowDetail,
  buildGeneratePromptWorkflowDetail,
  emitEnhancementWorkflowStep,
  truncateWorkflowDetail,
  idFromItem,
  typeFromItem,
} from "./enhance-workflow.mjs";
import {
  runStreamedWithRetry,
  runBufferedWithRetry,
} from "./codex-retry.mjs";
import {
  ENHANCE_WS_PATH,
  ENHANCE_WS_PROTOCOL,
  parseWebSocketProtocols,
  extractWebSocketAuthHeadersFromPayload,
  createWebSocketRequestView,
  isWebSocketOpen,
  closeWebSocket,
  writeWebSocketError,
  classifyWebSocketAuthErrorCode,
  classifyHttpAuthErrorCode,
  createConnectionSlotTracker,
  rejectWebSocketUpgrade,
} from "./ws-helpers.mjs";

// ---------------------------------------------------------------------------
// Resolve provider from ~/.codex/config.toml (optionally via CODEX_PROFILE)
// or CODEX_CONFIG_JSON.
// ---------------------------------------------------------------------------
const CODEX_PROFILE = normalizeEnvValue("CODEX_PROFILE");
const CODEX_CONFIG_OVERRIDES = parseJsonObjectEnv("CODEX_CONFIG_JSON") || {};
const CODEX_CONFIG_SEARCH_LABEL = CODEX_PROFILE
  ? `~/.codex/config.toml profile "${CODEX_PROFILE}" or CODEX_CONFIG_JSON`
  : "~/.codex/config.toml or CODEX_CONFIG_JSON";
const CODEX_CONFIG_FROM_TOML = await loadCodexConfig(CODEX_PROFILE);
const CODEX_CONFIG_FROM_ENV = resolveProviderConfig(CODEX_CONFIG_OVERRIDES, {
  profile: CODEX_PROFILE,
});
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
    requested_profile: CODEX_PROFILE || null,
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
    message: `No model provider config found in ${CODEX_CONFIG_SEARCH_LABEL}. Falling back to OPENAI_API_KEY.`,
    requested_profile: CODEX_PROFILE || null,
    codex_config_json_set: Object.keys(CODEX_CONFIG_OVERRIDES).length > 0,
    openai_api_key_set: !!process.env.OPENAI_API_KEY,
  }));
}

if (REQUIRE_PROVIDER_CONFIG && !CODEX_CONFIG) {
  throw new Error(
    `REQUIRE_PROVIDER_CONFIG is true, but no provider config was found in ${CODEX_CONFIG_SEARCH_LABEL}.`,
  );
}

const MAX_PROMPT_CHARS = Number.parseInt(process.env.MAX_PROMPT_CHARS || "32000", 10);
if (!Number.isFinite(MAX_PROMPT_CHARS) || MAX_PROMPT_CHARS <= 0) {
  throw new Error("MAX_PROMPT_CHARS must be a positive integer.");
}

const MAX_INFERENCE_PROMPT_CHARS = Number.parseInt(process.env.MAX_INFERENCE_PROMPT_CHARS || "24000", 10);
if (!Number.isFinite(MAX_INFERENCE_PROMPT_CHARS) || MAX_INFERENCE_PROMPT_CHARS <= 0) {
  throw new Error("MAX_INFERENCE_PROMPT_CHARS must be a positive integer.");
}

const MAX_URL_CHARS = Number.parseInt(process.env.MAX_URL_CHARS || "4096", 10);
if (!Number.isFinite(MAX_URL_CHARS) || MAX_URL_CHARS <= 0) {
  throw new Error("MAX_URL_CHARS must be a positive integer.");
}

const FETCH_TIMEOUT_MS = Number.parseInt(process.env.EXTRACT_FETCH_TIMEOUT_MS || "15000", 10);
if (!Number.isFinite(FETCH_TIMEOUT_MS) || FETCH_TIMEOUT_MS <= 0) {
  throw new Error("EXTRACT_FETCH_TIMEOUT_MS must be a positive integer.");
}

const MAX_RESPONSE_BYTES = Number.parseInt(
  process.env.EXTRACT_MAX_RESPONSE_BYTES || String(2 * 1024 * 1024),
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
const ENHANCE_WS_HEARTBEAT_MS = parsePositiveIntegerEnv(
  "ENHANCE_WS_HEARTBEAT_MS",
  30_000,
);
const ENHANCE_WS_IDLE_TIMEOUT_MS = parsePositiveIntegerEnv(
  "ENHANCE_WS_IDLE_TIMEOUT_MS",
  120_000,
);
const ENHANCE_WS_MAX_LIFETIME_MS = parsePositiveIntegerEnv(
  "ENHANCE_WS_MAX_LIFETIME_MS",
  15 * 60_000,
);
const ENHANCE_WS_MAX_PAYLOAD_BYTES = parsePositiveIntegerEnv(
  "ENHANCE_WS_MAX_PAYLOAD_BYTES",
  128 * 1024,
);
const ENHANCE_WS_MAX_BUFFERED_BYTES = parsePositiveIntegerEnv(
  "ENHANCE_WS_MAX_BUFFERED_BYTES",
  512 * 1024,
);
const MAX_HTTP_BODY_BYTES = parsePositiveIntegerEnv(
  "MAX_HTTP_BODY_BYTES",
  512 * 1024,
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
const MAX_SESSION_CONTEXT_SUMMARY_CHARS = parsePositiveIntegerEnv(
  "MAX_SESSION_CONTEXT_SUMMARY_CHARS",
  8_000,
);
const MAX_SESSION_LATEST_PROMPT_CHARS = parsePositiveIntegerEnv(
  "MAX_SESSION_LATEST_PROMPT_CHARS",
  24_000,
);

const OPENAI_API_BASE_URL = (CODEX_CONFIG?.baseUrl ? CODEX_CONFIG.baseUrl.replace(/\/+$/, "") : null)
  || process.env.OPENAI_BASE_URL?.trim()
  || "https://api.openai.com/v1";
const EXTRACT_MODEL = normalizeEnvValue("EXTRACT_MODEL")
  || RESOLVED_CODEX_MODEL
  || (!IS_AZURE_PROVIDER ? "gpt-4.1-mini" : undefined);
const INFER_MODEL = normalizeEnvValue("INFER_MODEL")
  || (!IS_AZURE_PROVIDER ? "gpt-5.4" : RESOLVED_CODEX_MODEL);

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

function resolveConfiguredCodexModel() {
  const explicitModel = normalizeEnvValue("CODEX_MODEL")
    || normalizeEnvValue("AZURE_OPENAI_DEPLOYMENT")
    || normalizeEnvValue("AZURE_OPENAI_DEPLOYMENT_NAME");
  if (explicitModel) return explicitModel;

  const providerModel = typeof CODEX_CONFIG?.model === "string" ? CODEX_CONFIG.model.trim() : "";
  if (providerModel) return providerModel;

  // Use a default model only for non-Azure providers.
  if (!IS_AZURE_PROVIDER) return "gpt-5.4";
  return undefined;
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
const RATE_LIMIT_BACKEND = normalizeEnvValue("RATE_LIMIT_BACKEND") || "memory";
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

const SERVICE_AUTH_CONFIG = resolveAuthConfig(process.env);

const ROUTE_AUTH_POLICIES = {
  "/enhance": { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
  "/extract-url": { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
  "/infer-builder-fields": { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
  [ENHANCE_WS_PATH]: { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
};

const authService = createAuthService({
  env: process.env,
  authConfig: SERVICE_AUTH_CONFIG,
  strictPublicApiKey: STRICT_PUBLIC_API_KEY,
  serviceToken: SERVICE_CONFIG.token,
  getClientIp,
  logEvent,
});

const rateLimiter = createRateLimiter({ backend: RATE_LIMIT_BACKEND });
const activeAbortControllers = new Set();
bindAbortControllers(activeAbortControllers);
const extractUrlCacheInstance = createExtractUrlCache({
  ttlMs: EXTRACT_URL_CACHE_TTL_MS,
  maxEntries: EXTRACT_URL_CACHE_MAX_ENTRIES,
});
const wsConnectionSlots = createConnectionSlotTracker(ENHANCE_WS_MAX_CONNECTIONS_PER_IP);

function trackAbortController(controller) {
  activeAbortControllers.add(controller);
  return controller;
}

function untrackAbortController(controller) {
  activeAbortControllers.delete(controller);
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

function extractEnhanceSession(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      threadId: undefined,
      contextSummary: "",
      latestEnhancedPrompt: "",
    };
  }

  const source = input;
  return {
    threadId: asNonEmptyString(source.thread_id) || asNonEmptyString(source.threadId),
    contextSummary: truncateString(
      asNonEmptyString(source.context_summary) || asNonEmptyString(source.contextSummary) || "",
      MAX_SESSION_CONTEXT_SUMMARY_CHARS,
    ),
    latestEnhancedPrompt: truncateString(
      asNonEmptyString(source.latest_enhanced_prompt) || asNonEmptyString(source.latestEnhancedPrompt) || "",
      MAX_SESSION_LATEST_PROMPT_CHARS,
    ),
  };
}

function buildEnhanceSessionEnvelope({
  threadId,
  turnId,
  status,
  transport,
  resumed,
  contextSummary,
  latestEnhancedPrompt,
}) {
  return {
    thread_id: threadId || null,
    turn_id: turnId || null,
    status,
    transport,
    resumed,
    context_summary: contextSummary || "",
    latest_enhanced_prompt: latestEnhancedPrompt || "",
  };
}

function toErrorMessage(error) {
  const rawMessage =
    (error instanceof Error && typeof error.message === "string")
      ? error.message
      : String(error);
  return sanitizeCodexExecErrorMessage(rawMessage);
}

async function inferBuilderFieldUpdates(prompt, currentFields, lockMetadata, requestContext = {}) {
  if (!INFER_MODEL) {
    return createEmptyBuilderFieldInferenceResult();
  }

  const hasProviderApiKey = CODEX_CONFIG
    ? RESOLVED_API_KEY
    : (normalizeEnvValue("OPENAI_API_KEY") || normalizeEnvValue("CODEX_API_KEY"));
  if (!hasProviderApiKey) {
    return createEmptyBuilderFieldInferenceResult();
  }

  try {
    const codex = getCodexClient();
    const inferInput = [
      INFER_SYSTEM_PROMPT,
      buildInferUserMessage(
        prompt,
        currentFields,
        lockMetadata,
        requestContext,
      ),
    ].join("\n\n");
    const inferThreadOptions = {
      model: INFER_MODEL,
      modelReasoningEffort: "minimal",
      webSearchEnabled: false,
    };
    const inferThread = codex.startThread(inferThreadOptions);
    const inferTurn = await runBufferedWithRetry(
      inferThread,
      inferInput,
      {
        outputSchema: INFER_BUILDER_FIELDS_SCHEMA,
      },
      { requestContext, ...RETRY_TELEMETRY },
    );
    captureUsageMetrics(requestContext, inferTurn.usage);
    return buildBuilderFieldInferenceResult({
      rawResponse: inferTurn.finalResponse,
      prompt,
      currentFields,
      lockMetadata,
    });
  } catch (error) {
    logEvent("warn", "infer_model_exception", { error_message: toErrorMessage(error) });
    return createEmptyBuilderFieldInferenceResult();
  }
}

/**
 * Summarize extracted text using the shared url-extract module with
 * config resolved at the service level.
 */
async function callSummarizeExtractedText(plainText) {
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

  return summarizeExtractedText(plainText, {
    apiBaseUrl: OPENAI_API_BASE_URL,
    apiKey,
    model: EXTRACT_MODEL,
    isAzure: IS_AZURE_PROVIDER,
    timeoutMs: FETCH_TIMEOUT_MS,
  });
}

function parseCurrentFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function parseInferRequestContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const parsed = {};

  if (typeof value.hasAttachedSources === "boolean") {
    parsed.hasAttachedSources = value.hasAttachedSources;
  }
  if (typeof value.attachedSourceCount === "number" && Number.isFinite(value.attachedSourceCount)) {
    parsed.attachedSourceCount = value.attachedSourceCount;
  }
  if (typeof value.hasPresetOrRemix === "boolean") {
    parsed.hasPresetOrRemix = value.hasPresetOrRemix;
  }
  if (typeof value.hasSessionContext === "boolean") {
    parsed.hasSessionContext = value.hasSessionContext;
  }
  if (Array.isArray(value.selectedOutputFormats)) {
    parsed.selectedOutputFormats = value.selectedOutputFormats
      .filter((entry) => typeof entry === "string" && entry.trim())
      .map((entry) => entry.trim());
  }
  if (typeof value.hasPastedSourceMaterial === "boolean") {
    parsed.hasPastedSourceMaterial = value.hasPastedSourceMaterial;
  }

  return parsed;
}

// Retry telemetry config used by both streamed and buffered calls.
const RETRY_TELEMETRY = {
  maxRetries: CODEX_429_MAX_RETRIES,
  backoffBaseSeconds: CODEX_429_BACKOFF_BASE_SECONDS,
  backoffMaxSeconds: CODEX_429_BACKOFF_MAX_SECONDS,
};

async function resolveEnhancementInputWithSourceExpansion({
  codex,
  prompt,
  enhancementContext,
  baseEnhancementInput,
  contextSources,
  threadOptions,
  signal,
  requestContext,
}) {
  if (!Array.isArray(contextSources) || contextSources.length === 0) {
    return {
      enhancementInput: baseEnhancementInput,
      sourceExpansion: null,
    };
  }

  const enhancementInputWithSourceSummaries =
    appendContextSourceSummariesToEnhancementInput({
      prompt,
      baseEnhancementInput,
      contextSources,
    });

  const expandableSources = contextSources.filter(
    (source) => source.expandable && hasText(source.summary) && hasText(source.rawContent),
  );
  if (expandableSources.length === 0) {
    return {
      enhancementInput: enhancementInputWithSourceSummaries,
      sourceExpansion: {
        availableCount: contextSources.length,
        expandableCount: 0,
        rationale: "",
        requestedRefs: [],
        expandedRefs: [],
      },
    };
  }

  const preflightPrompt = buildSourceExpansionDecisionPrompt({
    prompt,
    enhancementContext,
    contextSources,
  });
  const preflightThreadOptions = {
    ...(threadOptions || {}),
    modelReasoningEffort: "minimal",
    webSearchEnabled: false,
  };
  delete preflightThreadOptions.webSearchMode;
  const preflightThread = codex.startThread(preflightThreadOptions);

  try {
    const turn = await runBufferedWithRetry(
      preflightThread,
      preflightPrompt,
      {
        signal,
        outputSchema: SOURCE_EXPANSION_DECISION_SCHEMA,
      },
      { requestContext, ...RETRY_TELEMETRY },
    );
    captureUsageMetrics(requestContext, turn.usage);

    const decision = parseSourceExpansionDecision(turn.finalResponse);
    const requestedRefs = decision.sourceRequests.map((request) => request.ref);
    const selectedSources = decision.needsSourceContext
      ? selectContextSourcesForExpansion(expandableSources, decision.sourceRequests)
      : [];
    const expandedBlock = buildExpandedContextSourceBlock(selectedSources);
    const enhancementInput = expandedBlock
      ? `${enhancementInputWithSourceSummaries}\n\n${expandedBlock}`
      : enhancementInputWithSourceSummaries;

    logEvent("info", "enhance_source_context_decision", cleanLogFields({
      request_id: requestContext?.requestId,
      endpoint: requestContext?.endpoint,
      available_context_sources: contextSources.length,
      expandable_context_sources: expandableSources.length,
      needs_source_context: decision.needsSourceContext,
      requested_refs: requestedRefs.length > 0 ? requestedRefs.join(",") : undefined,
      expanded_refs: selectedSources.length > 0
        ? selectedSources.map((source) => source.reference?.refId || source.decisionRef).join(",")
        : undefined,
      rationale: decision.rationale || undefined,
    }));

    return {
      enhancementInput,
      sourceExpansion: {
        availableCount: contextSources.length,
        expandableCount: expandableSources.length,
        rationale: decision.rationale,
        requestedRefs,
        expandedRefs: selectedSources.map((source) => source.reference?.refId || source.decisionRef),
      },
    };
  } catch (error) {
    if (signal?.aborted || isAbortLikeError(error)) {
      throw error;
    }
    logEvent("warn", "enhance_source_context_preflight_failed", cleanLogFields({
      request_id: requestContext?.requestId,
      endpoint: requestContext?.endpoint,
      error_message: toErrorMessage(error),
      available_context_sources: contextSources.length,
      expandable_context_sources: expandableSources.length,
    }));
    return {
      enhancementInput: enhancementInputWithSourceSummaries,
      sourceExpansion: {
        availableCount: contextSources.length,
        expandableCount: expandableSources.length,
        rationale: "",
        requestedRefs: [],
        expandedRefs: [],
      },
    };
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

  const hasSessionField = Object.prototype.hasOwnProperty.call(requestBody, "session");
  if (
    hasSessionField
    && (
      !requestBody.session
      || typeof requestBody.session !== "object"
      || Array.isArray(requestBody.session)
    )
  ) {
    return {
      ok: false,
      status: 400,
      detail: "session must be an object when provided.",
    };
  }

  const requestSession = extractEnhanceSession(requestBody.session);
  const hasThreadIdField = Object.prototype.hasOwnProperty.call(requestBody, "thread_id")
    || Object.prototype.hasOwnProperty.call(requestBody, "threadId");
  const requestedThreadId = requestSession.threadId
    || asNonEmptyString(requestBody.thread_id)
    || asNonEmptyString(requestBody.threadId);
  if (hasThreadIdField && !requestedThreadId && !requestSession.threadId) {
    return {
      ok: false,
      status: 400,
      detail: "thread_id must be a non-empty string when provided.",
    };
  }

  const rawThreadOptions = requestBody.thread_options ?? requestBody.threadOptions;
  const sanitizedThreadOptions = sanitizeEnhanceThreadOptions(rawThreadOptions);
  if (!sanitizedThreadOptions.ok) {
    return {
      ok: false,
      status: 400,
      detail: sanitizedThreadOptions.error,
    };
  }

  const threadOptions = mergeEnhanceThreadOptions(
    DEFAULT_THREAD_OPTIONS,
    sanitizedThreadOptions.value,
  );
  const builderMode = parseEnhancementRequestMode(requestBody);
  const rewriteStrictness = parseEnhancementRequestRewriteStrictness(requestBody);
  const intentOverride = parseEnhancementRequestIntentOverride(requestBody);
  const ambiguityMode = parseEnhancementRequestAmbiguityMode(requestBody);
  const builderFields = parseEnhancementRequestBuilderFields(requestBody);
  const normalizedContextSources = normalizeEnhanceContextSources(
    requestBody.context_sources ?? requestBody.contextSources,
  );
  if (!normalizedContextSources.ok) {
    return {
      ok: false,
      status: 400,
      detail: normalizedContextSources.error,
    };
  }
  const enhancementContext = detectEnhancementContext(prompt, {
    builderMode,
    rewriteStrictness,
    ambiguityMode,
    intentOverride,
    builderFields,
    session: requestSession,
    webSearchEnabled: threadOptions.webSearchEnabled === true,
  });
  const baseEnhancementInput = buildEnhancementMetaPrompt(prompt, enhancementContext);

  return {
    ok: true,
    requestData: {
      prompt,
      requestedThreadId,
      requestSession,
      threadOptions,
      threadOptionWarnings: sanitizedThreadOptions.warnings,
      contextSources: normalizedContextSources.value,
      enhancementContext,
      baseEnhancementInput,
      turnId: `turn_${randomUUID().replaceAll("-", "")}`,
    },
  };
}

async function runEnhanceTurnStream(requestData, options) {
  const {
    prompt,
    requestedThreadId,
    requestSession,
    threadOptions,
    threadOptionWarnings,
    contextSources,
    enhancementContext,
    baseEnhancementInput,
    turnId,
  } = requestData;
  const {
    signal,
    emit,
    isClosed,
    requestContext,
  } = options;

  const agentMessageByItemId = new Map();
  const agentMessageItemOrder = [];
  let emittedAgentOutput = false;
  let activeThreadId = requestedThreadId || null;
  let thread = null;
  let sourceExpansion = null;
  let emittedGenerateWorkflowTerminal = false;
  let webSearchCount = 0;
  let lastWebSearchQuery = "";
  const seenWebSearchItemIds = new Set();

  if (Array.isArray(threadOptionWarnings) && threadOptionWarnings.length > 0) {
    logEvent("warn", "thread_options_sanitized", cleanLogFields({
      request_id: requestContext?.requestId,
      endpoint: requestContext?.endpoint,
      warnings: JSON.stringify(threadOptionWarnings),
    }));
  }

  try {
    throwIfAborted(signal);
    if (isClosed()) return;
    emitEnhancementWorkflowStep({
      emit,
      turnId,
      threadId: activeThreadId,
      stepId: "analyze_request",
      label: "Analyze request",
      status: "completed",
      detail: buildAnalyzeRequestWorkflowDetail(enhancementContext),
    });
    const codex = getCodexClient();
    const enhancementPreparation = await resolveEnhancementInputWithSourceExpansion({
      codex,
      prompt,
      enhancementContext,
      baseEnhancementInput,
      contextSources,
      threadOptions,
      signal,
      requestContext,
    });
    const enhancementInput = enhancementPreparation.enhancementInput;
    sourceExpansion = enhancementPreparation.sourceExpansion;
    const sourceContextWorkflow = buildSourceContextWorkflowUpdate(
      sourceExpansion,
      contextSources,
    );
    emitEnhancementWorkflowStep({
      emit,
      turnId,
      threadId: activeThreadId,
      stepId: "source_context",
      label: "Attach source context",
      status: sourceContextWorkflow.status,
      detail: sourceContextWorkflow.detail,
    });
    if (threadOptions.webSearchEnabled !== true) {
      emitEnhancementWorkflowStep({
        emit,
        turnId,
        threadId: activeThreadId,
        stepId: "web_search",
        label: "Search the web",
        status: "skipped",
        detail: "Web search was disabled for this run.",
      });
    }
    throwIfAborted(signal);
    if (isClosed()) return;
    thread = requestedThreadId
      ? codex.resumeThread(requestedThreadId, threadOptions)
      : codex.startThread(threadOptions);
    const { events } = await runStreamedWithRetry(
      thread,
      enhancementInput,
      { signal },
      { requestContext, ...RETRY_TELEMETRY },
    );
    activeThreadId = resolveActiveCodexThreadId(activeThreadId, thread);

    let turnFailed = false;
    let turnError = false;
    const buildSessionPayload = (status, overrides = {}) => buildEnhanceSessionEnvelope({
      threadId: activeThreadId,
      turnId,
      status,
      transport: requestContext.transport,
      resumed: Boolean(requestedThreadId),
      contextSummary: requestSession.contextSummary,
      latestEnhancedPrompt: requestSession.latestEnhancedPrompt,
      ...overrides,
    });

    for await (const event of events) {
      if (signal.aborted || isClosed()) break;

      if (event.type === "thread.started") {
        activeThreadId = event.thread_id;
        emit({
          event: "thread.started",
          type: "thread.started",
          thread_id: activeThreadId,
          turn_id: turnId,
          session: buildSessionPayload("starting"),
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
          session: buildSessionPayload("streaming"),
        });
        emitEnhancementWorkflowStep({
          emit,
          turnId,
          threadId: activeThreadId,
          stepId: "generate_prompt",
          label: "Generate enhanced prompt",
          status: "running",
          detail: "Generating the enhanced prompt and supporting artifacts.",
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
          session: buildSessionPayload("completed"),
        });
        continue;
      }

      if (event.type === "turn.failed") {
        turnFailed = true;
        const failure = classifyStreamFailure(event.error, {
          defaultCode: "service_error",
          defaultStatus: 503,
        });
        emittedGenerateWorkflowTerminal = true;
        emitEnhancementWorkflowStep({
          emit,
          turnId,
          threadId: activeThreadId,
          stepId: "generate_prompt",
          label: "Generate enhanced prompt",
          status: "failed",
          detail: failure.message,
        });
        setRequestError(requestContext, failure.code, failure.message, failure.status);
        emit({
          event: "turn.failed",
          type: "turn.failed",
          turn_id: turnId,
          thread_id: activeThreadId,
          error: {
            message: failure.message,
            code: failure.code,
            status: failure.status,
          },
          code: failure.code,
          status: failure.status,
          session: buildSessionPayload("failed"),
        });
        continue;
      }

      if (event.type === "error") {
        turnError = true;
        const failure = classifyStreamFailure({ message: event.message }, {
          defaultCode: "service_error",
          defaultStatus: 503,
        });
        emittedGenerateWorkflowTerminal = true;
        emitEnhancementWorkflowStep({
          emit,
          turnId,
          threadId: activeThreadId,
          stepId: "generate_prompt",
          label: "Generate enhanced prompt",
          status: "failed",
          detail: failure.message,
        });
        setRequestError(requestContext, failure.code, failure.message, failure.status);
        emit({
          event: "thread.error",
          type: "error",
          turn_id: turnId,
          thread_id: activeThreadId,
          error: {
            message: failure.message,
            code: failure.code,
            status: failure.status,
          },
          code: failure.code,
          status: failure.status,
          session: buildSessionPayload("failed"),
        });
        continue;
      }

      if (event.type === "item.started") {
        const itemId = idFromItem(event.item);
        const itemType = typeFromItem(event.item);
        if (isWorkflowWebSearchItemType(itemType)) {
          const nextQuery = extractWorkflowWebSearchQuery(event.item) || lastWebSearchQuery;
          if (
            itemId
            && isCountableWorkflowWebSearchItemType(itemType)
            && !seenWebSearchItemIds.has(itemId)
          ) {
            seenWebSearchItemIds.add(itemId);
            webSearchCount += 1;
          }
          lastWebSearchQuery = nextQuery;
          emitEnhancementWorkflowStep({
            emit,
            turnId,
            threadId: activeThreadId,
            stepId: "web_search",
            label: "Search the web",
            status: "running",
            detail: nextQuery
              ? `Searching the web for ${truncateWorkflowDetail(nextQuery, 120)}`
              : "Searching the web for supporting context.",
          });
        }
        emit({
          event: "item.started",
          type: "item.started",
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
        const currentText = extractItemText(event.item);
        if (isWorkflowWebSearchItemType(itemType)) {
          const nextQuery = extractWorkflowWebSearchQuery(event.item) || lastWebSearchQuery;
          if (
            itemId
            && isCountableWorkflowWebSearchItemType(itemType)
            && !seenWebSearchItemIds.has(itemId)
          ) {
            seenWebSearchItemIds.add(itemId);
            webSearchCount += 1;
          }
          lastWebSearchQuery = nextQuery;
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

        emit({
          event: "item.updated",
          type: "item.updated",
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
        const text = extractItemText(event.item);
        if (isWorkflowWebSearchItemType(itemType)) {
          const nextQuery = extractWorkflowWebSearchQuery(event.item) || lastWebSearchQuery;
          if (
            itemId
            && isCountableWorkflowWebSearchItemType(itemType)
            && !seenWebSearchItemIds.has(itemId)
          ) {
            seenWebSearchItemIds.add(itemId);
            webSearchCount += 1;
          }
          lastWebSearchQuery = nextQuery;
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

        emit({
          event: "item.completed",
          type: "item.completed",
          turn_id: turnId,
          thread_id: activeThreadId,
          item_id: itemId,
          item_type: itemType,
          item: event.item,
        });
        continue;
      }
    }

    if (!signal.aborted && !isClosed() && !turnFailed && !turnError) {
      if (threadOptions.webSearchEnabled === true) {
        emitEnhancementWorkflowStep({
          emit,
          turnId,
          threadId: activeThreadId,
          stepId: "web_search",
          label: "Search the web",
          status: webSearchCount > 0 ? "completed" : "skipped",
          detail: webSearchCount > 0
            ? buildWebSearchWorkflowDetail(webSearchCount, lastWebSearchQuery)
            : "No web lookup was needed for this enhancement.",
        });
      }

      const rawEnhancerOutput = pickPrimaryAgentMessageText(agentMessageByItemId, agentMessageItemOrder);

      // ── Enhancement response diagnostics ─────────────────────────────
      const agentItemCount = agentMessageByItemId.size;
      const rawOutputLength = rawEnhancerOutput.length;
      if (rawOutputLength === 0) {
        logEvent("warn", "enhance_empty_agent_output", cleanLogFields({
          request_id: requestContext?.requestId,
          endpoint: requestContext?.endpoint,
          thread_id: activeThreadId,
          turn_id: turnId,
          agent_item_count: agentItemCount,
          agent_item_order: agentMessageItemOrder.length,
          emitted_agent_output: emittedAgentOutput,
          message: "Codex turn completed but no agent_message text was collected. The model may have only produced reasoning or tool-use items.",
        }));
      }

      const postProcessed = postProcessEnhancementResponse({
        llmResponseText: rawEnhancerOutput,
        userInput: prompt,
        context: enhancementContext,
      });
      if (sourceExpansion) {
        postProcessed.source_context = sourceExpansion;
      }

      // Log parse outcome for every enhancement to aid failure triage.
      const diag = postProcessed.parse_diagnostics;
      logEvent(
        postProcessed.parse_status === "json" ? "info" : "warn",
        "enhance_post_process",
        cleanLogFields({
          request_id: requestContext?.requestId,
          endpoint: requestContext?.endpoint,
          thread_id: activeThreadId,
          turn_id: turnId,
          parse_status: postProcessed.parse_status,
          raw_output_chars: rawOutputLength,
          enhanced_prompt_chars: postProcessed.enhanced_prompt?.length ?? 0,
          quality_overall: postProcessed.quality_score?.overall,
          improvement_delta: postProcessed.improvement_delta,
          missing_parts: postProcessed.missing_parts?.length > 0
            ? postProcessed.missing_parts.join(",")
            : undefined,
          word_count_original: postProcessed.word_count?.original,
          word_count_enhanced: postProcessed.word_count?.enhanced,
          detected_intent: postProcessed.detected_context?.intent?.join(",") || undefined,
          detected_domain: postProcessed.detected_context?.domain?.join(",") || undefined,
          builder_mode: postProcessed.detected_context?.mode,
          // Parse diagnostics (especially useful when parse_status is "fallback")
          parse_had_code_fence: diag?.had_code_fence,
          parse_had_json_candidate: diag?.had_json_candidate,
          parse_json_candidate_chars: diag?.json_candidate_chars || undefined,
          parse_json_ok: diag?.json_parse_ok,
          parse_json_error: diag?.json_parse_error || undefined,
          parse_has_enhanced_prompt: diag?.has_enhanced_prompt_field,
          parse_has_parts_breakdown: diag?.has_parts_breakdown_field,
          parse_has_quality_score: diag?.has_quality_score_field,
        }),
      );

      const finalEnhancedPrompt = postProcessed.enhanced_prompt?.trim() || rawEnhancerOutput.trim();
      const finalContextSummary = postProcessed.session_context_summary || requestSession.contextSummary;
      emittedGenerateWorkflowTerminal = true;
      emitEnhancementWorkflowStep({
        emit,
        turnId,
        threadId: activeThreadId,
        stepId: "generate_prompt",
        label: "Generate enhanced prompt",
        status: "completed",
        detail: buildGeneratePromptWorkflowDetail(postProcessed),
      });

      if (!finalEnhancedPrompt) {
        logEvent("error", "enhance_empty_result", cleanLogFields({
          request_id: requestContext?.requestId,
          endpoint: requestContext?.endpoint,
          thread_id: activeThreadId,
          turn_id: turnId,
          parse_status: postProcessed.parse_status,
          raw_output_chars: rawOutputLength,
          raw_output_sha256: hashTextForLogs(rawEnhancerOutput),
          message: "Enhancement produced an empty final prompt. The LLM response could not be parsed or was blank.",
        }));
      }

      if (finalEnhancedPrompt && !emittedAgentOutput) {
        const syntheticItemId = `item_enhanced_${randomUUID().replaceAll("-", "")}`;
        emit({
          event: "item.completed",
          type: "item.completed",
          turn_id: turnId,
          thread_id: activeThreadId,
          item_id: syntheticItemId,
          item_type: "agent_message",
          item: { id: syntheticItemId, type: "agent_message", text: finalEnhancedPrompt },
        });
      }

      emit({
        event: "enhance/metadata",
        type: "enhance.metadata",
        turn_id: turnId,
        thread_id: activeThreadId,
          payload: postProcessed,
          request_warnings: threadOptionWarnings.length > 0 ? threadOptionWarnings : undefined,
          session: buildSessionPayload("completed", {
            contextSummary: finalContextSummary,
            latestEnhancedPrompt: finalEnhancedPrompt || requestSession.latestEnhancedPrompt,
          }),
        });
    }
  } catch (error) {
    activeThreadId = resolveActiveCodexThreadId(activeThreadId, thread);
    const existingErrorCode = requestContext?.errorCode;
    const existingStatusCode = requestContext?.statusCode;
    const aborted = signal?.aborted || isAbortLikeError(error);
    const failure = aborted
      ? {
        message: requestContext?.errorMessage || toErrorMessage(error),
        code: existingErrorCode || "request_aborted",
        status:
          existingStatusCode
          ?? statusFromErrorCode(existingErrorCode || "request_aborted")
          ?? 499,
      }
      : classifyStreamFailure({
        message: requestContext?.errorMessage || toErrorMessage(error),
        code: existingErrorCode,
        status: existingStatusCode,
      }, {
        defaultCode: "service_error",
        defaultStatus: 500,
      });
    setRequestError(requestContext, failure.code, failure.message, failure.status);
    if (!isClosed()) {
      if (!emittedGenerateWorkflowTerminal && !signal?.aborted) {
        emitEnhancementWorkflowStep({
          emit,
          turnId,
          threadId: activeThreadId,
          stepId: "generate_prompt",
          label: "Generate enhanced prompt",
          status: "failed",
          detail: failure.message,
        });
      }
      emit({
        event: "turn/error",
        type: "turn/error",
        turn_id: turnId,
        thread_id: activeThreadId,
        error: failure.message,
        code: failure.code,
        status: failure.status,
        session: buildEnhanceSessionEnvelope({
          threadId: activeThreadId,
          turnId,
          status: "failed",
          transport: requestContext.transport,
          resumed: Boolean(requestedThreadId),
          contextSummary: requestSession.contextSummary,
          latestEnhancedPrompt: requestSession.latestEnhancedPrompt,
        }),
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

  const controller = trackAbortController(new AbortController());
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
  try {
    await runEnhanceTurnStream(preparedRequest.requestData, {
      signal: controller.signal,
      emit: (payload) => writeSse(res, payload),
      isClosed: () => res.writableEnded,
      requestContext,
    });
    endSse(res);
  } finally {
    untrackAbortController(controller);
  }
}

async function handleEnhanceWebSocketConnection(ws, request, requestContext) {
  const clientIp = getClientIp(request, requestContext);
  if (!wsConnectionSlots.acquire(clientIp)) {
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
    wsConnectionSlots.release(clientIp);
  };
  ws.on("close", releaseConnectionSlot);

  try {
    const controller = trackAbortController(new AbortController());
    let receivedStartMessage = false;
    let awaitingPong = false;
    let idleTimeoutHandle = null;
    let maxLifetimeHandle = null;

    const cleanupTimers = () => {
      if (idleTimeoutHandle) {
        globalThis.clearTimeout(idleTimeoutHandle);
        idleTimeoutHandle = null;
      }
      if (maxLifetimeHandle) {
        globalThis.clearTimeout(maxLifetimeHandle);
        maxLifetimeHandle = null;
      }
    };

    const scheduleIdleTimeout = () => {
      if (idleTimeoutHandle) {
        globalThis.clearTimeout(idleTimeoutHandle);
      }
      idleTimeoutHandle = globalThis.setTimeout(() => {
        if (!isWebSocketOpen(ws)) return;
        setRequestError(
          requestContext,
          "request_timeout",
          "Websocket connection timed out while idle.",
          408,
        );
        emitWebSocketStreamError({
          message: "Websocket connection timed out while idle.",
          status: 408,
          code: "request_timeout",
        });
        if (!controller.signal.aborted) {
          controller.abort("Websocket idle timeout");
        }
        closeWebSocket(ws, 1008, "idle_timeout");
      }, ENHANCE_WS_IDLE_TIMEOUT_MS);
      idleTimeoutHandle.unref?.();
    };

    const markSocketActivity = () => {
      awaitingPong = false;
      scheduleIdleTimeout();
    };

    const closeForBackpressure = () => {
      if (!isWebSocketOpen(ws)) return;
      setRequestError(
        requestContext,
        "service_unavailable",
        "Websocket client is not consuming events fast enough.",
        503,
      );
      if (!controller.signal.aborted) {
        controller.abort("Websocket backpressure limit exceeded");
      }
      closeWebSocket(ws, 1008, "backpressure_limit");
    };

    const emitWebSocketPayload = (payload) => {
      if (!isWebSocketOpen(ws)) return false;
      if (
        typeof ws.bufferedAmount === "number"
        && ws.bufferedAmount > ENHANCE_WS_MAX_BUFFERED_BYTES
      ) {
        closeForBackpressure();
        return false;
      }
      try {
        ws.send(JSON.stringify(payload));
      } catch (error) {
        setRequestError(requestContext, "service_error", toErrorMessage(error), 500);
        if (!controller.signal.aborted) {
          controller.abort("Websocket send failed");
        }
        closeWebSocket(ws, 1011, "send_failed");
        return false;
      }
      markSocketActivity();
      if (
        typeof ws.bufferedAmount === "number"
        && ws.bufferedAmount > ENHANCE_WS_MAX_BUFFERED_BYTES
      ) {
        closeForBackpressure();
        return false;
      }
      return true;
    };

    const emitWebSocketStreamError = ({
      message,
      status,
      code,
      retryAfterSeconds,
    }) => {
      emitWebSocketPayload({
        event: "turn/error",
        type: "turn/error",
        error: message,
        ...(typeof status === "number" ? { status } : {}),
        ...(typeof code === "string" ? { code } : {}),
        ...(typeof retryAfterSeconds === "number" ? { retry_after_seconds: retryAfterSeconds } : {}),
      });
    };

    const firstMessageTimeoutHandle = globalThis.setTimeout(() => {
      if (receivedStartMessage || !isWebSocketOpen(ws)) return;
      setRequestError(
        requestContext,
        "request_timeout",
        "Timed out waiting for websocket start payload.",
        408,
      );
      emitWebSocketStreamError({
        message: "Timed out waiting for websocket start payload.",
        status: 408,
        code: "request_timeout",
      });
      if (!controller.signal.aborted) {
        controller.abort("Websocket start timeout");
      }
      closeWebSocket(ws, 1008, "start_timeout");
    }, ENHANCE_WS_INITIAL_MESSAGE_TIMEOUT_MS);
    firstMessageTimeoutHandle.unref?.();

    maxLifetimeHandle = globalThis.setTimeout(() => {
      if (!isWebSocketOpen(ws)) return;
      setRequestError(
        requestContext,
        "request_timeout",
        "Websocket connection exceeded the maximum lifetime.",
        408,
      );
      emitWebSocketStreamError({
        message: "Websocket connection exceeded the maximum lifetime.",
        status: 408,
        code: "request_timeout",
      });
      if (!controller.signal.aborted) {
        controller.abort("Websocket maximum lifetime exceeded");
      }
      closeWebSocket(ws, 1008, "max_lifetime");
    }, ENHANCE_WS_MAX_LIFETIME_MS);
    maxLifetimeHandle.unref?.();

    const heartbeatHandle = globalThis.setInterval(() => {
      if (!isWebSocketOpen(ws)) return;
      if (awaitingPong) {
        setRequestError(
          requestContext,
          "request_timeout",
          "Websocket heartbeat timed out.",
          408,
        );
        emitWebSocketStreamError({
          message: "Websocket heartbeat timed out.",
          status: 408,
          code: "request_timeout",
        });
        if (!controller.signal.aborted) {
          controller.abort("Websocket heartbeat timeout");
        }
        closeWebSocket(ws, 1008, "heartbeat_timeout");
        return;
      }

      awaitingPong = true;
      try {
        ws.ping();
      } catch (error) {
        setRequestError(requestContext, "service_error", toErrorMessage(error), 500);
        if (!controller.signal.aborted) {
          controller.abort("Websocket heartbeat send failed");
        }
        closeWebSocket(ws, 1011, "heartbeat_failed");
      }
    }, ENHANCE_WS_HEARTBEAT_MS);
    heartbeatHandle.unref?.();

    scheduleIdleTimeout();
    ws.on("pong", markSocketActivity);

    ws.on("close", () => {
      globalThis.clearTimeout(firstMessageTimeoutHandle);
      globalThis.clearInterval(heartbeatHandle);
      cleanupTimers();
      if (!controller.signal.aborted) {
        controller.abort("Client disconnected");
      }
      untrackAbortController(controller);
      const closeStatus = Number.isFinite(requestContext?.statusCode)
        ? resolveRequestCompletionStatus({
          transportStatusCode: 200,
          requestStatusCode: requestContext.statusCode,
          errorCode: requestContext?.errorCode,
        })
        : resolveRequestCompletionStatus({
          transportStatusCode: requestContext?.errorCode ? 400 : 200,
          requestStatusCode: requestContext?.statusCode,
          errorCode: requestContext?.errorCode,
        });
      completeRequestContext(requestContext, closeStatus);
    });

    ws.once("message", (rawData, isBinary) => {
      receivedStartMessage = true;
      globalThis.clearTimeout(firstMessageTimeoutHandle);
      markSocketActivity();
      runGuardedAsync(async () => {
        if (isBinary) {
          setRequestError(requestContext, "bad_response", "Invalid websocket payload.", 400);
          emitWebSocketStreamError({
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
          emitWebSocketStreamError({
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
        const auth = await authService.authenticateRequestContext(
          req,
          requestContext,
          authPolicyForEndpoint(requestContext?.endpoint || ENHANCE_WS_PATH),
        );
        if (!auth.ok) {
          setRequestError(
            requestContext,
            classifyHttpAuthErrorCode(auth.status, auth.error),
            auth.error,
            auth.status,
          );
          emitWebSocketStreamError({
            message: auth.error,
            status: auth.status,
            code: classifyWebSocketAuthErrorCode(auth.status, auth.error),
          });
          closeWebSocket(ws, 1008, "auth_failed");
          return;
        }
        if (requestContext) {
          requestContext.userIdHash = hashUserIdentifier(auth.userId);
          requestContext.authMode = auth.authMode;
        }

        const rateLimit = checkEnhanceRateLimits(auth, clientIp);
        if (!rateLimit.ok) {
          setRequestError(requestContext, "rate_limited", rateLimit.error, rateLimit.status);
          emitWebSocketStreamError({
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
          emitWebSocketStreamError({
            message: preparedRequest.detail,
            status: preparedRequest.status,
            code: "bad_response",
          });
          closeWebSocket(ws, 1008, "invalid_request");
          return;
        }

        await runEnhanceTurnStream(preparedRequest.requestData, {
          signal: controller.signal,
          emit: (eventPayload) => emitWebSocketPayload(eventPayload),
          isClosed: () => !isWebSocketOpen(ws),
          requestContext,
        });

        if (!controller.signal.aborted && isWebSocketOpen(ws)) {
          emitWebSocketPayload({
            event: "stream.done",
            type: "stream.done",
          });
          closeWebSocket(ws, 1000, "done");
        }
      }, (error) => {
        setRequestError(requestContext, "service_error", toErrorMessage(error), 500);
        if (isWebSocketOpen(ws)) {
          emitWebSocketStreamError({
            message: toErrorMessage(error),
            status: 500,
            code: "service_error",
          });
          if (!controller.signal.aborted) {
            controller.abort("Websocket internal error");
          }
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
  const result = rateLimiter.check(options);
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
  const result = rateLimiter.check(options);
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

function authPolicyForEndpoint(endpoint) {
  return ROUTE_AUTH_POLICIES[endpoint] || ROUTE_AUTH_POLICIES["/enhance"];
}

async function authenticateRequest(req, res, corsHeaders, requestContext) {
  const auth = await authService.authenticateRequestContext(
    req,
    requestContext,
    authPolicyForEndpoint(requestContext?.endpoint),
  );
  if (!auth.ok) {
    setRequestError(
      requestContext,
      classifyHttpAuthErrorCode(auth.status, auth.error),
      auth.error,
      auth.status,
    );
    json(res, auth.status, {
      error: auth.error,
      code: classifyHttpAuthErrorCode(auth.status, auth.error),
    }, corsHeaders);
    return null;
  }
  if (requestContext) {
    requestContext.userIdHash = hashUserIdentifier(auth.userId);
    requestContext.authMode = auth.authMode;
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
    json(res, 400, { error: "A valid URL is required.", code: "bad_request" }, corsHeaders);
    return;
  }
  if (urlInput.length > MAX_URL_CHARS) {
    json(
      res,
      413,
      { error: `URL is too large. Maximum ${MAX_URL_CHARS} characters.`, code: "payload_too_large" },
      corsHeaders,
    );
    return;
  }

  const parsedUrl = parseInputUrl(urlInput);
  if (!parsedUrl) {
    json(res, 400, { error: "Invalid URL format.", code: "bad_request" }, corsHeaders);
    return;
  }

  if (isPrivateHost(parsedUrl.hostname)) {
    setRequestError(requestContext, "unsafe_url", "URLs pointing to private or internal hosts are not allowed.", 400);
    json(res, 400, {
      error: "URLs pointing to private or internal hosts are not allowed.",
      code: "unsafe_url",
    }, corsHeaders);
    return;
  }

  const cachedEntry = extractUrlCacheInstance.get(parsedUrl.href);
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
    pageResponse = await fetchPageWithHeaderFallback(parsedUrl.href, FETCH_TIMEOUT_MS, EXTRACT_FETCH_MAX_REDIRECTS);
  } catch (error) {
    if (isTimeoutError(error)) {
      json(res, 504, { error: "Timed out while fetching the URL.", code: "request_timeout" }, corsHeaders);
      return;
    }
    if (isUrlNotAllowedError(error)) {
      setRequestError(requestContext, "unsafe_url", toErrorMessage(error), 400);
      json(
        res,
        400,
        {
          error: toErrorMessage(error),
          code: "unsafe_url",
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
        code: "bad_response",
      },
      corsHeaders,
    );
    return;
  }

  let bodyText;
  try {
    bodyText = await readBodyWithLimit(pageResponse, MAX_RESPONSE_BYTES);
  } catch {
    json(res, 413, { error: "Response body is too large to process.", code: "payload_too_large" }, corsHeaders);
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
        code: "bad_response",
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
        code: "bad_response",
      },
      corsHeaders,
    );
    return;
  }

  let summaryResult;
  try {
    summaryResult = await callSummarizeExtractedText(plainText);
  } catch (error) {
    if (isTimeoutError(error)) {
      json(res, 504, { error: "Timed out while extracting content.", code: "request_timeout" }, corsHeaders);
      return;
    }
    throw error;
  }

  if (!summaryResult.ok) {
    const errText = summaryResult.errorBody.trim();
    if (summaryResult.status === 429) {
      setRequestError(requestContext, "rate_limited", "Rate limit exceeded while extracting content.", 429);
      json(res, 429, { error: "Rate limit exceeded. Please try again in a moment.", code: "rate_limited" }, corsHeaders);
      return;
    }
    if (summaryResult.status === 402) {
      setRequestError(requestContext, "quota_exceeded", "AI credits depleted.", 402);
      json(res, 402, { error: "AI credits depleted. Please add funds to continue.", code: "quota_exceeded" }, corsHeaders);
      return;
    }
    setRequestError(
      requestContext,
      inferErrorCodeFromStatus(summaryResult.status) || "service_error",
      "OpenAI extraction request failed.",
      summaryResult.status,
    );
    logEvent("error", "extract_url_openai_error", cleanLogFields({
      request_id: requestContext?.requestId,
      endpoint: requestContext?.endpoint,
      status_code: summaryResult.status,
      error_code: requestContext?.errorCode || inferErrorCodeFromStatus(summaryResult.status) || "service_error",
      error_message: "OpenAI extraction request failed.",
      upstream_error_chars: errText.length || undefined,
      upstream_error_sha256: hashTextForLogs(errText),
    }));
    json(res, 500, { error: "Failed to extract content from the page.", code: "service_error" }, corsHeaders);
    return;
  }

  extractUrlCacheInstance.set(parsedUrl.href, title, summaryResult.content);
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
  const inferRequestContext = parseInferRequestContext(
    body?.request_context ?? body?.requestContext,
  );

  const inference = await inferBuilderFieldUpdates(
    prompt,
    currentFields,
    lockMetadata,
    inferRequestContext,
  );
  json(res, 200, inference, corsHeaders);
}

function buildReadinessReport() {
  const issues = [];
  const warnings = [];
  const authReadiness = authService.getReadiness();

  const hasProviderApiKey = CODEX_CONFIG
    ? Boolean(RESOLVED_API_KEY)
    : Boolean(normalizeEnvValue("OPENAI_API_KEY") || normalizeEnvValue("CODEX_API_KEY"));

  if (isShuttingDown) {
    issues.push("service_shutting_down");
  }
  if (REQUIRE_PROVIDER_CONFIG && !CODEX_CONFIG) {
    issues.push("provider_config_missing");
  }
  if (!hasProviderApiKey) {
    issues.push("provider_api_key_missing");
  }
  if (HAS_MISSING_AZURE_MODEL) {
    issues.push("provider_model_missing");
  }
  warnings.push(...authReadiness.warnings);
  issues.push(...authReadiness.issues);

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    provider: "codex-sdk",
    provider_source: CODEX_CONFIG_SOURCE,
    provider_name: CODEX_CONFIG?.name || "OpenAI",
    provider_base_url: OPENAI_API_BASE_URL,
    model: DEFAULT_THREAD_OPTIONS.model || null,
    extract_model: EXTRACT_MODEL || null,
    infer_model: INFER_MODEL || null,
    sandbox_mode: DEFAULT_THREAD_OPTIONS.sandboxMode || null,
    strict_public_api_key: STRICT_PUBLIC_API_KEY,
    trust_proxy: TRUST_PROXY,
    rate_limit_backend: RATE_LIMIT_BACKEND,
    ...authService.getStartupSummary(),
  };
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
    transportForEndpoint(url.pathname, ENHANCE_WS_PATH),
  );
  res.setHeader("x-request-id", requestId);
  attachHttpRequestLifecycleLogging(res, requestContext);
  logEvent("info", "request_start", {
    request_id: requestContext.requestId,
    endpoint: requestContext.endpoint,
    method: requestContext.method,
    transport: requestContext.transport,
  });

  if (isShuttingDown) {
    setRequestError(requestContext, "service_unavailable", "Server is shutting down.", 503);
    json(res, 503, { error: "Server is shutting down.", code: "service_unavailable" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    json(res, 200, {
      service: "ai-prompt-pro-codex-service",
      provider: "codex-sdk",
      status: "running",
      health: "/health",
      ready: "/ready",
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, {
      ok: true,
      status: "alive",
      ready: "/ready",
      provider: "codex-sdk",
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/ready") {
    const readiness = buildReadinessReport();
    json(res, readiness.ok ? 200 : 503, readiness);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health/details") {
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
    const cors = resolveCors(req, CORS_CONFIG);
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
  if (isShuttingDown) {
    rejectWebSocketUpgrade(socket, 503, {
      error: "Server is shutting down.",
      code: "service_unavailable",
    }, requestContext);
    return;
  }
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

  const cors = resolveCors(req, CORS_CONFIG);
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
    infer_model: INFER_MODEL,
    sandbox_mode: DEFAULT_THREAD_OPTIONS.sandboxMode || null,
    strict_public_api_key: STRICT_PUBLIC_API_KEY,
    trust_proxy: TRUST_PROXY,
    trusted_proxy_ip_count: TRUSTED_PROXY_IPS.size,
    rate_limit_backend: RATE_LIMIT_BACKEND,
    ...authService.getStartupSummary(),
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logEvent("info", "service_shutdown_start", {
    signal,
    active_ws_connections: enhanceWebSocketServer.clients.size,
    active_abort_controllers: activeAbortControllers.size,
  });

  server.close(() => {
    logEvent("info", "service_shutdown_http_closed", { signal });
  });

  for (const controller of activeAbortControllers) {
    if (controller.signal.aborted) continue;
    controller.abort("Server is shutting down.");
  }

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
