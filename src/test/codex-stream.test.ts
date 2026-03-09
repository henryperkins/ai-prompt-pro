import { describe, expect, it } from "vitest";
import {
    extractCodexDirectText,
    extractCodexDeltaText,
    extractCodexReasoningText,
    hasCodexSessionProgress,
    readCodexEventMeta,
    shouldEmitCodexOutputText,
} from "@/lib/codex-stream";

describe("codex stream helpers", () => {
    it("reads thread/turn/item metadata from raw item envelopes", () => {
        expect(readCodexEventMeta({
            event: "item.updated",
            type: "item.updated",
            thread_id: "thread_1",
            turn_id: "turn_1",
            item: { id: "item_1", type: "agent_message" },
        })).toEqual({
            eventType: "item.updated",
            responseType: null,
            threadId: "thread_1",
            turnId: "turn_1",
            itemId: "item_1",
            itemType: "agent_message",
        });
    });

    it("extracts delta text from raw Codex item payloads", () => {
        expect(extractCodexDeltaText({
            event: "item.updated",
            type: "item.updated",
            item: {
                id: "item_1",
                type: "agent_message",
                delta: { content: [{ text: "hello" }] },
            },
        })).toBe("hello");
    });

    it("does not treat item.delta-only payloads as full output text", () => {
        expect(extractCodexDirectText({
            event: "item.updated",
            type: "item.updated",
            item: {
                id: "item_1",
                type: "agent_message",
                delta: "bar",
            },
        })).toBeNull();
    });

    it("extracts reasoning summaries from nested raw item content", () => {
        expect(extractCodexReasoningText({
            event: "item.completed",
            type: "item.completed",
            item: {
                id: "item_reasoning_1",
                type: "reasoning",
                content: [
                    { summary: [{ text: "Step 1. " }] },
                    { reasoningSummary: [{ text: "Step 2" }] },
                ],
            },
        })).toBe("Step 1. Step 2");
    });

    it("does not treat reasoning items as renderable output text", () => {
        expect(shouldEmitCodexOutputText({
            eventType: "item.updated",
            responseType: "item.updated",
            itemType: "reasoning",
        })).toBe(false);

        expect(shouldEmitCodexOutputText({
            eventType: "item.updated",
            responseType: "item.updated",
            itemType: "agent_message",
        })).toBe(true);
    });

    it("recognizes SDK lifecycle events as session progress without bare IDs", () => {
        expect(hasCodexSessionProgress({
            eventType: "thread.started",
            responseType: null,
        })).toBe(true);

        expect(hasCodexSessionProgress({
            eventType: "item.started",
            responseType: null,
        })).toBe(false);

        expect(hasCodexSessionProgress({
            eventType: "turn/error",
            responseType: "turn/error",
        })).toBe(false);
    });
});
