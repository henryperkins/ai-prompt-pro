/**
 * Enhancement workflow step event builders.
 *
 * These pure functions produce the `enhance.workflow` event payloads that the
 * frontend renders as a step-by-step progress trace above the final prompt.
 *
 * @module enhance-workflow
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ENHANCEMENT_WORKFLOW_STEP_ORDER = {
  analyze_request: 10,
  source_context: 20,
  web_search: 30,
  generate_prompt: 40,
};

const AGENT_MESSAGE_ITEM_TYPES = new Set([
  "agent_message",
  "assistant_message",
  "message",
  "output_text",
  "text",
  "enhancement",
]);

// ---------------------------------------------------------------------------
// Workflow text helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a workflow detail string for display.
 *
 * @param {unknown} value
 * @param {number} [maxChars=180]
 * @returns {string}
 */
export function truncateWorkflowDetail(value, maxChars = 180) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

/**
 * @param {string | undefined} mode
 * @returns {string}
 */
export function formatEnhancementModeLabel(mode) {
  if (mode === "quick") return "light polish";
  if (mode === "guided") return "structured rewrite";
  if (mode === "advanced") return "expert prompt";
  return "standard enhancement";
}

// ---------------------------------------------------------------------------
// Item type classification
// ---------------------------------------------------------------------------

/**
 * @param {unknown} itemType
 * @returns {boolean}
 */
