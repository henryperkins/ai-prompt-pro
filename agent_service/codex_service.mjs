import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";
import { Codex } from "@openai/codex-sdk";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { extractThreadOptions } from "./thread-options.mjs";

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

const OPENAI_API_BASE_URL = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
const EXTRACT_MODEL = process.env.EXTRACT_MODEL?.trim() || "gpt-4.1-mini";

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
const PROMPT_ENHANCER_INSTRUCTIONS = [
  "You are an expert prompt engineer. Rewrite the user's draft prompt so it is clearer, more specific, and easier for GPT-5 class models to execute.",
  "",
  "<core_behavior>",
  "- Preserve the user's intent, requirements, and constraints.",
  "- Improve clarity, specificity, structure, and completeness without changing scope.",
  "- Remove redundancy, resolve contradictions, and keep essential details.",
  "- Do not add features, requirements, or assumptions unless needed for coherence.",
  "</core_behavior>",
  "",
  "<output_contract>",
  "- Return the enhanced prompt as plain text, ready to use.",
  "- Do not wrap the result in markdown code fences.",
  "- Keep the format concise and easy to scan.",
  "- Use explicit sections or bullets only when they improve clarity.",
  "</output_contract>",
  "",
  "<ambiguity_handling>",
  "- If key details are missing, include an \"Assumptions\" section with up to 3 concise assumptions.",
  "- Never fabricate facts, references, IDs, or exact figures.",
  "</ambiguity_handling>",
  "",
  "<web_search_citations>",
  "- Only if web search was used, append a sources block AFTER the enhanced prompt.",
  "- Format: a blank line, then '---', then 'Sources:', then each source as '- [Title](URL)' on its own line.",
  "- Do NOT embed URLs or citations inside the enhanced prompt body.",
  "</web_search_citations>",
  "",
  "<structure_preferences>",
  "- When appropriate, organize with labels such as: Role, Task, Context, Format, Constraints.",
  "- If a rigid template hurts clarity, keep the structure natural and concise.",
  "</structure_preferences>",
].join("\n");

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

const AUTH_CONFIG = (() => {
  const neonAuthUrlRaw = normalizeEnvValue("NEON_AUTH_URL");
  const neonAuthUrl = neonAuthUrlRaw ? neonAuthUrlRaw.replace(/\/+$/, "") : undefined;
  const neonJwksUrl = normalizeEnvValue("NEON_JWKS_URL")
    || (neonAuthUrl ? `${neonAuthUrl}/.well-known/jwks.json` : undefined);

  const configuredKeys = new Set(
    [
      normalizeEnvValue("FUNCTION_PUBLIC_API_KEY"),
      normalizeEnvValue("NEON_PUBLISHABLE_KEY"),
      normalizeEnvValue("VITE_NEON_PUBLISHABLE_KEY"),
    ].filter((value) => typeof value === "string" && value.length > 0),
  );

  return {
    neonAuthUrl,
    neonJwksUrl,
    configuredKeys,
  };
})();

const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "application/xml",
  "text/xml",
];

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

const rateLimitStores = new Map();

let neonJwksResolver = null;

