import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNewPostsIndicator } from "@/hooks/useNewPostsIndicator";

const mocks = vi.hoisted(() => ({
  loadFeed: vi.fn(),
}));

vi.mock("@/lib/community", () => ({
  loadFeed: (...args: unknown[]) => mocks.loadFeed(...args),
}));

function post(createdAt: number) {
  return { createdAt };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useNewPostsIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("polls with a single feed request and reports unseen posts", async () => {
    mocks.loadFeed
      .mockResolvedValueOnce([post(100)])
      .mockResolvedValueOnce([
        post(200),
        post(150),
      ]);

    const { result, unmount } = renderHook(() => useNewPostsIndicator({ enabled: true, intervalMs: 60_000 }));

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalledTimes(1);
    });
    expect(mocks.loadFeed).toHaveBeenCalledWith({ sort: "new", page: 0, limit: 20 });

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalledTimes(1);
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.newCount).toBe(2);
    });

    expect(mocks.loadFeed).toHaveBeenCalledWith({ sort: "new", page: 0, limit: 20 });
    expect(mocks.loadFeed).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("advances the seen baseline when dismissed", async () => {
    mocks.loadFeed
      .mockResolvedValueOnce([post(100)])
      .mockResolvedValueOnce([post(300)])
      .mockResolvedValueOnce([post(300)]);

    const { result, unmount } = renderHook(() => useNewPostsIndicator({ enabled: true, intervalMs: 60_000 }));

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalledTimes(1);
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.newCount).toBe(1);
    });

    act(() => {
      result.current.dismiss();
    });

    await waitFor(() => {
      expect(result.current.newCount).toBe(0);
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalledTimes(3);
    });

    expect(result.current.newCount).toBe(0);
    unmount();
  });

  it("does not restore a stale count after dismiss during an in-flight poll", async () => {
    const deferred = createDeferred<Array<{ createdAt: number }>>();

    mocks.loadFeed
      .mockResolvedValueOnce([post(100)])
      .mockReturnValueOnce(deferred.promise);

    const { result, unmount } = renderHook(() => useNewPostsIndicator({ enabled: true, intervalMs: 60_000 }));

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalledTimes(1);
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalledTimes(2);
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.newCount).toBe(0);

    await act(async () => {
      deferred.resolve([post(200), post(150)]);
      await deferred.promise;
    });

    await waitFor(() => {
      expect(result.current.newCount).toBe(0);
    });

    unmount();
  });
});
