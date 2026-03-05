function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeErrorCode(rawCode) {
  if (typeof rawCode !== "string" || !rawCode.trim()) return undefined;
  const normalized = rawCode.trim().toLowerCase().replace(/[/.\s-]/g, "_");
  if (normalized.includes("rate_limit") || normalized === "429") return "rate_limited";
  if (normalized.includes("timeout")) return "request_timeout";
  if (
    normalized === "auth_required"
    || normalized.includes("sign_in_required")
    || normalized.includes("missing_bearer")
    || normalized.includes("missing_token")
    || normalized.includes("unauthenticated")
  ) {
    return "auth_required";
  }
  if (normalized.includes("auth") || normalized.includes("session")) return "auth_session_invalid";
  if (normalized.includes("payload") || normalized.includes("too_large")) return "payload_too_large";
  if (normalized.includes("bad") || normalized.includes("invalid")) return "bad_response";
  if (normalized.includes("method")) return "method_not_allowed";
  if (normalized.includes("not_found")) return "not_found";
  if (normalized.includes("forbidden")) return "forbidden";
  if (normalized.includes("unavailable")) return "service_unavailable";
  if (normalized.includes("service")) return "service_error";
  return undefined;
}

export function isRateLimitMessage(message) {
  return /(^|\b)429(\b|$)|rate.limit|too many requests|throttl/i.test(String(message || ""));
}

export function statusFromErrorCode(errorCode) {
  switch (errorCode) {
    case "auth_required":
    case "auth_session_invalid":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "method_not_allowed":
      return 405;
    case "request_timeout":
      return 408;
    case "payload_too_large":
      return 413;
    case "rate_limited":
      return 429;
    case "bad_response":
      return 422;
    case "service_unavailable":
      return 503;
    case "service_error":
      return 500;
    default:
      return undefined;
  }
}

export function classifyStreamFailure(error, options = {}) {
  const defaultCode = options.defaultCode || "service_error";
  const defaultStatus = Number.isFinite(options.defaultStatus) ? options.defaultStatus : 500;

  const rawMessage =
    (error && typeof error === "object" && typeof error.message === "string" && error.message.trim())
      ? error.message.trim()
      : String(error || "Unexpected error from Codex service.");
  const message = rawMessage || "Unexpected error from Codex service.";
  const status = toFiniteNumber(
    error?.status
      ?? error?.statusCode
      ?? error?.response?.status
      ?? error?.cause?.status
      ?? error?.cause?.statusCode
      ?? error?.cause?.response?.status,
  );
  const normalizedCode = normalizeErrorCode(error?.code ?? error?.error_code ?? error?.cause?.code);

  if (normalizedCode) {
    return {
      message,
      code: normalizedCode,
      status: status ?? statusFromErrorCode(normalizedCode) ?? defaultStatus,
    };
  }

  if (isRateLimitMessage(message)) {
    return {
      message,
      code: "rate_limited",
      status: 429,
    };
  }

  return {
    message,
    code: defaultCode,
    status: status ?? defaultStatus,
  };
}

export function resolveRequestCompletionStatus({
  transportStatusCode,
  requestStatusCode,
  errorCode,
}) {
  const transportStatus = toFiniteNumber(transportStatusCode);
  const storedStatus = toFiniteNumber(requestStatusCode);
  const inferredStatus = statusFromErrorCode(errorCode);

  if (errorCode && storedStatus !== undefined && (transportStatus === undefined || transportStatus < 400)) {
    return storedStatus;
  }

  if (transportStatus !== undefined) return transportStatus;
  if (storedStatus !== undefined) return storedStatus;
  if (inferredStatus !== undefined) return inferredStatus;
  return 500;
}
