export const PAYLOAD_TOO_LARGE_ERROR_CODE = "payload_too_large";

export function createPayloadTooLargeError(maxBytes, receivedBytes) {
  const message = Number.isFinite(receivedBytes) && receivedBytes > 0
    ? `Request body too large. Maximum ${maxBytes} bytes; received ${receivedBytes} bytes.`
    : `Request body too large. Maximum ${maxBytes} bytes.`;
  const error = new Error(message);
  error.code = PAYLOAD_TOO_LARGE_ERROR_CODE;
  error.statusCode = 413;
  error.maxBytes = maxBytes;
  if (Number.isFinite(receivedBytes) && receivedBytes >= 0) {
    error.receivedBytes = receivedBytes;
  }
  return error;
}

export function isPayloadTooLargeError(error) {
  if (!error || typeof error !== "object") return false;
  const candidate = error;
  return (
    candidate.code === PAYLOAD_TOO_LARGE_ERROR_CODE
    || candidate.statusCode === 413
    || candidate.status === 413
  );
}

function parseMaxBytes(maxBytes) {
  const parsed = Number.parseInt(String(maxBytes), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("maxBytes must be a positive integer.");
  }
  return parsed;
}

function parseContentLengthHeader(contentLengthHeader) {
  if (typeof contentLengthHeader !== "string") return null;
  const trimmed = contentLengthHeader.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function readBodyJsonWithLimit(req, options = {}) {
  const maxBytes = parseMaxBytes(options.maxBytes ?? 256 * 1024);

  return new Promise((resolve, reject) => {
    let settled = false;
    let receivedBytes = 0;
    const chunks = [];

    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("error", onError);
      req.removeListener("end", onEnd);
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const succeed = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onData = (chunk) => {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += chunkBuffer.length;
      if (receivedBytes > maxBytes) {
        req.resume();
        fail(createPayloadTooLargeError(maxBytes, receivedBytes));
        return;
      }
      chunks.push(chunkBuffer);
    };

    const onError = (error) => {
      fail(error);
    };

    const onEnd = () => {
      if (chunks.length === 0) {
        succeed({});
        return;
      }

      const body = Buffer.concat(chunks).toString("utf8").trim();
      if (!body) {
        succeed({});
        return;
      }

      try {
        succeed(JSON.parse(body));
      } catch (error) {
        fail(new Error("Invalid JSON body.", { cause: error }));
      }
    };

    const contentLengthHeader = Array.isArray(req.headers?.["content-length"])
      ? req.headers["content-length"][0]
      : req.headers?.["content-length"];
    const contentLength = parseContentLengthHeader(contentLengthHeader);
    if (contentLength !== null && contentLength > maxBytes) {
      req.resume();
      fail(createPayloadTooLargeError(maxBytes, contentLength));
      return;
    }

    req.on("data", onData);
    req.on("error", onError);
    req.on("end", onEnd);
  });
}
