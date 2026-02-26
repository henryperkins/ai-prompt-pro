import { describe, expect, it, vi } from "vitest";
import { runGuardedAsync } from "../../agent_service/async-guard.mjs";

describe("runGuardedAsync", () => {
  it("forwards thrown errors to onError for async handlers", async () => {
    const onError = vi.fn();
    runGuardedAsync(async () => {
      throw new Error("boom");
    }, onError);

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0][0] as Error).message).toBe("boom");
  });

  it("does not call onError when handler succeeds", async () => {
    const onError = vi.fn();
    const onRun = vi.fn();

    runGuardedAsync(async () => {
      onRun();
    }, onError);

    await vi.waitFor(() => {
      expect(onRun).toHaveBeenCalledTimes(1);
    });

    expect(onError).not.toHaveBeenCalled();
  });
});
