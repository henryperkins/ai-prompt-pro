import { describe, expect, it, vi } from "vitest";
import {
  isAbortLikeError,
  sleepWithSignal,
  throwIfAborted,
} from "../../agent_service/request-abort-utils.mjs";

describe("request abort utils", () => {
  it("identifies abort-like errors and disconnect messages", () => {
    const abortError = new Error("Request was aborted.");
    abortError.name = "AbortError";

    expect(isAbortLikeError(abortError)).toBe(true);
    expect(isAbortLikeError("Client disconnected")).toBe(true);
    expect(isAbortLikeError(new Error("Codex worker failed."))).toBe(false);
  });

  it("throws the signal reason when already aborted", () => {
    const controller = new AbortController();
    controller.abort("Client disconnected");

    expect(() => throwIfAborted(controller.signal)).toThrowError(/Client disconnected/);
  });

  it("rejects sleep when the signal aborts before the timer finishes", async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const pending = sleepWithSignal(1_000, controller.signal);
      const rejection = expect(pending).rejects.toThrow(/Client disconnected/);

      controller.abort("Client disconnected");
      await vi.runAllTimersAsync();

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
