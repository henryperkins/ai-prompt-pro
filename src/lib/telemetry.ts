export const BUILDER_TELEMETRY_EVENT_NAME = "promptforge:builder-telemetry";

export type BuilderTelemetryEvent =
  | "builder_loaded"
  | "builder_first_input"
  | "builder_zone2_opened"
  | "builder_zone3_opened"
  | "builder_enhance_clicked"
  | "builder_enhance_completed"
  | "builder_inference_applied"
  | "builder_field_manual_override"
  | "builder_save_clicked"
  | "builder_share_toggled"
  | "builder_dev_export_used";

export type BuilderTelemetryValue = string | number | boolean | null;

export interface BuilderTelemetryPayload {
  [key: string]: BuilderTelemetryValue;
}

export interface BuilderTelemetryEnvelope {
  event: BuilderTelemetryEvent;
  payload: BuilderTelemetryPayload;
  timestamp: number;
}

export function trackBuilderEvent(
  event: BuilderTelemetryEvent,
  payload: BuilderTelemetryPayload = {},
): void {
  if (typeof window === "undefined") return;

  const detail: BuilderTelemetryEnvelope = {
    event,
    payload,
    timestamp: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<BuilderTelemetryEnvelope>(BUILDER_TELEMETRY_EVENT_NAME, {
      detail,
    }),
  );
}
