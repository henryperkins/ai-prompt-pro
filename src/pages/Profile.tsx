import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { PageHero, PageShell } from "@/components/PageShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/base/primitives/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
import { StateCard } from "@/components/base/primitives/state-card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { brandCopy } from "@/lib/brand-copy";
import {
  type CommunityPost,
  type CommunityProfile,
  type FollowStats,
  type VoteState,
  type VoteType,
  computeNextPromptRatingSummary,
  followCommunityUser,
  isFollowingCommunityUser,
  loadFollowStats,
  loadMyRatings,
  loadMyVotes,
  loadPostsByAuthor,
  loadPostsByIds,
  loadProfilesByIds,
  setPromptRating,
  toggleVote,
  unfollowCommunityUser,
} from "@/lib/community";
import { toCommunityErrorState, type CommunityErrorState } from "@/lib/community-errors";
import { copyTextToClipboard } from "@/lib/clipboard";

const PROFILE_PAGE_SIZE = 20;

function getInitials(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function toProfileMap(profiles: CommunityProfile[]): Record<string, CommunityProfile> {
  return profiles.reduce<Record<string, CommunityProfile>>((map, profile) => {
    map[profile.id] = profile;
    return map;
  }, {});
}

function toParentTitleMap(posts: CommunityPost[]): Record<string, string> {
  return posts.reduce<Record<string, string>>((map, post) => {
    map[post.id] = post.title;
    return map;
  }, {});
}

const Profile = () => {
  const { userId: routeUserId } = useParams<{ userId: string }>();
  const profileUserId = routeUserId?.trim() || "";
  const requestToken = useRef(0);
  const voteInFlightByPost = useRef<Set<string>>(new Set());
  const ratingInFlightByPost = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [profileStats, setProfileStats] = useState<FollowStats>({ followersCount: 0, followingCount: 0 });
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [authorById, setAuthorById] = useState<Record<string, CommunityProfile>>({});
  const [parentTitleById, setParentTitleById] = useState<Record<string, string>>({});
  const [voteStateByPost, setVoteStateByPost] = useState<Record<string, VoteState>>({});
  const [ratingByPost, setRatingByPost] = useState<Record<string, number | null>>({});
  const [isFollowing, setIsFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [errorState, setErrorState] = useState<CommunityErrorState | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const isOwnProfile = Boolean(user?.id && profileUserId && user.id === profileUserId);

  const hydratePostContext = useCallback(
    async (
      targetPosts: CommunityPost[],
      token: number,
      mode: "replace" | "merge" = "replace",
    ) => {
      const parentIds = Array.from(
        new Set(targetPosts.map((post) => post.remixedFrom).filter((value): value is string => !!value)),
      );

      const [parentPostsResult, voteStatesResult, ratingsResult] = await Promise.allSettled([
        loadPostsByIds(parentIds),
        loadMyVotes(targetPosts.map((post) => post.id)),
        loadMyRatings(targetPosts.map((post) => post.id)),
      ]);

      if (token !== requestToken.current) return;

      const parentPosts = parentPostsResult.status === "fulfilled" ? parentPostsResult.value : [];
      const voteStates = voteStatesResult.status === "fulfilled" ? voteStatesResult.value : {};
      const ratings = ratingsResult.status === "fulfilled" ? ratingsResult.value : {};
      const nextParentTitles = toParentTitleMap(parentPosts);

      if (mode === "merge") {
        setParentTitleById((previous) => ({ ...previous, ...nextParentTitles }));
        setVoteStateByPost((previous) => ({ ...previous, ...voteStates }));
        setRatingByPost((previous) => ({ ...previous, ...ratings }));
        return;
      }

      setParentTitleById(nextParentTitles);
      setVoteStateByPost(voteStates);
      setRatingByPost(ratings);
    },
    [],
  );

  useEffect(() => {
    const token = ++requestToken.current;

    if (!profileUserId) {
      setProfile(null);
      setProfileStats({ followersCount: 0, followingCount: 0 });
      setPosts([]);
      setAuthorById({});
      setParentTitleById({});
      setVoteStateByPost({});
      setRatingByPost({});
      setHasMore(false);
      setPage(0);
      setIsFollowing(false);
      setFollowPending(false);
      setIsLoadingMore(false);
      setLoading(false);
      setErrorState({
        kind: "not_found",
        message: "This profile link is invalid.",
      });
      return;
    }

    setProfile(null);
    setProfileStats({ followersCount: 0, followingCount: 0 });
    setPosts([]);
    setAuthorById({});
    setParentTitleById({});
    setVoteStateByPost({});
    setRatingByPost({});
    setHasMore(false);
    setPage(0);
    setIsFollowing(false);
    setFollowPending(false);
    setLoading(true);
    setIsLoadingMore(false);
    setErrorState(null);

    void (async () => {
      try {
        const [profiles, stats, firstPage, following] = await Promise.all([
          loadProfilesByIds([profileUserId]),
          loadFollowStats(profileUserId),
          loadPostsByAuthor(profileUserId, { limit: PROFILE_PAGE_SIZE, page: 0 }),
          user?.id && user.id !== profileUserId
            ? isFollowingCommunityUser(profileUserId)
            : Promise.resolve(false),
        ]);

        if (token !== requestToken.current) return;

        const loadedProfile = profiles[0] ?? null;
        if (!loadedProfile) {
          setProfile(null);
          setProfileStats({ followersCount: 0, followingCount: 0 });
          setPosts([]);
          setAuthorById({});
          setParentTitleById({});
          setVoteStateByPost({});
          setRatingByPost({});
          setHasMore(false);
          setPage(0);
          setIsFollowing(false);
          setFollowPending(false);
          setErrorState({
            kind: "not_found",
            message: "This profile is unavailable.",
          });
          return;
        }

        setProfile(loadedProfile);
        setProfileStats(stats);
        setPosts(firstPage);
        setAuthorById(toProfileMap([loadedProfile]));
        setPage(0);
        setHasMore(firstPage.length === PROFILE_PAGE_SIZE);
        setIsFollowing(following);
        await hydratePostContext(firstPage, token);
      } catch (error) {
        if (token !== requestToken.current) return;
        setProfile(null);
        setProfileStats({ followersCount: 0, followingCount: 0 });
        setPosts([]);
        setAuthorById({});
        setParentTitleById({});
        setVoteStateByPost({});
        setRatingByPost({});
        setHasMore(false);
        setPage(0);
        setIsFollowing(false);
        setFollowPending(false);
        setErrorState(toCommunityErrorState(error, "Failed to load profile."));
      } finally {
        if (token === requestToken.current) {
          setLoading(false);
        }
      }
    })();
  }, [hydratePostContext, profileUserId, retryNonce, user?.id]);

  const handleLoadMore = useCallback(() => {
    if (loading || isLoadingMore || !hasMore || !profileUserId) return;
    const token = requestToken.current;
    const nextPage = page + 1;
    setIsLoadingMore(true);

    void (async () => {
      try {
        const nextPagePosts = await loadPostsByAuthor(profileUserId, {
          limit: PROFILE_PAGE_SIZE,
          page: nextPage,
        });
        if (token !== requestToken.current) return;

        const seenIds = new Set(posts.map((post) => post.id));
        const dedupedNewPosts = nextPagePosts.filter((post) => !seenIds.has(post.id));

        setPosts((previous) => {
          const previousIds = new Set(previous.map((post) => post.id));
          const dedupedAgainstPrevious = nextPagePosts.filter((post) => !previousIds.has(post.id));
          return [...previous, ...dedupedAgainstPrevious];
        });
        setPage(nextPage);
        setHasMore(nextPagePosts.length === PROFILE_PAGE_SIZE);
        if (dedupedNewPosts.length > 0) {
          await hydratePostContext(dedupedNewPosts, token, "merge");
        }
      } catch (error) {
        if (token !== requestToken.current) return;
        toast({
          title: "Could not load more posts",
          description: error instanceof Error ? error.message : "Unexpected error while loading profile posts.",
          variant: "destructive",
        });
      } finally {
        if (token === requestToken.current) {
          setIsLoadingMore(false);
        }
      }
    })();
  }, [hasMore, hydratePostContext, isLoadingMore, loading, page, posts, profileUserId, toast]);

  const handleToggleFollow = useCallback(async () => {
    if (!profileUserId || isOwnProfile) return;

    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to follow creators." });
      return;
    }

    setFollowPending(true);
    try {
      if (isFollowing) {
        await unfollowCommunityUser(profileUserId);
        setIsFollowing(false);
        setProfileStats((previous) => ({
          ...previous,
          followersCount: Math.max(0, previous.followersCount - 1),
        }));
      } else {
        await followCommunityUser(profileUserId);
        setIsFollowing(true);
        setProfileStats((previous) => ({
          ...previous,
          followersCount: previous.followersCount + 1,
        }));
      }
    } catch (error) {
      toast({
        title: "Follow action failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setFollowPending(false);
    }
  }, [isFollowing, isOwnProfile, profileUserId, toast, user]);

  const handleCopyPrompt = useCallback(
    async (post: CommunityPost) => {
      try {
        await copyTextToClipboard(post.enhancedPrompt || post.starterPrompt);
        toast({
          title: "Prompt copied",
          description: "Prompt text copied with context-ready formatting.",
        });
      } catch {
        toast({
          title: "Copy failed",
          description: "Could not access clipboard in this browser context.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleToggleVote = useCallback(
    async (postId: string, voteType: VoteType) => {
      if (!user) {
        toast({ title: "Sign in required", description: "Create an account to vote." });
        return;
      }
      if (voteInFlightByPost.current.has(postId)) return;
      voteInFlightByPost.current.add(postId);
      try {
        const result = await toggleVote(postId, voteType);
        setVoteStateByPost((prev) => ({
          ...prev,
          [postId]: {
            upvote: voteType === "upvote" ? result.active : prev[postId]?.upvote ?? false,
            verified: voteType === "verified" ? result.active : prev[postId]?.verified ?? false,
          },
        }));
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            const delta = result.active ? 1 : -1;
            if (voteType === "upvote") {
              return { ...post, upvoteCount: Math.max(0, post.upvoteCount + delta) };
            }
            return { ...post, verifiedCount: Math.max(0, post.verifiedCount + delta) };
          }),
        );
      } catch (error) {
        toast({
          title: "Vote failed",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      } finally {
        voteInFlightByPost.current.delete(postId);
      }
    },
    [toast, user],
  );

  const handleRatePrompt = useCallback(
    async (postId: string, rating: number | null) => {
      if (!user) {
        toast({ title: "Sign in required", description: "Create an account to rate prompts." });
        return;
      }
      if (ratingInFlightByPost.current.has(postId)) return;
      ratingInFlightByPost.current.add(postId);

      const previousRating = ratingByPost[postId] ?? null;

      try {
        const result = await setPromptRating(postId, rating);
        setRatingByPost((prev) => ({
          ...prev,
          [postId]: result.rating,
        }));
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            const summary = computeNextPromptRatingSummary({
              currentCount: post.ratingCount ?? 0,
              currentAverage: post.ratingAverage ?? 0,
              previousRating,
              nextRating: result.rating,
            });
            return {
              ...post,
              ratingCount: summary.ratingCount,
              ratingAverage: summary.ratingAverage,
            };
          }),
        );
      } catch (error) {
        toast({
          title: "Rating failed",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      } finally {
        ratingInFlightByPost.current.delete(postId);
      }
    },
    [ratingByPost, toast, user],
  );

  const handleCommentAdded = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post,
      ),
    );
  }, []);

  const handleRetry = useCallback(() => {
    setRetryNonce((prev) => prev + 1);
  }, []);

  const subtitle = useMemo(() => {
    if (profile) {
      return "Public prompts, remix activity, and social stats.";
    }
    return "Community profile";
  }, [profile]);

  return (
    <PageShell>
      <div className="community-typography" data-density="comfortable">
        <PageHero
          eyebrow={brandCopy.brandLine}
          title={profile ? `${profile.displayName}` : "Profile"}
          subtitle={subtitle}
        />

        {!loading && errorState && (
          <StateCard
            variant="error"
            title={errorState.kind === "not_found" ? "Profile not found" : "Couldn’t load profile"}
            description={errorState.message}
            primaryAction={{ label: "Retry", onClick: handleRetry }}
            secondaryAction={{ label: "Open Community", to: "/community" }}
          />
        )}

        {!errorState && profile && (
          <>
            <Card className="mb-4 border-border/80 bg-card/85 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar className="h-12 w-12 border border-border/60">
                  <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.displayName} />
                  <AvatarFallback>{getInitials(profile.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">{profile.displayName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{profileStats.followersCount} followers</Badge>
                    <Badge variant="secondary">{profileStats.followingCount} following</Badge>
                    <Badge variant="outline">{posts.length} visible prompts</Badge>
                  </div>
                </div>
                {isOwnProfile ? (
                  <Badge variant="outline">You</Badge>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant={isFollowing ? "outline" : "default"}
                    className="h-11 sm:h-9"
                    onClick={() => void handleToggleFollow()}
                    disabled={followPending}
                  >
                    {followPending ? "Saving..." : isFollowing ? "Following" : "Follow"}
                  </Button>
                )}
              </div>
            </Card>

            <CommunityFeed
              posts={posts}
              loading={loading}
              errorMessage={errorState?.message}
              errorType={errorState?.kind}
              authorById={authorById}
              parentTitleById={parentTitleById}
              onCopyPrompt={handleCopyPrompt}
              onToggleVote={handleToggleVote}
              voteStateByPost={voteStateByPost}
              onCommentAdded={handleCommentAdded}
              canVote={Boolean(user)}
              canRate={Boolean(user)}
              ratingByPost={ratingByPost}
              onRatePrompt={handleRatePrompt}
              currentUserId={null}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              onRetry={handleRetry}
            />
          </>
        )}

        {!errorState && !profile && !loading && (
          <StateCard
            variant="empty"
            title="Profile not found"
            description="The requested profile is unavailable."
            primaryAction={{ label: "Open Community", to: "/community" }}
            secondaryAction={{ label: "Go to Builder", to: "/" }}
          />
        )}

        {!errorState && loading && !profile && (
          <StateCard
            variant="empty"
            title="Loading profile"
            description="Please wait while we load this profile."
            primaryAction={{ label: "Open Community", to: "/community" }}
            secondaryAction={{ label: "Go to Builder", to: "/" }}
          />
        )}

        <div className="mt-4 flex justify-end">
          <Button asChild variant="ghost" size="sm" className="h-11 sm:h-9">
            <Link to="/community">Back to community</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
};

export default Profile;
