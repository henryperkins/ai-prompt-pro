type EnhanceStreamEvent = {
  eventType: string | null;
  responseType: string | null;
  itemId: string | null;
  itemType: string | null;
};

type EnhanceOutputStreamState = {
  itemOrder: string[];
  itemTextById: Record<string, string>;
};

type ApplyEnhanceOutputEventResult = {
  didHandle: boolean;
  text: string;
};

const OUTPUT_FALLBACK_ITEM_ID = "__enhance_output__";

function normalizeToken(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isOutputDeltaEvent(meta: EnhanceStreamEvent): boolean {
  const eventType = normalizeToken(meta.eventType);
  const responseType = normalizeToken(meta.responseType);
  return (
    responseType === "response.output_text.delta"
    || eventType === "item/agent_message/delta"
    || eventType === "item.delta"
    || eventType === "item/delta"
    || /^item\/[^/]+\/delta$/.test(eventType)
    || /^item\.[^.]+\.delta$/.test(eventType)
  );
}

function isOutputDoneEvent(meta: EnhanceStreamEvent): boolean {
  const eventType = normalizeToken(meta.eventType);
  const responseType = normalizeToken(meta.responseType);
  return (
    responseType === "response.output_text.done"
    || eventType === "item/completed"
    || eventType === "item.completed"
    || /^item\/[^/]+\/completed$/.test(eventType)
    || /^item\.[^.]+\.completed$/.test(eventType)
  );
}

function isRenderableOutputItemType(itemType: string | null | undefined): boolean {
  const normalized = normalizeToken(itemType);
  if (!normalized) return true;

  return (
    normalized === "agent_message"
    || normalized === "assistant_message"
    || normalized === "enhancement"
    || normalized === "output_text"
    || normalized === "text"
    || normalized === "message"
  );
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

function extractTextFromContent(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (!value) return null;
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => extractTextFromContent(entry))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? parts.join("") : null;
  }
  if (typeof value !== "object") return null;

  const obj = value as {
    content?: unknown;
    text?: unknown;
    output_text?: unknown;
    delta?: unknown;
    payload?: unknown;
  };

  return (
    extractTextValue(obj) ||
    extractTextFromContent(obj.content) ||
    extractTextFromContent(obj.text) ||
    extractTextFromContent(obj.output_text) ||
    extractTextFromContent(obj.payload)
  );
}

function extractDirectOutputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    text?: unknown;
    output_text?: unknown;
    content?: unknown;
    payload?: unknown;
    item?: unknown;
  };
  const item = (data.item ?? {}) as {
    text?: unknown;
    output_text?: unknown;
    content?: unknown;
  };

  return (
    extractTextValue(data.text) ||
    extractTextFromContent(data.text) ||
    extractTextValue(data.output_text) ||
    extractTextFromContent(data.output_text) ||
    extractTextValue(data.content) ||
    extractTextFromContent(data.content) ||
    extractTextValue((data.payload as { text?: unknown; output_text?: unknown } | undefined)?.text) ||
    extractTextFromContent((data.payload as { text?: unknown; output_text?: unknown } | undefined)?.text) ||
    extractTextValue((data.payload as { output_text?: unknown } | undefined)?.output_text) ||
    extractTextFromContent((data.payload as { output_text?: unknown } | undefined)?.output_text) ||
    extractTextValue(item.text) ||
    extractTextFromContent(item.text) ||
    extractTextValue(item.output_text) ||
    extractTextFromContent(item.output_text) ||
    extractTextValue(item.content) ||
    extractTextFromContent(item.content)
  );
}

function extractExplicitOutputDelta(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    delta?: unknown;
    payload?: unknown;
    item?: unknown;
  };
  const item = (data.item ?? {}) as {
    delta?: unknown;
  };

  return (
    extractTextValue(data.delta) ||
    extractTextFromContent(data.delta) ||
    extractTextValue(item.delta) ||
    extractTextFromContent(item.delta) ||
    extractTextValue((data.payload as { delta?: unknown } | undefined)?.delta) ||
    extractTextFromContent((data.payload as { delta?: unknown } | undefined)?.delta)
  );
}

function computeNextOutputText(previousText: string, payload: unknown): string {
  const previous = typeof previousText === "string" ? previousText : "";
  const current = extractDirectOutputText(payload);
  const explicitDelta = extractExplicitOutputDelta(payload);

  if (current && current.startsWith(previous)) {
    return current;
  }

  if (current && current !== previous) {
    return current;
  }

  if (explicitDelta) {
    if (previous.endsWith(explicitDelta)) {
      return previous;
    }
    return `${previous}${explicitDelta}`;
  }

  return current || previous;
}

function joinOutputText(state: EnhanceOutputStreamState): string {
  return state.itemOrder.map((itemId) => state.itemTextById[itemId] || "").join("");
}

export function createEnhanceOutputStreamState(): EnhanceOutputStreamState {
  return {
    itemOrder: [],
    itemTextById: {},
  };
}

export function applyEnhanceOutputEvent(
  state: EnhanceOutputStreamState,
  meta: EnhanceStreamEvent,
  payload: unknown,
): ApplyEnhanceOutputEventResult {
  if (!isOutputDeltaEvent(meta) && !isOutputDoneEvent(meta)) {
    return { didHandle: false, text: joinOutputText(state) };
  }

  if (!isRenderableOutputItemType(meta.itemType)) {
    return { didHandle: false, text: joinOutputText(state) };
  }

  const itemId = meta.itemId || OUTPUT_FALLBACK_ITEM_ID;
  if (!state.itemOrder.includes(itemId)) {
    state.itemOrder.push(itemId);
  }

  const previousText = state.itemTextById[itemId] || "";
  const nextText = computeNextOutputText(previousText, payload);
  state.itemTextById[itemId] = nextText;

  return {
    didHandle: true,
    text: joinOutputText(state),
  };
}
