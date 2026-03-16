import { hasCodexSessionProgress, normalizeCodexToken } from "@/lib/codex-stream";

export type CodexSessionStatus =
  | "idle"
  | "starting"
  | "streaming"
  | "completed"
  | "failed"
  | "aborted";

export type CodexSessionTransport = "sse" | "ws" | null;

export interface CodexSession {
  threadId: string | null;
  turnId: string | null;
  status: CodexSessionStatus;
  transport: CodexSessionTransport;
  contextSummary: string;
  latestEnhancedPrompt: string;
  lastRunContextSummary: string;
  lastRunEnhancedPrompt: string;
  eventCount: number;
  startedAt: number | null;
  updatedAt: number | null;
  lastEventType: string | null;
  lastResponseType: string | null;
  lastItemId: string | null;
  lastItemType: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

export interface CodexSessionEventMeta {
  eventType: string | null;
  responseType: string | null;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  itemType: string | null;
  payload?: unknown;
  transport?: CodexSessionTransport;
  occurredAt?: number;
}

const MAX_SESSION_CONTEXT_SUMMARY_CHARS = 4_000;
const MAX_SESSION_PROMPT_CHARS = 12_000;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeStatus(value: unknown): CodexSessionStatus | null {
  if (typeof value !== "string") return null;
  switch (value.trim().toLowerCase()) {
    case "idle":
    case "starting":
    case "streaming":
    case "completed":
    case "failed":
    case "aborted":
      return value.trim().toLowerCase() as CodexSessionStatus;
    default:
      return null;
  }
}

function normalizeTransport(value: unknown): CodexSessionTransport {
  if (typeof value !== "string") return null;
  switch (value.trim().toLowerCase()) {
    case "sse":
      return "sse";
    case "ws":
    case "websocket":
      return "ws";
    default:
      return null;
  }
}

function truncate(value: string | null, maxChars: number): string {
  if (!value) return "";
  return value.length > maxChars ? value.slice(0, maxChars) : value;
}

function extractSessionEnvelope(payload: unknown): Partial<CodexSession> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const candidate = (payload as { session?: unknown }).session;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;

  const session = candidate as {
    thread_id?: unknown;
    threadId?: unknown;
    turn_id?: unknown;
    turnId?: unknown;
    status?: unknown;
    transport?: unknown;
    context_summary?: unknown;
    contextSummary?: unknown;
    latest_enhanced_prompt?: unknown;
    latestEnhancedPrompt?: unknown;
  };

  const next = createCodexSession();
  const status = normalizeStatus(session.status);
  const transport = normalizeTransport(session.transport);

  if (status) next.status = status;
  if (transport) next.transport = transport;

  next.threadId = asNonEmptyString(session.thread_id) || asNonEmptyString(session.threadId);
  next.turnId = asNonEmptyString(session.turn_id) || asNonEmptyString(session.turnId);
  next.lastRunContextSummary = truncate(
    asNonEmptyString(session.context_summary) || asNonEmptyString(session.contextSummary),
    MAX_SESSION_CONTEXT_SUMMARY_CHARS,
  );
  next.lastRunEnhancedPrompt = truncate(
    asNonEmptyString(session.latest_enhanced_prompt) || asNonEmptyString(session.latestEnhancedPrompt),
    MAX_SESSION_PROMPT_CHARS,
  );

  return next;
}

function deriveStatusFromEvent(meta: CodexSessionEventMeta): CodexSessionStatus | null {
  const eventType = normalizeCodexToken(meta.eventType);
  const responseType = normalizeCodexToken(meta.responseType);

  if (eventType === "turn.completed" || responseType === "response.completed") {
    return "completed";
  }
  if (
    eventType === "turn.failed"
    || eventType === "turn/error"
    || eventType === "thread.error"
    || eventType === "error"
    || responseType === "turn/error"
  ) {
    return "failed";
  }
  if (eventType === "thread.started") {
    return "starting";
  }
  if (hasCodexSessionProgress({ eventType, responseType })) {
    return "streaming";
  }

  return null;
}

