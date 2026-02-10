import { supabase } from "@/integrations/supabase/client";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  (SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : undefined);
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

let bootstrapTokenPromise: Promise<string> | null = null;
const ANON_AUTH_DISABLED_KEY = "ai-prompt-pro:anon-auth-disabled";
const ACCESS_TOKEN_REFRESH_GRACE_SECONDS = 30;

function readAnonAuthDisabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ANON_AUTH_DISABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function persistAnonAuthDisabled(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(ANON_AUTH_DISABLED_KEY, "1");
    } else {
      window.localStorage.removeItem(ANON_AUTH_DISABLED_KEY);
    }
  } catch {
    // Ignore storage errors (private mode, disabled storage, etc.).
  }
}

let anonAuthDisabled = readAnonAuthDisabled();

function sessionExpiresSoon(expiresAt: number | null | undefined): boolean {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowSeconds + ACCESS_TOKEN_REFRESH_GRACE_SECONDS;
}

async function refreshSessionAccessToken(): Promise<string | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();
  if (error) return null;
  return session?.access_token ?? null;
}

async function clearLocalSupabaseSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Ignore local sign-out failures and continue with fallback auth.
  }
}

function shouldPersistAnonAuthDisabled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; status?: unknown; code?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const status = typeof candidate.status === "number" ? candidate.status : null;

  if (code.includes("anonymous") || code.includes("provider_disabled")) {
    return true;
  }

  if (!message) return false;
  const suggestsAnonymousIsDisabled =
    message.includes("anonymous") &&
    (message.includes("disabled") || message.includes("not enabled") || message.includes("unsupported"));

  if (!suggestsAnonymousIsDisabled) return false;
  return status === null || status >= 400;
}

function assertSupabaseEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing Supabase env. Set VITE_SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID) and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
    );
  }
}