export function isAgentMessageItemType(itemType) {
  if (typeof itemType !== "string") return false;
  return AGENT_MESSAGE_ITEM_TYPES.has(itemType.trim().toLowerCase());
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeWorkflowToken(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * @param {unknown} itemType
 * @returns {boolean}
 */
export function isWorkflowWebSearchItemType(itemType) {
  const normalized = normalizeWorkflowToken(itemType);
  if (!normalized) return false;
  return (
    normalized === "web_search_call"
    || normalized === "web_search"
    || normalized === "web_search_result"
    || /(^|[./_-])web[_-]?search([./_-]|$)/.test(normalized)
    || /(^|[./_-])web[_-]?search[_-]?call([./_-]|$)/.test(normalized)
  );
}

/**
 * @param {unknown} itemType
 * @returns {boolean}
 */
export function isCountableWorkflowWebSearchItemType(itemType) {
  const normalized = normalizeWorkflowToken(itemType);
  if (!normalized || normalized === "web_search_result") return false;
  return (
    normalized === "web_search_call"
    || normalized === "web_search"
    || /(^|[./_-])web[_-]?search[_-]?call([./_-]|$)/.test(normalized)
  );
}

/**
 * Extract the query string from a web-search item.
 *
 * @param {unknown} item
 * @returns {string}
 */
export function extractWorkflowWebSearchQuery(item) {
  if (!item || typeof item !== "object") return "";

  const directQuery = typeof item.query === "string" ? item.query.trim() : "";
  if (directQuery) return directQuery;

  const rawArgs = item.arguments ?? item.args ?? item.input;
  if (typeof rawArgs === "string") {
    try {
      const parsed = JSON.parse(rawArgs);
      if (parsed && typeof parsed === "object" && typeof parsed.query === "string") {
        return parsed.query.trim();
      }
    } catch {
      const trimmed = rawArgs.trim();
      return trimmed.length > 0 && trimmed.length < 300 ? trimmed : "";
    }
  }

  if (rawArgs && typeof rawArgs === "object" && typeof rawArgs.query === "string") {
    return rawArgs.query.trim();
  }

  return "";
}

// ---------------------------------------------------------------------------
// Step detail builders
// ---------------------------------------------------------------------------

/**
 * Build the detail string for the "analyze_request" workflow step.
 *
 * @param {Record<string, unknown> | undefined} enhancementContext
 * @returns {string}
 */
export function buildAnalyzeRequestWorkflowDetail(enhancementContext) {
  const primaryIntent = enhancementContext?.primaryIntent
    || enhancementContext?.intent?.[0]
    || "general";
  const modeLabel = formatEnhancementModeLabel(enhancementContext?.builderMode);
  const ambiguityLevel = enhancementContext?.ambiguityLevel || "unknown";
  return `Detected ${primaryIntent} intent in ${modeLabel} mode. Ambiguity ${ambiguityLevel}.`;
}

/**
 * Build the detail for the "source_context" workflow step.
 *
 * @param {Record<string, unknown> | null} sourceExpansion
 * @param {unknown[]} contextSources
 * @returns {{ status: string; detail: string }}
 */
export function buildSourceContextWorkflowUpdate(sourceExpansion, contextSources) {
  const availableCount = Array.isArray(contextSources) ? contextSources.length : 0;
  const summaryLabel = `${availableCount} attached source summar${availableCount === 1 ? "y" : "ies"}`;
  if (!sourceExpansion || availableCount === 0) {
    return {
      status: "skipped",
      detail: "No attached sources were provided.",
    };
  }

  if (sourceExpansion.expandedRefs.length > 0) {
    const rationale = truncateWorkflowDetail(sourceExpansion.rationale);
    return {
      status: "completed",
      detail: rationale
        ? `Expanded ${sourceExpansion.expandedRefs.length} attached source(s). ${rationale}`
        : `Expanded ${sourceExpansion.expandedRefs.length} attached source(s) for additional context.`,
    };
  }

  if (availableCount > 0) {
    const rationale = truncateWorkflowDetail(sourceExpansion.rationale);
    return {
      status: "completed",
      detail: rationale
        ? `Used ${summaryLabel}. ${rationale}`
        : `Used ${summaryLabel} without expanding raw content.`,
    };
  }

  return {
    status: "skipped",
    detail: "No attached sources were provided.",
  };
}

/**
 * Build the detail for the "web_search" workflow step.
 *
 * @param {number} searchCount
 * @param {string} query
 * @returns {string}
 */
export function buildWebSearchWorkflowDetail(searchCount, query) {
  const countLabel = `${searchCount} web search${searchCount === 1 ? "" : "es"}`;
  const normalizedQuery = truncateWorkflowDetail(query, 120);
  return normalizedQuery
    ? `Ran ${countLabel}. Last query: ${normalizedQuery}`
    : `Ran ${countLabel}.`;
}

/**
 * Build the detail for the "generate_prompt" workflow step.
 *
 * @param {Record<string, unknown> | undefined} postProcessed
 * @returns {string}
 */
export function buildGeneratePromptWorkflowDetail(postProcessed) {
  if (postProcessed?.parse_status === "json") {
    return "Generated the final prompt and structured enhancement metadata.";
  }
  return "Generated the final prompt; metadata required fallback text recovery.";
}

// ---------------------------------------------------------------------------
// Workflow step emitter
// ---------------------------------------------------------------------------

/**
 * Emit a single workflow step event via the provided `emit` callback.
 *
 * @param {{ emit: Function; turnId: string; threadId: string | null; stepId: string; label: string; status: string; detail?: string }} options
 */
export function emitEnhancementWorkflowStep({
  emit,
  turnId,
  threadId,
  stepId,
  label,
  status,
  detail,
}) {
  const order = ENHANCEMENT_WORKFLOW_STEP_ORDER[stepId];
  if (!order) return;

  emit({
    event: "enhance/workflow",
    type: "enhance.workflow",
    turn_id: turnId,
    thread_id: threadId || null,
    payload: {
      step_id: stepId,
      order,
      label,
      status,
      detail: truncateWorkflowDetail(detail) || undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Item helpers
// ---------------------------------------------------------------------------

/**
 * Extract item id.
 *
 * @param {unknown} item
 * @returns {string | undefined}
 */
export function idFromItem(item) {
  if (!item || typeof item !== "object") return undefined;
  return typeof item.id === "string" ? item.id : undefined;
}

/**
 * Extract item type.
 *
 * @param {unknown} item
 * @returns {string | undefined}
 */
export function typeFromItem(item) {
  if (!item || typeof item !== "object") return undefined;
  return typeof item.type === "string" ? item.type : undefined;
}
