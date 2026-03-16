import { describe, expect, it } from "vitest";

import { buildEnhanceSuccessfulTerminalEvents } from "../../agent_service/enhance-stream-contract.mjs";

describe("enhance stream terminal contract", () => {
  it("emits metadata before response.completed and synthesizes a final agent item when needed", () => {
    const events = buildEnhanceSuccessfulTerminalEvents({
      turnId: "turn_123",
      threadId: "thread_123",
      usage: { input_tokens: 12, output_tokens: 34 },
      payload: { enhanced_prompt: "Final enhanced prompt." },
      requestWarnings: ["web search disabled"],
      session: {
        thread_id: "thread_123",
        turn_id: "turn_123",
        status: "completed",
        context_summary: "Carry forward the approved context.",
        latest_enhanced_prompt: "Final enhanced prompt.",
      },
      emittedAgentOutput: false,
      finalEnhancedPrompt: "Final enhanced prompt.",
      syntheticItemId: "item_final_1",
    });

    expect(events.map((event) => event.event)).toEqual([
      "item.completed",
      "enhance/metadata",
      "turn.completed",
    ]);
    expect(events[1]).toMatchObject({
      event: "enhance/metadata",
      type: "enhance.metadata",
      request_warnings: ["web search disabled"],
      session: {
        latest_enhanced_prompt: "Final enhanced prompt.",
      },
    });
    expect(events[2]).toMatchObject({
      event: "turn.completed",
      type: "response.completed",
      usage: { input_tokens: 12, output_tokens: 34 },
      session: {
        context_summary: "Carry forward the approved context.",
      },
    });
  });

  it("does not duplicate the final item when agent output was already streamed", () => {
    const events = buildEnhanceSuccessfulTerminalEvents({
      turnId: "turn_456",
      threadId: "thread_456",
      usage: undefined,
      payload: { enhanced_prompt: "Already streamed prompt." },
      requestWarnings: [],
      session: {
        thread_id: "thread_456",
        turn_id: "turn_456",
        status: "completed",
      },
      emittedAgentOutput: true,
      finalEnhancedPrompt: "Already streamed prompt.",
    });

    expect(events.map((event) => event.event)).toEqual([
      "enhance/metadata",
      "turn.completed",
    ]);
  });
});
