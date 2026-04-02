function normalizeThreadId(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function normalizeErrorToken(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase().replace(/[/.\s-]+/g, "_");
}

function readErrorStatus(error) {
    const status = error?.status
        ?? error?.statusCode
        ?? error?.response?.status
        ?? error?.cause?.status
        ?? error?.cause?.statusCode
        ?? error?.cause?.response?.status;
    if (typeof status === "number" && Number.isFinite(status)) return status;
    if (typeof status === "string" && status.trim()) {
        const parsed = Number(status);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function readErrorMessage(error) {
    if (error instanceof Error && typeof error.message === "string") {
        return error.message.trim();
    }
    if (typeof error?.message === "string") {
        return error.message.trim();
    }
    if (typeof error?.cause?.message === "string") {
        return error.cause.message.trim();
    }
    return "";
}

export function readCodexThreadId(thread) {
    if (!thread || typeof thread !== "object") return null;
    return normalizeThreadId(thread.id);
}

export function resolveActiveCodexThreadId(activeThreadId, thread) {
    return normalizeThreadId(activeThreadId) || readCodexThreadId(thread);
}

export function isInvalidResumeThreadError(error) {
    if (!error || typeof error !== "object") return false;

    const errorCode = normalizeErrorToken(
        error?.code ?? error?.error_code ?? error?.cause?.code,
    );
    if (
        errorCode.includes("thread_not_found")
        || errorCode.includes("unknown_thread")
        || errorCode.includes("invalid_thread")
        || errorCode.includes("no_such_thread")
    ) {
        return true;
    }

    const status = readErrorStatus(error);
    const message = readErrorMessage(error);
    if (!/thread/i.test(message)) {
        return false;
    }

    if (status === 404) {
        return true;
    }

    return /(not found|does not exist|no such|unknown|invalid|expired|missing)/i.test(message);
}
