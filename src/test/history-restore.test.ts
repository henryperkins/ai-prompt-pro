import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeRestoredVersionPrompt, queueRestoredVersionPrompt } from "@/lib/history-restore";

describe("history-restore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("preserves exact prompt content on round-trip", () => {
    const prompt = "  Keep leading and trailing spaces  \n\nLine two.\n";

    expect(queueRestoredVersionPrompt(prompt)).toBe(true);
    expect(consumeRestoredVersionPrompt()).toBe(prompt);
  });

  it("consumes the queued prompt only once", () => {
    expect(queueRestoredVersionPrompt("Prompt A")).toBe(true);
    expect(consumeRestoredVersionPrompt()).toBe("Prompt A");
    expect(consumeRestoredVersionPrompt()).toBeNull();
  });

  it("returns false and stores nothing for empty prompts", () => {
    expect(queueRestoredVersionPrompt("")).toBe(false);
    expect(consumeRestoredVersionPrompt()).toBeNull();
  });

  it("returns false when localStorage set fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });

    expect(queueRestoredVersionPrompt("Will not persist")).toBe(false);
    expect(consumeRestoredVersionPrompt()).toBeNull();
  });
});