export function createCodexSession(overrides: Partial<CodexSession> = {}): CodexSession {
  return {
    threadId: null,
    turnId: null,
    status: "idle",
    transport: null,
    contextSummary: "",
    latestEnhancedPrompt: "",
    lastRunContextSummary: "",
    lastRunEnhancedPrompt: "",
    eventCount: 0,
    startedAt: null,
    updatedAt: null,
    lastEventType: null,
    lastResponseType: null,
    lastItemId: null,
    lastItemType: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

export function beginCodexSession(
  session: CodexSession | null | undefined,
  options: {
    threadId?: string | null;
    transport?: CodexSessionTransport;
    occurredAt?: number;
  } = {},
): CodexSession {
  const occurredAt = options.occurredAt ?? Date.now();
  const next = createCodexSession(session ?? undefined);

  next.threadId = options.threadId ?? next.threadId;
  next.transport = options.transport ?? next.transport;
  next.status = "starting";
  next.startedAt = next.startedAt ?? occurredAt;
  next.updatedAt = occurredAt;
  next.lastErrorCode = null;
  next.lastErrorMessage = null;

  return next;
}

export function advanceCodexSessionFromEvent(
  session: CodexSession | null | undefined,
  meta: CodexSessionEventMeta,
): CodexSession {
  const occurredAt = meta.occurredAt ?? Date.now();
  const next = createCodexSession(session ?? undefined);
  const sessionEnvelope = extractSessionEnvelope(meta.payload);

  next.eventCount += 1;
  next.updatedAt = occurredAt;
  next.lastEventType = meta.eventType;
  next.lastResponseType = meta.responseType;
  next.lastItemId = meta.itemId;
  next.lastItemType = meta.itemType;

  if (meta.transport) {
    next.transport = meta.transport;
  }
  if (meta.threadId) {
    next.threadId = meta.threadId;
  }
  if (meta.turnId) {
    next.turnId = meta.turnId;
  }

  if (sessionEnvelope) {
    if (sessionEnvelope.threadId) next.threadId = sessionEnvelope.threadId;
    if (sessionEnvelope.turnId) next.turnId = sessionEnvelope.turnId;
    if (sessionEnvelope.transport) next.transport = sessionEnvelope.transport;
    if (sessionEnvelope.lastRunContextSummary) {
      next.lastRunContextSummary = sessionEnvelope.lastRunContextSummary;
    }
    if (sessionEnvelope.lastRunEnhancedPrompt) {
      next.lastRunEnhancedPrompt = sessionEnvelope.lastRunEnhancedPrompt;
    }
    if (sessionEnvelope.status) {
      next.status = sessionEnvelope.status;
    }
  }

  const derivedStatus = deriveStatusFromEvent(meta);
  if (derivedStatus && next.status !== "failed") {
    next.status = derivedStatus;
  }

  if (next.status !== "idle") {
    next.startedAt = next.startedAt ?? occurredAt;
  }

  return next;
}

export function completeCodexSession(
  session: CodexSession | null | undefined,
  options: {
    transport?: CodexSessionTransport;
    occurredAt?: number;
  } = {},
): CodexSession {
  const occurredAt = options.occurredAt ?? Date.now();
  const next = createCodexSession(session ?? undefined);
  next.transport = options.transport ?? next.transport;
  next.status = "completed";
  next.startedAt = next.startedAt ?? occurredAt;
  next.updatedAt = occurredAt;
  next.lastErrorCode = null;
  next.lastErrorMessage = null;
  return next;
}

export function failCodexSession(
  session: CodexSession | null | undefined,
  error: { code?: string | null; message?: string | null } = {},
  options: {
    transport?: CodexSessionTransport;
    occurredAt?: number;
  } = {},
): CodexSession {
  const occurredAt = options.occurredAt ?? Date.now();
  const next = createCodexSession(session ?? undefined);
  next.transport = options.transport ?? next.transport;
  next.status = "failed";
  next.startedAt = next.startedAt ?? occurredAt;
  next.updatedAt = occurredAt;
  next.lastErrorCode = asNonEmptyString(error.code) || next.lastErrorCode;
  next.lastErrorMessage = asNonEmptyString(error.message) || next.lastErrorMessage;
  return next;
}

export function abortCodexSession(
  session: CodexSession | null | undefined,
  options: {
    transport?: CodexSessionTransport;
    occurredAt?: number;
  } = {},
): CodexSession {
  const occurredAt = options.occurredAt ?? Date.now();
  const next = createCodexSession(session ?? undefined);
  next.transport = options.transport ?? next.transport;
  next.status = "aborted";
  next.startedAt = next.startedAt ?? occurredAt;
  next.updatedAt = occurredAt;
  return next;
}

export function toCodexSessionRequest(
  session: CodexSession | null | undefined,
): {
  thread_id?: string;
  context_summary?: string;
  latest_enhanced_prompt?: string;
} | undefined {
  if (!session) return undefined;

  const payload: {
    thread_id?: string;
    context_summary?: string;
    latest_enhanced_prompt?: string;
  } = {};

  const threadId = asNonEmptyString(session.threadId);
  const contextSummary = truncate(asNonEmptyString(session.contextSummary), MAX_SESSION_CONTEXT_SUMMARY_CHARS);
  const latestEnhancedPrompt = truncate(
    asNonEmptyString(session.latestEnhancedPrompt),
    MAX_SESSION_PROMPT_CHARS,
  );

  if (threadId) payload.thread_id = threadId;
  if (contextSummary) payload.context_summary = contextSummary;
  if (latestEnhancedPrompt) payload.latest_enhanced_prompt = latestEnhancedPrompt;

  return Object.keys(payload).length > 0 ? payload : undefined;
}
