import { describe, expect, it } from "vitest";
import { extractSseText, readSseEventMeta } from "@/lib/ai-client";

describe("ai-client SSE helpers", () => {
  it("extracts Codex-style item delta text from event envelopes", () => {
    expect(
      extractSseText({
        event: "item/agent_message/delta",
        item_id: "item_1",
        delta: "hello",
      }),
    ).toBe("hello");

    expect(
      extractSseText({
        event: "item/agent_message/delta",
        item: { delta: { text: "world" } },
      }),
    ).toBe("world");

    expect(
      extractSseText({
        event: "item/reasoning/delta",
        type: "response.reasoning_summary_text.delta",
        item_id: "item_reasoning_1",
        item_type: "reasoning",
        delta: "step one",
      }),
    ).toBe("step one");
  });

  it("extracts completed text from payload objects", () => {
    expect(
      extractSseText({
        event: "item/completed",
        item_id: "item_2",
        payload: { text: "final text" },
      }),
    ).toBe("final text");

    expect(
      extractSseText({
        event: "item/completed",
        payload: { output_text: "output text" },
      }),
    ).toBe("output text");
  });

  it("keeps legacy Responses API compatibility", () => {
    expect(
      extractSseText({
        type: "response.output_text.delta",
        delta: "legacy delta",
      }),
    ).toBe("legacy delta");

    expect(
      extractSseText({
        type: "response.output_text.done",
        item_id: "item_done_1",
        text: "done text",
      }),
    ).toBe("done text");

    expect(
      extractSseText({
        choices: [{ delta: { content: "chat delta" } }],
      }),
    ).toBe("chat delta");
  });

  it("reads event metadata for thread/turn/item", () => {
    expect(readSseEventMeta({})).toEqual({
      eventType: null,
      responseType: null,
      threadId: null,
      turnId: null,
      itemId: null,
      itemType: null,
    });

    expect(
      readSseEventMeta({
        event: "item/agent_message/delta",
        type: "response.output_text.delta",
        thread_id: "thread_1",
        turn_id: "turn_1",
        item_id: "item_meta_1",
      }),
    ).toEqual({
      eventType: "item/agent_message/delta",
      responseType: "response.output_text.delta",
      threadId: "thread_1",
      turnId: "turn_1",
      itemId: "item_meta_1",
      itemType: null,
    });

    expect(
      readSseEventMeta({
        type: "response.output_text.done",
        thread_id: "thread_2",
        turn_id: "turn_2",
        item: { id: "item_meta_2", type: "agent_message" },
      }),
    ).toEqual({
      eventType: "response.output_text.done",
      responseType: "response.output_text.done",
      threadId: "thread_2",
      turnId: "turn_2",
      itemId: "item_meta_2",
      itemType: "agent_message",
    });

    expect(
      readSseEventMeta({
        event: "item/reasoning/delta",
        type: "response.reasoning_summary_text.delta",
        thread_id: "thread_3",
        turn_id: "turn_3",
        item_id: "item_meta_3",
        item_type: "reasoning",
      }),
    ).toEqual({
      eventType: "item/reasoning/delta",
      responseType: "response.reasoning_summary_text.delta",
      threadId: "thread_3",
      turnId: "turn_3",
      itemId: "item_meta_3",
      itemType: "reasoning",
    });
  });
});
