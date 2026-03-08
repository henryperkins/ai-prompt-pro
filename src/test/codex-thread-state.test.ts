import { describe, expect, it } from "vitest";
import {
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
});