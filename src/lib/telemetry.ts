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
  | "builder_enhance_intent_overridden"
  | "builder_enhance_structured_applied"
  | "builder_github_install_clicked"
  | "builder_github_repo_connected"
  | "builder_github_manifest_searched"
  | "builder_github_file_previewed"
  | "builder_github_sources_attached";

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
/*  Telemetry listener — tab-scoped localStorage ring buffer           */
/* ------------------------------------------------------------------ */

const TELEMETRY_LOG_PREFIX = "promptforge-telemetry-log:";
/** Legacy single-key name kept for one-release backward compatibility. */
const TELEMETRY_LOG_LEGACY_KEY = "promptforge-telemetry-log";
const TELEMETRY_LOG_MAX = 500;
const TAB_ID_KEY = "promptforge-telemetry-tab-id";

let listenerAttached = false;
let activeListener: EventListener | null = null;

function getTabId(): string {
  if (typeof sessionStorage === "undefined") return "default";
  let id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

function tabKey(): string {
  return `${TELEMETRY_LOG_PREFIX}${getTabId()}`;
}

export function startTelemetryListener(): void {
  if (typeof window === "undefined" || listenerAttached) return;
  listenerAttached = true;

  const key = tabKey();

  activeListener = ((e: CustomEvent<BuilderTelemetryEnvelope>) => {
    try {
      const log = readScopedLog(key);
      log.push(e.detail);
      if (log.length > TELEMETRY_LOG_MAX) {
        log.splice(0, log.length - TELEMETRY_LOG_MAX);
      }
      localStorage.setItem(key, JSON.stringify(log));
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

/**
 * Read the merged telemetry log from all tabs, sorted by timestamp and
 * capped to the most recent `TELEMETRY_LOG_MAX` entries.
 */
export function getTelemetryLog(): BuilderTelemetryEnvelope[] {
  const merged: BuilderTelemetryEnvelope[] = [];

  try {
    // Include the legacy key if present (one-release backward compat).
    const legacyRaw = localStorage.getItem(TELEMETRY_LOG_LEGACY_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) merged.push(...parsed);
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(TELEMETRY_LOG_PREFIX)) {
        const entries = readScopedLog(k);
        merged.push(...entries);
      }
    }
  } catch {
    // ignore
  }

  merged.sort((a, b) => a.timestamp - b.timestamp);
  return merged.slice(-TELEMETRY_LOG_MAX);
}

export function clearTelemetryLog(): void {
  try {
    // Remove the legacy key.
    localStorage.removeItem(TELEMETRY_LOG_LEGACY_KEY);

    // Remove all tab-scoped keys.
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(TELEMETRY_LOG_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

function readScopedLog(key: string): BuilderTelemetryEnvelope[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
