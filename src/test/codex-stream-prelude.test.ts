import { describe, expect, it } from "vitest";
import {
    hasOnlyRetrySafeCodexPreludeEvents,
    isRetrySafeCodexPreludeEvent,
} from "../../agent_service/codex-stream-prelude.mjs";

describe("codex stream retry prelude helpers", () => {
    it("treats SDK thread and turn start events as retry-safe prelude", () => {
        expect(isRetrySafeCodexPreludeEvent({ type: "thread.started" })).toBe(true);
        expect(isRetrySafeCodexPreludeEvent({ type: "turn.started" })).toBe(true);
    });

    it("blocks retry once streamed item or failure events appear", () => {
        expect(isRetrySafeCodexPreludeEvent({ type: "item.started" })).toBe(false);
        expect(isRetrySafeCodexPreludeEvent({ type: "item.updated" })).toBe(false);
        expect(isRetrySafeCodexPreludeEvent({ type: "turn.failed" })).toBe(false);
    });

    it("accepts only pure SDK prelude sequences", () => {
        expect(hasOnlyRetrySafeCodexPreludeEvents([])).toBe(true);
        expect(hasOnlyRetrySafeCodexPreludeEvents([
            { type: "thread.started" },
            { type: "turn.started" },
        ])).toBe(true);
        expect(hasOnlyRetrySafeCodexPreludeEvents([
            { type: "thread.started" },
            { type: "item.started" },
        ])).toBe(false);
    });
});