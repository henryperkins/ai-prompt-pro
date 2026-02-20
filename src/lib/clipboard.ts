function fallbackCopyText(text: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    return false;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "-9999px";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";

  document.body.appendChild(textArea);

  try {
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textArea.remove();
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to legacy copy path for iOS/webview contexts.
    }
  }

  if (fallbackCopyText(text)) {
    return;
  }

  throw new Error("Clipboard access is blocked.");
}
