import { useCallback, useEffect, useRef } from "react";
import {
  trackCommunityEvent,
  type CommunityTelemetryPayload,
} from "@/lib/community-telemetry";

const SESSION_STORAGE_KEY = "promptforge:community-mobile-session-v1";

type CommunityMobileTelemetrySurface = "community_feed" | "community_post";
type CommunityMobileInteractionKind = "comment" | "reaction";

interface StoredMobileSessionState {
  id: string;
  startedAt: number;
  firstActionTracked: boolean;
  commentInteractions: number;
  reactionInteractions: number;
}

interface UseCommunityMobileTelemetryInput {
  enabled: boolean;
  surface: CommunityMobileTelemetrySurface;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createInitialSession(now: number): StoredMobileSessionState {
  return {
    id: createSessionId(),
    startedAt: now,
    firstActionTracked: false,
    commentInteractions: 0,
    reactionInteractions: 0,
  };
}

function readSession(): StoredMobileSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredMobileSessionState>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.startedAt !== "number" ||
      typeof parsed.firstActionTracked !== "boolean" ||
      typeof parsed.commentInteractions !== "number" ||
      typeof parsed.reactionInteractions !== "number"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      startedAt: parsed.startedAt,
      firstActionTracked: parsed.firstActionTracked,
      commentInteractions: parsed.commentInteractions,
      reactionInteractions: parsed.reactionInteractions,
    };
  } catch {
    return null;
  }
}

function writeSession(session: StoredMobileSessionState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures (private mode, quota, etc.) and still emit events.
  }
}

export function useCommunityMobileTelemetry({
  enabled,
  surface,
}: UseCommunityMobileTelemetryInput) {
  const sessionRef = useRef<StoredMobileSessionState | null>(null);
  const enabledStartedAtRef = useRef<number | null>(enabled ? Date.now() : null);

  if (enabled && enabledStartedAtRef.current === null) {
    enabledStartedAtRef.current = Date.now();
  } else if (!enabled && enabledStartedAtRef.current !== null) {
    enabledStartedAtRef.current = null;
  }

  const ensureSession = useCallback((): StoredMobileSessionState | null => {
    if (!enabled) return null;

    if (sessionRef.current) return sessionRef.current;

    const now = enabledStartedAtRef.current ?? Date.now();
    const existing = readSession();
    const session = existing ?? createInitialSession(now);
    if (!existing) {
      writeSession(session);
    }
    sessionRef.current = session;
    return session;
  }, [enabled]);

  const persist = useCallback((session: StoredMobileSessionState) => {
    sessionRef.current = session;
    writeSession(session);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    ensureSession();
  }, [enabled, ensureSession]);

  const maybeTrackFirstAction = useCallback(
    (
      session: StoredMobileSessionState,
      action: string,
      payload: CommunityTelemetryPayload,
      now: number,
    ): StoredMobileSessionState => {
      if (session.firstActionTracked) return session;

      const nextSession: StoredMobileSessionState = {
        ...session,
        firstActionTracked: true,
      };
      persist(nextSession);

      trackCommunityEvent("community_mobile_first_meaningful_action", {
        surface,
        action,
        sessionId: nextSession.id,
        firstMeaningfulActionMs: Math.max(0, now - session.startedAt),
        ...payload,
      });

      return nextSession;
    },
    [persist, surface],
  );

  const trackFirstMeaningfulAction = useCallback(
    (action: string, payload: CommunityTelemetryPayload = {}) => {
      const session = ensureSession();
      if (!session) return;

      const now = Date.now();
      maybeTrackFirstAction(session, action, payload, now);
    },
    [ensureSession, maybeTrackFirstAction],
  );

  const trackInteraction = useCallback(
    (
      kind: CommunityMobileInteractionKind,
      action: string,
      payload: CommunityTelemetryPayload = {},
    ) => {
      const session = ensureSession();
      if (!session) return;

      const now = Date.now();
      const sessionWithFirstAction = maybeTrackFirstAction(session, action, payload, now);

      const nextSession: StoredMobileSessionState = {
        ...sessionWithFirstAction,
        commentInteractions:
          kind === "comment"
            ? sessionWithFirstAction.commentInteractions + 1
            : sessionWithFirstAction.commentInteractions,
        reactionInteractions:
          kind === "reaction"
            ? sessionWithFirstAction.reactionInteractions + 1
            : sessionWithFirstAction.reactionInteractions,
      };
      persist(nextSession);

      const interactionCount =
        kind === "comment" ? nextSession.commentInteractions : nextSession.reactionInteractions;

      trackCommunityEvent("community_mobile_interaction", {
        surface,
        kind,
        action,
        sessionId: nextSession.id,
        interactionCount,
        commentInteractions: nextSession.commentInteractions,
        reactionInteractions: nextSession.reactionInteractions,
        ...payload,
      });
    },
    [ensureSession, maybeTrackFirstAction, persist, surface],
  );

  return {
    trackFirstMeaningfulAction,
    trackInteraction,
  };
}
