const CF_API_BASE_URL = import.meta.env.VITE_API_WORKER_URL || "http://localhost:8000";
const CF_TOKEN_KEY = "pf_tokens";

function getCfAccessToken(): string | null {
  try {
    const stored = localStorage.getItem(CF_TOKEN_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${CF_API_BASE_URL}${path}`;
  const token = getCfAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const msg = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
      ? (body as { error: string }).error
      : `Request failed (${response.status})`;
    throw new Error(msg);
  }
  return response.json() as Promise<T>;
}
import { assertBackendConfigured } from "@/lib/backend-config";
import { requireUserId } from "@/lib/require-user-id";
import { sanitizePostgresText } from "@/lib/saved-prompt-shared";

export type CommunityReportTargetType = "post" | "comment";

export interface CommunityReportInput {
  targetType: CommunityReportTargetType;
  postId?: string | null;
  commentId?: string | null;
  reportedUserId?: string | null;
  reason?: string;
  details?: string;
}

function normalizeReason(value?: string): string {
  const normalized = sanitizePostgresText(value || "").trim().slice(0, 80);
  return normalized || "other";
}

function normalizeDetails(value?: string): string {
  return sanitizePostgresText(value || "").trim().slice(0, 2000);
}

export async function loadBlockedUserIds(): Promise<string[]> {
  assertBackendConfigured("Community moderation");
  await requireUserId("Community moderation");
  return apiFetch<string[]>("/api/moderation/blocks");
}

export async function blockCommunityUser(blockedUserId: string, reason?: string): Promise<boolean> {
  const blockerId = await requireUserId("Community moderation");
  const targetId = blockedUserId.trim();

  if (!targetId) {
    throw new Error("Target user is required.");
  }
  if (targetId === blockerId) {
    throw new Error("You cannot block your own account.");
  }

  const result = await apiFetch<{ blocked: boolean }>(`/api/moderation/blocks/${targetId}`, {
    method: "PUT",
    body: JSON.stringify({
      reason: sanitizePostgresText(reason || "").trim().slice(0, 500),
    }),
  });

  return result.blocked;
}

export async function unblockCommunityUser(blockedUserId: string): Promise<boolean> {
  await requireUserId("Community moderation");
  const targetId = blockedUserId.trim();
  if (!targetId) return false;

  const result = await apiFetch<{ blocked: boolean }>(`/api/moderation/blocks/${targetId}`, {
    method: "DELETE",
  });

  return !result.blocked;
}

export async function submitCommunityReport(input: CommunityReportInput): Promise<string> {
  await requireUserId("Community moderation");

  if (input.targetType === "post" && !input.postId) {
    throw new Error("Post report is missing a post id.");
  }
  if (input.targetType === "comment" && !input.commentId) {
    throw new Error("Comment report is missing a comment id.");
  }

  const result = await apiFetch<{ id: string }>("/api/moderation/reports", {
    method: "POST",
    body: JSON.stringify({
      targetType: input.targetType,
      postId: input.postId?.trim() || null,
      commentId: input.commentId?.trim() || null,
      reportedUserId: input.reportedUserId?.trim() || null,
      reason: normalizeReason(input.reason),
      details: normalizeDetails(input.details),
    }),
  });

  return result.id;
}
