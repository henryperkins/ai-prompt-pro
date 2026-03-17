import { Codex } from "@openai/codex-sdk";
import {
  normalizeEnvValue,
  normalizeBool,
  parsePositiveIntegerEnv,
  parseJsonObjectEnv,
  parseStringArrayEnv,
  parseEnumEnv,
  normalizeStringRecord,
} from "./env-parse.mjs";
import { cleanLogFields, logEvent, SERVICE_NAME } from "./logging.mjs";
import { headerValue } from "./http-helpers.mjs";
import {
  loadCodexConfig,
  isAzureProvider,
  resolveProviderConfig,
} from "./codex-config.mjs";
import {
  normalizeIpAddress,
  resolveClientIp,
} from "./network-security.mjs";
import {
  createAuthService,
  resolveAuthConfig,
} from "./auth.mjs";
import { createRateLimiter } from "./rate-limit.mjs";
import {
  bindAbortControllers,
  createExtractUrlCache,
} from "./url-extract.mjs";
import {
  ENHANCE_WS_PATH,
  createConnectionSlotTracker,
} from "./ws-helpers.mjs";

const SANDBOX_MODES = new Set(["read-only", "workspace-write", "danger-full-access"]);
const REASONING_EFFORTS = new Set(["minimal", "low", "medium", "high", "xhigh"]);
const REASONING_SUMMARIES = new Set(["auto", "concise", "detailed"]);
const WEB_SEARCH_MODES = new Set(["disabled", "cached", "live"]);
const APPROVAL_POLICIES = new Set(["never", "on-request", "on-failure", "untrusted"]);

