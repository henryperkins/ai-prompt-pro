export const COMMUNITY_TELEMETRY_EVENT_NAME = "promptforge:community-telemetry";

export type CommunityTelemetryEvent =
  | "community_mobile_first_meaningful_action"
  | "community_mobile_interaction";

// Community mobile telemetry payload conventions:
// - surface: route-level context (`community_feed` | `community_post`)
// - sourceSurface: where the action originated (`feed` | `post_detail` | `notification`)
// - kind: interaction class (`comment` | `reaction` | `share` | `save`)
export type CommunityMobileTelemetrySurface = "community_feed" | "community_post";
export type CommunityMobileTelemetrySourceSurface = "feed" | "post_detail" | "notification";
export type CommunityMobileInteractionKind = "comment" | "reaction" | "share" | "save";

export type CommunityTelemetryValue = string | number | boolean | null;

export interface CommunityTelemetryPayload {
  [key: string]: CommunityTelemetryValue;
}

export interface CommunityTelemetryEnvelope {
  event: CommunityTelemetryEvent;
  payload: CommunityTelemetryPayload;
  timestamp: number;
}

export function getDefaultCommunityMobileSourceSurface(
  surface: CommunityMobileTelemetrySurface,
): CommunityMobileTelemetrySourceSurface {
  return surface === "community_feed" ? "feed" : "post_detail";
}

export function trackCommunityEvent(
  event: CommunityTelemetryEvent,
  payload: CommunityTelemetryPayload = {},
): void {
  if (typeof window === "undefined") return;

  const detail: CommunityTelemetryEnvelope = {
    event,
    payload,
    timestamp: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<CommunityTelemetryEnvelope>(COMMUNITY_TELEMETRY_EVENT_NAME, {
      detail,
    }),
  );
}
