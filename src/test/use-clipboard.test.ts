import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClipboard } from "@/hooks/use-clipboard";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const isSecureContextDescriptor = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");

function restoreDescriptors() {
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  } else {
    delete (navigator as { clipboard?: unknown }).clipboard;
  }

  if (isSecureContextDescriptor) {
    Object.defineProperty(window, "isSecureContext", isSecureContextDescriptor);
  } else {
    delete (window as { isSecureContext?: unknown }).isSecureContext;
  }

  if (execCommandDescriptor) {
    Object.defineProperty(document, "execCommand", execCommandDescriptor);
  } else {
    delete (document as { execCommand?: unknown }).execCommand;
  }
}

describe("useClipboard", () => {
  afterEach(() => {
    vi.useRealTimers();
    restoreDescriptors();
  });

  it("preserves the copied id when the fallback clipboard path is used", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => true) });

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy("hello", "row-1");
    });

    expect(result.current.copied).toBe("row-1");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
  });
});
