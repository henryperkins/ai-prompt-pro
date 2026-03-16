import { describe, expect, it } from "vitest";
import {
  advanceCodexSessionFromEvent,
  beginCodexSession,
  completeCodexSession,
  createCodexSession,
  toCodexSessionRequest,
} from "@/lib/codex-session";

describe("codex-session", () => {
  it("serializes only the carry-forward session fields", () => {
    expect(toCodexSessionRequest(createCodexSession())).toBeUndefined();

    expect(
      toCodexSessionRequest(createCodexSession({
        threadId: "thread_123",
        contextSummary: "Use a direct, B2B-friendly tone.",
        latestEnhancedPrompt: "You are a PMM writing launch copy.",
      })),
    ).toEqual({
      thread_id: "thread_123",
      context_summary: "Use a direct, B2B-friendly tone.",
      latest_enhanced_prompt: "You are a PMM writing launch copy.",
    });
  });

  it("advances session state from streamed event envelopes", () => {
    const started = beginCodexSession(createCodexSession({
      contextSummary: "Keep the approved product context.",
      latestEnhancedPrompt: "Manual carry-forward prompt.",
    }), {
      transport: "sse",
    });

    const streaming = advanceCodexSessionFromEvent(started, {
      eventType: "turn.started",
      responseType: "response.created",
      threadId: "thread_456",
      turnId: "turn_456",
      itemId: null,
      itemType: null,
      payload: {
        event: "turn.started",
        type: "response.created",
        thread_id: "thread_456",
        turn_id: "turn_456",
      },
      transport: "sse",
    });

    expect(streaming).toMatchObject({
      threadId: "thread_456",
      turnId: "turn_456",
      status: "streaming",
      transport: "sse",
    });

    const completed = advanceCodexSessionFromEvent(streaming, {
      eventType: "enhance/metadata",
      responseType: "enhance.metadata",
      threadId: "thread_456",
      turnId: "turn_456",
      itemId: null,
      itemType: null,
      payload: {
        event: "enhance/metadata",
        type: "enhance.metadata",
        session: {
          thread_id: "thread_456",
          turn_id: "turn_456",
          status: "completed",
          context_summary: "Carry forward the product, audience, and tone constraints.",
          latest_enhanced_prompt: "Final enhanced prompt.",
        },
      },
      transport: "sse",
    });

    expect(completeCodexSession(completed)).toMatchObject({
      threadId: "thread_456",
      turnId: "turn_456",
      status: "completed",
      contextSummary: "Keep the approved product context.",
      latestEnhancedPrompt: "Manual carry-forward prompt.",
      lastRunContextSummary: "Carry forward the product, audience, and tone constraints.",
      lastRunEnhancedPrompt: "Final enhanced prompt.",
    });
    expect(completed.eventCount).toBe(2);
  });
});
