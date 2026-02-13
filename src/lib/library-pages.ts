import type { AuthUser } from "@/hooks/useAuth";

function normalizeIds(ids: string[]): string[] {
  return Array.from(
    new Set(
      ids
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}

export function decodeSelectionIds(searchParams: URLSearchParams): string[] {
  return normalizeIds(searchParams.getAll("id"));
}

export function encodeSelectionIds(ids: string[]): URLSearchParams {
  const next = new URLSearchParams();
  normalizeIds(ids).forEach((id) => next.append("id", id));
  return next;
}

export function getUserDisplayName(user: AuthUser | null): string {
  if (!user) return "Guest";
  const metadata = user.user_metadata as Record<string, unknown> | null | undefined;
  const displayName = typeof metadata?.display_name === "string" ? metadata.display_name : "";
  if (displayName.trim()) return displayName.trim();
  const fullName = typeof metadata?.full_name === "string" ? metadata.full_name : "";
  if (fullName.trim()) return fullName.trim();
  if (user.email) return user.email;
  return "You";
}

export function getUserAvatarUrl(user: AuthUser | null): string | null {
  if (!user) return null;
  const metadata = user.user_metadata as Record<string, unknown> | null | undefined;
  const avatarUrl = typeof metadata?.avatar_url === "string" ? metadata.avatar_url.trim() : "";
  return avatarUrl || null;
}

export function getInitials(value: string): string {
  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}
