import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";
import { WebSocketServer } from "ws";

// ── Shared utilities ────────────────────────────────────────────────────────
import {
  asNonEmptyString,
  hasText,
  truncateString,
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
  redirect,
  beginSse,
  writeSse,
  endSse,
  headerValue,
  resolveCors,
} from "./http-helpers.mjs";

// ── Domain modules ──────────────────────────────────────────────────────────
import {
  buildBuilderFieldInferenceResult,
  buildInferUserMessage,
  createEmptyBuilderFieldInferenceResult,
  INFER_BUILDER_FIELDS_SCHEMA,
  INFER_SYSTEM_PROMPT,
} from "./builder-field-inference.mjs";
import { buildEnhanceSuccessfulTerminalEvents } from "./enhance-stream-contract.mjs";
import {
  buildEnhancementMetaPrompt,
  detectEnhancementContext,
  ENHANCEMENT_OUTPUT_SCHEMA,
  parseEnhancementRequestAmbiguityMode,
  parseEnhancementRequestBuilderFields,
  parseEnhancementRequestIntentOverride,
  parseEnhancementRequestMode,
  parseEnhancementRequestRewriteStrictness,
  parseEnhancementJsonResponse,
  pickPrimaryAgentMessageText,
  postProcessEnhancementResponse,
  validateEnhancementOutputContract,
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
  isPrivateHost,
  isUrlNotAllowedError,
} from "./network-security.mjs";
import { runGuardedAsync } from "./async-guard.mjs";
import {
  isPayloadTooLargeError,
  readBodyJsonWithLimit,
  readBodyTextWithLimit,
} from "./http-body.mjs";
import { extractItemText } from "./stream-text.mjs";
import {
  classifyStreamFailure,
  resolveRequestCompletionStatus,
  statusFromErrorCode,
} from "./stream-errors.mjs";
import { resolveActiveCodexThreadId } from "./codex-thread-state.mjs";
import {
  isAbortLikeError,
  throwIfAborted,
} from "./request-abort-utils.mjs";

// ── Extracted domain modules ────────────────────────────────────────────────
import {
  fetchPageWithHeaderFallback,
  readBodyWithLimit,
  responseMimeType,
  isTextLikeContentType,
  looksLikeBinaryPayload,
  extractTitle,
  normalizeExtractableText,
  clampExtractText,
  parseInputUrl,
  sanitizeUrlForLogs,
  isTimeoutError,
  summarizeExtractedText,
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
  createWebSocketHeartbeatState,
  writeWebSocketError,
  classifyWebSocketAuthErrorCode,
  classifyHttpAuthErrorCode,
  rejectWebSocketUpgrade,
} from "./ws-helpers.mjs";
import {
  normalizeInferCurrentFields,
  normalizeInferLockMetadata,
  normalizeInferRequestContext,
  normalizeInferSourceSummaries,
  buildInferInputBudget,
  buildInferInputBudgetDetail,
} from "./infer-request.mjs";
import { createGitHubAppClient } from "./github-app.mjs";
import { isGitHubError } from "./github-errors.mjs";
import { createGitHubManifestService } from "./github-manifest.mjs";
import {
  createGitHubRouteRegistry,
  matchGitHubRoute,
  listGitHubRoutesForPath,
  collectGitHubRouteMethods,
} from "./github-routes.mjs";
import { createGitHubSourceContextService } from "./github-source-context.mjs";
import { createGitHubStore } from "./github-store.mjs";
import { createServiceRuntime } from "./service-runtime.mjs";

const runtime = await createServiceRuntime({ env: process.env });
const githubApp = createGitHubAppClient(runtime.githubConfig);
const githubStore = createGitHubStore({
  databaseUrl: runtime.githubConfig.databaseUrl,
});
const githubManifestService = createGitHubManifestService({
  app: githubApp,
  store: githubStore,
});
const githubSourceContextService = createGitHubSourceContextService({
  app: githubApp,
  manifestService: githubManifestService,
});
const githubRoutes = createGitHubRouteRegistry({
  runtime,
  app: githubApp,
  store: githubStore,
  manifestService: githubManifestService,
  sourceContextService: githubSourceContextService,
});

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
      runtime.maxSessionContextSummaryChars,
    ),
    latestEnhancedPrompt: truncateString(
      asNonEmptyString(source.latest_enhanced_prompt) || asNonEmptyString(source.latestEnhancedPrompt) || "",
      runtime.maxSessionLatestPromptChars,
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
  const payload = {
    thread_id: threadId || null,
    turn_id: turnId || null,
    status,
    transport,
    resumed,
  };

  const normalizedContextSummary = asNonEmptyString(contextSummary);
  const normalizedLatestEnhancedPrompt = asNonEmptyString(latestEnhancedPrompt);

  if (normalizedContextSummary) {
    payload.context_summary = normalizedContextSummary;
  }
  if (normalizedLatestEnhancedPrompt) {
    payload.latest_enhanced_prompt = normalizedLatestEnhancedPrompt;
  }

  return payload;
}

