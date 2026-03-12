/**
 * Shared environment-variable parsing utilities.
 *
 * These helpers normalise, validate, and coerce raw `process.env` values into
 * the typed shapes expected by the rest of the agent service.  Every function
 * here is deterministic and side-effect-free so it can be unit-tested trivially.
 *
 * @module env-parse
 */

/**
 * Return a trimmed, non-empty string from an env var or `undefined`.
 *
 * @param {string} name - Environment variable name.
 * @param {Record<string, string | undefined>} [source] - Env source (defaults to `process.env`).
 * @returns {string | undefined}
 */
export function normalizeEnvValue(name, source) {
  const value = source ? source[name] : process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * Coerce a string value to boolean, with a fallback.
 *
 * @param {string | undefined} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
export function normalizeBool(value, defaultValue = false) {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean value "${value}".`);
}

/**
 * Parse an env var as a positive integer, or return a default.
 *
 * @param {string} name - Environment variable name.
 * @param {number} defaultValue
 * @param {Record<string, string | undefined>} [source] - Env source (defaults to `process.env`).
 * @returns {number}
 */
export function parsePositiveIntegerEnv(name, defaultValue, source) {
  const raw = normalizeEnvValue(name, source);
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

/**
 * Parse an env var as a JSON object, or return `undefined`.
 *
 * @param {string} name
 * @param {Record<string, string | undefined>} [source] - Env source (defaults to `process.env`).
 * @returns {Record<string, unknown> | undefined}
 */
export function parseJsonObjectEnv(name, source) {
  const raw = normalizeEnvValue(name, source);
  if (!raw) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} must be valid JSON.`, { cause: error });
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${name} must be a JSON object.`);
  }
  return parsed;
}

/**
 * Parse an env var as a string array (JSON or comma-delimited).
 *
 * @param {string} name
 * @param {Record<string, string | undefined>} [source] - Env source (defaults to `process.env`).
 * @returns {string[] | undefined}
 */
export function parseStringArrayEnv(name, source) {
  const raw = normalizeEnvValue(name, source);
  if (!raw) return undefined;

  if (raw.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${name} must be a JSON array of strings.`, { cause: error });
    }
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
      throw new Error(`${name} must be a JSON array of strings.`);
    }
    const normalized = parsed.map((entry) => entry.trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  const normalized = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Parse an env var that must match one of a set of allowed values.
 *
 * @param {string} name
 * @param {Set<string>} allowedValues
 * @param {Record<string, string | undefined>} [source] - Env source (defaults to `process.env`).
 * @returns {string | undefined}
 */
export function parseEnumEnv(name, allowedValues, source) {
  const raw = normalizeEnvValue(name, source);
  if (!raw) return undefined;
  if (!allowedValues.has(raw)) {
    throw new Error(`${name} has invalid value "${raw}".`);
  }
  return raw;
}

/**
 * Coerce a value to a finite number, or return `undefined`.
 *
 * @param {unknown} value
 * @returns {number | undefined}
 */
export function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Return a trimmed non-empty string or `undefined`.
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function asNonEmptyString(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * Check whether a value is a non-empty string.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Truncate a string to `maxChars`, trimming first.
 *
 * @param {unknown} value
 * @param {number} maxChars
 * @returns {string}
 */
export function truncateString(value, maxChars) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) : trimmed;
}

/**
 * Normalise a raw string-valued record (all values must be strings).
 *
 * @param {unknown} value
 * @returns {Record<string, string> | undefined}
 */
export function normalizeStringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "string") {
      throw new Error("Record must contain only string values.");
    }
    record[key] = raw;
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

/**
 * Parse a raw string array value (JSON or comma-delimited) — non-env version.
 *
 * @param {string | undefined} rawValue
 * @returns {string[] | undefined}
 */
export function parseStringArrayValue(rawValue) {
  if (typeof rawValue !== "string") return undefined;
  const raw = rawValue.trim();
  if (!raw) return undefined;

  if (raw.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error("Value must be a JSON array of strings.", { cause: error });
    }
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
      throw new Error("Value must be a JSON array of strings.");
    }
    const normalized = parsed.map((entry) => entry.trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  const normalized = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}
