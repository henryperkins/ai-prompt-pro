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

describe("useNewPostsIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("polls using limit-based feed requests and reports unseen posts", async () => {
    mocks.loadFeed
      .mockResolvedValueOnce([post(100)])
      .mockResolvedValueOnce([post(200)])
      .mockResolvedValueOnce([
        post(200),
        post(150),
      ]);

    const { result, unmount } = renderHook(() => useNewPostsIndicator({ enabled: true, intervalMs: 60_000 }));

    await waitFor(() => {
      expect(mocks.loadFeed).toHaveBeenCalledTimes(1);
    });
    expect(mocks.loadFeed).toHaveBeenCalledWith({ sort: "new", page: 0, limit: 1 });

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
    unmount();
  });

  it("advances the seen baseline when dismissed", async () => {
    mocks.loadFeed
      .mockResolvedValueOnce([post(100)])
      .mockResolvedValueOnce([post(300)])
      .mockResolvedValueOnce([post(300)])
      .mockResolvedValue([post(300)]);

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
      expect(mocks.loadFeed.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    expect(result.current.newCount).toBe(0);
    unmount();
  });
});