function toErrorMessage(error) {
  return runtime.toErrorMessage(error);
}

function createServiceError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function createPayloadTooLargeError(message) {
  return createServiceError(message, "payload_too_large", 413);
}

function createBadResponseError(message) {
  return createServiceError(message, "bad_response", 422);
}

function countObjectStringChars(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }

  return Object.values(value).reduce((sum, entry) => {
    return sum + (typeof entry === "string" ? entry.length : 0);
  }, 0);
}

function buildEnhancementInputBudget({
  prompt,
  enhancementContext,
  baseEnhancementInput,
  enhancementInput,
  sourceSummaryChars = 0,
  expandedSourceChars = 0,
}) {
  return {
    rawPromptChars: typeof prompt === "string" ? prompt.length : 0,
    builderFieldChars: countObjectStringChars(enhancementContext?.builderFields),
    sessionContextChars:
      typeof enhancementContext?.session?.contextSummary === "string"
        ? enhancementContext.session.contextSummary.length
        : 0,
    carryForwardPromptChars:
      typeof enhancementContext?.session?.latestEnhancedPrompt === "string"
        ? enhancementContext.session.latestEnhancedPrompt.length
        : 0,
    baseEnhancementInputChars:
      typeof baseEnhancementInput === "string" ? baseEnhancementInput.length : 0,
    sourceSummaryChars,
    expandedSourceChars,
    composedEnhancementInputChars:
      typeof enhancementInput === "string" ? enhancementInput.length : 0,
  };
}

function buildEnhancementInputBudgetDetail(stage, budget) {
  const detailParts = [
    `raw prompt ${budget.rawPromptChars}`,
    `builder fields ${budget.builderFieldChars}`,
    `session summary ${budget.sessionContextChars}`,
    `carry-forward prompt ${budget.carryForwardPromptChars}`,
    `base meta prompt ${budget.baseEnhancementInputChars}`,
  ];

  if (budget.sourceSummaryChars > 0) {
    detailParts.push(`source summaries ${budget.sourceSummaryChars}`);
  }
  if (budget.expandedSourceChars > 0) {
    detailParts.push(`expanded source context ${budget.expandedSourceChars}`);
  }

  return [
    `Enhancement input is too large after ${stage}.`,
    `Maximum ${runtime.maxPromptChars} characters; composed prompt is ${budget.composedEnhancementInputChars} characters.`,
    `Breakdown: ${detailParts.join(", ")}.`,
  ].join(" ");
}

function assertEnhancementInputWithinLimit({
  stage,
  prompt,
  enhancementContext,
  baseEnhancementInput,
  enhancementInput,
  sourceSummaryChars = 0,
  expandedSourceChars = 0,
}) {
  const budget = buildEnhancementInputBudget({
    prompt,
    enhancementContext,
    baseEnhancementInput,
    enhancementInput,
    sourceSummaryChars,
    expandedSourceChars,
  });

  if (budget.composedEnhancementInputChars <= runtime.maxPromptChars) {
    return budget;
  }

  throw createPayloadTooLargeError(
    buildEnhancementInputBudgetDetail(stage, budget),
  );
}

