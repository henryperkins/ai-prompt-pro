export type CommunityErrorKind =
  | "network"
  | "auth"
  | "not_found"
  | "backend_unconfigured"
  | "unknown";

export interface CommunityErrorState {
  kind: CommunityErrorKind;
  message: string;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function classifyErrorKind(message: string): CommunityErrorKind {
  const normalized = message.toLowerCase();

  if (normalized.includes("backend is not configured")) {
    return "backend_unconfigured";
  }

  if (
    /network|failed to fetch|fetch failed|connection|timeout|offline|load failed/.test(normalized)
  ) {
    return "network";
  }

  if (
    /sign in required|authentication|not authenticated|unauthorized|forbidden|permission|row-level security|jwt/.test(
      normalized,
    )
  ) {
    return "auth";
  }

  if (/not found|unavailable|invalid or expired|invalid input|no post|404/.test(normalized)) {
    return "not_found";
  }

  return "unknown";
}

export function toCommunityErrorState(error: unknown, fallback: string): CommunityErrorState {
  const message = toErrorMessage(error, fallback);
  return {
    kind: classifyErrorKind(message),
    message,
  };
}
