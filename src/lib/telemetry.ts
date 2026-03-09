export const BUILDER_TELEMETRY_EVENT_NAME = "promptforge:builder-telemetry";

export type BuilderTelemetryEvent =
  | "preset_viewed"
  | "preset_clicked"
  | "preset_applied"
  | "preset_not_found"
  | "builder_loaded"
  | "builder_first_input"
  | "builder_zone2_opened"
  | "builder_zone3_opened"
  | "builder_enhance_clicked"
  | "builder_enhance_completed"
  | "builder_inference_applied"
  | "builder_field_manual_override"
  | "builder_copy_pre_enhance"
  | "builder_save_pre_enhance_attempt"
  | "builder_more_pre_enhance_attempt"
  | "builder_clear_prompt_with_preview"
  | "builder_save_clicked"
  | "builder_share_toggled"
  | "builder_dev_export_used"
  | "builder_enhance_metadata_received"
  | "builder_enhance_variant_applied"
  | "builder_enhance_accepted"
  | "builder_enhance_rerun"
  | "builder_enhance_too_much_changed"
  | "builder_enhance_assumption_edited"
  | "builder_enhance_intent_overridden";

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

/* ------------------------------------------------------------------ */
/*  Telemetry listener — localStorage ring buffer                     */
/* ------------------------------------------------------------------ */

const TELEMETRY_LOG_KEY = "promptforge-telemetry-log";
const TELEMETRY_LOG_MAX = 500;

let listenerAttached = false;
let activeListener: EventListener | null = null;

export function startTelemetryListener(): void {
  if (typeof window === "undefined" || listenerAttached) return;
  listenerAttached = true;

  activeListener = ((e: CustomEvent<BuilderTelemetryEnvelope>) => {
    try {
      const log = readLog();
      log.push(e.detail);
      if (log.length > TELEMETRY_LOG_MAX) {
        log.splice(0, log.length - TELEMETRY_LOG_MAX);
      }
      localStorage.setItem(TELEMETRY_LOG_KEY, JSON.stringify(log));
    } catch {
      // localStorage full or unavailable — silently skip
    }
  }) as EventListener;

  window.addEventListener(BUILDER_TELEMETRY_EVENT_NAME, activeListener);
}

/** Remove the listener and reset internal state. Useful for test isolation. */
export function resetTelemetryListener(): void {
  if (typeof window !== "undefined" && activeListener) {
    window.removeEventListener(BUILDER_TELEMETRY_EVENT_NAME, activeListener);
  }
  activeListener = null;
  listenerAttached = false;
}

export function getTelemetryLog(): BuilderTelemetryEnvelope[] {
  return readLog();
}

export function clearTelemetryLog(): void {
  try {
    localStorage.removeItem(TELEMETRY_LOG_KEY);
  } catch {
    // ignore
  }
}

function readLog(): BuilderTelemetryEnvelope[] {
  try {
    const raw = localStorage.getItem(TELEMETRY_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
