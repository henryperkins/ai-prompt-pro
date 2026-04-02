import { describe, expect, it } from "vitest";
import {
    isInvalidResumeThreadError,
    readCodexThreadId,
    resolveActiveCodexThreadId,
} from "../../agent_service/codex-thread-state.mjs";

describe("codex thread state helpers", () => {
    it("reads the SDK thread id once it has been populated", () => {
        expect(readCodexThreadId({ id: "thread_retry_1" })).toBe("thread_retry_1");
    });

    it("recovers the active thread id from the SDK thread after retry-safe prelude loss", () => {
        expect(resolveActiveCodexThreadId(null, { id: "thread_retry_1" })).toBe("thread_retry_1");
    });

    it("prefers the already-active emitted thread id when present", () => {
        expect(resolveActiveCodexThreadId("thread_emitted_1", { id: "thread_retry_1" })).toBe("thread_emitted_1");
    });

    it("returns null when neither source has a usable thread id", () => {
        expect(resolveActiveCodexThreadId("   ", { id: "   " })).toBeNull();
        expect(resolveActiveCodexThreadId(null, null)).toBeNull();
    });

    it("detects stale resume-thread failures from status, code, and message hints", () => {
        expect(
            isInvalidResumeThreadError({
                status: 404,
                message: "Thread thread_123 was not found.",
            }),
        ).toBe(true);

        expect(
            isInvalidResumeThreadError({
                code: "thread_not_found",
                message: "Codex CLI failed: requested thread does not exist.",
            }),
        ).toBe(true);

        expect(
            isInvalidResumeThreadError({
                cause: {
                    code: "invalid_thread",
                    message: "Thread thread_456 is invalid or expired.",
                },
            }),
        ).toBe(true);
    });

    it("does not treat unrelated failures as stale resume-thread errors", () => {
        expect(
            isInvalidResumeThreadError({
                status: 401,
                message: "Invalid or expired auth session.",
            }),
        ).toBe(false);

        expect(
            isInvalidResumeThreadError({
                status: 429,
                message: "Rate limit exceeded.",
            }),
        ).toBe(false);
    });
});
