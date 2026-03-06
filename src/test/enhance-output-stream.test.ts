import { describe, expect, it } from "vitest";
import {
  applyEnhanceOutputEvent,
  createEnhanceOutputStreamState,
} from "@/lib/enhance-output-stream";

describe("enhance output stream state", () => {
  it("handles raw item.updated and item.completed agent_message events", () => {
    const state = createEnhanceOutputStreamState();

    expect(applyEnhanceOutputEvent(state, {
      eventType: "item.updated",
      responseType: "item.updated",
      itemId: "item_raw_1",
      itemType: "agent_message",
    }, {
      event: "item.updated",
      type: "item.updated",
      item: { id: "item_raw_1", type: "agent_message", text: "foo" },
    })).toEqual({
      didHandle: true,
      text: "foo",
    });

    expect(applyEnhanceOutputEvent(state, {
      eventType: "item.updated",
      responseType: "item.updated",
      itemId: "item_raw_1",
      itemType: "agent_message",
    }, {
      event: "item.updated",
      type: "item.updated",
      item: { id: "item_raw_1", type: "agent_message", text: "foobar" },
    })).toEqual({
      didHandle: true,
      text: "foobar",
    });

    expect(applyEnhanceOutputEvent(state, {
      eventType: "item.completed",
      responseType: "item.completed",
      itemId: "item_raw_1",
      itemType: "agent_message",
    }, {
      event: "item.completed",
      type: "item.completed",
      item: { id: "item_raw_1", type: "agent_message", text: "foobar" },
    })).toEqual({
      didHandle: true,
      text: "foobar",
    });
  });

  it("replaces prior partial text when a completed item rewrites the output", () => {
    const state = createEnhanceOutputStreamState();

    expect(applyEnhanceOutputEvent(state, {
      eventType: "item/agent_message/delta",
      responseType: "response.output_text.delta",
      itemId: "item_1",
      itemType: "agent_message",
    }, {
      event: "item/agent_message/delta",
      type: "response.output_text.delta",
      item_id: "item_1",
      item_type: "agent_message",
      delta: "foo",
      item: { id: "item_1", type: "agent_message", text: "foo" },
    })).toEqual({
      didHandle: true,
      text: "foo",
    });

    expect(applyEnhanceOutputEvent(state, {
      eventType: "item/completed",
      responseType: "response.output_text.done",
      itemId: "item_1",
      itemType: "agent_message",
    }, {
      event: "item/completed",
      type: "response.output_text.done",
      item_id: "item_1",
      item_type: "agent_message",
      payload: { text: "bar" },
      item: { id: "item_1", type: "agent_message", text: "bar" },
    })).toEqual({
      didHandle: true,
      text: "bar",
    });
  });

  it("does not duplicate completed text after matching deltas", () => {
    const state = createEnhanceOutputStreamState();

    applyEnhanceOutputEvent(state, {
      eventType: "item/agent_message/delta",
      responseType: "response.output_text.delta",
      itemId: "item_1",
      itemType: "agent_message",
    }, {
      delta: "hello",
      item: { id: "item_1", type: "agent_message", text: "hello" },
    });

    expect(applyEnhanceOutputEvent(state, {
      eventType: "item/completed",
      responseType: "response.output_text.done",
      itemId: "item_1",
      itemType: "agent_message",
    }, {
      payload: { text: "hello" },
      item: { id: "item_1", type: "agent_message", text: "hello" },
    })).toEqual({
      didHandle: true,
      text: "hello",
    });
  });

  it("ignores reasoning items when building enhanced prompt output", () => {
    const state = createEnhanceOutputStreamState();

    expect(applyEnhanceOutputEvent(state, {
      eventType: "item/reasoning/delta",
      responseType: "response.reasoning_summary_text.delta",
      itemId: "item_reasoning_1",
      itemType: "reasoning",
    }, {
      delta: "thinking",
    })).toEqual({
      didHandle: false,
      text: "",
    });
  });

  it("appends delta-only item updates instead of replacing accumulated output", () => {
    const state = createEnhanceOutputStreamState();

    expect(applyEnhanceOutputEvent(state, {
      eventType: "item.updated",
      responseType: "item.updated",
      itemId: "item_raw_2",
      itemType: "agent_message",
    }, {
      event: "item.updated",
      type: "item.updated",
      item: { id: "item_raw_2", type: "agent_message", delta: "foo" },
    })).toEqual({
      didHandle: true,
      text: "foo",
    });

    expect(applyEnhanceOutputEvent(state, {
      eventType: "item.updated",
      responseType: "item.updated",
      itemId: "item_raw_2",
      itemType: "agent_message",
    }, {
      event: "item.updated",
      type: "item.updated",
      item: { id: "item_raw_2", type: "agent_message", delta: "bar" },
    })).toEqual({
      didHandle: true,
      text: "foobar",
    });
  });
});
