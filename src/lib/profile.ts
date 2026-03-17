import { sanitizePostgresText } from "@/lib/saved-prompt-shared";

export const DISPLAY_NAME_MAX_LENGTH = 32;

const DISPLAY_NAME_HIDDEN_OR_CONTROL_CODE_POINTS = new Set([
  0x00ad,
  0x034f,
  0x061c,
  0x115f,
  0x1160,
  0x17b4,
  0x17b5,
  0x180e,
  0x200b,
  0x200c,
  0x200d,
  0x200e,
  0x200f,
  0x202a,
  0x202b,
  0x202c,
  0x202d,
  0x202e,
  0x2060,
  0x2066,
  0x2067,
  0x2068,
  0x2069,
  0x3164,
  0xfeff,
]);
const SIGN_UP_FALLBACK_SEPARATOR_PATTERN = /[+_-]+/g;
const SIGN_UP_FALLBACK_UNSAFE_CHAR_PATTERN = /[^\p{L}\p{N}.\s]/gu;

export function normalizeDisplayName(value: string | null | undefined): string {
  const sanitized = sanitizePostgresText(typeof value === "string" ? value : "");
  return sanitized.replace(/\s+/g, " ").trim();
}

function countDisplayNameCharacters(value: string): number {
  return Array.from(value).length;
}

function truncateDisplayName(value: string): string {
  return Array.from(value).slice(0, DISPLAY_NAME_MAX_LENGTH).join("");
}

function containsHiddenOrControlDisplayNameChar(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (typeof codePoint !== "number") {
      continue;
    }

    if (
      (codePoint >= 0x0000 && codePoint <= 0x001f)
      || (codePoint >= 0x007f && codePoint <= 0x009f)
      || DISPLAY_NAME_HIDDEN_OR_CONTROL_CODE_POINTS.has(codePoint)
    ) {
      return true;
    }
  }

  return false;
}

function toStoredDisplayName(value: string | null | undefined): string | null {
  const normalized = normalizeDisplayName(value);
  if (!normalized) {
    return null;
  }

  return truncateDisplayName(normalized);
}

function normalizeEmailLocalPart(localPart: string): string {
  return sanitizePostgresText(localPart)
    .replace(SIGN_UP_FALLBACK_SEPARATOR_PATTERN, " ")
    .replace(SIGN_UP_FALLBACK_UNSAFE_CHAR_PATTERN, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

export function validateDisplayName(value: string): string | null {
  const normalized = normalizeDisplayName(value);

  if (!normalized) {
    return "Display name is required.";
  }

  if (containsHiddenOrControlDisplayNameChar(normalized)) {
    return "Display name cannot include hidden or control characters.";
  }

  if (countDisplayNameCharacters(normalized) > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

export function resolveSignUpDisplayName(email: string, displayName?: string): string {
  const providedName = toStoredDisplayName(displayName);
  if (providedName) {
    return providedName;
  }

  const localPart = email.split("@")[0] || "";
  const fallbackName = toStoredDisplayName(normalizeEmailLocalPart(localPart));
  return fallbackName || "Member";
}
