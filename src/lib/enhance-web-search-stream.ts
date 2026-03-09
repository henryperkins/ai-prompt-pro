import { normalizeCodexToken, type CodexStreamEventMeta } from "@/lib/codex-stream";

export type WebSearchPhase = "idle" | "searching" | "completed";

export interface WebSearchActivity {
  phase: WebSearchPhase;
  query: string | null;
  itemId: string | null;
  searchCount: number;
}

export const IDLE_WEB_SEARCH_ACTIVITY: WebSearchActivity = {
  phase: "idle",
  query: null,
  itemId: null,
  searchCount: 0,
};

type StreamEvent = Pick<CodexStreamEventMeta, "eventType" | "responseType" | "itemId" | "itemType">;

function isWebSearchItemType(itemType: string | null | undefined): boolean {
  const normalized = normalizeCodexToken(itemType);
  if (!normalized) return false;
  return (
    normalized === "web_search_call"
    || normalized === "web_search"
    || normalized === "web_search_result"
    || /(^|[./_-])web[_-]?search([./_-]|$)/.test(normalized)
    || /(^|[./_-])web[_-]?search[_-]?call([./_-]|$)/.test(normalized)
  );
}

function isCountableWebSearchItemType(itemType: string | null | undefined): boolean {
  const normalized = normalizeCodexToken(itemType);
  if (!normalized) return false;
  if (normalized === "web_search_result") return false;
  return (
    normalized === "web_search_call"
    || normalized === "web_search"
    || /(^|[./_-])web[_-]?search[_-]?call([./_-]|$)/.test(normalized)
  );
}

function extractQueryFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  // Check for web_search_activity envelope from the backend
  const data = payload as {
    web_search_activity?: { query?: unknown; phase?: unknown };
    item?: { arguments?: unknown; args?: unknown; input?: unknown; query?: unknown };
  };
  const activity = data.web_search_activity;
  if (activity && typeof activity.query === "string" && activity.query.trim()) {
    return activity.query.trim();
  }

  // Fallback: extract from item arguments
  const item = data.item;
  if (!item || typeof item !== "object") return null;
  const args = (item as Record<string, unknown>).arguments
    ?? (item as Record<string, unknown>).args
    ?? (item as Record<string, unknown>).input;

  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args) as Record<string, unknown>;
      if (typeof parsed.query === "string") return parsed.query;
    } catch {
      return args.length > 0 && args.length < 300 ? args : null;
    }
  }
  if (args && typeof args === "object") {
    const argsObj = args as Record<string, unknown>;
    if (typeof argsObj.query === "string") return argsObj.query;
  }
  if (typeof (item as Record<string, unknown>).query === "string") {
    return (item as Record<string, unknown>).query as string;
  }

  return null;
}

function extractPhaseFromPayload(payload: unknown): WebSearchPhase | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as { web_search_activity?: { phase?: unknown } };
  const phase = data.web_search_activity?.phase;
  if (phase === "searching") return "searching";
  if (phase === "completed") return "completed";
  return null;
}

/**
 * Detect web search activity from a streaming event and return an updated
 * activity state. Returns `null` if the event is not web-search related.
 */
export function extractWebSearchActivity(
  previous: WebSearchActivity,
  event: StreamEvent,
  payload: unknown,
): WebSearchActivity | null {
  if (!isWebSearchItemType(event.itemType)) return null;

  const eventType = normalizeCodexToken(event.eventType);
  const query = extractQueryFromPayload(payload) || previous.query;
  const backendPhase = extractPhaseFromPayload(payload);
  const itemId = event.itemId || previous.itemId;

  // Determine phase
  let phase: WebSearchPhase;
  if (backendPhase) {
    phase = backendPhase;
  } else if (
    eventType.includes("started")
    || eventType.includes("delta")
    || eventType.includes("updated")
    || eventType.includes("added")
  ) {
    phase = "searching";
  } else if (eventType.includes("completed") || eventType.includes("done")) {
    phase = "completed";
  } else {
    phase = "searching";
  }

  // Increment search count on new items
  const isNewItem = event.itemId !== null && event.itemId !== previous.itemId;
  const searchCount = isNewItem && isCountableWebSearchItemType(event.itemType)
    ? previous.searchCount + 1
    : previous.searchCount;

  return { phase, query, itemId, searchCount };
}