function headerValue(req, headerName) {
  const rawValue = req.headers[headerName.toLowerCase()];
  if (typeof rawValue === "string") return rawValue;
  if (Array.isArray(rawValue)) return rawValue[0];
  return undefined;
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

function getClientIp(req) {
  const forwardedFor = headerValue(req, "x-forwarded-for");
  if (forwardedFor) {
    const [firstHop] = forwardedFor.split(",");
    if (firstHop?.trim()) return firstHop.trim();
  }

  const realIp = headerValue(req, "x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return "unknown";
}

function parseBearerToken(req) {
  const authHeader = headerValue(req, "authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function isPublishableKeyLike(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("sb_publishable_")) return true;
  if (trimmed.startsWith("pk_live_") || trimmed.startsWith("pk_test_")) return true;
  return false;
}

function isConfiguredPublicApiKey(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (AUTH_CONFIG.configuredKeys.has(trimmed)) return true;
  return AUTH_CONFIG.configuredKeys.size === 0 && isPublishableKeyLike(trimmed);
}

function looksLikeJwt(value) {
  return typeof value === "string" && value.split(".").length === 3;
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

async function requireAuthenticatedUser(req) {
  const bearerToken = parseBearerToken(req);
  const apiKey = (headerValue(req, "apikey") || "").trim();
  const clientIp = getClientIp(req);

  if (!bearerToken) {
    if (isConfiguredPublicApiKey(apiKey)) {
      return {
        ok: true,
        userId: null,
        isPublicKey: true,
        rateKey: `public:${clientIp}`,
      };
    }
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
    return {
      ok: false,
      status: 401,
      error: "Invalid or expired auth session.",
    };
  }

  const verified = await verifyNeonJwt(bearerToken);
  if (verified.ok) {
    return {
      ok: true,
      userId: verified.userId,
      isPublicKey: false,
      rateKey: verified.userId,
    };
  }

  if (verified.reason === "config") {
    return {
      ok: false,
      status: 503,
      error: "Authentication service is unavailable because Neon auth is not configured.",
    };
  }

  if (verified.reason === "unavailable") {
    return {
      ok: false,
      status: 503,
      error: "Authentication service is temporarily unavailable. Please try again.",
    };
  }

  return {
    ok: false,
    status: 401,
    error: "Invalid or expired auth session.",
  };
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
  options.model = normalizeEnvValue("CODEX_MODEL") || "gpt-5.2";

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

  const baseUrl = normalizeEnvValue("OPENAI_BASE_URL") || normalizeEnvValue("CODEX_BASE_URL");
  if (baseUrl) options.baseUrl = baseUrl;

  const apiKey = normalizeEnvValue("CODEX_API_KEY") || normalizeEnvValue("OPENAI_API_KEY");
  if (apiKey) options.apiKey = apiKey;

  const codexPathOverride = normalizeEnvValue("CODEX_PATH_OVERRIDE");
  if (codexPathOverride) options.codexPathOverride = codexPathOverride;

  const config = parseJsonObjectEnv("CODEX_CONFIG_JSON") || {};

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

function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8").trim();
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body.", { cause: error }));
      }
    });
  });
}

function asNonEmptyString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

// ---------------------------------------------------------------------------
// Prompt structure inspection (ported from Python inspect_prompt_structure)
// ---------------------------------------------------------------------------
const CORE_SECTIONS = ["Role", "Task", "Context", "Format", "Constraints"];

function inspectPromptStructure(prompt) {
  const normalized = prompt.toLowerCase();
  function hasSection(name) {
    const token = name.toLowerCase();
    return [
      `${token}:`,
      `${token} -`,
      `## ${token}`,
      `### ${token}`,
      `[${token}]`,
    ].some((pattern) => normalized.includes(pattern));
  }
  const present = CORE_SECTIONS.filter(hasSection);
  const missing = CORE_SECTIONS.filter((s) => !present.includes(s));
  return { present_sections: present, missing_sections: missing, char_count: prompt.length };
}

function buildEnhancerInput(prompt) {
  const analysis = inspectPromptStructure(prompt);
  let structureHint = "";
  if (analysis.missing_sections.length > 0) {
    structureHint =
      `\n\n<prompt_structure_analysis>\n` +
      `Present sections: ${analysis.present_sections.join(", ") || "none"}\n` +
      `Missing sections: ${analysis.missing_sections.join(", ")}\n` +
      `Character count: ${analysis.char_count}\n` +
      `</prompt_structure_analysis>`;
  }
  return `${PROMPT_ENHANCER_INSTRUCTIONS}${structureHint}\n\n<source_prompt>\n${prompt}\n</source_prompt>`;
}

function textFromItem(item) {
  if (!item || typeof item !== "object") return "";
  if (typeof item.text === "string") return item.text;
  return "";
}

function idFromItem(item) {
  if (!item || typeof item !== "object") return undefined;
  return typeof item.id === "string" ? item.id : undefined;
}

function typeFromItem(item) {
  if (!item || typeof item !== "object") return undefined;
  return typeof item.type === "string" ? item.type : undefined;
}

function isStreamedTextItemType(itemType) {
  return itemType === "agent_message" || itemType === "reasoning";
}

