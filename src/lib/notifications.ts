import { apiFetch } from "@/lib/api-client";
import { requireUserId } from "@/lib/require-user-id";

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

interface ApiNotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  read_at: number | null;
  created_at: number;
  actor_display_name: string;
  actor_avatar_url: string | null;
  post_title: string;
}

function normalizeNotificationType(value: string): NotificationType {
  if (value === "upvote") return "upvote";
  if (value === "verified") return "verified";
  if (value === "remix") return "remix";
  return "comment";
}

function mapNotification(row: ApiNotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    actorId: row.actor_id,
    type: normalizeNotificationType(row.type),
    postId: row.post_id,
    commentId: row.comment_id,
    readAt: typeof row.read_at === "number" ? row.read_at * 1000 : null,
    createdAt: row.created_at * 1000,
    actorDisplayName: row.actor_display_name || "Community member",
    actorAvatarUrl: row.actor_avatar_url,
    postTitle: row.post_title || "your post",
  };
}

export async function loadNotifications(limit = 25, offset = 0): Promise<Notification[]> {
  await requireUserId("Notifications");
  const normalizedLimit = Math.min(Math.max(limit, 1), 100);
  const normalizedOffset = Math.max(offset, 0);
  const rows = await apiFetch<ApiNotificationRow[]>(
    `/api/notifications?limit=${normalizedLimit}&offset=${normalizedOffset}`,
  );
  return rows.map(mapNotification);
}

export async function getUnreadCount(): Promise<number> {
  await requireUserId("Notifications");
  const result = await apiFetch<{ count: number }>("/api/notifications/unread-count");
  return result.count ?? 0;
}

export async function markAsRead(notificationId: string): Promise<boolean> {
  await requireUserId("Notifications");
  const result = await apiFetch<{ changed: boolean }>(`/api/notifications/${notificationId}/read`, {
    method: "POST",
  });
  return result.changed;
}

export async function markAllAsRead(): Promise<number> {
  await requireUserId("Notifications");
  const result = await apiFetch<{ changed: number }>("/api/notifications/read-all", {
    method: "POST",
  });
  return result.changed ?? 0;
}
