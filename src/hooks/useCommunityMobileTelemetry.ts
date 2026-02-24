import { useCallback, useEffect, useRef } from "react";
import {
  getDefaultCommunityMobileSourceSurface,
  trackCommunityEvent,
  type CommunityMobileInteractionKind,
  type CommunityMobileTelemetrySourceSurface,
  type CommunityMobileTelemetrySurface,
  type CommunityTelemetryPayload,
} from "@/lib/community-telemetry";

const SESSION_STORAGE_KEY = "promptforge:community-mobile-session-v1";

interface StoredMobileSessionState {
  id: string;
  startedAt: number;
  firstActionTracked: boolean;
  commentInteractions: number;
  reactionInteractions: number;
  shareInteractions: number;
  saveInteractions: number;
}

interface UseCommunityMobileTelemetryInput {
  enabled: boolean;
  surface: CommunityMobileTelemetrySurface;
}

interface TrackCommunityMobileActionOptions {
  sourceSurface?: CommunityMobileTelemetrySourceSurface;
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
    shareInteractions: 0,
    saveInteractions: 0,
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
      shareInteractions: typeof parsed.shareInteractions === "number" ? parsed.shareInteractions : 0,
      saveInteractions: typeof parsed.saveInteractions === "number" ? parsed.saveInteractions : 0,
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
  const enabledStartedAtRef = useRef<number | null>(null);

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

  const resolveSourceSurface = useCallback(
    (options?: TrackCommunityMobileActionOptions): CommunityMobileTelemetrySourceSurface => {
      return options?.sourceSurface ?? getDefaultCommunityMobileSourceSurface(surface);
    },
    [surface],
  );

  useEffect(() => {
    if (enabled) {
      enabledStartedAtRef.current = Date.now();
      return;
    }
    enabledStartedAtRef.current = null;
    sessionRef.current = null;
  }, [enabled]);

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
      sourceSurface: CommunityMobileTelemetrySourceSurface,
    ): StoredMobileSessionState => {
      if (session.firstActionTracked) return session;

      const nextSession: StoredMobileSessionState = {
        ...session,
        firstActionTracked: true,
      };
      persist(nextSession);

      trackCommunityEvent("community_mobile_first_meaningful_action", {
        surface,
        sourceSurface,
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
    (
      action: string,
      payload: CommunityTelemetryPayload = {},
      options?: TrackCommunityMobileActionOptions,
    ) => {
      const session = ensureSession();
      if (!session) return;

      const now = Date.now();
      maybeTrackFirstAction(session, action, payload, now, resolveSourceSurface(options));
    },
    [ensureSession, maybeTrackFirstAction, resolveSourceSurface],
  );

  const trackInteraction = useCallback(
    (
      kind: CommunityMobileInteractionKind,
      action: string,
      payload: CommunityTelemetryPayload = {},
      options?: TrackCommunityMobileActionOptions,
    ) => {
      const session = ensureSession();
      if (!session) return;

      const now = Date.now();
      const sourceSurface = resolveSourceSurface(options);
      const sessionWithFirstAction = maybeTrackFirstAction(session, action, payload, now, sourceSurface);

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
        shareInteractions:
          kind === "share"
            ? sessionWithFirstAction.shareInteractions + 1
            : sessionWithFirstAction.shareInteractions,
        saveInteractions:
          kind === "save"
            ? sessionWithFirstAction.saveInteractions + 1
            : sessionWithFirstAction.saveInteractions,
      };
      persist(nextSession);

      const interactionCount =
        kind === "comment"
          ? nextSession.commentInteractions
          : kind === "reaction"
            ? nextSession.reactionInteractions
            : kind === "share"
              ? nextSession.shareInteractions
              : nextSession.saveInteractions;

      trackCommunityEvent("community_mobile_interaction", {
        surface,
        sourceSurface,
        kind,
        action,
        sessionId: nextSession.id,
        interactionCount,
        commentInteractions: nextSession.commentInteractions,
        reactionInteractions: nextSession.reactionInteractions,
        shareInteractions: nextSession.shareInteractions,
        saveInteractions: nextSession.saveInteractions,
        ...payload,
      });
    },
    [ensureSession, maybeTrackFirstAction, persist, resolveSourceSurface, surface],
  );

  return {
    trackFirstMeaningfulAction,
    trackInteraction,
  };
}
