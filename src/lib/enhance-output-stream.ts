import {
  extractCodexDeltaText,
  extractCodexDirectText,
  isCodexOutputDeltaEvent,
  isCodexOutputDoneEvent,
  isRenderableCodexOutputItemType,
  type CodexStreamEventMeta,
} from "@/lib/codex-stream";

type EnhanceStreamEvent = Pick<CodexStreamEventMeta, "eventType" | "responseType" | "itemId" | "itemType">;

type EnhanceOutputStreamState = {
  itemOrder: string[];
  itemTextById: Record<string, string>;
};

type ApplyEnhanceOutputEventResult = {
  didHandle: boolean;
  text: string;
};

const OUTPUT_FALLBACK_ITEM_ID = "__enhance_output__";

function computeNextOutputText(previousText: string, payload: unknown): string {
  const previous = typeof previousText === "string" ? previousText : "";
  const current = extractCodexDirectText(payload);
  const explicitDelta = extractCodexDeltaText(payload);

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
  if (!isCodexOutputDeltaEvent(meta) && !isCodexOutputDoneEvent(meta)) {
    return { didHandle: false, text: joinOutputText(state) };
  }

  if (!isRenderableCodexOutputItemType(meta.itemType)) {
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
