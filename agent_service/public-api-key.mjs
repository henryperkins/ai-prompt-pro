export function isPublishableKeyLike(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("sb_publishable_")) return true;
  if (trimmed.startsWith("pk_live_") || trimmed.startsWith("pk_test_")) return true;
  return false;
}

export function isConfiguredPublicApiKey(
  value,
  {
    configuredKeys = new Set(),
    strict = true,
  } = {},
) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (configuredKeys.has(trimmed)) return true;
  if (configuredKeys.size > 0) return false;

  if (strict) return false;
  return isPublishableKeyLike(trimmed);
}
