import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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
const POLL_INTERVAL_MS = 30_000;

export function useNotifications(limit = DEFAULT_LIMIT): UseNotificationsResult {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    if (!isMountedRef.current) return;
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

    if (!isMountedRef.current) return;
    setLoading(true);
    try {
      const [items, count] = await Promise.all([
        loadNotifications(limit, 0),
        getUnreadCount(),
      ]);
      if (!isMountedRef.current) return;
      setNotifications(items);
      setUnreadCount(count);
      setError(null);
    } catch (nextError) {
      if (!isMountedRef.current) return;
      setError(nextError instanceof Error ? nextError.message : "Failed to load notifications.");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [limit, reset, user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const changed = await markNotificationAsRead(notificationId);
      if (!changed) return;
      if (!isMountedRef.current) return;

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
      if (!isMountedRef.current) return;
      setError(nextError instanceof Error ? nextError.message : "Failed to mark notification as read.");
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const changedCount = await markAllNotificationsAsRead();
      if (changedCount === 0) return;
      if (!isMountedRef.current) return;

      const markedAt = Date.now();
      setNotifications((previous) =>
        previous.map((notification) =>
          notification.readAt ? notification : { ...notification, readAt: markedAt },
        ),
      );
      setUnreadCount(0);
      setError(null);
    } catch (nextError) {
      if (!isMountedRef.current) return;
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

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const canUseVisibilityApi = typeof document !== "undefined";

    const stopPolling = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (canUseVisibilityApi && document.visibilityState === "hidden") return;
        void refresh();
      }, POLL_INTERVAL_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
        return;
      }
      startPolling();
      void refresh();
    };

    if (!canUseVisibilityApi || document.visibilityState !== "hidden") {
      startPolling();
    }
    if (canUseVisibilityApi) {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      stopPolling();
      if (canUseVisibilityApi) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
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
