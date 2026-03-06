import type { CommunityPost, CommunityProfile } from "@/lib/community";
import { getInitials as sharedGetInitials } from "@/lib/utils/get-initials";

/** @deprecated Import `getInitials` from "@/lib/utils/get-initials". */
export const getInitials = sharedGetInitials;

export function estimateTokens(text: string): string {
  const words = text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  const tokens = Math.max(1, Math.round(words * 1.35));
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
}

export function toProfileMap(profiles: CommunityProfile[]): Record<string, CommunityProfile> {
  return profiles.reduce<Record<string, CommunityProfile>>((map, profile) => {
    map[profile.id] = profile;
    return map;
  }, {});
}

export function toParentTitleMap(posts: CommunityPost[]): Record<string, string> {
  return posts.reduce<Record<string, string>>((map, post) => {
    map[post.id] = post.title;
    return map;
  }, {});
}