function functionUrl(name: "enhance-prompt" | "extract-url"): string {
  assertSupabaseEnv();
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function getAccessToken({
  forceRefresh = false,
  allowSessionToken = true,
}: {
  forceRefresh?: boolean;
  allowSessionToken?: boolean;
} = {}): Promise<string> {
  assertSupabaseEnv();

  if (forceRefresh) {
    const forcedToken = await refreshSessionAccessToken();
    if (forcedToken) return forcedToken;
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Could not read auth session: ${sessionError.message}`);
  }
  if (session?.access_token) {
    if (!allowSessionToken) {
      await clearLocalSupabaseSession();
    } else {
      if (sessionExpiresSoon(session.expires_at)) {
        const refreshedToken = await refreshSessionAccessToken();
        if (refreshedToken) return refreshedToken;
      }
      return session.access_token;
    }
  }

  if (!anonAuthDisabled) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error && data.session?.access_token) {
      anonAuthDisabled = false;
      persistAnonAuthDisabled(false);
      return data.session.access_token;
    }
    if (error && shouldPersistAnonAuthDisabled(error)) {
      // Anonymous sign-ins are disabled in this project — stop retrying across refreshes.
      anonAuthDisabled = true;
      persistAnonAuthDisabled(true);
    }
  }

  // Fallback for projects where anonymous auth is disabled:
  // use the project publishable key for Edge Function calls.
  return SUPABASE_PUBLISHABLE_KEY as string;
}

async function getAccessTokenWithBootstrap({
  forceRefresh = false,
  allowSessionToken = true,
}: {
  forceRefresh?: boolean;
  allowSessionToken?: boolean;
} = {}): Promise<string> {
  if (forceRefresh || !allowSessionToken) {
    bootstrapTokenPromise = null;
    return getAccessToken({ forceRefresh, allowSessionToken });
  }

  if (!bootstrapTokenPromise) {
    bootstrapTokenPromise = getAccessToken().finally(() => {
      bootstrapTokenPromise = null;
    });
  }
  return bootstrapTokenPromise;
}

async function functionHeaders({
  forceRefresh = false,
  allowSessionToken = true,
}: {
  forceRefresh?: boolean;
  allowSessionToken?: boolean;
} = {}): Promise<Record<string, string>> {
  assertSupabaseEnv();
  const accessToken = await getAccessTokenWithBootstrap({ forceRefresh, allowSessionToken });
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY as string,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function readFunctionError(resp: Response): Promise<string> {
  const fallbackMessage = `Error: ${resp.status}`;
  const errorData = await resp.json().catch(() => null);
  if (!errorData || typeof errorData !== "object") {
    return fallbackMessage;
  }

  const maybeError = (errorData as { error?: unknown }).error;
  if (typeof maybeError === "string" && maybeError.trim()) {
    return maybeError.trim();
  }

  const maybeDetail = (errorData as { detail?: unknown }).detail;
  if (typeof maybeDetail === "string" && maybeDetail.trim()) {
    return maybeDetail.trim();
  }

  return fallbackMessage;
}

function isInvalidSupabaseSessionError(status: number, errorMessage: string): boolean {
  if (status !== 401) return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("invalid or expired supabase session") ||
    (normalized.includes("invalid") && normalized.includes("session")) ||
    (normalized.includes("expired") && normalized.includes("session"))
  );
}

function extractSseError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as { error?: unknown };
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  if (data.error && typeof data.error === "object") {
    const message = (data.error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return null;
}

function extractTextValue(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (!value || typeof value !== "object") return null;
  const obj = value as { text?: unknown; content?: unknown; output_text?: unknown; delta?: unknown };
  if (typeof obj.text === "string" && obj.text) return obj.text;
  if (typeof obj.content === "string" && obj.content) return obj.content;
  if (typeof obj.output_text === "string" && obj.output_text) return obj.output_text;
  if (typeof obj.delta === "string" && obj.delta) return obj.delta;
  return null;
}

function isItemDeltaEventType(eventType: string | null): boolean {
  if (!eventType) return false;
  if (eventType === "item/delta" || eventType === "item.delta") return true;
  if (/^item\/[^/]+\/delta$/.test(eventType)) return true;
  if (/^item\.[^.]+\.delta$/.test(eventType)) return true;
  return false;
}

function isItemCompletedEventType(eventType: string | null): boolean {
  if (!eventType) return false;
  if (eventType === "item/completed" || eventType === "item.completed") return true;
  if (/^item\/[^/]+\/completed$/.test(eventType)) return true;
  if (/^item\.[^.]+\.completed$/.test(eventType)) return true;
  return false;
}

function isResponseOutputTextDelta(responseType: string | null): boolean {
  return responseType === "response.output_text.delta";
}

function isResponseOutputTextDone(responseType: string | null): boolean {
  return responseType === "response.output_text.done";
}

function isRenderableItemType(itemType: string | null): boolean {
  if (!itemType) return true;
  const normalized = itemType.trim().toLowerCase();
  if (!normalized) return true;

  return (
    normalized === "agent_message" ||
    normalized === "assistant_message" ||
    normalized === "enhancement" ||
    normalized === "output_text" ||
    normalized === "text" ||
    normalized === "message"
  );
}

function shouldEmitSseText(meta: {
  eventType: string | null;
  responseType: string | null;
  itemType: string | null;
}): boolean {
  if (isResponseOutputTextDelta(meta.responseType) || isResponseOutputTextDone(meta.responseType)) {
    return true;
  }

  if (isItemDeltaEventType(meta.eventType) || isItemCompletedEventType(meta.eventType)) {
    return isRenderableItemType(meta.itemType);
  }

  return true;
}

export function extractSseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    choices?: Array<{ delta?: { content?: unknown } }>;
    event?: unknown;
    type?: unknown;
    delta?: unknown;
    output_text?: unknown;
    text?: unknown;
    payload?: unknown;
    item?: unknown;
  };

  const chatCompletionsDelta = data.choices?.[0]?.delta?.content;
  if (typeof chatCompletionsDelta === "string" && chatCompletionsDelta) {
    return chatCompletionsDelta;
  }

  // Codex-style turn/item streaming event shape.
  const eventType =
    typeof data.event === "string"
      ? data.event
      : typeof data.type === "string"
        ? data.type
        : null;
  const responseType = typeof data.type === "string" ? data.type : null;

  if (isItemDeltaEventType(eventType) || isResponseOutputTextDelta(responseType)) {
    return (
      extractTextValue(data.delta) ||
      extractTextValue((data.item as { delta?: unknown } | undefined)?.delta) ||
      extractTextValue((data.payload as { delta?: unknown } | undefined)?.delta) ||
      extractTextValue(data.item)
    );
  }

  if (isItemCompletedEventType(eventType) || isResponseOutputTextDone(responseType)) {
    return (
      extractTextValue(data.text) ||
      extractTextValue((data.payload as { text?: unknown; output_text?: unknown } | undefined)?.text) ||
      extractTextValue(
        (data.payload as { text?: unknown; output_text?: unknown } | undefined)?.output_text,
      ) ||
      extractTextValue((data.item as { text?: unknown; output_text?: unknown } | undefined)?.text) ||
      extractTextValue((data.item as { text?: unknown; output_text?: unknown } | undefined)?.output_text) ||
      extractTextValue(data.output_text)
    );
  }

  // Responses API streaming event shape.
  if (isResponseOutputTextDelta(responseType) && typeof data.delta === "string" && data.delta) {
    return data.delta;
  }

  // Fallback for any adapter that emits output_text directly.
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  return null;
}

export function readSseEventMeta(payload: unknown): {
  eventType: string | null;
  responseType: string | null;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  itemType: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return {
      eventType: null,
      responseType: null,
      threadId: null,
      turnId: null,
      itemId: null,
      itemType: null,
    };
  }

  const data = payload as {
    event?: unknown;
    type?: unknown;
    thread_id?: unknown;
    turn_id?: unknown;
    item_id?: unknown;
    item_type?: unknown;
    item?: unknown;
  };
  const responseType =
    typeof data.type === "string" && data.type.startsWith("response.") ? data.type : null;
  const eventType =
    typeof data.event === "string"
      ? data.event
      : responseType ||
          (typeof data.type === "string"
            ? data.type
            : null);

  const threadId = typeof data.thread_id === "string" ? data.thread_id : null;
  const turnId = typeof data.turn_id === "string" ? data.turn_id : null;

  const itemId =
    typeof data.item_id === "string"
      ? data.item_id
      : typeof (data.item as { id?: unknown } | undefined)?.id === "string"
        ? ((data.item as { id?: unknown } | undefined)?.id as string)
        : null;

  const itemType =
    typeof data.item_type === "string"
      ? data.item_type
      : typeof (data.item as { type?: unknown } | undefined)?.type === "string"
        ? ((data.item as { type?: unknown } | undefined)?.type as string)
        : null;

  return { eventType, responseType, threadId, turnId, itemId, itemType };
}


export async function streamEnhance({
  prompt,
  onDelta,
  onDone,
  onError,
  onEvent,
}: {
  prompt: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onEvent?: (event: {
    eventType: string | null;
    responseType: string | null;
    threadId: string | null;
    turnId: string | null;
    itemId: string | null;
    itemType: string | null;
    payload: unknown;
  }) => void;
}) {
  try {
    const requestEnhance = (headers: Record<string, string>) =>
      fetch(functionUrl("enhance-prompt"), {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt }),
      });

    let headers = await functionHeaders();
    let resp = await requestEnhance(headers);

    if (!resp.ok) {
      let errorMessage = await readFunctionError(resp);

      if (resp.status === 401 || isInvalidSupabaseSessionError(resp.status, errorMessage)) {
        headers = await functionHeaders({ forceRefresh: true, allowSessionToken: false });
        resp = await requestEnhance(headers);
        if (!resp.ok) {
          errorMessage = await readFunctionError(resp);
          onError(errorMessage);
          return;
        }
      } else {
        onError(errorMessage);
        return;
      }
    }

    if (!resp.body) {
      onError("No response body");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let terminalError: string | null = null;
    const deltaItemIds = new Set<string>();

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const parsedError = extractSseError(parsed);
          if (parsedError) {
            terminalError = parsedError;
            streamDone = true;
            break;
          }

          const meta = readSseEventMeta(parsed);
          onEvent?.({ ...meta, payload: parsed });

          if (isItemDeltaEventType(meta.eventType) || isResponseOutputTextDelta(meta.responseType)) {
            if (meta.itemId) deltaItemIds.add(meta.itemId);
          }
          if (
            (isItemCompletedEventType(meta.eventType) || isResponseOutputTextDone(meta.responseType)) &&
            meta.itemId &&
            deltaItemIds.has(meta.itemId)
          ) {
            continue;
          }

          if (!shouldEmitSseText(meta)) {
            continue;
          }

          const content = extractSseText(parsed);
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (terminalError) {
      onError(terminalError);
      return;
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const parsedError = extractSseError(parsed);
          if (parsedError) {
            terminalError = parsedError;
            break;
          }

          const meta = readSseEventMeta(parsed);
          onEvent?.({ ...meta, payload: parsed });

          if (isItemDeltaEventType(meta.eventType) || isResponseOutputTextDelta(meta.responseType)) {
            if (meta.itemId) deltaItemIds.add(meta.itemId);
          }
          if (
            (isItemCompletedEventType(meta.eventType) || isResponseOutputTextDone(meta.responseType)) &&
            meta.itemId &&
            deltaItemIds.has(meta.itemId)
          ) {
            continue;
          }

          if (!shouldEmitSseText(meta)) {
            continue;
          }

          const content = extractSseText(parsed);
          if (content) onDelta(content);
        } catch {
          /* ignore */
        }
      }
    }

    if (terminalError) {
      onError(terminalError);
      return;
    }

    onDone();
  } catch (e) {
    console.error("Stream error:", e);
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}

export async function extractUrl(url: string): Promise<{ title: string; content: string }> {
  const headers = await functionHeaders();
  const resp = await fetch(functionUrl("extract-url"), {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: "Extraction failed" }));
    throw new Error(errorData.error || `Error: ${resp.status}`);
  }

  return resp.json();
}
