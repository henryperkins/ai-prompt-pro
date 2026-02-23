import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { CommunityReportDialog } from "@/components/community/CommunityReportDialog";
import { PageHero, PageShell } from "@/components/PageShell";
import { Button } from "@/components/base/buttons/button";
import { StateCard } from "@/components/base/primitives/state-card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { brandCopy } from "@/lib/brand-copy";
import {
  type CommunityPost,
  type CommunityProfile,
  type VoteState,
  type VoteType,
  computeNextPromptRatingSummary,
  loadMyRatings,
  loadMyVotes,
  loadPersonalFeed,
  loadPostsByIds,
  loadProfilesByIds,
  setPromptRating,
  toggleVote,
} from "@/lib/community";
import { toCommunityErrorState, type CommunityErrorState } from "@/lib/community-errors";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  blockCommunityUser,
  loadBlockedUserIds,
  submitCommunityReport,
  unblockCommunityUser,
} from "@/lib/community-moderation";

const FEED_PAGE_SIZE = 20;

interface CommunityReportTarget {
  targetType: "post" | "comment";
  postId: string;
  commentId?: string;
  reportedUserId: string | null;
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

const Feed = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [authorById, setAuthorById] = useState<Record<string, CommunityProfile>>({});
  const [parentTitleById, setParentTitleById] = useState<Record<string, string>>({});
  const [voteStateByPost, setVoteStateByPost] = useState<Record<string, VoteState>>({});
  const [ratingByPost, setRatingByPost] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [errorState, setErrorState] = useState<CommunityErrorState | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [reportTarget, setReportTarget] = useState<CommunityReportTarget | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const requestToken = useRef(0);
  const voteInFlightByPost = useRef<Set<string>>(new Set());
  const ratingInFlightByPost = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) {
      setBlockedUserIds([]);
      return;
    }

    let cancelled = false;
    void loadBlockedUserIds()
      .then((ids) => {
        if (!cancelled) {
          setBlockedUserIds(ids);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load blocked users:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const hydrateFeedContext = useCallback(
    async (
      targetPosts: CommunityPost[],
      token: number,
      mode: "replace" | "merge" = "replace",
    ) => {
      const authorIds = Array.from(new Set(targetPosts.map((post) => post.authorId)));
      const parentIds = Array.from(
        new Set(targetPosts.map((post) => post.remixedFrom).filter((value): value is string => !!value)),
      );

      const [authorProfilesResult, parentPostsResult, voteStatesResult, ratingsResult] = await Promise.allSettled([
        loadProfilesByIds(authorIds),
        loadPostsByIds(parentIds),
        loadMyVotes(targetPosts.map((post) => post.id)),
        loadMyRatings(targetPosts.map((post) => post.id)),
      ]);

      if (token !== requestToken.current) return;

      const authorProfiles = authorProfilesResult.status === "fulfilled" ? authorProfilesResult.value : [];
      const parentPosts = parentPostsResult.status === "fulfilled" ? parentPostsResult.value : [];
      const voteStates = voteStatesResult.status === "fulfilled" ? voteStatesResult.value : {};
      const ratings = ratingsResult.status === "fulfilled" ? ratingsResult.value : {};
      const nextAuthors = toProfileMap(authorProfiles);
      const nextParentTitles = toParentTitleMap(parentPosts);

      if (mode === "merge") {
        setAuthorById((previous) => ({ ...previous, ...nextAuthors }));
        setParentTitleById((previous) => ({ ...previous, ...nextParentTitles }));
        setVoteStateByPost((previous) => ({ ...previous, ...voteStates }));
        setRatingByPost((previous) => ({ ...previous, ...ratings }));
        return;
      }

      setAuthorById(nextAuthors);
      setParentTitleById(nextParentTitles);
      setVoteStateByPost(voteStates);
      setRatingByPost(ratings);
    },
    [],
  );

  useEffect(() => {
    const token = ++requestToken.current;

    if (!user?.id) {
      setPosts([]);
      setAuthorById({});
      setParentTitleById({});
      setVoteStateByPost({});
      setRatingByPost({});
      setHasMore(false);
      setIsLoadingMore(false);
      setPage(0);
      setErrorState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setIsLoadingMore(false);
    setErrorState(null);

    void (async () => {
      try {
        const firstPage = await loadPersonalFeed({
          limit: FEED_PAGE_SIZE,
          page: 0,
        });
        if (token !== requestToken.current) return;

        setPosts(firstPage);
        setPage(0);
        setHasMore(firstPage.length === FEED_PAGE_SIZE);
        await hydrateFeedContext(firstPage, token);
      } catch (error) {
        if (token !== requestToken.current) return;
        setPosts([]);
        setPage(0);
        setHasMore(false);
        setAuthorById({});
        setParentTitleById({});
        setVoteStateByPost({});
        setRatingByPost({});
        setErrorState(toCommunityErrorState(error, "Failed to load personal feed."));
      } finally {
        if (token === requestToken.current) {
          setLoading(false);
        }
      }
    })();
  }, [hydrateFeedContext, retryNonce, user?.id]);

  const handleLoadMore = useCallback(() => {
    if (loading || isLoadingMore || !hasMore || !user?.id) return;
    const token = requestToken.current;
    const nextPage = page + 1;
    setIsLoadingMore(true);

    void (async () => {
      try {
        const nextPagePosts = await loadPersonalFeed({
          limit: FEED_PAGE_SIZE,
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
        setHasMore(nextPagePosts.length === FEED_PAGE_SIZE);
        if (dedupedNewPosts.length > 0) {
          await hydrateFeedContext(dedupedNewPosts, token, "merge");
        }
      } catch (error) {
        if (token !== requestToken.current) return;
        toast({
          title: "Could not load more posts",
          description: error instanceof Error ? error.message : "Unexpected error while loading your feed.",
          variant: "destructive",
        });
      } finally {
        if (token === requestToken.current) {
          setIsLoadingMore(false);
        }
      }
    })();
  }, [hasMore, hydrateFeedContext, isLoadingMore, loading, page, posts, toast, user?.id]);

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

  const visiblePosts = useMemo(
    () => posts.filter((post) => !blockedUserIds.includes(post.authorId)),
    [blockedUserIds, posts],
  );

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

  return (
    <PageShell>
      <div className="community-typography pf-community-page" data-density="comfortable">
        <PageHero
          eyebrow={brandCopy.brandLine}
          title="Personal Feed"
          subtitle="Latest shared prompts from people you follow."
          className="pf-gilded-frame pf-hero-surface"
        />

        {!user && (
          <StateCard
            variant="empty"
            title="Sign in to view your personal feed"
            description="Follow creators to get their latest prompt updates here."
            primaryAction={{ label: "Go to Builder", to: "/" }}
            secondaryAction={{ label: "Open Community", to: "/community" }}
          />
        )}

        {user && (
          <>
            <div className="mb-4 flex items-center justify-end">
              <Button
                type="button"
                color="secondary"
                size="sm"
                className="type-button-label h-11 sm:h-9"
                onClick={() => navigate("/community")}
              >
                Find creators to follow
              </Button>
            </div>

            <CommunityFeed
              posts={visiblePosts}
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
              currentUserId={user.id}
              blockedUserIds={blockedUserIds}
              onReportPost={handleReportPost}
              onReportComment={handleReportComment}
              onBlockUser={handleBlockUser}
              onUnblockUser={handleUnblockUser}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleLoadMore}
              onRetry={handleRetry}
            />
          </>
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
      </div>
    </PageShell>
  );
};

export default Feed;
