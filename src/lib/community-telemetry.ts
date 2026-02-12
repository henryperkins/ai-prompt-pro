export const COMMUNITY_TELEMETRY_EVENT_NAME = "promptforge:community-telemetry";

export type CommunityTelemetryEvent =
  | "community_mobile_first_meaningful_action"
  | "community_mobile_interaction";

export type CommunityTelemetryValue = string | number | boolean | null;

export interface CommunityTelemetryPayload {
  [key: string]: CommunityTelemetryValue;
}

export interface CommunityTelemetryEnvelope {
  event: CommunityTelemetryEvent;
  payload: CommunityTelemetryPayload;
  timestamp: number;
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