function toItemDeltaEventType(itemType) {
  if (itemType === "reasoning") {
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
  if (itemType === "reasoning") {
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
  if (error instanceof Error && typeof error.message === "string") return error.message;
  return String(error);
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

function isPrivateHost(hostname) {
  if (
    hostname === "metadata.google.internal"
    || hostname === "metadata.google"
    || hostname.endsWith(".internal")
  ) {
    return true;
  }

  const bare = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (
    bare === "::1"
    || bare === "::"
    || bare.startsWith("fe80:")
    || bare.startsWith("fc00:")
    || bare.startsWith("fd")
  ) {
    return true;
  }

  const ipv4Match = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    return false;
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }

  return false;
}

function hasAllowedContentType(resp) {
  const ct = resp.headers.get("content-type") || "";
  const mime = ct.split(";")[0].trim().toLowerCase();
  return ALLOWED_CONTENT_TYPES.some((allowed) => mime === allowed);
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

function extractTitle(html, url) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 120);
  }
  try {
    return new URL(url).hostname;
  } catch {
    return "Extracted content";
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
  const apiKey = normalizeEnvValue("OPENAI_API_KEY") || normalizeEnvValue("CODEX_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetchWithTimeout(`${OPENAI_API_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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

async function runStreamedWithRetry(thread, input, turnOptions) {
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
        console.log(`Codex 429 detected; retrying (attempt ${attempt + 1}/${CODEX_429_MAX_RETRIES}) after ${(delay / 1000).toFixed(2)}s`);
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
      console.log(`Codex 429 thrown; retrying (attempt ${attempt + 1}/${CODEX_429_MAX_RETRIES}) after ${(delay / 1000).toFixed(2)}s`);
      await sleep(delay);
      attempt++;
    }
  }
}

async function streamWithCodex(req, res, body, corsHeaders) {
  const prompt = asNonEmptyString(body.prompt);
  if (!prompt) {
    json(res, 400, { detail: "Prompt is required." }, corsHeaders);
    return;
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    json(
      res,
      413,
      { detail: `Prompt is too large. Maximum ${MAX_PROMPT_CHARS} characters.` },
      corsHeaders,
    );
    return;
  }

  const hasThreadIdField = Object.prototype.hasOwnProperty.call(body, "thread_id")
    || Object.prototype.hasOwnProperty.call(body, "threadId");
  const requestedThreadId = asNonEmptyString(body.thread_id) || asNonEmptyString(body.threadId);
  if (hasThreadIdField && !requestedThreadId) {
    json(res, 400, { detail: "thread_id must be a non-empty string when provided." }, corsHeaders);
    return;
  }
  const requestThreadOptions = extractThreadOptions(body.thread_options || body.threadOptions);
  const threadOptions = { ...DEFAULT_THREAD_OPTIONS, ...requestThreadOptions };

  const turnId = `turn_${randomUUID().replaceAll("-", "")}`;
  const stateByItemId = new Map();
  const controller = new AbortController();
  req.on("aborted", () => controller.abort("Client disconnected"));
  res.on("close", () => {
    if (!res.writableEnded) {
      controller.abort("Client disconnected");
    }
  });

  beginSse(res, corsHeaders);

  try {
    const codex = getCodexClient();
    const thread = requestedThreadId
      ? codex.resumeThread(requestedThreadId, threadOptions)
      : codex.startThread(threadOptions);
    const { events } = await runStreamedWithRetry(thread, buildEnhancerInput(prompt), {
      signal: controller.signal,
    });

    let activeThreadId = requestedThreadId || null;

    for await (const event of events) {
      if (controller.signal.aborted || res.writableEnded) break;

      if (event.type === "thread.started") {
        activeThreadId = event.thread_id;
        writeSse(res, {
          event: "thread.started",
          type: "thread.started",
          thread_id: activeThreadId,
        });
        continue;
      }

      if (event.type === "turn.started") {
        writeSse(res, {
          event: "turn.started",
          type: "response.created",
          turn_id: turnId,
          thread_id: activeThreadId,
          kind: "enhance",
        });
        continue;
      }

      if (event.type === "turn.completed") {
        writeSse(res, {
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
        writeSse(res, {
          event: "turn.failed",
          type: "turn.failed",
          turn_id: turnId,
          thread_id: activeThreadId,
          error: event.error,
        });
        continue;
      }

      if (event.type === "error") {
        writeSse(res, {
          event: "thread.error",
          type: "error",
          turn_id: turnId,
          thread_id: activeThreadId,
          error: event.message,
        });
        continue;
      }

      if (event.type === "item.started") {
        const itemId = idFromItem(event.item);
        const itemType = typeFromItem(event.item);
        writeSse(res, {
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

        if (isStreamedTextItemType(itemType)) {
          const previousText = itemId ? stateByItemId.get(itemId) || "" : "";
          const currentText = textFromItem(event.item);
          let delta = "";

          if (currentText && currentText.startsWith(previousText)) {
            delta = currentText.slice(previousText.length);
          } else if (currentText && currentText !== previousText) {
            delta = currentText;
          }

          if (itemId) {
            stateByItemId.set(itemId, currentText);
          }

          if (delta) {
            const eventShape = toItemDeltaEventType(itemType);
            writeSse(res, {
              event: eventShape.event,
              type: eventShape.type,
              turn_id: turnId,
              thread_id: activeThreadId,
              item_id: itemId,
              item_type: itemType,
              delta,
              ...(itemType === "agent_message" ? { choices: [{ delta: { content: delta } }] } : {}),
              item: event.item,
            });
          }
          continue;
        }

        writeSse(res, {
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

        if (isStreamedTextItemType(itemType)) {
          const text = textFromItem(event.item);
          if (itemId) {
            stateByItemId.set(itemId, text);
          }
          const eventShape = toItemDoneEventType(itemType);
          writeSse(res, {
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

        writeSse(res, {
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

    endSse(res);
  } catch (error) {
    writeSse(res, {
      event: "turn/error",
      type: "turn/error",
      turn_id: turnId,
      error: toErrorMessage(error),
    });
    endSse(res);
  }
}

function enforceRateLimit(res, corsHeaders, options, failureMessage) {
  const result = applyRateLimit(options);
  if (result.ok) return true;
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

async function authenticateRequest(req, res, corsHeaders) {
  const providedServiceToken = (headerValue(req, "x-agent-token") || "").trim();
  if (providedServiceToken) {
    if (!SERVICE_CONFIG.token || providedServiceToken !== SERVICE_CONFIG.token) {
      json(res, 401, { error: "Invalid or missing service token." }, corsHeaders);
      return null;
    }
    return {
      ok: true,
      userId: "service",
      isPublicKey: false,
      rateKey: `service:${getClientIp(req)}`,
    };
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error }, corsHeaders);
    return null;
  }
  return auth;
}

async function handleEnhance(req, res, body, corsHeaders) {
  const auth = await authenticateRequest(req, res, corsHeaders);
  if (!auth) return;

  const clientIp = getClientIp(req);
  if (!enforceRateLimit(res, corsHeaders, {
    scope: "enhance-minute",
    key: `${auth.rateKey}:${clientIp}`,
    limit: ENHANCE_PER_MINUTE,
    windowMs: 60_000,
  }, "Rate limit exceeded. Please try again later.")) {
    return;
  }

  if (!enforceRateLimit(res, corsHeaders, {
    scope: "enhance-day",
    key: auth.rateKey,
    limit: ENHANCE_PER_DAY,
    windowMs: 86_400_000,
  }, "Daily quota exceeded. Please try again tomorrow.")) {
    return;
  }

  await streamWithCodex(req, res, body, corsHeaders);
}

async function handleExtractUrl(req, res, body, corsHeaders) {
  const auth = await authenticateRequest(req, res, corsHeaders);
  if (!auth) return;

  const clientIp = getClientIp(req);
  if (!enforceRateLimit(res, corsHeaders, {
    scope: "extract-minute",
    key: `${auth.rateKey}:${clientIp}`,
    limit: EXTRACT_PER_MINUTE,
    windowMs: 60_000,
  }, "Rate limit exceeded. Please try again later.")) {
    return;
  }

  if (!enforceRateLimit(res, corsHeaders, {
    scope: "extract-day",
    key: auth.rateKey,
    limit: EXTRACT_PER_DAY,
    windowMs: 86_400_000,
  }, "Daily quota exceeded. Please try again tomorrow.")) {
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

  let pageResponse;
  try {
    pageResponse = await fetchWithTimeout(parsedUrl.href, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PromptForge/1.0; +https://promptforge.app)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    }, FETCH_TIMEOUT_MS);
  } catch (error) {
    if (isTimeoutError(error)) {
      json(res, 504, { error: "Timed out while fetching the URL." }, corsHeaders);
      return;
    }
    throw error;
  }

  if (!pageResponse.ok) {
    json(
      res,
      422,
      { error: `Could not fetch URL (status ${pageResponse.status})` },
      corsHeaders,
    );
    return;
  }

  if (!hasAllowedContentType(pageResponse)) {
    json(res, 422, { error: "URL did not return an HTML or text content type." }, corsHeaders);
    return;
  }

  let html;
  try {
    html = await readBodyWithLimit(pageResponse, MAX_RESPONSE_BYTES);
  } catch {
    json(res, 413, { error: "Response body is too large to process." }, corsHeaders);
    return;
  }

  const title = extractTitle(html, parsedUrl.href);
  let plainText = stripHtml(html);
  if (plainText.length > 8000) {
    plainText = `${plainText.slice(0, 8000)}…`;
  }
  if (plainText.length < 50) {
    json(res, 422, { error: "Page had too little readable text content." }, corsHeaders);
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
      json(res, 429, { error: "Rate limit exceeded. Please try again in a moment." }, corsHeaders);
      return;
    }
    if (summaryResult.status === 402) {
      json(res, 402, { error: "AI credits depleted. Please add funds to continue." }, corsHeaders);
      return;
    }
    console.error("OpenAI extraction error:", summaryResult.status, errText);
    json(res, 500, { error: "Failed to extract content from the page." }, corsHeaders);
    return;
  }

  json(res, 200, { title, content: summaryResult.content }, corsHeaders);
}

async function handleInferBuilderFields(req, res, body, corsHeaders) {
  const auth = await authenticateRequest(req, res, corsHeaders);
  if (!auth) return;

  const clientIp = getClientIp(req);
  if (!enforceRateLimit(res, corsHeaders, {
    scope: "infer-minute",
    key: `${auth.rateKey}:${clientIp}`,
    limit: INFER_PER_MINUTE,
    windowMs: 60_000,
  }, "Rate limit exceeded. Please try again later.")) {
    return;
  }

  if (!enforceRateLimit(res, corsHeaders, {
    scope: "infer-day",
    key: auth.rateKey,
    limit: INFER_PER_DAY,
    windowMs: 86_400_000,
  }, "Daily quota exceeded. Please try again tomorrow.")) {
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
      model: DEFAULT_THREAD_OPTIONS.model || null,
      sandbox_mode: DEFAULT_THREAD_OPTIONS.sandboxMode || null,
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
        json(res, cors.status, { error: cors.error }, cors.headers);
        return;
      }
      res.writeHead(200, cors.headers);
      res.end("ok");
      return;
    }

    if (!cors.ok) {
      json(res, cors.status, { error: cors.error }, cors.headers);
      return;
    }

    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed." }, cors.headers);
      return;
    }

    let body;
    try {
      body = await readBodyJson(req);
    } catch (error) {
      json(res, 400, { error: toErrorMessage(error) }, cors.headers);
      return;
    }

    try {
      if (url.pathname === "/enhance") {
        await handleEnhance(req, res, body, cors.headers);
        return;
      }
      if (url.pathname === "/extract-url") {
        await handleExtractUrl(req, res, body, cors.headers);
        return;
      }
      if (url.pathname === "/infer-builder-fields") {
        await handleInferBuilderFields(req, res, body, cors.headers);
        return;
      }
    } catch (error) {
      console.error(`${url.pathname} error:`, error);
      json(
        res,
        500,
        { error: error instanceof Error ? error.message : "Unknown error" },
        cors.headers,
      );
      return;
    }
  }

  json(res, 404, { detail: "Not found." });
}

const server = createServer((req, res) => {
  void requestHandler(req, res);
});

server.listen(SERVICE_CONFIG.port, SERVICE_CONFIG.host, () => {
  console.log(
    `Codex SDK service listening on http://${SERVICE_CONFIG.host}:${SERVICE_CONFIG.port}`,
  );
});
