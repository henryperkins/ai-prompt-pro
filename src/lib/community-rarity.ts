import type { CommunityPost } from "@/lib/community";
import type { PromptSummary } from "@/lib/persistence";

export type PromptForgeRarity = "common" | "rare" | "epic" | "legendary";
export type CommunityRarityClass = `pf-rarity-${PromptForgeRarity}`;

type CommunityRarityInput = Pick<CommunityPost, "upvoteCount" | "verifiedCount" | "remixCount" | "ratingAverage">;
type LibraryRarityInput = Pick<PromptSummary, "revision" | "sourceCount" | "databaseCount" | "tags" | "isShared" | "remixedFrom">;

export function getCommunityPostRarity(post: CommunityRarityInput): PromptForgeRarity {
  const signal =
    post.upvoteCount +
    post.verifiedCount * 2 +
    post.remixCount * 2 +
    Math.round(post.ratingAverage ?? 0);

  if (signal >= 22) return "legendary";
  if (signal >= 12) return "epic";
  if (signal >= 6) return "rare";
  return "common";
}

export function getCommunityPostRarityClass(post: CommunityRarityInput, isFeatured = false): CommunityRarityClass {
  if (isFeatured) return "pf-rarity-legendary";
  return `pf-rarity-${getCommunityPostRarity(post)}` as CommunityRarityClass;
}

export function getLibraryPromptRarity(prompt: LibraryRarityInput): PromptForgeRarity {
  const weightedSignal =
    prompt.revision +
    prompt.sourceCount +
    prompt.databaseCount +
    Math.min(prompt.tags.length, 4) +
    (prompt.isShared ? 2 : 0) +
    (prompt.remixedFrom ? 1 : 0);

  if (weightedSignal >= 12) return "legendary";
  if (weightedSignal >= 8) return "epic";
  if (weightedSignal >= 4) return "rare";
  return "common";
}
