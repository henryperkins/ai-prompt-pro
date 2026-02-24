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
  const seenVersion = useRef(0);

  const dismiss = useCallback(() => {
    seenVersion.current += 1;
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
      seenVersion.current += 1;
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled || pollInFlight.current || document.visibilityState === "hidden") {
        return;
      }

      pollInFlight.current = true;
      const baselineSeenAt = newestSeenAt.current;
      const baselineVersion = seenVersion.current;

      try {
        const latestPosts = await loadFeed({ sort: "new", page: 0, limit: 20 });
        if (cancelled) return;
        if (baselineVersion !== seenVersion.current) return;

        const latest = latestPosts[0] as CommunityPost | undefined;
        if (!latest) {
          setNewCount(0);
          return;
        }

        latestObservedAt.current = latest.createdAt;

        if (baselineSeenAt === null) {
          newestSeenAt.current = latest.createdAt;
          seenVersion.current += 1;
          setNewCount(0);
          return;
        }

        if (latest.createdAt <= baselineSeenAt) {
          setNewCount(0);
          return;
        }

        const count = latestPosts.filter((post) => post.createdAt > baselineSeenAt).length;
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
