import { useEffect, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProfileHero } from "@/components/community/ProfileHero";
import type { CommunityProfile, FollowStats, ProfileActivityStats } from "@/lib/community";

const profile: CommunityProfile = {
  id: "story-profile",
  displayName: "Ari Flint",
  avatarUrl: null,
  createdAt: Date.UTC(2024, 6, 12),
};

const followStats: FollowStats = {
  followersCount: 1284,
  followingCount: 96,
};

const activityStats: ProfileActivityStats = {
  totalPosts: 42,
  totalUpvotes: 318,
  totalVerified: 27,
  averageRating: 4.8,
};

function ThemeFrame({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    root.dataset.theme = "default";

    return () => {
      if (previousTheme) {
        root.dataset.theme = previousTheme;
        return;
      }
      delete root.dataset.theme;
    };
  }, []);

  return <div className="mx-auto max-w-5xl p-4">{children}</div>;
}

const meta = {
  title: "Design System/Branded/ProfileHero",
  component: ProfileHero,
  args: {
    profile,
    followStats,
    activityStats,
    bestRarity: "legendary",
    memberSinceAt: profile.createdAt,
    isOwnProfile: false,
    isFollowing: false,
    followPending: false,
    onToggleFollow: () => {},
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <ThemeFrame>
        <Story />
      </ThemeFrame>
    ),
  ],
} satisfies Meta<typeof ProfileHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ViewerState: Story = {};

export const FollowingState: Story = {
  args: {
    isFollowing: true,
  },
};

export const OwnProfileState: Story = {
  args: {
    isOwnProfile: true,
    isFollowing: false,
  },
};
