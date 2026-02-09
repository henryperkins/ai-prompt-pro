import { describe, expect, it } from "vitest";
import { buildLineDiff } from "@/lib/text-diff";

describe("buildLineDiff", () => {
  it("returns only context lines for identical text", () => {
    const diff = buildLineDiff("a\nb\nc", "a\nb\nc");
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.lines.every((line) => line.type === "context")).toBe(true);
  });

  it("marks removed and added lines in git-like order", () => {
    const diff = buildLineDiff("role\ntask\nformat", "role\ntask updated\nformat\nnotes");
    expect(diff.removed).toBe(1);
    expect(diff.added).toBe(2);
    expect(diff.lines.map((line) => `${line.type}:${line.value}`)).toEqual([
      "context:role",
      "remove:task",
      "add:task updated",
      "context:format",
      "add:notes",
    ]);
  });

  it("handles empty before/after payloads", () => {
    const addOnly = buildLineDiff("", "new line");
    expect(addOnly.removed).toBe(0);
    expect(addOnly.added).toBe(1);

    const removeOnly = buildLineDiff("old line", "");
    expect(removeOnly.removed).toBe(1);
    expect(removeOnly.added).toBe(0);
  });
});
