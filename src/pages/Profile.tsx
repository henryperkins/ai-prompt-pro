import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { CommunityReportDialog } from "@/components/community/CommunityReportDialog";
import { ProfileHero } from "@/components/community/ProfileHero";
import { getBestRarityFromPosts } from "@/components/community/profile-rarity";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/base/buttons/button";
import { StateCard } from "@/components/base/state-card";
import { Skeleton } from "@/components/base/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  type CommunityPost,
  type CommunityProfile,
  type FollowStats,
  type ProfileActivityStats,
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
  loadProfileActivityStats,
  loadProfilesByIds,
  setPromptRating,
  toggleVote,
  unfollowCommunityUser,
} from "@/lib/community";
import { getCommunityPostRarity } from "@/lib/community-rarity";
import {
  blockCommunityUser,
  loadBlockedUserIds,
  submitCommunityReport,
  unblockCommunityUser,
} from "@/lib/community-moderation";
import { toParentTitleMap, toProfileMap } from "@/lib/community-utils";
import { toCommunityErrorState, type CommunityErrorState } from "@/lib/community-errors";
import { copyTextToClipboard } from "@/lib/clipboard";

const PROFILE_PAGE_SIZE = 20;

const EMPTY_ACTIVITY_STATS: ProfileActivityStats = {
  totalPosts: 0,
  totalUpvotes: 0,
  totalVerified: 0,
  averageRating: 0,
};

interface CommunityReportTarget {
  targetType: "post" | "comment";
  postId: string;
  commentId?: string;
  reportedUserId: string | null;
}

type RelationshipLoadStatus = "idle" | "loading" | "ready" | "error";

