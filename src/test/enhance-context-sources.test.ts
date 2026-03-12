import { describe, expect, it } from "vitest";
import {
  buildEnhanceContextSources,
  MAX_ENHANCE_CONTEXT_SOURCE_RAW_CHARS,
  MAX_ENHANCE_CONTEXT_SOURCE_TOTAL_RAW_CHARS,
} from "@/lib/enhance-context-sources";

describe("buildEnhanceContextSources", () => {
  it("keeps summaries for all sources and caps expandable raw content", () => {
    const rawA = "A".repeat(MAX_ENHANCE_CONTEXT_SOURCE_RAW_CHARS + 500);
    const rawB = "B".repeat(MAX_ENHANCE_CONTEXT_SOURCE_TOTAL_RAW_CHARS);

    const result = buildEnhanceContextSources([
      {
        id: "one",
        type: "file",
        title: "alpha.md",
        rawContent: rawA,
        summary: "Alpha summary",
        addedAt: Date.now(),
      },
      {
        id: "two",
        type: "text",
        title: "Beta",
        rawContent: rawB,
        summary: "Beta summary",
        addedAt: Date.now(),
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "one",
      title: "alpha.md",
      summary: "Alpha summary",
      expandable: true,
      rawContentTruncated: true,
    });
    expect(result[0].rawContent.length).toBeLessThanOrEqual(
      MAX_ENHANCE_CONTEXT_SOURCE_RAW_CHARS,
    );
    expect(result[1].summary).toBe("Beta summary");
    expect(result[0].rawContent.length + result[1].rawContent.length).toBeLessThanOrEqual(
      MAX_ENHANCE_CONTEXT_SOURCE_TOTAL_RAW_CHARS,
    );
  });

  it("drops sources that have neither summary nor raw content", () => {
    const result = buildEnhanceContextSources([
      {
        id: "empty",
        type: "text",
        title: "Empty",
        rawContent: "   ",
        summary: "",
        addedAt: Date.now(),
      },
    ]);

    expect(result).toEqual([]);
  });
});