function parseNonNegativeIntegerEnv(name, defaultValue, env) {
  const raw = normalizeEnvValue(name, env);
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function parseNonNegativeFloatEnv(name, defaultValue, env) {
  const raw = normalizeEnvValue(name, env);
  if (!raw) return defaultValue;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function resolveProviderApiKey(providerConfig, env) {
  const envKey = typeof providerConfig?.envKey === "string" ? providerConfig.envKey.trim() : "";
  if (!envKey) return null;
  const value = env?.[envKey];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveConfiguredCodexModel({ env, codexConfig, isAzureProviderConfig }) {
  const explicitModel = normalizeEnvValue("CODEX_MODEL", env)
    || normalizeEnvValue("AZURE_OPENAI_DEPLOYMENT", env)
    || normalizeEnvValue("AZURE_OPENAI_DEPLOYMENT_NAME", env);
  if (explicitModel) return explicitModel;

  const providerModel = typeof codexConfig?.model === "string" ? codexConfig.model.trim() : "";
  if (providerModel) return providerModel;

  if (!isAzureProviderConfig) return "gpt-5.4";
  return undefined;
}

function stripInternalPaths(message) {
  return message
    .replace(/(?:\/(?:home|tmp|var|usr|opt|etc|root))\S*/gi, "[path]")
    .replace(/[A-Z]:\\[^\s"')]+/g, "[path]")
    .replace(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(?::\d+)?[^\s"]*/gi, "[internal-url]");
}

export function sanitizeCodexExecErrorMessage(message) {
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

function toErrorMessage(error) {
  const rawMessage =
    (error instanceof Error && typeof error.message === "string")
      ? error.message
      : String(error);
  return sanitizeCodexExecErrorMessage(rawMessage);
}

function buildProviderConfigSearchLabel(codexProfile) {
  return codexProfile
    ? `~/.codex/config.toml profile "${codexProfile}" or CODEX_CONFIG_JSON`
    : "~/.codex/config.toml or CODEX_CONFIG_JSON";
}

function logProviderConfigResolution({
  codexConfig,
  codexConfigSource,
  codexConfigSearchLabel,
  codexConfigOverrides,
  codexProfile,
  resolvedApiKey,
  isAzureProviderConfig,
  env,
}) {
  if (codexConfig) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "provider_config_resolved",
      service: SERVICE_NAME,
      config_source: codexConfigSource,
      requested_profile: codexProfile || null,
      provider: codexConfig.provider,
      provider_name: codexConfig.name,
      base_url: codexConfig.baseUrl,
      env_key: codexConfig.envKey,
      api_key_resolved: !!resolvedApiKey,
      is_azure: isAzureProviderConfig,
    }));
    return;
  }

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "warn",
    event: "provider_config_not_found",
    service: SERVICE_NAME,
    message: `No model provider config found in ${codexConfigSearchLabel}. Falling back to OPENAI_API_KEY.`,
    requested_profile: codexProfile || null,
    codex_config_json_set: Object.keys(codexConfigOverrides).length > 0,
    openai_api_key_set: !!env?.OPENAI_API_KEY,
  }));
}

export async function createServiceRuntime({ env = process.env, deps = {} } = {}) {
  const {
    CodexClass = Codex,
    bindAbortControllersImpl = bindAbortControllers,
    cleanLogFieldsImpl = cleanLogFields,
    createAuthServiceImpl = createAuthService,
    createConnectionSlotTrackerImpl = createConnectionSlotTracker,
    createExtractUrlCacheImpl = createExtractUrlCache,
    createRateLimiterImpl = createRateLimiter,
    isAzureProviderImpl = isAzureProvider,
    loadCodexConfigImpl = loadCodexConfig,
    logEventImpl = logEvent,
    normalizeIpAddressImpl = normalizeIpAddress,
    resolveAuthConfigImpl = resolveAuthConfig,
    resolveClientIpImpl = resolveClientIp,
    resolveProviderConfigImpl = resolveProviderConfig,
  } = deps;

  const codexProfile = normalizeEnvValue("CODEX_PROFILE", env);
  const codexConfigOverrides = parseJsonObjectEnv("CODEX_CONFIG_JSON", env) || {};
  const codexConfigSearchLabel = buildProviderConfigSearchLabel(codexProfile);
  const codexConfigFromToml = await loadCodexConfigImpl(codexProfile);
  const codexConfigFromEnv = resolveProviderConfigImpl(codexConfigOverrides, {
    profile: codexProfile,
  });
  const codexConfig = codexConfigFromToml || codexConfigFromEnv;
  const codexConfigSource = codexConfigFromToml
    ? "config_toml"
    : (codexConfigFromEnv ? "codex_config_json" : "fallback");
  const isAzureProviderConfig = isAzureProviderImpl(codexConfig);
  const resolvedApiKey = resolveProviderApiKey(codexConfig, env);
  const requireProviderConfig = normalizeBool(env?.REQUIRE_PROVIDER_CONFIG, false);
  const resolvedCodexModel = resolveConfiguredCodexModel({
    env,
    codexConfig,
    isAzureProviderConfig,
  });
  const hasMissingAzureModel = isAzureProviderConfig && !resolvedCodexModel;

  logProviderConfigResolution({
    codexConfig,
    codexConfigSource,
    codexConfigSearchLabel,
    codexConfigOverrides,
    codexProfile,
    resolvedApiKey,
    isAzureProviderConfig,
    env,
  });

  if (requireProviderConfig && !codexConfig) {
    throw new Error(
      `REQUIRE_PROVIDER_CONFIG is true, but no provider config was found in ${codexConfigSearchLabel}.`,
    );
  }

  const maxPromptChars = parsePositiveIntegerEnv("MAX_PROMPT_CHARS", 64000, env);
  const maxInferencePromptChars = parsePositiveIntegerEnv("MAX_INFERENCE_PROMPT_CHARS", 24000, env);
  const maxUrlChars = parsePositiveIntegerEnv("MAX_URL_CHARS", 4096, env);
  const fetchTimeoutMs = parsePositiveIntegerEnv("EXTRACT_FETCH_TIMEOUT_MS", 15000, env);
  const maxResponseBytes = parsePositiveIntegerEnv(
    "EXTRACT_MAX_RESPONSE_BYTES",
    2 * 1024 * 1024,
    env,
  );
  const enhancePerMinute = parsePositiveIntegerEnv("ENHANCE_PER_MINUTE", 12, env);
  const enhancePerDay = parsePositiveIntegerEnv("ENHANCE_PER_DAY", 300, env);
  const extractPerMinute = parsePositiveIntegerEnv("EXTRACT_PER_MINUTE", 6, env);
  const extractPerDay = parsePositiveIntegerEnv("EXTRACT_PER_DAY", 120, env);
  const inferPerMinute = parsePositiveIntegerEnv("INFER_PER_MINUTE", 15, env);
  const inferPerDay = parsePositiveIntegerEnv("INFER_PER_DAY", 400, env);
  const enhanceWsInitialMessageTimeoutMs = parsePositiveIntegerEnv(
    "ENHANCE_WS_INITIAL_MESSAGE_TIMEOUT_MS",
    5000,
    env,
  );
  const enhanceWsHeartbeatMs = parsePositiveIntegerEnv(
    "ENHANCE_WS_HEARTBEAT_MS",
    30_000,
    env,
  );
  const enhanceWsIdleTimeoutMs = parsePositiveIntegerEnv(
    "ENHANCE_WS_IDLE_TIMEOUT_MS",
    120_000,
    env,
  );
  const enhanceWsMaxLifetimeMs = parsePositiveIntegerEnv(
    "ENHANCE_WS_MAX_LIFETIME_MS",
    15 * 60_000,
    env,
  );
  const enhanceWsMaxPayloadBytes = parsePositiveIntegerEnv(
    "ENHANCE_WS_MAX_PAYLOAD_BYTES",
    128 * 1024,
    env,
  );
  const enhanceWsMaxBufferedBytes = parsePositiveIntegerEnv(
    "ENHANCE_WS_MAX_BUFFERED_BYTES",
    512 * 1024,
    env,
  );
  const maxHttpBodyBytes = parsePositiveIntegerEnv(
    "MAX_HTTP_BODY_BYTES",
    512 * 1024,
    env,
  );
  const enhanceWsMaxConnectionsPerIp = parsePositiveIntegerEnv(
    "ENHANCE_WS_MAX_CONNECTIONS_PER_IP",
    10,
    env,
  );
  const shutdownDrainTimeoutMs = parsePositiveIntegerEnv(
    "SHUTDOWN_DRAIN_TIMEOUT_MS",
    10_000,
    env,
  );
  const extractUrlCacheTtlMs = parsePositiveIntegerEnv(
    "EXTRACT_URL_CACHE_TTL_MS",
    600_000,
    env,
  );
  const extractUrlCacheMaxEntries = parsePositiveIntegerEnv(
    "EXTRACT_URL_CACHE_MAX_ENTRIES",
    200,
    env,
  );
  const maxSessionContextSummaryChars = parsePositiveIntegerEnv(
    "MAX_SESSION_CONTEXT_SUMMARY_CHARS",
    8_000,
    env,
  );
  const maxSessionLatestPromptChars = parsePositiveIntegerEnv(
    "MAX_SESSION_LATEST_PROMPT_CHARS",
    24_000,
    env,
  );
  const githubPerMinute = parsePositiveIntegerEnv("GITHUB_PER_MINUTE", 30, env);
  const githubPerDay = parsePositiveIntegerEnv("GITHUB_PER_DAY", 600, env);
  const githubConfig = (() => {
    const enabled = normalizeBool(env?.GITHUB_CONTEXT_ENABLED, false);
    const postInstallRedirectUrl = normalizeEnvValue("GITHUB_POST_INSTALL_REDIRECT_URL", env);
    if (enabled && postInstallRedirectUrl) {
      try {
        new URL(postInstallRedirectUrl);
      } catch {
        throw new Error("GITHUB_POST_INSTALL_REDIRECT_URL must be a valid absolute URL.");
      }
    }

    return {
      enabled,
      apiBaseUrl: normalizeEnvValue("GITHUB_API_BASE_URL", env),
      appId: normalizeEnvValue("GITHUB_APP_ID", env),
      appPrivateKey: normalizeEnvValue("GITHUB_APP_PRIVATE_KEY", env),
      appSlug: normalizeEnvValue("GITHUB_APP_SLUG", env),
      databaseUrl: normalizeEnvValue("NEON_DATABASE_URL", env) || normalizeEnvValue("DATABASE_URL", env),
      postInstallRedirectUrl,
      repositoryPageSize: parsePositiveIntegerEnv("GITHUB_REPOSITORY_PAGE_SIZE", 50, env),
      stateSecret: normalizeEnvValue("GITHUB_APP_STATE_SECRET", env),
      webhookSecret: normalizeEnvValue("GITHUB_WEBHOOK_SECRET", env),
    };
  })();

  // --- Diagnostic: port mismatch detection ---
  if (githubConfig.enabled) {
    const redirectUrl = githubConfig.postInstallRedirectUrl || "";
    const originsRaw = normalizeEnvValue("ALLOWED_ORIGINS", env) || "";
    const vitePort = normalizeEnvValue("PORT", env) || "8001";
    if (redirectUrl.includes(":5173")) {
      logEventImpl("warn", "github_port_mismatch", {
        error_code: "github_config_port_mismatch",
        message:
          "GITHUB_POST_INSTALL_REDIRECT_URL references port 5173, but Vite dev server runs on 8080. "
          + "The post-install redirect will land on a dead page.",
        redirect_url: redirectUrl,
      });
    }
    if (originsRaw.includes(":5173") && !originsRaw.includes(":8080")) {
      logEventImpl("warn", "github_cors_port_mismatch", {
        error_code: "github_cors_port_mismatch",
        message:
          "ALLOWED_ORIGINS includes port 5173 but not 8080. "
          + "The frontend on port 8080 will be CORS-blocked for all GitHub API calls.",
        allowed_origins: originsRaw,
      });
    }
  }
  // --- End diagnostic ---

  const githubUserAuthPolicy = Object.freeze({
    allowPublicKey: false,
    allowServiceToken: false,
    allowUserJwt: true,
    requireActiveSession: true,
  });

  const openaiApiBaseUrl = (codexConfig?.baseUrl ? codexConfig.baseUrl.replace(/\/+$/, "") : null)
    || normalizeEnvValue("OPENAI_BASE_URL", env)
    || "https://api.openai.com/v1";
  const directApiKey = normalizeEnvValue("CODEX_API_KEY", env) || normalizeEnvValue("OPENAI_API_KEY", env);
  const extractModel = normalizeEnvValue("EXTRACT_MODEL", env)
    || resolvedCodexModel
    || (!isAzureProviderConfig ? "gpt-4.1-mini" : undefined);
  const inferModel = normalizeEnvValue("INFER_MODEL", env)
    || (!isAzureProviderConfig ? "gpt-5.4" : resolvedCodexModel);

  const retryTelemetry = {
    maxRetries: parseNonNegativeIntegerEnv("CODEX_429_MAX_RETRIES", 2, env),
    backoffBaseSeconds: parseNonNegativeFloatEnv("CODEX_429_BACKOFF_BASE_SECONDS", 1.0, env),
    backoffMaxSeconds: parseNonNegativeFloatEnv("CODEX_429_BACKOFF_MAX_SECONDS", 20.0, env),
  };

  if (hasMissingAzureModel) {
    logEventImpl("warn", "provider_model_not_set", {
      error_code: "provider_model_not_set",
      message:
        "Azure provider is configured but no model deployment name was resolved. "
        + "Set CODEX_MODEL (or AZURE_OPENAI_DEPLOYMENT) to a valid Azure deployment name.",
      provider: codexConfig?.provider,
      config_source: codexConfigSource,
    });
  }

  const serviceConfig = (() => {
    const host = normalizeEnvValue("HOST", env) || "0.0.0.0";
    const portRaw = normalizeEnvValue("PORT", env) || "8001";
    const port = Number.parseInt(portRaw, 10);
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error(`PORT must be a positive integer. Received "${portRaw}".`);
    }

    return {
      host,
      port,
      token: normalizeEnvValue("AGENT_SERVICE_TOKEN", env),
    };
  })();

  const corsConfig = (() => {
    const configured = normalizeEnvValue("ALLOWED_ORIGINS", env);
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

  const strictPublicApiKey = normalizeBool(env?.STRICT_PUBLIC_API_KEY, true);
  const rateLimitBackend = normalizeEnvValue("RATE_LIMIT_BACKEND", env) || "memory";
  const trustProxy = normalizeBool(env?.TRUST_PROXY, false);
  const trustedProxyIps = new Set(
    (parseStringArrayEnv("TRUSTED_PROXY_IPS", env) || [])
      .map((value) => normalizeIpAddressImpl(value))
      .filter((value) => typeof value === "string" && value.length > 0),
  );
  const extractFetchMaxRedirects = parsePositiveIntegerEnv("EXTRACT_FETCH_MAX_REDIRECTS", 5, env);

  if (!strictPublicApiKey) {
    logEventImpl("warn", "strict_public_api_key_disabled", {
      error_code: "auth_config_weak_public_key_matching",
      message:
        "STRICT_PUBLIC_API_KEY is disabled. Publishable-format keys may be accepted without explicit configuration.",
    });
  }

  const serviceAuthConfig = resolveAuthConfigImpl(env);

  const activeAbortControllers = new Set();
  bindAbortControllersImpl(activeAbortControllers);

  function getClientIp(req, requestContext) {
    const resolvedIp = resolveClientIpImpl({
      forwardedFor: headerValue(req, "x-forwarded-for"),
      realIp: headerValue(req, "x-real-ip"),
      socketRemoteAddress: req?.socket?.remoteAddress,
      trustProxy,
      trustedProxyIps,
    });

    if (resolvedIp.ignoredForwarded && resolvedIp.forwardedIp) {
      logEventImpl("warn", "forwarded_ip_ignored", cleanLogFieldsImpl({
        request_id: requestContext?.requestId,
        endpoint: requestContext?.endpoint,
        remote_ip: resolvedIp.socketIp,
        forwarded_ip: resolvedIp.forwardedIp,
        reason: trustProxy ? "untrusted_proxy" : "trust_proxy_disabled",
      }));
    }

    return resolvedIp.ip;
  }

  const authService = createAuthServiceImpl({
    env,
    authConfig: serviceAuthConfig,
    strictPublicApiKey,
    serviceToken: serviceConfig.token,
    getClientIp,
    logEvent: logEventImpl,
  });

  const routeAuthPolicies = {
    "/enhance": { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
    "/extract-url": { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
    "/infer-builder-fields": { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
    [ENHANCE_WS_PATH]: { allowPublicKey: true, allowServiceToken: true, allowUserJwt: true },
  };

  const rateLimiter = createRateLimiterImpl({ backend: rateLimitBackend });
  const extractUrlCache = createExtractUrlCacheImpl({
    ttlMs: extractUrlCacheTtlMs,
    maxEntries: extractUrlCacheMaxEntries,
  });
  const wsConnectionSlots = createConnectionSlotTrackerImpl(enhanceWsMaxConnectionsPerIp);

  function trackAbortController(controller) {
    activeAbortControllers.add(controller);
    return controller;
  }

  function untrackAbortController(controller) {
    activeAbortControllers.delete(controller);
  }

  const defaultThreadOptions = (() => {
    const options = {};
    if (resolvedCodexModel) {
      options.model = resolvedCodexModel;
    }

    const sandboxMode = parseEnumEnv("CODEX_SANDBOX_MODE", SANDBOX_MODES, env);
    if (sandboxMode) options.sandboxMode = sandboxMode;

    const workingDirectory = normalizeEnvValue("CODEX_WORKING_DIRECTORY", env);
    if (workingDirectory) options.workingDirectory = workingDirectory;

    const skipGitRepoCheckRaw = normalizeEnvValue("CODEX_SKIP_GIT_REPO_CHECK", env);
    if (skipGitRepoCheckRaw) {
      options.skipGitRepoCheck = normalizeBool(skipGitRepoCheckRaw, false);
    }

    options.modelReasoningEffort =
      parseEnumEnv("CODEX_MODEL_REASONING_EFFORT", REASONING_EFFORTS, env) || "high";

    const networkAccessEnabledRaw = normalizeEnvValue("CODEX_NETWORK_ACCESS_ENABLED", env);
    if (networkAccessEnabledRaw) {
      options.networkAccessEnabled = normalizeBool(networkAccessEnabledRaw, false);
    }

    const webSearchMode = parseEnumEnv("CODEX_WEB_SEARCH_MODE", WEB_SEARCH_MODES, env);
    if (webSearchMode) options.webSearchMode = webSearchMode;

    const webSearchEnabledRaw = normalizeEnvValue("CODEX_WEB_SEARCH_ENABLED", env);
    if (webSearchEnabledRaw) {
      options.webSearchEnabled = normalizeBool(webSearchEnabledRaw, false);
    }

    const approvalPolicy = parseEnumEnv("CODEX_APPROVAL_POLICY", APPROVAL_POLICIES, env);
    if (approvalPolicy) options.approvalPolicy = approvalPolicy;

    const additionalDirectories = parseStringArrayEnv("CODEX_ADDITIONAL_DIRECTORIES", env);
    if (additionalDirectories) options.additionalDirectories = additionalDirectories;

    return options;
  })();

  const defaultCodexOptions = (() => {
    const options = {};

    if (!codexConfig) {
      const baseUrl = normalizeEnvValue("OPENAI_BASE_URL", env) || normalizeEnvValue("CODEX_BASE_URL", env);
      if (baseUrl) options.baseUrl = baseUrl;

      if (directApiKey) options.apiKey = directApiKey;
    }

    const codexPathOverride = normalizeEnvValue("CODEX_PATH_OVERRIDE", env);
    if (codexPathOverride) options.codexPathOverride = codexPathOverride;

    const config = { ...codexConfigOverrides };
    if (codexConfig?.provider) {
      config.model_provider = codexConfig.provider;
    }

    config.model_reasoning_summary =
      parseEnumEnv("CODEX_MODEL_REASONING_SUMMARY", REASONING_SUMMARIES, env) || "detailed";

    const maxOutputTokensRaw = normalizeEnvValue("CODEX_MAX_OUTPUT_TOKENS", env);
    if (maxOutputTokensRaw) {
      const parsed = Number.parseInt(maxOutputTokensRaw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("CODEX_MAX_OUTPUT_TOKENS must be a positive integer.");
      }
      config.max_output_tokens = parsed;
    }
    if (Object.keys(config).length > 0) options.config = config;

    const envConfig = parseJsonObjectEnv("CODEX_ENV_JSON", env);
    const normalizedEnv = normalizeStringRecord(envConfig);
    if (normalizedEnv) options.env = normalizedEnv;

    return options;
  })();

  let codexClient = null;

  function getCodexClient() {
    if (!codexClient) {
      codexClient = new CodexClass(defaultCodexOptions);
    }
    return codexClient;
  }

  function hasProviderApiKey() {
    if (codexConfig) return Boolean(resolvedApiKey);
    return Boolean(directApiKey);
  }

  function buildRuntimeSummary() {
    return {
      provider_source: codexConfigSource,
      provider_name: codexConfig?.name || "OpenAI",
      provider_base_url: openaiApiBaseUrl,
      github_context_enabled: githubConfig.enabled,
      model: defaultThreadOptions.model || null,
      extract_model: extractModel || null,
      infer_model: inferModel || null,
      sandbox_mode: defaultThreadOptions.sandboxMode || null,
      strict_public_api_key: strictPublicApiKey,
      trust_proxy: trustProxy,
      rate_limit_backend: rateLimitBackend,
      ...authService.getStartupSummary(),
    };
  }

  function buildReadinessReport({ isShuttingDown = false } = {}) {
    const issues = [];
    const warnings = [];
    const authReadiness = authService.getReadiness();

    if (isShuttingDown) {
      issues.push("service_shutting_down");
    }
    if (requireProviderConfig && !codexConfig) {
      issues.push("provider_config_missing");
    }
    if (!hasProviderApiKey()) {
      issues.push("provider_api_key_missing");
    }
    if (hasMissingAzureModel) {
      issues.push("provider_model_missing");
    }
    if (
      githubConfig.enabled
      && (
        !githubConfig.appId
        || !githubConfig.appPrivateKey
        || !githubConfig.appSlug
        || !githubConfig.databaseUrl
        || !githubConfig.postInstallRedirectUrl
        || !githubConfig.stateSecret
        || !githubConfig.webhookSecret
      )
    ) {
      warnings.push("github_config_incomplete");
    }
    warnings.push(...authReadiness.warnings);
    issues.push(...authReadiness.issues);

    return {
      ok: issues.length === 0,
      issues,
      warnings,
      provider: "codex-sdk",
      ...buildRuntimeSummary(),
    };
  }

  function buildHealthDetails() {
    return {
      provider_source: codexConfigSource,
      provider_name: codexConfig?.name || "OpenAI",
      provider_base_url: openaiApiBaseUrl,
      github_context_enabled: githubConfig.enabled,
      model: defaultThreadOptions.model || null,
      sandbox_mode: defaultThreadOptions.sandboxMode || null,
      strict_public_api_key: strictPublicApiKey,
      trust_proxy: trustProxy,
    };
  }

  function buildServiceStartLogFields() {
    return {
      host: serviceConfig.host,
      port: serviceConfig.port,
      provider: codexConfig?.provider || "openai",
      ...buildRuntimeSummary(),
      trusted_proxy_ip_count: trustedProxyIps.size,
    };
  }

  return {
    authService,
    activeAbortControllers,
    buildHealthDetails,
    buildReadinessReport,
    buildServiceStartLogFields,
    codexConfig,
    codexConfigOverrides,
    codexConfigSearchLabel,
    codexConfigSource,
    corsConfig,
    defaultCodexOptions,
    defaultThreadOptions,
    directApiKey,
    enhancePerDay,
    enhancePerMinute,
    enhanceWsHeartbeatMs,
    enhanceWsIdleTimeoutMs,
    enhanceWsInitialMessageTimeoutMs,
    enhanceWsMaxBufferedBytes,
    enhanceWsMaxConnectionsPerIp,
    enhanceWsMaxLifetimeMs,
    enhanceWsMaxPayloadBytes,
    extractFetchMaxRedirects,
    extractModel,
    extractPerDay,
    extractPerMinute,
    extractUrlCache,
    fetchTimeoutMs,
    getClientIp,
    getCodexClient,
    githubConfig,
    githubPerDay,
    githubPerMinute,
    githubUserAuthPolicy,
    hasMissingAzureModel,
    hasProviderApiKey,
    inferModel,
    inferPerDay,
    inferPerMinute,
    isAzureProvider: isAzureProviderConfig,
    maxHttpBodyBytes,
    maxInferencePromptChars,
    maxPromptChars,
    maxResponseBytes,
    maxSessionContextSummaryChars,
    maxSessionLatestPromptChars,
    maxUrlChars,
    openaiApiBaseUrl,
    rateLimitBackend,
    rateLimiter,
    requireProviderConfig,
    resolvedApiKey,
    resolvedCodexModel,
    retryTelemetry,
    routeAuthPolicies,
    sanitizeCodexExecErrorMessage,
    serviceAuthConfig,
    serviceConfig,
    shutdownDrainTimeoutMs,
    strictPublicApiKey,
    toErrorMessage,
    trackAbortController,
    trustProxy,
    trustedProxyIps,
    untrackAbortController,
    wsConnectionSlots,
  };
}