const Profile = () => {
  const { userId: routeUserId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const profileUserId = routeUserId?.trim() || "";
  const requestToken = useRef(0);
  const voteInFlightByPost = useRef<Set<string>>(new Set());
  const ratingInFlightByPost = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [profileStats, setProfileStats] = useState<FollowStats>({ followersCount: 0, followingCount: 0 });
  const [activityStats, setActivityStats] = useState<ProfileActivityStats>(EMPTY_ACTIVITY_STATS);
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
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedUsersStatus, setBlockedUsersStatus] = useState<RelationshipLoadStatus>("idle");
  const [hasResolvedBlockedUsersOnce, setHasResolvedBlockedUsersOnce] = useState(false);
  const [reportTarget, setReportTarget] = useState<CommunityReportTarget | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const isOwnProfile = Boolean(user?.id && profileUserId && user.id === profileUserId);

  const bestRarity = useMemo(() => getBestRarityFromPosts(posts), [posts]);
  const memberSinceAt = useMemo(() => {
    if (profile?.createdAt) return profile.createdAt;
    if (posts.length === 0) return null;
    return posts.reduce((earliest, post) => Math.min(earliest, post.createdAt), posts[0].createdAt);
  }, [posts, profile?.createdAt]);
  const topPromptPostId = useMemo(() => {
    const epicOrLegendaryPosts = posts
      .filter((post) => {
        const rarity = getCommunityPostRarity(post);
        return rarity === "epic" || rarity === "legendary";
      })
      .sort((a, b) => {
        const aLegendary = getCommunityPostRarity(a) === "legendary" ? 1 : 0;
        const bLegendary = getCommunityPostRarity(b) === "legendary" ? 1 : 0;
        if (aLegendary !== bLegendary) return bLegendary - aLegendary;
        if (a.upvoteCount !== b.upvoteCount) return b.upvoteCount - a.upvoteCount;
        return b.createdAt - a.createdAt;
      });
    return epicOrLegendaryPosts[0]?.id ?? null;
  }, [posts]);
  const orderedPosts = useMemo(() => {
    if (!topPromptPostId) return posts;
    const topPrompt = posts.find((post) => post.id === topPromptPostId);
    if (!topPrompt) return posts;
    return [topPrompt, ...posts.filter((post) => post.id !== topPromptPostId)];
  }, [posts, topPromptPostId]);

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
    setReportTarget(null);

    if (!user?.id) {
      setBlockedUserIds([]);
      setBlockedUsersStatus("idle");
      setHasResolvedBlockedUsersOnce(false);
      return;
    }

    let cancelled = false;
    setBlockedUsersStatus("loading");

    void loadBlockedUserIds()
      .then((ids) => {
        if (!cancelled) {
          setBlockedUserIds(ids);
          setBlockedUsersStatus("ready");
          setHasResolvedBlockedUsersOnce(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load blocked users:", error);
          setBlockedUsersStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const token = ++requestToken.current;

    if (!profileUserId) {
      setProfile(null);
      setProfileStats({ followersCount: 0, followingCount: 0 });
      setActivityStats(EMPTY_ACTIVITY_STATS);
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
    setActivityStats(EMPTY_ACTIVITY_STATS);
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
        const [profilesResult, statsResult, activityResult, firstPageResult, followingResult] = await Promise.allSettled([
          loadProfilesByIds([profileUserId]),
          loadFollowStats(profileUserId),
          loadProfileActivityStats(profileUserId),
          loadPostsByAuthor(profileUserId, { limit: PROFILE_PAGE_SIZE, page: 0 }),
          user?.id && user.id !== profileUserId
            ? isFollowingCommunityUser(profileUserId)
            : Promise.resolve(false),
        ]);

        if (token !== requestToken.current) return;

        if (profilesResult.status !== "fulfilled") {
          throw profilesResult.reason;
        }
        if (firstPageResult.status !== "fulfilled") {
          throw firstPageResult.reason;
        }

        const loadedProfile = profilesResult.value[0] ?? null;
        if (!loadedProfile) {
          setProfile(null);
          setProfileStats({ followersCount: 0, followingCount: 0 });
          setActivityStats(EMPTY_ACTIVITY_STATS);
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

        if (statsResult.status === "rejected") {
          console.error("Failed to load follow stats:", statsResult.reason);
        }
        if (activityResult.status === "rejected") {
          console.error("Failed to load profile activity stats:", activityResult.reason);
        }
        if (followingResult.status === "rejected") {
          console.error("Failed to load follow status:", followingResult.reason);
        }

        const stats = statsResult.status === "fulfilled"
          ? statsResult.value
          : { followersCount: 0, followingCount: 0 };
        const activity = activityResult.status === "fulfilled"
          ? activityResult.value
          : EMPTY_ACTIVITY_STATS;
        const firstPage = firstPageResult.value;
        const following = followingResult.status === "fulfilled" ? followingResult.value : false;

        setProfile(loadedProfile);
        setProfileStats(stats);
        setActivityStats(activity);
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
        setActivityStats(EMPTY_ACTIVITY_STATS);
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

  const handleBlockUser = useCallback(async (targetUserId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to block users." });
      return;
    }
    if (!targetUserId || targetUserId === user.id) {
      return;
    }

    try {
      await blockCommunityUser(targetUserId);
      setBlockedUserIds((previous) => (
        previous.includes(targetUserId) ? previous : [...previous, targetUserId]
      ));
      setBlockedUsersStatus("ready");
      setHasResolvedBlockedUsersOnce(true);
      toast({
        title: "User blocked",
        description: "Posts and comments from this user are now hidden.",
      });
    } catch (error) {
      toast({
        title: "Unable to block user",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    }
  }, [toast, user]);

  const handleUnblockUser = useCallback(async (targetUserId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to manage blocked users." });
      return;
    }

    try {
      await unblockCommunityUser(targetUserId);
      setBlockedUserIds((previous) => previous.filter((id) => id !== targetUserId));
      setBlockedUsersStatus("ready");
      setHasResolvedBlockedUsersOnce(true);
      toast({ title: "User unblocked" });
    } catch (error) {
      toast({
        title: "Unable to unblock user",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    }
  }, [toast, user]);

  const handleReportPost = useCallback((post: CommunityPost) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to submit reports." });
      return;
    }

    setReportTarget({
      targetType: "post",
      postId: post.id,
      reportedUserId: post.authorId,
    });
  }, [toast, user]);

  const handleReportComment = useCallback((commentId: string, userId: string, postId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to submit reports." });
      return;
    }

    setReportTarget({
      targetType: "comment",
      postId,
      commentId,
      reportedUserId: userId,
    });
  }, [toast, user]);

  const handleSubmitReport = useCallback(async ({ reason, details }: { reason: string; details: string }) => {
    if (!reportTarget) return;

    setReportSubmitting(true);
    try {
      await submitCommunityReport({
        targetType: reportTarget.targetType,
        postId: reportTarget.postId,
        commentId: reportTarget.commentId ?? null,
        reportedUserId: reportTarget.reportedUserId,
        reason,
        details,
      });
      setReportTarget(null);
      toast({
        title: "Thanks for the report",
        description: "We review reports and take action when needed.",
      });
    } catch (error) {
      toast({
        title: "Failed to submit report",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setReportSubmitting(false);
    }
  }, [reportTarget, toast]);

  const handleRetry = useCallback(() => {
    setRetryNonce((prev) => prev + 1);
  }, []);

  const blockFilterReady =
    !user?.id || blockedUsersStatus === "ready" || hasResolvedBlockedUsersOnce;
  const effectiveBlockedUserIds = useMemo(
    () => (blockFilterReady ? blockedUserIds : []),
    [blockFilterReady, blockedUserIds],
  );
  const profileAuthorBlocked = profile ? effectiveBlockedUserIds.includes(profile.id) : false;
  const visiblePosts = useMemo(
    () =>
      blockFilterReady
        ? orderedPosts.filter((post) => !effectiveBlockedUserIds.includes(post.authorId))
        : [],
    [blockFilterReady, effectiveBlockedUserIds, orderedPosts],
  );
  const hiddenPostCount = blockFilterReady ? orderedPosts.length - visiblePosts.length : 0;

  return (
    <PageShell>
      <div className="community-typography pf-community-page" data-density="comfortable">
        {!loading && errorState && (
          <StateCard
            variant="error"
            title={errorState.kind === "not_found" ? "Profile not found" : "Couldn't load profile"}
            description={errorState.message}
            primaryAction={{ label: "Retry", onClick: handleRetry }}
            secondaryAction={{ label: "Open Community", to: "/community" }}
          />
        )}

        {!errorState && loading && !profile && (
          <div className="space-y-3">
            {/* Loading skeleton for hero */}
            <div className="pf-gilded-frame rounded-2xl px-4 py-6 sm:px-6 sm:py-8">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
                <Skeleton className="h-20 w-20 rounded-full sm:h-24 sm:w-24" />
                <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-1 h-9 w-24" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {!loading && !errorState && profile && !blockFilterReady && (
          <StateCard
            variant="empty"
            title="Loading content protections"
            description="We’re checking your blocked-user list before showing this profile."
            primaryAction={{ label: "Back to community", onClick: () => navigate("/community") }}
          />
        )}

        {!loading && !errorState && profile && blockFilterReady && profileAuthorBlocked && (
          <StateCard
            variant="empty"
            title="You blocked this user"
            description="Posts and comments from blocked users are hidden until you unblock them."
            primaryAction={{ label: "Unblock user", onClick: () => void handleUnblockUser(profile.id) }}
            secondaryAction={{ label: "Back to community", to: "/community" }}
          />
        )}

        {!errorState && profile && blockFilterReady && !profileAuthorBlocked && (
          <>
            <ProfileHero
              profile={profile}
              followStats={profileStats}
              activityStats={activityStats}
              bestRarity={bestRarity}
              memberSinceAt={memberSinceAt}
              isOwnProfile={isOwnProfile}
              isFollowing={isFollowing}
              followPending={followPending}
              onToggleFollow={() => void handleToggleFollow()}
            />

            <CommunityFeed
              posts={visiblePosts}
              loading={loading}
              errorMessage={errorState?.message}
              errorType={errorState?.kind}
              blockFilterReady={blockFilterReady}
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
              currentUserId={user?.id ?? null}
              blockedUserIds={effectiveBlockedUserIds}
              onReportPost={handleReportPost}
              onReportComment={handleReportComment}
              onBlockUser={handleBlockUser}
              onUnblockUser={handleUnblockUser}
              featuredPostId={topPromptPostId}
              selectedPostId={topPromptPostId}
              featuredPostBadgeLabel={topPromptPostId ? "Top Prompt" : undefined}
              suppressAutoFeatured={Boolean(topPromptPostId)}
              rawPostCount={orderedPosts.length}
              hiddenPostCount={hiddenPostCount}
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

        <CommunityReportDialog
          open={reportTarget !== null}
          targetLabel={reportTarget?.targetType ?? "content"}
          submitting={reportSubmitting}
          onOpenChange={(open) => {
            if (!open && !reportSubmitting) {
              setReportTarget(null);
            }
          }}
          onSubmit={handleSubmitReport}
        />

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            className="type-button-label h-11 sm:h-9"
            onClick={() => navigate("/community")}
          >
            Back to community
          </Button>
        </div>
      </div>
    </PageShell>
  );
};

export default Profile;
