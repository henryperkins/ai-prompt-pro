export interface CodexStreamEventMeta {
    eventType: string | null;
    responseType: string | null;
    threadId: string | null;
    turnId: string | null;
    itemId: string | null;
    itemType: string | null;
}

type CodexStreamEventLike = Pick<CodexStreamEventMeta, "eventType" | "responseType">;
type CodexOutputEventLike = Pick<CodexStreamEventMeta, "eventType" | "responseType" | "itemType">;
type TextPath = readonly string[];
type CodexTextExtractionOptions = {
    additionalObjectKeys?: readonly string[];
    includeDeltaContent?: boolean;
};

const RENDERABLE_OUTPUT_ITEM_TYPES = new Set([
    "agent_message",
    "assistant_message",
    "enhancement",
    "output_text",
    "text",
    "message",
]);

const REASONING_ITEM_TYPES = new Set([
    "reasoning",
    "reasoning_summary",
    "reasoning-summary",
    "reasoning.summary",
    "reasoningsummary",
]);

const REASONING_SEGMENT_PATTERN = /(^|[./_-])reasoning([./_-]|$)/;
const DEFAULT_TEXT_CONTENT_KEYS = ["content", "text", "output_text", "delta", "payload"] as const;
const REASONING_TEXT_CONTENT_KEYS = [
    ...DEFAULT_TEXT_CONTENT_KEYS,
    "summary",
    "reasoning_summary",
    "reasoningSummary",
    "parts",
] as const;

const DELTA_TEXT_PATHS = [
    ["delta"],
    ["item", "delta"],
    ["payload", "delta"],
    ["item"],
] as const satisfies readonly TextPath[];

const DIRECT_TEXT_PATHS = [
    ["text"],
    ["output_text"],
    ["content"],
    ["payload", "text"],
    ["payload", "output_text"],
    ["payload", "content"],
    ["item", "text"],
    ["item", "output_text"],
    ["item", "content"],
    ["item"],
] as const satisfies readonly TextPath[];

const REASONING_TEXT_PATHS = [
    ["reasoning_summary"],
    ["reasoningSummary"],
    ["summary"],
    ["payload", "reasoning_summary"],
    ["payload", "reasoningSummary"],
    ["payload", "summary"],
    ["item", "reasoning_summary"],
    ["item", "reasoningSummary"],
    ["item", "summary"],
    ["text"],
    ["output_text"],
    ["content"],
    ["payload", "text"],
    ["payload", "output_text"],
    ["payload", "content"],
    ["item", "text"],
    ["item", "output_text"],
    ["item", "content"],
    ["item"],
] as const satisfies readonly TextPath[];