async function inferBuilderFieldUpdates({
  prompt,
  currentFields,
  lockMetadata,
  inferRequestContext = {},
  sourceSummaries = [],
  requestContext,
}) {
  if (!runtime.inferModel) {
    return createEmptyBuilderFieldInferenceResult();
  }

  if (!runtime.hasProviderApiKey()) {
    return createEmptyBuilderFieldInferenceResult();
  }

  try {
    const codex = runtime.getCodexClient();
    const normalizedInferRequestContext = sourceSummaries.length > 0
      ? {
        ...inferRequestContext,
        sourceSummaries,
      }
      : inferRequestContext;
    const inferInput = [
      INFER_SYSTEM_PROMPT,
      buildInferUserMessage(
        prompt,
        currentFields,
        lockMetadata,
        normalizedInferRequestContext,
      ),
    ].join("\n\n");
    const inferBudget = buildInferInputBudget({
      prompt,
      currentFields,
      lockMetadata,
      inferRequestContext,
      sourceSummaries,
      inferInput,
    });
    if (inferBudget.composedInferInputChars > runtime.maxInferencePromptChars) {
      throw createPayloadTooLargeError(
        buildInferInputBudgetDetail(runtime.maxInferencePromptChars, inferBudget),
      );
    }
    const inferThreadOptions = {
      ...runtime.defaultThreadOptions,
      model: runtime.inferModel,
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
    if (error?.code === "payload_too_large" || error?.status === 413) {
      throw error;
    }
    const failure = classifyStreamFailure(error, {
      defaultCode: "service_unavailable",
      defaultStatus: 503,
    });
    logEvent("warn", "infer_model_exception", cleanLogFields({
      request_id: requestContext?.requestId,
      endpoint: requestContext?.endpoint,
      error_code: failure.code,
      error_message: failure.message,
      prompt_chars: typeof prompt === "string" ? prompt.length : undefined,
      source_summary_count: sourceSummaries.length > 0 ? sourceSummaries.length : undefined,
    }));
    throw createServiceError(failure.message, failure.code, failure.status);
  }
}

/**
 * Summarize extracted text using the shared url-extract module with
 * config resolved at the service level.
 */
async function callSummarizeExtractedText(plainText) {
  if (!runtime.extractModel) {
    throw new Error(
      "No extract model configured for Azure provider. Set EXTRACT_MODEL, CODEX_MODEL, or AZURE_OPENAI_DEPLOYMENT.",
    );
  }

  const apiKey = runtime.codexConfig
    ? runtime.resolvedApiKey
    : runtime.directApiKey;
  if (!apiKey) {
    if (runtime.codexConfig?.envKey) {
      throw new Error(
        `No API key configured for provider '${runtime.codexConfig.provider}'. Set ${runtime.codexConfig.envKey}.`,
      );
    }
    throw new Error("No API key configured. Set AZURE_OPENAI_API_KEY (via provider config) or OPENAI_API_KEY.");
  }

  return summarizeExtractedText(plainText, {
    apiBaseUrl: runtime.openaiApiBaseUrl,
    apiKey,
    model: runtime.extractModel,
    isAzure: runtime.isAzureProvider,
    timeoutMs: runtime.fetchTimeoutMs,
  });
}

// Retry telemetry config used by both streamed and buffered calls.
const RETRY_TELEMETRY = runtime.retryTelemetry;

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
  const sourceSummaryChars = Math.max(
    0,
    enhancementInputWithSourceSummaries.length - baseEnhancementInput.length,
  );

  if (sourceSummaryChars > 0) {
    assertEnhancementInputWithinLimit({
      stage: "attaching source summaries",
      prompt,
      enhancementContext,
      baseEnhancementInput,
      enhancementInput: enhancementInputWithSourceSummaries,
      sourceSummaryChars,
    });
  }

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
    const expandedSourceChars = Math.max(
      0,
      enhancementInput.length - enhancementInputWithSourceSummaries.length,
    );

    if (expandedSourceChars > 0) {
      assertEnhancementInputWithinLimit({
        stage: "expanding attached source context",
        prompt,
        enhancementContext,
        baseEnhancementInput,
        enhancementInput,
        sourceSummaryChars,
        expandedSourceChars,
      });
    }

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
    if (error?.code === "payload_too_large" || error?.status === 413) {
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
  if (prompt.length > runtime.maxPromptChars) {
    return {
      ok: false,
      status: 413,
      detail: `Prompt is too large. Maximum ${runtime.maxPromptChars} characters.`,
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
    runtime.defaultThreadOptions,
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
    hasAttachedContextSources: normalizedContextSources.value.length > 0,
    session: requestSession,
    webSearchEnabled: threadOptions.webSearchEnabled === true,
  });
  const baseEnhancementInput = buildEnhancementMetaPrompt(prompt, enhancementContext);
  const baseBudget = buildEnhancementInputBudget({
    prompt,
    enhancementContext,
    baseEnhancementInput,
    enhancementInput: baseEnhancementInput,
  });

  if (baseBudget.composedEnhancementInputChars > runtime.maxPromptChars) {
    return {
      ok: false,
      status: 413,
      detail: buildEnhancementInputBudgetDetail(
        "composing the base enhancement prompt",
        baseBudget,
      ),
    };
  }

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
  let sawUpstreamTurnCompleted = false;
  let upstreamTurnUsage;

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
    const codex = runtime.getCodexClient();
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
      {
        signal,
        outputSchema: ENHANCEMENT_OUTPUT_SCHEMA,
      },
      { requestContext, ...RETRY_TELEMETRY },
    );
    activeThreadId = resolveActiveCodexThreadId(activeThreadId, thread);

    let turnFailed = false;
    let turnError = false;
    const buildSessionPayload = (status, overrides = {}) => {
      const payload = {
        threadId: activeThreadId,
        turnId,
        status,
        transport: requestContext.transport,
        resumed: Boolean(requestedThreadId),
      };

      if (Object.prototype.hasOwnProperty.call(overrides, "contextSummary")) {
        payload.contextSummary = overrides.contextSummary;
      }
      if (Object.prototype.hasOwnProperty.call(overrides, "latestEnhancedPrompt")) {
        payload.latestEnhancedPrompt = overrides.latestEnhancedPrompt;
      }

      return buildEnhanceSessionEnvelope(payload);
    };

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
        sawUpstreamTurnCompleted = true;
        upstreamTurnUsage = event.usage;
        captureUsageMetrics(requestContext, event.usage);
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
      if (!sawUpstreamTurnCompleted) {
        throw createBadResponseError(
          "Enhancement stream ended without a completion event. Please retry.",
        );
      }

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
      const postProcessed = postProcessEnhancementResponse({
        llmResponseText: rawEnhancerOutput,
        userInput: prompt,
        context: enhancementContext,
      });
      const parsedEnhancerOutput =
        postProcessed.parse_status === "json"
          ? parseEnhancementJsonResponse(rawEnhancerOutput)
          : null;
      const outputContract = validateEnhancementOutputContract(parsedEnhancerOutput);
      const missingEnhancementPlan =
        parsedEnhancerOutput != null
        && !Object.prototype.hasOwnProperty.call(parsedEnhancerOutput, "enhancement_plan");

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

      if (missingEnhancementPlan) {
        logEvent("warn", "enhance_missing_enhancement_plan", cleanLogFields({
          request_id: requestContext?.requestId,
          endpoint: requestContext?.endpoint,
          thread_id: activeThreadId,
          turn_id: turnId,
          raw_output_chars: rawOutputLength,
        }));
      }

      if (postProcessed.parse_status !== "json" || !outputContract.ok) {
        const validationDetail = [
          outputContract.missingFields.length > 0
            ? `missing=${outputContract.missingFields.join(",")}`
            : null,
          outputContract.invalidFields.length > 0
            ? `invalid=${outputContract.invalidFields.join(",")}`
            : null,
        ].filter(Boolean).join(" ");
        logEvent("error", "enhance_invalid_structured_output", cleanLogFields({
          request_id: requestContext?.requestId,
          endpoint: requestContext?.endpoint,
          thread_id: activeThreadId,
          turn_id: turnId,
          parse_status: postProcessed.parse_status,
          raw_output_chars: rawOutputLength,
          validation_detail: validationDetail || undefined,
          parse_json_error: diag?.json_parse_error || undefined,
          raw_output_sha256: hashTextForLogs(rawEnhancerOutput),
        }));
        throw createBadResponseError(
          "Enhancement returned invalid structured output. Please retry.",
        );
      }

      if (sourceExpansion) {
        postProcessed.source_context = sourceExpansion;
      }

      const finalEnhancedPrompt = postProcessed.enhanced_prompt.trim();
      const finalContextSummary = postProcessed.session_context_summary || "";
      if (!finalEnhancedPrompt) {
        throw createBadResponseError(
          "Enhancement returned an empty prompt. Please retry.",
        );
      }

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

      const completedSession = buildSessionPayload("completed", {
        contextSummary: finalContextSummary,
        latestEnhancedPrompt: finalEnhancedPrompt,
      });
      for (const payload of buildEnhanceSuccessfulTerminalEvents({
        turnId,
        threadId: activeThreadId,
        usage: upstreamTurnUsage,
        payload: postProcessed,
        requestWarnings: threadOptionWarnings,
        session: completedSession,
        emittedAgentOutput,
        finalEnhancedPrompt,
      })) {
        emit({
          ...payload,
        });
      }
    }
  } catch (error) {
    activeThreadId = resolveActiveCodexThreadId(activeThreadId, thread);
    const thrownErrorCode = typeof error?.code === "string" ? error.code : undefined;
    const thrownErrorStatus = Number.isFinite(error?.status) ? error.status : undefined;
    const existingErrorCode = requestContext?.errorCode || thrownErrorCode;
    const existingStatusCode = requestContext?.statusCode ?? thrownErrorStatus;
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
        defaultCode: existingErrorCode || "service_error",
        defaultStatus: existingStatusCode ?? 500,
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
    const preparedRequestCode =
      inferErrorCodeFromStatus(preparedRequest.status) || "bad_response";
    setRequestError(
      requestContext,
      preparedRequestCode,
      preparedRequest.detail,
      preparedRequest.status,
    );
    json(
      res,
      preparedRequest.status,
      { detail: preparedRequest.detail, code: preparedRequestCode },
      corsHeaders,
    );
    return;
  }

  const controller = runtime.trackAbortController(new AbortController());
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
    runtime.untrackAbortController(controller);
  }
}

