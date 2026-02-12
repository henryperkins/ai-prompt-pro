/**
 * Gravatar avatar URL helper.
 * Uses SHA-256 hash of the normalized email per Gravatar API v3.
 * See: https://docs.gravatar.com/llms.txt
 */

const GRAVATAR_BASE = "https://0.gravatar.com/avatar/";

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build a Gravatar avatar URL for the given email.
 * Returns `null` if no email is provided.
 *
 * @param email - User email address
 * @param size  - Image size in pixels (default 80)
 * @param fallback - Gravatar default image style when no avatar exists
 *                   (e.g. "mp" for mystery person, "identicon", "retro")
 */
export async function getGravatarUrl(
  email: string | null | undefined,
  size = 80,
  fallback = "mp",
): Promise<string | null> {
  if (!email) return null;
  const hash = await sha256Hex(email.trim().toLowerCase());
  return `${GRAVATAR_BASE}${hash}?s=${size}&d=${fallback}`;
}
