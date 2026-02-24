import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommunityMobileTelemetry } from "@/hooks/useCommunityMobileTelemetry";
import {
  COMMUNITY_TELEMETRY_EVENT_NAME,
  type CommunityTelemetryEnvelope,
} from "@/lib/community-telemetry";

const SESSION_STORAGE_KEY = "promptforge:community-mobile-session-v1";

describe("useCommunityMobileTelemetry", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-20T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks first meaningful action using session start time", () => {
    const captured: CommunityTelemetryEnvelope[] = [];
    const handler = (event: Event) => {
      captured.push((event as CustomEvent<CommunityTelemetryEnvelope>).detail);
    };

    window.addEventListener(COMMUNITY_TELEMETRY_EVENT_NAME, handler);

    const { result } = renderHook(() =>
      useCommunityMobileTelemetry({
        enabled: true,
        surface: "community_feed",
      }),
    );

    vi.advanceTimersByTime(1400);

    act(() => {
      result.current.trackFirstMeaningfulAction("filter_drawer_opened");
    });

    window.removeEventListener(COMMUNITY_TELEMETRY_EVENT_NAME, handler);

    expect(captured).toHaveLength(1);
    expect(captured[0]?.event).toBe("community_mobile_first_meaningful_action");
    expect(captured[0]?.payload.action).toBe("filter_drawer_opened");
    expect(captured[0]?.payload.sourceSurface).toBe("feed");
    expect(captured[0]?.payload.firstMeaningfulActionMs).toBeGreaterThanOrEqual(1400);
  });

  it("reuses an existing session start timestamp from sessionStorage", () => {
    const existingStartedAt = Date.now() - 5000;
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        id: "existing-session",
        startedAt: existingStartedAt,
        firstActionTracked: false,
        commentInteractions: 0,
        reactionInteractions: 0,
      }),
    );

    const captured: CommunityTelemetryEnvelope[] = [];
    const handler = (event: Event) => {
      captured.push((event as CustomEvent<CommunityTelemetryEnvelope>).detail);
    };

    window.addEventListener(COMMUNITY_TELEMETRY_EVENT_NAME, handler);

    const { result } = renderHook(() =>
      useCommunityMobileTelemetry({
        enabled: true,
        surface: "community_post",
      }),
    );

    act(() => {
      result.current.trackFirstMeaningfulAction("comment_thread_opened");
    });

    window.removeEventListener(COMMUNITY_TELEMETRY_EVENT_NAME, handler);

    expect(captured).toHaveLength(1);
    expect(captured[0]?.payload.sessionId).toBe("existing-session");
    expect(captured[0]?.payload.firstMeaningfulActionMs).toBe(5000);
    expect(captured[0]?.payload.sourceSurface).toBe("post_detail");
  });

  it("tracks share/save interactions and supports source overrides", () => {
    const captured: CommunityTelemetryEnvelope[] = [];
    const handler = (event: Event) => {
      captured.push((event as CustomEvent<CommunityTelemetryEnvelope>).detail);
    };

    window.addEventListener(COMMUNITY_TELEMETRY_EVENT_NAME, handler);

    const { result } = renderHook(() =>
      useCommunityMobileTelemetry({
        enabled: true,
        surface: "community_post",
      }),
    );

    act(() => {
      result.current.trackInteraction(
        "share",
        "share_clipboard",
        { postId: "post-1" },
        { sourceSurface: "notification" },
      );
      result.current.trackInteraction("save", "library", { postId: "post-1" });
    });

    window.removeEventListener(COMMUNITY_TELEMETRY_EVENT_NAME, handler);

    const interactionEvents = captured.filter((event) => event.event === "community_mobile_interaction");
    expect(interactionEvents).toHaveLength(2);

    expect(interactionEvents[0]?.payload.kind).toBe("share");
    expect(interactionEvents[0]?.payload.action).toBe("share_clipboard");
    expect(interactionEvents[0]?.payload.sourceSurface).toBe("notification");
    expect(interactionEvents[0]?.payload.interactionCount).toBe(1);
    expect(interactionEvents[0]?.payload.shareInteractions).toBe(1);
    expect(interactionEvents[0]?.payload.saveInteractions).toBe(0);

    expect(interactionEvents[1]?.payload.kind).toBe("save");
    expect(interactionEvents[1]?.payload.action).toBe("library");
    expect(interactionEvents[1]?.payload.sourceSurface).toBe("post_detail");
    expect(interactionEvents[1]?.payload.interactionCount).toBe(1);
    expect(interactionEvents[1]?.payload.shareInteractions).toBe(1);
    expect(interactionEvents[1]?.payload.saveInteractions).toBe(1);
  });
});