async function handleEnhanceWebSocketConnection(ws, request, requestContext) {
  const clientIp = runtime.getClientIp(request, requestContext);
  if (!runtime.wsConnectionSlots.acquire(clientIp)) {
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
    runtime.wsConnectionSlots.release(clientIp);
  };
  ws.on("close", releaseConnectionSlot);

  try {
    const controller = runtime.trackAbortController(new AbortController());
    let receivedStartMessage = false;
    let idleTimeoutHandle = null;
    let maxLifetimeHandle = null;
    const heartbeatState = createWebSocketHeartbeatState();

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
      }, runtime.enhanceWsIdleTimeoutMs);
      idleTimeoutHandle.unref?.();
    };

    const markSocketActivity = () => {
      heartbeatState.onSocketActivity();
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
        && ws.bufferedAmount > runtime.enhanceWsMaxBufferedBytes
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
        && ws.bufferedAmount > runtime.enhanceWsMaxBufferedBytes
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
    }, runtime.enhanceWsInitialMessageTimeoutMs);
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
    }, runtime.enhanceWsMaxLifetimeMs);
    maxLifetimeHandle.unref?.();

    const heartbeatHandle = globalThis.setInterval(() => {
      if (!isWebSocketOpen(ws)) return;
      if (heartbeatState.isAwaitingPong()) {
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

      try {
        ws.ping();
        heartbeatState.markPingSent();
      } catch (error) {
        setRequestError(requestContext, "service_error", toErrorMessage(error), 500);
        if (!controller.signal.aborted) {
          controller.abort("Websocket heartbeat send failed");
        }
        closeWebSocket(ws, 1011, "heartbeat_failed");
      }
    }, runtime.enhanceWsHeartbeatMs);
    heartbeatHandle.unref?.();

    scheduleIdleTimeout();
    ws.on("pong", () => {
      heartbeatState.onPong();
      markSocketActivity();
    });

    ws.on("close", () => {
      globalThis.clearTimeout(firstMessageTimeoutHandle);
      globalThis.clearInterval(heartbeatHandle);
      cleanupTimers();
      if (!controller.signal.aborted) {
        controller.abort("Client disconnected");
      }
      runtime.untrackAbortController(controller);
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
        const auth = await runtime.authService.authenticateRequestContext(
          req,
          requestContext,
          runtime.routeAuthPolicies[requestContext?.endpoint || ENHANCE_WS_PATH]
            || runtime.routeAuthPolicies[ENHANCE_WS_PATH],
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
          const preparedRequestCode =
            inferErrorCodeFromStatus(preparedRequest.status) || "bad_response";
          setRequestError(
            requestContext,
            preparedRequestCode,
            preparedRequest.detail,
            preparedRequest.status,
          );
          emitWebSocketStreamError({
            message: preparedRequest.detail,
            status: preparedRequest.status,
            code: preparedRequestCode,
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
  const result = runtime.rateLimiter.check(options);
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
  const result = runtime.rateLimiter.check(options);
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

function getMinuteRateLimitKey(auth, clientIp) {
  return auth.minuteRateKey || `${auth.rateKey}:${clientIp}`;
}

function getDayRateLimitKey(auth) {
  return auth.dayRateKey || auth.rateKey;
}

function checkEnhanceRateLimits(auth, clientIp) {
  const minuteWindow = checkRateLimit({
    scope: "enhance-minute",
    key: getMinuteRateLimitKey(auth, clientIp),
    limit: runtime.enhancePerMinute,
    windowMs: 60_000,
  }, "Rate limit exceeded. Please try again later.");
  if (!minuteWindow.ok) {
    return minuteWindow;
  }

  return checkRateLimit({
    scope: "enhance-day",
    key: getDayRateLimitKey(auth),
    limit: runtime.enhancePerDay,
    windowMs: 86_400_000,
  }, "Daily quota exceeded. Please try again tomorrow.");
}

function checkGitHubRateLimits(auth, clientIp) {
  const minuteWindow = checkRateLimit({
    scope: "github-minute",
    key: getMinuteRateLimitKey(auth, clientIp),
    limit: runtime.githubPerMinute,
    windowMs: 60_000,
  }, "GitHub context rate limit exceeded. Please try again later.");
  if (!minuteWindow.ok) {
    return minuteWindow;
  }

  return checkRateLimit({
    scope: "github-day",
    key: getDayRateLimitKey(auth),
    limit: runtime.githubPerDay,
    windowMs: 86_400_000,
  }, "GitHub context daily quota exceeded. Please try again tomorrow.");
}

function sendRateLimitResponse(res, corsHeaders, rateLimit, requestContext) {
  setRequestError(requestContext, "rate_limited", rateLimit.error, rateLimit.status);
  json(
    res,
    rateLimit.status,
    { error: rateLimit.error, code: "rate_limited" },
    {
      ...corsHeaders,
      ...(rateLimit.retryAfterSeconds
        ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
        : {}),
    },
  );
}

async function authenticateRequest(req, res, corsHeaders, requestContext, authPolicy) {
  const resolvedAuthPolicy = authPolicy || runtime.routeAuthPolicies[requestContext?.endpoint];
  if (!resolvedAuthPolicy) {
    setRequestError(requestContext, "service_error", "Auth policy is not configured.", 500);
    json(res, 500, {
      error: "Auth policy is not configured.",
      code: "service_error",
    }, corsHeaders);
    return null;
  }

  const auth = await runtime.authService.authenticateRequestContext(
    req,
    requestContext,
    resolvedAuthPolicy,
  );
  if (!auth.ok) {
    const errorCode = classifyHttpAuthErrorCode(auth.status, auth.error);
    setRequestError(requestContext, errorCode, auth.error, auth.status);
    json(res, auth.status, {
      error: auth.error,
      code: errorCode,
    }, corsHeaders);
    return null;
  }
  if (requestContext) {
    requestContext.userIdHash = hashUserIdentifier(auth.userId);
    requestContext.authMode = auth.authMode;
  }
  return auth;
}

async function readHttpBodyByMode(req, bodyMode) {
  if (bodyMode === "none") {
    return undefined;
  }
  if (bodyMode === "text") {
    return readBodyTextWithLimit(req, { maxBytes: runtime.maxHttpBodyBytes });
  }
  return readBodyJsonWithLimit(req, { maxBytes: runtime.maxHttpBodyBytes });
}

function respondWithGitHubRouteResult(res, routeResult, corsHeaders) {
  const headers = {
    ...corsHeaders,
    ...(routeResult?.headers && typeof routeResult.headers === "object" ? routeResult.headers : {}),
  };
  if (typeof routeResult?.redirectTo === "string" && routeResult.redirectTo.trim()) {
    redirect(res, Number(routeResult.status) || 302, routeResult.redirectTo, headers);
    return;
  }
  if (routeResult?.body === undefined) {
    res.writeHead(Number(routeResult?.status) || 204, headers);
    res.end();
    return;
  }
  json(res, Number(routeResult?.status) || 200, routeResult.body, headers);
}

function classifyGitHubErrorCode(error, status) {
  if (typeof error?.code === "string" && error.code.trim()) {
    return error.code.trim();
  }
  return inferErrorCodeFromStatus(status) || "service_error";
}

function resolveGitHubCustomAuthMode(customAuth) {
  if (customAuth === "githubSetupState") {
    return "github_setup_state";
  }
  if (customAuth === "githubWebhookSignature") {
    return "github_webhook_signature";
  }
  return null;
}

async function handleGitHubRoute(req, res, url, route, routesForPath, requestContext) {
  const cors = resolveCors(req, runtime.corsConfig, {
    allowMethods: routesForPath.length > 0
      ? collectGitHubRouteMethods(githubRoutes, url.pathname)
      : ["GET", "POST", "DELETE"],
  });
  if (!cors.ok) {
    setRequestError(requestContext, inferErrorCodeFromStatus(cors.status), cors.error, cors.status);
    json(res, cors.status, { error: cors.error }, cors.headers);
    return;
  }

  if (!route.authPolicy && !route.customAuth) {
    setRequestError(requestContext, "service_error", "GitHub route auth policy is not configured.", 500);
    json(
      res,
      500,
      { error: "GitHub route auth policy is not configured.", code: "service_error" },
      cors.headers,
    );
    return;
  }

  if (route.customAuth) {
    const authMode = resolveGitHubCustomAuthMode(route.customAuth);
    if (!authMode) {
      setRequestError(
        requestContext,
        "service_error",
        `GitHub custom auth mode "${route.customAuth}" is not supported.`,
        500,
      );
      json(
        res,
        500,
        {
          error: `GitHub custom auth mode "${route.customAuth}" is not supported.`,
          code: "service_error",
        },
        cors.headers,
      );
      return;
    }
    requestContext.authMode = authMode;
  }

  let auth = null;
  if (route.authPolicy) {
    auth = await authenticateRequest(req, res, cors.headers, requestContext, route.authPolicy);
    if (!auth) return;
  }

  if (route.rateLimitScope === "github-user" && auth) {
    const clientIp = runtime.getClientIp(req, requestContext);
    const rateLimit = checkGitHubRateLimits(auth, clientIp);
    if (!rateLimit.ok) {
      sendRateLimitResponse(res, cors.headers, rateLimit, requestContext);
      return;
    }
  }

  let body;
  try {
    body = await readHttpBodyByMode(req, route.bodyMode);
  } catch (error) {
    const statusCode = isPayloadTooLargeError(error) ? 413 : 400;
    const errorCode = statusCode === 413 ? "payload_too_large" : "bad_request";
    const errorMessage = toErrorMessage(error);
    setRequestError(requestContext, errorCode, errorMessage, statusCode);
    json(res, statusCode, { error: errorMessage, code: errorCode }, cors.headers);
    return;
  }

  try {
    const result = await route.handler({
      auth,
      body,
      params: route.params || {},
      req,
      requestContext,
      res,
      route,
      runtime,
      url,
    });
    respondWithGitHubRouteResult(res, result, cors.headers);
  } catch (error) {
    const status = Number.isFinite(error?.status) ? error.status : 500;
    const code = classifyGitHubErrorCode(error, status);
    const message = isGitHubError(error)
      ? error.message
      : toErrorMessage(error);
    setRequestError(requestContext, code, message, status);
    json(res, status, { error: message, code }, cors.headers);
  }
}

async function handleEnhance(req, res, body, corsHeaders, requestContext) {
  const auth = await authenticateRequest(
    req,
    res,
    corsHeaders,
    requestContext,
    runtime.routeAuthPolicies["/enhance"],
  );
  if (!auth) return;

  const clientIp = runtime.getClientIp(req, requestContext);
  const rateLimit = checkEnhanceRateLimits(auth, clientIp);
  if (!rateLimit.ok) {
    sendRateLimitResponse(res, corsHeaders, rateLimit, requestContext);
    return;
  }

  await streamWithCodex(req, res, body, corsHeaders, requestContext);
}

async function handleExtractUrl(req, res, body, corsHeaders, requestContext) {
  const auth = await authenticateRequest(
    req,
    res,
    corsHeaders,
    requestContext,
    runtime.routeAuthPolicies["/extract-url"],
  );
  if (!auth) return;

  const clientIp = runtime.getClientIp(req, requestContext);
  if (!enforceRateLimit(res, corsHeaders, {
    scope: "extract-minute",
    key: getMinuteRateLimitKey(auth, clientIp),
    limit: runtime.extractPerMinute,
    windowMs: 60_000,
  }, "Rate limit exceeded. Please try again later.", requestContext)) {
    return;
  }

  if (!enforceRateLimit(res, corsHeaders, {
    scope: "extract-day",
    key: getDayRateLimitKey(auth),
    limit: runtime.extractPerDay,
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
  if (urlInput.length > runtime.maxUrlChars) {
    json(
      res,
      413,
      { error: `URL is too large. Maximum ${runtime.maxUrlChars} characters.`, code: "payload_too_large" },
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

  const cachedEntry = runtime.extractUrlCache.get(parsedUrl.href);
  if (cachedEntry) {
    logEvent("info", "extract_url_cache_hit", {
      request_id: requestContext?.requestId,
      url: sanitizeUrlForLogs(parsedUrl) || parsedUrl.origin,
      url_sha256: hashTextForLogs(parsedUrl.href),
    });
    json(res, 200, { title: cachedEntry.title, content: cachedEntry.content }, corsHeaders);
    return;
  }

  let pageResponse;
  try {
    pageResponse = await fetchPageWithHeaderFallback(
      parsedUrl.href,
      runtime.fetchTimeoutMs,
      runtime.extractFetchMaxRedirects,
    );
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
    bodyText = await readBodyWithLimit(pageResponse, runtime.maxResponseBytes);
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

  runtime.extractUrlCache.set(parsedUrl.href, title, summaryResult.content);
  json(res, 200, { title, content: summaryResult.content }, corsHeaders);
}

async function handleInferBuilderFields(req, res, body, corsHeaders, requestContext) {
  const auth = await authenticateRequest(
    req,
    res,
    corsHeaders,
    requestContext,
    runtime.routeAuthPolicies["/infer-builder-fields"],
  );
  if (!auth) return;

  const clientIp = runtime.getClientIp(req, requestContext);
  if (!enforceRateLimit(res, corsHeaders, {
    scope: "infer-minute",
    key: getMinuteRateLimitKey(auth, clientIp),
    limit: runtime.inferPerMinute,
    windowMs: 60_000,
  }, "Rate limit exceeded. Please try again later.", requestContext)) {
    return;
  }

  if (!enforceRateLimit(res, corsHeaders, {
    scope: "infer-day",
    key: getDayRateLimitKey(auth),
    limit: runtime.inferPerDay,
    windowMs: 86_400_000,
  }, "Daily quota exceeded. Please try again tomorrow.", requestContext)) {
    return;
  }

  const promptRaw = body?.prompt;
  const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
  if (!prompt) {
    setRequestError(requestContext, "bad_request", "Prompt is required.", 400);
    json(res, 400, { error: "Prompt is required.", code: "bad_request" }, corsHeaders);
    return;
  }
  if (prompt.length > runtime.maxInferencePromptChars) {
    setRequestError(
      requestContext,
      "payload_too_large",
      `Prompt is too large. Maximum ${runtime.maxInferencePromptChars} characters.`,
      413,
    );
    json(
      res,
      413,
      {
        error: `Prompt is too large. Maximum ${runtime.maxInferencePromptChars} characters.`,
        code: "payload_too_large",
      },
      corsHeaders,
    );
    return;
  }

  const currentFields = normalizeInferCurrentFields(
    body?.current_fields ?? body?.currentFields,
  );
  const lockMetadata = normalizeInferLockMetadata(
    body?.lock_metadata ?? body?.lockMetadata,
  );
  const inferRequestContext = normalizeInferRequestContext(
    body?.request_context ?? body?.requestContext,
  );
  const sourceSummaries = normalizeInferSourceSummaries(
    body?.source_summaries ?? body?.sourceSummaries,
  );

  try {
    const inference = await inferBuilderFieldUpdates({
      prompt,
      currentFields,
      lockMetadata,
      inferRequestContext,
      sourceSummaries,
      requestContext,
    });
    json(res, 200, inference, corsHeaders);
  } catch (error) {
    const status = Number.isFinite(error?.status) ? error.status : 500;
    const code = typeof error?.code === "string"
      ? error.code
      : inferErrorCodeFromStatus(status) || "service_error";
    const message = toErrorMessage(error);
    setRequestError(requestContext, code, message, status);
    json(res, status, { error: message, code }, corsHeaders);
  }
}

async function requestHandler(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const rawRequestId = (headerValue(req, "x-request-id") || "").trim();
  const requestId = rawRequestId || `req_${randomUUID().replaceAll("-", "")}`;
  const method = typeof req.method === "string" ? req.method : "GET";
  const isGitHubPath = url.pathname === "/github" || url.pathname.startsWith("/github/");
  const githubRoutesForPath = isGitHubPath
    ? listGitHubRoutesForPath(githubRoutes, url.pathname)
    : [];
  const matchedGitHubRoute = isGitHubPath
    ? matchGitHubRoute(githubRoutes, method, url.pathname)
    : null;
  const resolvedEndpoint = matchedGitHubRoute?.pattern || githubRoutesForPath[0]?.pattern || url.pathname;
  const requestContext = createRequestContext(
    requestId,
    resolvedEndpoint,
    method,
    transportForEndpoint(resolvedEndpoint, ENHANCE_WS_PATH),
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
    const readiness = runtime.buildReadinessReport({ isShuttingDown });
    json(res, readiness.ok ? 200 : 503, readiness);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health/details") {
    json(res, 200, {
      ok: true,
      provider: "codex-sdk",
      ...runtime.buildHealthDetails(),
    });
    return;
  }

  if (isGitHubPath) {
    const allowedMethods = githubRoutesForPath.length > 0
      ? collectGitHubRouteMethods(githubRoutes, url.pathname)
      : ["GET", "POST", "DELETE"];
    const cors = resolveCors(req, runtime.corsConfig, { allowMethods: allowedMethods });

    if (req.method === "OPTIONS") {
      if (!cors.ok) {
        setRequestError(requestContext, inferErrorCodeFromStatus(cors.status), cors.error, cors.status);
        json(res, cors.status, { error: cors.error }, cors.headers);
        return;
      }
      if (githubRoutesForPath.length === 0) {
        setRequestError(requestContext, inferErrorCodeFromStatus(404), "Not found.", 404);
        json(res, 404, { error: "Not found.", code: "not_found" }, cors.headers);
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

    if (githubRoutesForPath.length === 0) {
      setRequestError(requestContext, inferErrorCodeFromStatus(404), "Not found.", 404);
      json(res, 404, { error: "Not found.", code: "not_found" }, cors.headers);
      return;
    }

    if (!matchedGitHubRoute) {
      setRequestError(requestContext, inferErrorCodeFromStatus(405), "Method not allowed.", 405);
      json(
        res,
        405,
        { error: "Method not allowed.", code: "method_not_allowed" },
        {
          ...cors.headers,
          Allow: allowedMethods.join(", "),
        },
      );
      return;
    }

    try {
      await handleGitHubRoute(
        req,
        res,
        url,
        matchedGitHubRoute,
        githubRoutesForPath,
        requestContext,
      );
      return;
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
        { error: requestContext.errorMessage || "Internal server error.", code: "service_error" },
        cors.headers,
      );
      return;
    }
  }

  const isFunctionPath = (
    url.pathname === "/enhance"
    || url.pathname === "/extract-url"
    || url.pathname === "/infer-builder-fields"
  );

  if (isFunctionPath) {
    const cors = resolveCors(req, runtime.corsConfig);
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
      body = await readBodyJsonWithLimit(req, { maxBytes: runtime.maxHttpBodyBytes });
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
  maxPayload: runtime.enhanceWsMaxPayloadBytes,
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

  const cors = resolveCors(req, runtime.corsConfig);
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

server.listen(runtime.serviceConfig.port, runtime.serviceConfig.host, () => {
  logEvent("info", "service_start", runtime.buildServiceStartLogFields());
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
    active_abort_controllers: runtime.activeAbortControllers.size,
  });

  server.close(() => {
    logEvent("info", "service_shutdown_http_closed", { signal });
  });

  for (const controller of runtime.activeAbortControllers) {
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
      timeout_ms: runtime.shutdownDrainTimeoutMs,
    });
    process.exit(1);
  }, runtime.shutdownDrainTimeoutMs);
  drainTimer.unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
