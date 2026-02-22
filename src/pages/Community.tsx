import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { CommunityReportDialog } from "@/components/community/CommunityReportDialog";
import { PageHero, PageShell } from "@/components/PageShell";
import { Button } from "@/components/base/buttons/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/base/primitives/drawer";
import { InputBase } from "@/components/base/input/input";
import { ScrollArea } from "@/components/base/primitives/scroll-area";
import { useCommunityMobileTelemetry } from "@/hooks/useCommunityMobileTelemetry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { brandCopy } from "@/lib/brand-copy";
import {
  type CommunityPost,
  type CommunityProfile,
  type CommunitySort,
  type VoteState,
  type VoteType,
  computeNextPromptRatingSummary,
  loadFeed,
  loadMyRatings,
  loadMyVotes,
  loadPostsByIds,
  loadProfilesByIds,
  setPromptRating,
  toggleVote,
} from "@/lib/community";
import { communityFeatureFlags } from "@/lib/feature-flags";
import { toCommunityErrorState, type CommunityErrorState } from "@/lib/community-errors";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  blockCommunityUser,
  loadBlockedUserIds,
  submitCommunityReport,
  unblockCommunityUser,
} from "@/lib/community-moderation";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: Array<{ label: string; value: CommunitySort }> = [
  { label: "Trending", value: "popular" },
  { label: "Newest", value: "new" },
  { label: "Most Remixed", value: "most_remixed" },
  { label: "Verified", value: "verified" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  ...PROMPT_CATEGORY_OPTIONS,
];
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

const Community = () => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [authorById, setAuthorById] = useState<Record<string, CommunityProfile>>({});
  const [parentTitleById, setParentTitleById] = useState<Record<string, string>>({});
  const [voteStateByPost, setVoteStateByPost] = useState<Record<string, VoteState>>({});
  const [ratingByPost, setRatingByPost] = useState<Record<string, number | null>>({});
  const [sort, setSort] = useState<CommunitySort>("new");
  const [category, setCategory] = useState("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mobileCategorySheetOpen, setMobileCategorySheetOpen] = useState(false);
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
  const mobileFilterDescriptionId = useId();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const mobileEnhancementsEnabled = isMobile && communityFeatureFlags.communityMobileEnhancements;
  const showCategorySuggestions = isSearchFocused && (!isMobile || !mobileEnhancementsEnabled);
  const { trackFirstMeaningfulAction, trackInteraction } = useCommunityMobileTelemetry({
    enabled: mobileEnhancementsEnabled,
    surface: "community_feed",
  });
  const categoryPanelId = "community-search-categories";
  const selectedCategoryLabel =
    CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? "All";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

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
    setLoading(true);
    setIsLoadingMore(false);
    setErrorState(null);

    void (async () => {
      try {
        const firstPage = await loadFeed({
          sort,
          category,
          search: query || undefined,
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
        setErrorState(toCommunityErrorState(error, "Failed to load community feed."));
      } finally {
        if (token === requestToken.current) {
          setLoading(false);
        }
      }
    })();
  }, [sort, category, query, user?.id, hydrateFeedContext, retryNonce]);

  const handleLoadMore = useCallback(() => {
    if (loading || isLoadingMore || !hasMore) return;
    const token = requestToken.current;
    const nextPage = page + 1;
    setIsLoadingMore(true);

    void (async () => {
      try {
        const nextPagePosts = await loadFeed({
          sort,
          category,
          search: query || undefined,
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
          description: error instanceof Error ? error.message : "Unexpected error while loading remix feed.",
          variant: "destructive",
        });
      } finally {
        if (token === requestToken.current) {
          setIsLoadingMore(false);
        }
      }
    })();
  }, [
    loading,
    isLoadingMore,
    hasMore,
    page,
    sort,
    category,
    query,
    posts,
    hydrateFeedContext,
    toast,
  ]);

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
      trackInteraction("reaction", `vote_${voteType}`, {
        postId,
      });
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
    [toast, trackInteraction, user],
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
    trackInteraction("comment", "comment_added", { postId });
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post,
      ),
    );
  }, [trackInteraction]);

  const handleCommentThreadOpen = useCallback((postId: string) => {
    trackFirstMeaningfulAction("comment_thread_opened", { postId });
    trackInteraction("comment", "thread_opened", { postId });
  }, [trackFirstMeaningfulAction, trackInteraction]);

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
      <div className="community-typography" data-density="comfortable">
        <PageHero
          eyebrow={brandCopy.brandLine}
          title="Community Remix Feed"
          subtitle="Browse proven prompts, review context, and remix with clear attribution."
        />

        <div
          className="relative mb-3 rounded-xl border border-border bg-card/85 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          data-testid="community-search-shell"
        >
          <div className="p-2 sm:p-0">
            <div className="relative">
              <label htmlFor="community-feed-search" className="sr-only">
                Search community posts
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <InputBase
                id="community-feed-search"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                onFocus={() => {
                  if (!mobileEnhancementsEnabled) setIsSearchFocused(true);
                }}
                onBlur={() => {
                  if (!mobileEnhancementsEnabled) setIsSearchFocused(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsSearchFocused(false);
                    (event.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Search by title, use case, or context keyword"
                inputClassName="type-input h-11 border-0 bg-transparent pl-9 shadow-none"
                wrapperClassName="bg-transparent shadow-none ring-0"
                aria-expanded={showCategorySuggestions}
                aria-controls={showCategorySuggestions ? categoryPanelId : undefined}
              />
            </div>
            {mobileEnhancementsEnabled && (
              <Button
                type="button"
                color="secondary"
                size="sm"
                className="type-button-label mt-2 h-11 w-full items-center justify-between px-3"
                onClick={() => {
                  trackFirstMeaningfulAction("filter_drawer_opened");
                  setMobileCategorySheetOpen(true);
                }}
                data-testid="community-filter-trigger"
              >
                <span>Filter</span>
                <span className="type-meta type-wrap-safe max-w-[65%] text-right text-muted-foreground">
                  {selectedCategoryLabel}
                </span>
              </Button>
            )}
          </div>

          {showCategorySuggestions && (
            <div
              id={categoryPanelId}
              className="type-post-body absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-border/70 bg-popover p-2 shadow-lg"
              role="group"
              aria-label="Category filters"
            >
              <div className="type-label-caps type-reply-label flex items-center justify-between px-2 py-1 text-muted-foreground">
                <span>Categories</span>
                <span>Action</span>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {CATEGORY_OPTIONS.map((option) => {
                  const isSelected = category === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isSelected}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setCategory(option.value)}
                      className={cn(
                        "type-tab-label flex min-h-11 items-center justify-between rounded-md px-2 py-2 transition-colors sm:min-h-10",
                        isSelected
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <span>{option.label}</span>
                      <span className="type-meta text-muted-foreground">
                        {isSelected ? "Selected" : "Filter"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="type-help px-2 pt-2 text-muted-foreground">
                Current: <span className="font-medium text-foreground">{selectedCategoryLabel}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:rounded-lg sm:bg-muted sm:p-1">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setSort(option.value);
                trackFirstMeaningfulAction("sort_changed", { sort: option.value });
              }}
              aria-pressed={sort === option.value}
              data-testid="community-sort-button"
              className={cn(
                "type-tab-label h-11 rounded-md px-3 transition-all sm:h-10 sm:flex-1 sm:px-2",
                sort === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground sm:bg-transparent",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mobileEnhancementsEnabled && (
          <Drawer open={mobileCategorySheetOpen} onOpenChange={setMobileCategorySheetOpen}>
            <DrawerContent
              className="max-h-[80vh] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              aria-describedby={mobileFilterDescriptionId}
              data-testid="community-filter-sheet"
            >
              <DrawerHeader className="pb-1">
                <DrawerTitle className="type-post-title">Filter Categories</DrawerTitle>
                <DrawerDescription id={mobileFilterDescriptionId} className="sr-only">
                  Choose a community category to filter visible prompts.
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <p className="type-help mb-2 text-muted-foreground">
                  Current: <span className="font-medium text-foreground">{selectedCategoryLabel}</span>
                </p>
                <ScrollArea className="max-h-[52vh] pr-2">
                  <div className="space-y-1.5 pb-1">
                    {CATEGORY_OPTIONS.map((option) => {
                      const isSelected = category === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={cn(
                            "type-tab-label flex h-11 w-full items-center justify-between rounded-md border px-3 text-left",
                            isSelected
                              ? "border-primary/35 bg-primary/10 text-foreground"
                              : "border-border/70 bg-background text-foreground",
                          )}
                          onClick={() => {
                            trackFirstMeaningfulAction("filter_selected", { category: option.value });
                            setCategory(option.value);
                            setMobileCategorySheetOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          <span className="type-meta text-muted-foreground">
                            {isSelected ? "Selected" : "Filter"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </DrawerContent>
          </Drawer>
        )}

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
          onCommentThreadOpen={handleCommentThreadOpen}
          canVote={Boolean(user)}
          canRate={Boolean(user)}
          ratingByPost={ratingByPost}
          onRatePrompt={handleRatePrompt}
          currentUserId={user?.id ?? null}
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

export default Community;
