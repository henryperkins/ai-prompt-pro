/**
 * Structured JSON logging for the agent service.
 *
 * All log output is JSON-serialised to stdout/stderr to integrate with
 * cloud log ingestion pipelines (Azure Monitor, Datadog, etc.).
 *
 * @module logging
 */

export const SERVICE_NAME = "ai-prompt-pro-codex-service";

/**
 * Strip `undefined` values from a log payload so JSON.stringify produces
 * compact output without `"key":null` noise.
 *
 * @param {Record<string, unknown>} fields
 * @returns {Record<string, unknown>}
 */
export function cleanLogFields(fields) {
  const entries = Object.entries(fields || {});
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

/**
 * Emit a structured log event.
 *
 * @param {"info" | "warn" | "error"} level
 * @param {string} event - Machine-readable event name.
 * @param {Record<string, unknown>} [fields] - Additional payload fields.
 */
export function logEvent(level, event, fields = {}) {
  const payload = cleanLogFields({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: SERVICE_NAME,
    ...fields,
  });
  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}
