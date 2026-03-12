function normalizeAbortMessage(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function createAbortError(reason = "Request was aborted.") {
  if (reason instanceof Error) {
    return reason;
  }

  const error = new Error(normalizeAbortMessage(reason) || "Request was aborted.");
  error.name = "AbortError";
  return error;
}

export function abortErrorFromSignal(signal) {
  return createAbortError(signal?.reason);
}

export function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw abortErrorFromSignal(signal);
}

export function isAbortLikeError(error) {
  if (!error) return false;
  if (typeof error === "string") {
    return /(abort|cancel|client disconnected)/i.test(error);
  }

  const name = typeof error.name === "string" ? error.name.toLowerCase() : "";
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";

  return (
    name.includes("abort")
    || name.includes("cancel")
    || code === "request_aborted"
    || message.includes("request was aborted")
    || message.includes("request was cancelled")
    || message.includes("request was canceled")
    || message.includes("client disconnected")
  );
}

export function sleepWithSignal(ms, signal) {
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    let timer = null;

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(abortErrorFromSignal(signal));
    };

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
