import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "@/lib/clipboard";

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const originalExecCommandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");

function setClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

function mockExecCommand(result: boolean) {
  const execCommand = vi.fn(() => result);
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: execCommand,
  });
  return execCommand;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";

  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }

  if (originalExecCommandDescriptor) {
    Object.defineProperty(document, "execCommand", originalExecCommandDescriptor);
  } else {
    Reflect.deleteProperty(document, "execCommand");
  }
});

describe("copyTextToClipboard", () => {
  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    const execCommand = mockExecCommand(true);

    await copyTextToClipboard("hello");

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to execCommand when clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    setClipboard(writeText);
    const execCommand = mockExecCommand(true);

    await copyTextToClipboard("fallback text");

    expect(writeText).toHaveBeenCalledWith("fallback text");
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("uses fallback when clipboard API is unavailable", async () => {
    setClipboard();
    const execCommand = mockExecCommand(true);

    await copyTextToClipboard("legacy path");

    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("throws when both clipboard and fallback copy fail", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
    setClipboard(writeText);
    const execCommand = mockExecCommand(false);

    await expect(copyTextToClipboard("fail")).rejects.toThrow("Clipboard access is blocked.");

    expect(execCommand).toHaveBeenCalledWith("copy");
  });
});
