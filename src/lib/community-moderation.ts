import { neon } from "@/integrations/neon/client";
import type { TablesInsert } from "@/integrations/neon/types";
import { assertBackendConfigured } from "@/lib/backend-config";
import { isPostgrestError, sanitizePostgresText } from "@/lib/saved-prompt-shared";

export type CommunityReportTargetType = "post" | "comment";

export interface CommunityReportInput {
  targetType: CommunityReportTargetType;
  postId?: string | null;
  commentId?: string | null;
  reportedUserId?: string | null;
  reason?: string;
  details?: string;
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (isPostgrestError(error)) {
    return new Error(error.message || fallback);
  }
  return new Error(fallback);
}

function normalizeReason(value?: string): string {
  const normalized = sanitizePostgresText(value || "").trim().slice(0, 80);
  return normalized || "other";
}

function normalizeDetails(value?: string): string {
  return sanitizePostgresText(value || "").trim().slice(0, 2000);
}

async function requireUserId(featureName: string): Promise<string> {
  assertBackendConfigured(featureName);
  const { data, error } = await neon.auth.getUser();
  if (error) throw toError(error, "Authentication failed.");
  if (!data.user?.id) throw new Error("Sign in required.");
  return data.user.id;
}

export async function loadBlockedUserIds(): Promise<string[]> {
  assertBackendConfigured("Community moderation");

  const { data: authData, error: authError } = await neon.auth.getUser();
  if (authError) {
    throw toError(authError, "Authentication failed.");
  }
  if (!authData.user?.id) {
    return [];
  }

  try {
    const { data, error } = await neon
      .from("community_user_blocks")
      .select("blocked_user_id")
      .eq("blocker_id", authData.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Array.from(new Set((data || []).map((row) => row.blocked_user_id).filter(Boolean)));
  } catch (error) {
    throw toError(error, "Failed to load blocked users.");
  }
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

  const safeReason = sanitizePostgresText(reason || "").trim().slice(0, 500);

  try {
    const { data, error } = await neon
      .from("community_user_blocks")
      .upsert(
        {
          blocker_id: blockerId,
          blocked_user_id: targetId,
          reason: safeReason,
        },
        {
          onConflict: "blocker_id,blocked_user_id",
          ignoreDuplicates: true,
        },
      )
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return true;

    const { data: existing, error: lookupError } = await neon
      .from("community_user_blocks")
      .select("id")
      .eq("blocker_id", blockerId)
      .eq("blocked_user_id", targetId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    return Boolean(existing?.id);
  } catch (error) {
    throw toError(error, "Failed to block user.");
  }
}

export async function unblockCommunityUser(blockedUserId: string): Promise<boolean> {
  const blockerId = await requireUserId("Community moderation");
  const targetId = blockedUserId.trim();
  if (!targetId) return false;

  try {
    const { data, error } = await neon
      .from("community_user_blocks")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_user_id", targetId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return Boolean(data?.id);
  } catch (error) {
    throw toError(error, "Failed to unblock user.");
  }
}

export async function submitCommunityReport(input: CommunityReportInput): Promise<string> {
  const reporterId = await requireUserId("Community moderation");
  const reason = normalizeReason(input.reason);
  const details = normalizeDetails(input.details);

  if (input.targetType === "post" && !input.postId) {
    throw new Error("Post report is missing a post id.");
  }
  if (input.targetType === "comment" && !input.commentId) {
    throw new Error("Comment report is missing a comment id.");
  }

  const payload: TablesInsert<"community_reports"> = {
    reporter_id: reporterId,
    reported_user_id: input.reportedUserId?.trim() || null,
    target_type: input.targetType,
    reason,
    details,
    post_id: input.postId?.trim() || null,
    comment_id: input.commentId?.trim() || null,
  };

  if (input.targetType === "post") {
    payload.comment_id = null;
  }

  try {
    const { data, error } = await neon
      .from("community_reports")
      .insert(payload)
      .select("id")
      .single();

    if (error) throw error;
    if (!data?.id) {
      throw new Error("Report submission returned no id.");
    }
    return data.id;
  } catch (error) {
    throw toError(error, "Failed to submit report.");
  }
}
