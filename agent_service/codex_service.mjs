import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";
import { Codex } from "@openai/codex-sdk";

const MAX_PROMPT_CHARS = Number.parseInt(process.env.MAX_PROMPT_CHARS || "16000", 10);
if (!Number.isFinite(MAX_PROMPT_CHARS) || MAX_PROMPT_CHARS <= 0) {
  throw new Error("MAX_PROMPT_CHARS must be a positive integer.");
}

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

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function beginSse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
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

function extractThreadOptions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input;
  const options = {};

  if (
    typeof source.modelReasoningEffort === "string" &&
    REASONING_EFFORTS.has(source.modelReasoningEffort)
  ) {
    options.modelReasoningEffort = source.modelReasoningEffort;
  }

  if (typeof source.webSearchEnabled === "boolean") {
    options.webSearchEnabled = source.webSearchEnabled;
  }

  return options;
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

function toErrorMessage(error) {
  if (error instanceof Error && typeof error.message === "string") return error.message;
  return String(error);
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

async function streamWithCodex(req, res, body) {
  const prompt = asNonEmptyString(body.prompt);
  if (!prompt) {
    json(res, 400, { detail: "Prompt is required." });
    return;
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    json(res, 413, { detail: `Prompt is too large. Maximum ${MAX_PROMPT_CHARS} characters.` });
    return;
  }

  const requestedThreadId = asNonEmptyString(body.thread_id) || asNonEmptyString(body.threadId);
  const requestThreadOptions = extractThreadOptions(body.thread_options);
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

  beginSse(res);

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

        if (itemType === "agent_message" && itemId) {
          const previousText = stateByItemId.get(itemId) || "";
          const currentText = textFromItem(event.item);
          let delta = "";

          if (currentText && currentText.startsWith(previousText)) {
            delta = currentText.slice(previousText.length);
          } else if (currentText && currentText !== previousText) {
            delta = currentText;
          }

          stateByItemId.set(itemId, currentText);

          if (delta) {
            writeSse(res, {
              event: "item/agent_message/delta",
              type: "response.output_text.delta",
              turn_id: turnId,
              thread_id: activeThreadId,
              item_id: itemId,
              item_type: "agent_message",
              delta,
              choices: [{ delta: { content: delta } }],
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

        if (itemType === "agent_message") {
          const text = textFromItem(event.item);
          if (itemId) {
            stateByItemId.set(itemId, text);
          }
          writeSse(res, {
            event: "item/completed",
            type: "response.output_text.done",
            turn_id: turnId,
            thread_id: activeThreadId,
            item_id: itemId,
            item_type: "agent_message",
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

  if (req.method === "POST" && url.pathname === "/enhance") {
    if (SERVICE_CONFIG.token && req.headers["x-agent-token"] !== SERVICE_CONFIG.token) {
      json(res, 401, { detail: "Invalid or missing service token." });
      return;
    }

    let body;
    try {
      body = await readBodyJson(req);
    } catch (error) {
      json(res, 400, { detail: toErrorMessage(error) });
      return;
    }

    await streamWithCodex(req, res, body);
    return;
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
