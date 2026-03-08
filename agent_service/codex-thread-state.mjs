function normalizeThreadId(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
}

export function readCodexThreadId(thread) {
    if (!thread || typeof thread !== "object") return null;
    return normalizeThreadId(thread.id);
}

export function resolveActiveCodexThreadId(activeThreadId, thread) {
    return normalizeThreadId(activeThreadId) || readCodexThreadId(thread);
}