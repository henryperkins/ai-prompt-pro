import { format } from "date-fns";
import type { CommunityPost, FollowStats, ProfileActivityStats, CommunityProfile } from "@/lib/community";
import { getInitials } from "@/lib/community-utils";
import { getCommunityPostRarity, type PromptForgeRarity } from "@/lib/community-rarity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/base/primitives/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { cn } from "@/lib/utils";
import { ArrowUp, CheckCircle as CheckCircle2, Fire as Flame, Star } from "@phosphor-icons/react";

interface ProfileHeroProps {
  profile: CommunityProfile;
  followStats: FollowStats;
  activityStats: ProfileActivityStats;
  bestRarity: PromptForgeRarity;
  memberSinceAt?: number | null;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followPending: boolean;
  onToggleFollow: () => void;
}

const RARITY_RING: Record<PromptForgeRarity, string> = {
  common: "ring-[rgba(var(--pf-slate-rgb)/0.7)]",
  rare: "ring-[rgba(var(--pf-arcane-rgb)/0.65)]",
  epic: "ring-[rgba(var(--pf-ember-rgb)/0.6)]",
  legendary: "ring-[rgba(var(--pf-gold-rgb)/0.7)]",
};

const RARITY_GLOW: Record<PromptForgeRarity, string> = {
  common: "",
  rare: "shadow-[0_0_18px_rgba(var(--pf-arcane-rgb)/0.18)]",
  epic: "shadow-[0_0_22px_rgba(var(--pf-ember-rgb)/0.16)]",
  legendary: "shadow-[0_0_26px_rgba(var(--pf-gold-rgb)/0.2)]",
};

const RARITY_LABEL: Record<PromptForgeRarity, string> = {
  common: "",
  rare: "Rare Creator",
  epic: "Epic Creator",
  legendary: "Legendary Creator",
};

const RARITY_BADGE_COLOR: Record<PromptForgeRarity, string> = {
  common: "",
  rare: "border-[rgba(var(--pf-arcane-rgb)/0.5)] bg-[rgba(var(--pf-arcane-rgb)/0.12)] text-[var(--pf-arcane-teal)]",
  epic: "border-[rgba(var(--pf-ember-rgb)/0.5)] bg-[rgba(var(--pf-ember-rgb)/0.12)] text-[var(--pf-ember-orange)]",
  legendary: "border-[rgba(var(--pf-gold-rgb)/0.5)] bg-[rgba(var(--pf-gold-rgb)/0.12)] text-[var(--pf-forge-gold)]",
};

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

const STAT_CELLS: Array<{
  key: keyof ProfileActivityStats;
  label: string;
  icon: typeof Flame;
  format: (value: number) => string;
}> = [
  { key: "totalPosts", label: "Prompts", icon: Flame, format: (v) => String(v) },
  { key: "totalUpvotes", label: "Upvotes", icon: ArrowUp, format: (v) => String(v) },
  { key: "totalVerified", label: "Verified", icon: CheckCircle2, format: (v) => String(v) },
  { key: "averageRating", label: "Avg Rating", icon: Star, format: (v) => v > 0 ? v.toFixed(1) : "--" },
];

export function ProfileHero({
  profile,
  followStats,
  activityStats,
  bestRarity,
  memberSinceAt = null,
  isOwnProfile,
  isFollowing,
  followPending,
  onToggleFollow,
}: ProfileHeroProps) {
  const showRarityBadge = bestRarity !== "common";
  const memberSinceLabel = memberSinceAt
    ? `Member since ${format(new Date(memberSinceAt), "MMMM yyyy")}`
    : "Member since recently";

  return (
    <div className="mb-4 space-y-3">
      {/* Hero card */}
      <div className="pf-gilded-frame pf-hero-surface px-4 py-6 sm:px-6 sm:py-8">
        <div className="relative z-[1] flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
          {/* Avatar with rarity ring */}
          <div
            className={cn(
              "relative shrink-0 rounded-full ring-[3px] ring-offset-2 ring-offset-transparent",
              RARITY_RING[bestRarity],
              RARITY_GLOW[bestRarity],
            )}
          >
            <Avatar className="h-20 w-20 border-2 border-border/40 sm:h-24 sm:w-24">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.displayName} />
              <AvatarFallback className="text-lg font-semibold">
                {getInitials(profile.displayName)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Identity */}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="pf-text-display text-xl font-bold text-[rgba(var(--pf-parchment-rgb)/0.97)] sm:text-2xl"
                style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
              >
                {profile.displayName}
              </h1>
              {isOwnProfile && (
                <Badge type="modern" className="type-chip border border-border/60 bg-background/30 text-foreground/80">
                  You
                </Badge>
              )}
              {showRarityBadge && (
                <Badge
                  type="modern"
                  className={cn("type-chip border text-xs font-semibold", RARITY_BADGE_COLOR[bestRarity])}
                >
                  {RARITY_LABEL[bestRarity]}
                </Badge>
              )}
            </div>
            <p className="type-meta text-[rgba(var(--pf-parchment-rgb)/0.82)]">{memberSinceLabel}</p>

            {/* Follow stats as side-by-side stat cells */}
            <div className="grid w-full grid-cols-2 gap-2 sm:max-w-[280px]">
              <div className="rounded-lg border border-border/60 bg-background/20 px-3 py-2 text-center">
                <span className="type-numeric block text-base text-[rgba(var(--pf-parchment-rgb)/0.97)]">
                  {followStats.followersCount}
                </span>{" "}
                <span className="type-meta text-[rgba(var(--pf-parchment-rgb)/0.82)]">Followers</span>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/20 px-3 py-2 text-center">
                <span className="type-numeric block text-base text-[rgba(var(--pf-parchment-rgb)/0.97)]">
                  {followStats.followingCount}
                </span>{" "}
                <span className="type-meta text-[rgba(var(--pf-parchment-rgb)/0.82)]">Following</span>
              </div>
            </div>

            {/* Follow button */}
            {!isOwnProfile && (
              <Button
                type="button"
                size="sm"
                color={isFollowing ? "secondary" : "primary"}
                className="type-button-label mt-1 h-10 min-w-[100px] sm:h-9"
                onClick={onToggleFollow}
                disabled={followPending}
              >
                {followPending ? "Saving..." : isFollowing ? "Following" : "Follow"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Activity stats strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAT_CELLS.map(({ key, label, icon: Icon, format }) => (
          <div
            key={key}
            className="pf-card flex flex-col items-center gap-1 rounded-xl border border-border/60 px-3 py-3 text-center"
            style={{ transform: "none" }}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="type-numeric text-lg font-bold text-foreground">
              {format(activityStats[key])}
            </span>
            <span className="type-meta text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Section divider + heading */}
      <div className="space-y-2 pt-1">
        <div className="pf-divider" />
        <div className="flex items-center justify-between px-1">
          <h2 className="type-post-title text-foreground">Published Prompts</h2>
          <Badge
            type="modern"
            className="type-chip type-numeric border border-border/60 bg-background/60 text-muted-foreground"
          >
            {activityStats.totalPosts}
          </Badge>
        </div>
      </div>
    </div>
  );
}
