import type { CommunityPost } from "@/lib/community";
import { getCommunityPostRarity, type PromptForgeRarity } from "@/lib/community-rarity";

export function getBestRarityFromPosts(posts: CommunityPost[]): PromptForgeRarity {
  const order: PromptForgeRarity[] = ["common", "rare", "epic", "legendary"];
  let best: PromptForgeRarity = "common";
  for (const post of posts) {
    const rarity = getCommunityPostRarity(post);
    if (order.indexOf(rarity) > order.indexOf(best)) {
      best = rarity;
    }
  }
  return best;
}
