const RETRY_SAFE_PRELUDE_EVENT_TYPES = new Set(["thread.started", "turn.started"]);

export function isRetrySafeCodexPreludeEvent(event) {
    if (!event || typeof event !== "object") return false;
    return RETRY_SAFE_PRELUDE_EVENT_TYPES.has(event.type);
}

export function hasOnlyRetrySafeCodexPreludeEvents(events) {
    if (!Array.isArray(events)) return false;
    return events.every((event) => isRetrySafeCodexPreludeEvent(event));
}