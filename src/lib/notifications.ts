import { neon } from "@/integrations/neon/client";
import { type CommunityProfile, loadProfilesByIds } from "@/lib/community";
import { toProfileMap } from "@/lib/community-utils";
import { isPostgrestError } from "@/lib/saved-prompt-shared";

export type NotificationType = "upvote" | "verified" | "comment" | "remix";

export interface Notification {
  id: string;
  userId: string;
  actorId: string | null;
  type: NotificationType;
  postId: string | null;
  commentId: string | null;
  readAt: number | null;
  createdAt: number;
  actorDisplayName: string;
  actorAvatarUrl: string | null;
  postTitle: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
}

interface PostTitleRow {
  id: string;
  title: string;
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (isPostgrestError(error)) return new Error(error.message || fallback);
  return new Error(fallback);
}

function normalizeNotificationType(value: string): NotificationType {
  if (value === "upvote") return "upvote";
  if (value === "verified") return "verified";
  if (value === "remix") return "remix";
  return "comment";
}

function toPostTitleMap(posts: PostTitleRow[]): Record<string, string> {
  return posts.reduce<Record<string, string>>((map, post) => {
    map[post.id] = post.title;
    return map;
  }, {});
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function requireUserId(): Promise<string> {
  const { data, error } = await neon.auth.getUser();
  if (error) throw toError(error, "Authentication failed.");
  const user = data.user;
  if (!user?.id) {
    throw new Error("Sign in required.");
  }
  return user.id;
}

export async function loadNotifications(limit = 25, offset = 0): Promise<Notification[]> {
  const userId = await requireUserId();
  const normalizedLimit = Math.min(Math.max(limit, 1), 100);
  const normalizedOffset = Math.max(offset, 0);

  try {
    const { data, error } = await neon
      .from("notifications")
      .select("id, user_id, actor_id, type, post_id, comment_id, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(normalizedOffset, normalizedOffset + normalizedLimit - 1);

    if (error) throw error;
    const rows = (data || []) as NotificationRow[];
    if (rows.length === 0) return [];

    const actorIds = uniqueNonEmpty(rows.map((row) => row.actor_id));
    const postIds = uniqueNonEmpty(rows.map((row) => row.post_id));

    const [profilesResult, postsResult] = await Promise.allSettled([
      loadProfilesByIds(actorIds),
      postIds.length > 0
        ? neon.from("community_posts").select("id, title").in("id", postIds)
        : Promise.resolve({ data: [] as PostTitleRow[], error: null }),
    ]);

    const profiles =
      profilesResult.status === "fulfilled"
        ? profilesResult.value
        : [];

    const postRows =
      postsResult.status === "fulfilled" && !postsResult.value.error
        ? ((postsResult.value.data || []) as PostTitleRow[])
        : [];

    const profileById = toProfileMap(profiles);
    const postTitleById = toPostTitleMap(postRows);

    return rows.map((row) => {
      const actor = row.actor_id ? profileById[row.actor_id] : undefined;
      return {
        id: row.id,
        userId: row.user_id,
        actorId: row.actor_id,
        type: normalizeNotificationType(row.type),
        postId: row.post_id,
        commentId: row.comment_id,
        readAt: row.read_at ? new Date(row.read_at).getTime() : null,
        createdAt: new Date(row.created_at).getTime(),
        actorDisplayName: actor?.displayName || "Community member",
        actorAvatarUrl: actor?.avatarUrl || null,
        postTitle: row.post_id ? postTitleById[row.post_id] || "your post" : "your post",
      };
    });
  } catch (error) {
    throw toError(error, "Failed to load notifications.");
  }
}

export async function getUnreadCount(): Promise<number> {
  const userId = await requireUserId();

  try {
    const { count, error } = await neon
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    throw toError(error, "Failed to load unread notifications.");
  }
}

export async function markAsRead(notificationId: string): Promise<boolean> {
  const userId = await requireUserId();

  try {
    const { data, error } = await neon
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .is("read_at", null)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return Boolean(data?.id);
  } catch (error) {
    throw toError(error, "Failed to mark notification as read.");
  }
}

export async function markAllAsRead(): Promise<number> {
  const userId = await requireUserId();

  try {
    const { data, error } = await neon
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null)
      .select("id");

    if (error) throw error;
    return (data || []).length;
  } catch (error) {
    throw toError(error, "Failed to mark all notifications as read.");
  }
}
