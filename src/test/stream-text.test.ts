import { describe, expect, it } from "vitest";
import {
  computeStreamTextUpdate,
  extractItemDelta,
  extractItemText,
} from "../../agent_service/stream-text.mjs";

describe("stream-text helpers", () => {
  it("extracts text from multiple item fields", () => {
    expect(extractItemText({ text: "alpha" })).toBe("alpha");
    expect(extractItemText({ output_text: "beta" })).toBe("beta");
    expect(
      extractItemText({
        content: [
          { text: "gamma" },
          { content: " delta" },
        ],
      }),
    ).toBe("gamma delta");
  });

  it("extracts explicit delta values from item payloads", () => {
    expect(extractItemDelta({ delta: "next" })).toBe("next");
    expect(extractItemDelta({ payload: { delta: "tail" } })).toBe("tail");
  });

  it("computes delta from cumulative text updates", () => {
    expect(computeStreamTextUpdate("", { text: "hello" })).toEqual({
      nextText: "hello",
      delta: "hello",
    });
    expect(computeStreamTextUpdate("hel", { text: "hello" })).toEqual({
      nextText: "hello",
      delta: "lo",
    });
  });

  it("appends explicit deltas when full text is missing", () => {
    expect(computeStreamTextUpdate("hello", { delta: " world" })).toEqual({
      nextText: "hello world",
      delta: " world",
    });
  });

  it("avoids duplicate append when explicit delta is already present", () => {
    expect(computeStreamTextUpdate("hello world", { delta: " world" })).toEqual({
      nextText: "hello world",
      delta: "",
    });
  });

  it("handles non-prefix full text replacements", () => {
    expect(computeStreamTextUpdate("old value", { output_text: "new value" })).toEqual({
      nextText: "new value",
      delta: "new value",
    });
  });
});
