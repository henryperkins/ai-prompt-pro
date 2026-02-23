import { useCallback, useEffect, useRef, useState } from "react";
import { loadFeed, type CommunityPost } from "@/lib/community";

interface UseNewPostsIndicatorOptions {
  enabled: boolean;
  intervalMs?: number;
}

interface UseNewPostsIndicatorResult {
  newCount: number;
  dismiss: () => void;
}

export function useNewPostsIndicator({
  enabled,
  intervalMs = 45_000,
}: UseNewPostsIndicatorOptions): UseNewPostsIndicatorResult {
  const [newCount, setNewCount] = useState(0);
  const newestSeenAt = useRef<number | null>(null);
  const latestObservedAt = useRef<number | null>(null);
  const pollInFlight = useRef(false);

  const dismiss = useCallback(() => {
    setNewCount(0);
    if (latestObservedAt.current) {
      newestSeenAt.current = latestObservedAt.current;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setNewCount(0);
      newestSeenAt.current = null;
      latestObservedAt.current = null;
      pollInFlight.current = false;
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled || pollInFlight.current || document.visibilityState === "hidden") {
        return;
      }

      pollInFlight.current = true;

      try {
        const latestPosts = await loadFeed({ sort: "new", page: 0, limit: 1 });
        if (cancelled) return;

        const latest = latestPosts[0] as CommunityPost | undefined;
        if (!latest) return;

        latestObservedAt.current = latest.createdAt;

        if (newestSeenAt.current === null) {
          newestSeenAt.current = latest.createdAt;
          return;
        }

        if (latest.createdAt <= newestSeenAt.current) {
          setNewCount(0);
          return;
        }

        const countPosts = await loadFeed({ sort: "new", page: 0, limit: 20 });
        if (cancelled) return;

        const count = countPosts.filter((post) => post.createdAt > newestSeenAt.current!).length;
        setNewCount(count);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug("useNewPostsIndicator poll failed", error);
        }
      } finally {
        pollInFlight.current = false;
      }
    };

    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);

  return { newCount, dismiss };
}
