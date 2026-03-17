export function isAllowedRedirectOrigin(candidateOrigin, corsConfig) {
  if (typeof candidateOrigin !== "string" || !candidateOrigin.trim()) {
    return false;
  }

  let parsedOrigin = "";
  try {
    parsedOrigin = new URL(candidateOrigin).origin;
  } catch {
    return false;
  }

  if (!corsConfig || corsConfig.mode !== "set") {
    return false;
  }

  return corsConfig.origins.has(parsedOrigin);
}
