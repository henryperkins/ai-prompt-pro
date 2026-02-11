import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  type Notification,
  getUnreadCount,
  loadNotifications,
  markAllAsRead as markAllNotificationsAsRead,
  markAsRead as markNotificationAsRead,
} from "@/lib/notifications";

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const DEFAULT_LIMIT = 30;

export function useNotifications(limit = DEFAULT_LIMIT): UseNotificationsResult {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setLoading(false);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      reset();
      return;
    }

    setLoading(true);
    try {
      const [items, count] = await Promise.all([
        loadNotifications(limit, 0),
        getUnreadCount(),
      ]);
      setNotifications(items);
      setUnreadCount(count);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [limit, reset, user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const changed = await markNotificationAsRead(notificationId);
      if (!changed) return;

      const markedAt = Date.now();
      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === notificationId && !notification.readAt
            ? { ...notification, readAt: markedAt }
            : notification,
        ),
      );
      setUnreadCount((previous) => Math.max(0, previous - 1));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to mark notification as read.");
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const changedCount = await markAllNotificationsAsRead();
      if (changedCount === 0) return;

      const markedAt = Date.now();
      setNotifications((previous) =>
        previous.map((notification) =>
          notification.readAt ? notification : { ...notification, readAt: markedAt },
        ),
      );
      setUnreadCount(0);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to mark all notifications as read.");
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }
    void refresh();
  }, [refresh, reset, user]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, user?.id]);

  return useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      refresh,
      markAsRead,
      markAllAsRead,
    }),
    [error, loading, markAllAsRead, markAsRead, notifications, refresh, unreadCount],
  );
}
