import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharePost } from "@/lib/community-share";

const mocks = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(),
}));

vi.mock("@/lib/clipboard", () => ({
  copyTextToClipboard: (...args: unknown[]) => mocks.copyTextToClipboard(...args),
}));

describe("sharePost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
      writable: true,
    });
  });

  it("uses native share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
      writable: true,
    });

    const result = await sharePost({ id: "post-1", title: "Prompt" }, "https://example.com");

    expect(result).toBe("native");
    expect(share).toHaveBeenCalledWith({
      title: "Prompt",
      url: "https://example.com/community/post-1",
    });
    expect(mocks.copyTextToClipboard).not.toHaveBeenCalled();
  });

  it("treats native share abort as a successful user cancellation", async () => {
    const abort = new Error("cancelled");
    abort.name = "AbortError";

    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(abort),
      writable: true,
    });

    const result = await sharePost({ id: "post-2", title: "Prompt" }, "https://example.com");

    expect(result).toBe("native");
    expect(mocks.copyTextToClipboard).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when native share fails", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("Not allowed")),
      writable: true,
    });
    mocks.copyTextToClipboard.mockResolvedValue(undefined);

    const result = await sharePost({ id: "post-3", title: "Prompt" }, "https://example.com");

    expect(result).toBe("clipboard");
    expect(mocks.copyTextToClipboard).toHaveBeenCalledWith("https://example.com/community/post-3");
  });

  it("returns failed when no share path works", async () => {
    mocks.copyTextToClipboard.mockRejectedValue(new Error("Clipboard unavailable"));

    const result = await sharePost({ id: "post-4", title: "Prompt" }, "https://example.com");

    expect(result).toBe("failed");
  });
});