export function normalizeCodexToken(value: string | null | undefined): string {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function hasCodexReasoningSegment(value: string | null | undefined): boolean {
    const normalized = normalizeCodexToken(value);
    if (!normalized) return false;
    return REASONING_SEGMENT_PATTERN.test(normalized);
}

export function isCodexReasoningItemType(value: string | null | undefined): boolean {
    const normalized = normalizeCodexToken(value);
    if (!normalized) return false;
    return REASONING_ITEM_TYPES.has(normalized) || hasCodexReasoningSegment(normalized);
}

export function isCodexItemDeltaEventType(eventType: string | null | undefined): boolean {
    const normalized = normalizeCodexToken(eventType);
    if (!normalized) return false;
    if (normalized === "item.updated") return true;
    if (normalized === "item/delta" || normalized === "item.delta") return true;
    if (/^item\/[^/]+\/delta$/.test(normalized)) return true;
    if (/^item\.[^.]+\.delta$/.test(normalized)) return true;
    return false;
}

export function isCodexItemCompletedEventType(eventType: string | null | undefined): boolean {
    const normalized = normalizeCodexToken(eventType);
    if (!normalized) return false;
    if (normalized === "item/completed" || normalized === "item.completed") return true;
    if (/^item\/[^/]+\/completed$/.test(normalized)) return true;
    if (/^item\.[^.]+\.completed$/.test(normalized)) return true;
    return false;
}

export function isCodexResponseOutputTextDelta(responseType: string | null | undefined): boolean {
    return normalizeCodexToken(responseType) === "response.output_text.delta";
}

export function isCodexResponseOutputTextDone(responseType: string | null | undefined): boolean {
    return normalizeCodexToken(responseType) === "response.output_text.done";
}

export function isCodexOutputDeltaEvent(meta: CodexStreamEventLike): boolean {
    return isCodexResponseOutputTextDelta(meta.responseType) || isCodexItemDeltaEventType(meta.eventType);
}

export function isCodexOutputDoneEvent(meta: CodexStreamEventLike): boolean {
    return isCodexResponseOutputTextDone(meta.responseType) || isCodexItemCompletedEventType(meta.eventType);
}

export function isRenderableCodexOutputItemType(itemType: string | null | undefined): boolean {
    const normalized = normalizeCodexToken(itemType);
    if (!normalized) return true;
    return RENDERABLE_OUTPUT_ITEM_TYPES.has(normalized);
}

export function shouldEmitCodexOutputText(meta: CodexOutputEventLike): boolean {
    if (isCodexResponseOutputTextDelta(meta.responseType) || isCodexResponseOutputTextDone(meta.responseType)) {
        return true;
    }

    if (isCodexItemDeltaEventType(meta.eventType) || isCodexItemCompletedEventType(meta.eventType)) {
        return isRenderableCodexOutputItemType(meta.itemType);
    }

    return true;
}

export function readCodexEventMeta(payload: unknown): CodexStreamEventMeta {
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
            : responseType || (typeof data.type === "string" ? data.type : null);

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

export function extractCodexTextValue(
    value: unknown,
    options: { includeDeltaContent?: boolean } = {},
): string | null {
    if (typeof value === "string" && value) return value;
    if (!value || typeof value !== "object") return null;

    const obj = value as {
        text?: unknown;
        content?: unknown;
        output_text?: unknown;
        delta?: unknown;
    };

    if (typeof obj.text === "string" && obj.text) return obj.text;
    if (typeof obj.content === "string" && obj.content) return obj.content;
    if (typeof obj.output_text === "string" && obj.output_text) return obj.output_text;
    if (options.includeDeltaContent !== false && typeof obj.delta === "string" && obj.delta) return obj.delta;
    return null;
}

export function extractCodexTextFromContent(
    value: unknown,
    options: CodexTextExtractionOptions = {},
): string | null {
    if (typeof value === "string" && value) return value;
    if (!value) return null;

    if (Array.isArray(value)) {
        const parts = value
            .map((entry) => extractCodexTextFromContent(entry, options))
            .filter((entry): entry is string => Boolean(entry));
        return parts.length > 0 ? parts.join("") : null;
    }

    if (typeof value !== "object") return null;

    const obj = value as Record<string, unknown>;
    const directText = extractCodexTextValue(obj, {
        includeDeltaContent: options.includeDeltaContent,
    });
    if (directText) return directText;

    const contentKeys = [...DEFAULT_TEXT_CONTENT_KEYS, ...(options.additionalObjectKeys ?? [])]
        .filter((key) => options.includeDeltaContent !== false || key !== "delta");
    for (const key of contentKeys) {
        const nested = extractCodexTextFromContent(obj[key], options);
        if (nested) return nested;
    }

    return null;
}

function readPathValue(source: unknown, path: TextPath): unknown {
    let current = source;
    for (const segment of path) {
        if (!current || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[segment];
    }
    return current;
}

function extractTextAtPaths(
    source: unknown,
    paths: readonly TextPath[],
    options: CodexTextExtractionOptions = {},
): string | null {
    for (const path of paths) {
        const value = readPathValue(source, path);
        const text = extractCodexTextValue(value, {
            includeDeltaContent: options.includeDeltaContent,
        }) || extractCodexTextFromContent(value, options);
        if (text) return text;
    }

    return null;
}

export function extractCodexDeltaText(payload: unknown): string | null {
    return extractTextAtPaths(payload, DELTA_TEXT_PATHS);
}

export function extractCodexDirectText(payload: unknown): string | null {
    return extractTextAtPaths(payload, DIRECT_TEXT_PATHS, {
        includeDeltaContent: false,
    });
}

export function extractCodexReasoningText(payload: unknown): string | null {
    return extractTextAtPaths(payload, REASONING_TEXT_PATHS, {
        additionalObjectKeys: REASONING_TEXT_CONTENT_KEYS,
    });
}

export function extractCodexStreamText(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;

    const data = payload as {
        choices?: Array<{ delta?: { content?: unknown } }>;
    };
    const chatCompletionsDelta = data.choices?.[0]?.delta?.content;
    if (typeof chatCompletionsDelta === "string" && chatCompletionsDelta) {
        return chatCompletionsDelta;
    }

    const meta = readCodexEventMeta(payload);
    if (isCodexOutputDeltaEvent(meta)) {
        return extractCodexDeltaText(payload);
    }

    if (isCodexOutputDoneEvent(meta)) {
        return extractCodexDirectText(payload);
    }

    return extractCodexDirectText(payload);
}

export function hasCodexSessionProgress(meta: CodexStreamEventLike): boolean {
    const eventType = normalizeCodexToken(meta.eventType);
    const responseType = normalizeCodexToken(meta.responseType);

    if (
        eventType === "thread.started"
        || eventType === "turn.started"
        || eventType === "item.started"
        || eventType === "item.updated"
        || eventType === "item.completed"
    ) {
        return true;
    }

    return responseType.startsWith("response.output") || responseType.startsWith("response.reasoning");
}
