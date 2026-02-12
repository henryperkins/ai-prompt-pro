export const DISPLAY_NAME_MAX_LENGTH = 32;
const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9]+$/;

export function validateDisplayName(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return "Display name is required.";
  }

  if (normalized.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!DISPLAY_NAME_PATTERN.test(normalized)) {
    return "Display name can only include letters and numbers.";
  }

  return null;
}
