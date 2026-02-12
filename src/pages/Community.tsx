import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { PageHero, PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCommunityMobileTelemetry } from "@/hooks/useCommunityMobileTelemetry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  type CommunityPost,
  type CommunityProfile,
  type CommunitySort,
  type VoteState,
  type VoteType,
  loadFeed,
  loadMyVotes,
  loadPostsByIds,
  loadProfilesByIds,
  toggleVote,
} from "@/lib/community";
import { communityFeatureFlags } from "@/lib/feature-flags";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestToken = useRef(0);
  const voteInFlightByPost = useRef<Set<string>>(new Set());
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

      const [authorProfilesResult, parentPostsResult, voteStatesResult] = await Promise.allSettled([
        loadProfilesByIds(authorIds),
        loadPostsByIds(parentIds),
        loadMyVotes(targetPosts.map((post) => post.id)),
      ]);

      if (authorProfilesResult.status === "rejected") throw authorProfilesResult.reason;
      if (parentPostsResult.status === "rejected") throw parentPostsResult.reason;
      if (token !== requestToken.current) return;

      const authorProfiles = authorProfilesResult.value;
      const parentPosts = parentPostsResult.value;
      const voteStates = voteStatesResult.status === "fulfilled" ? voteStatesResult.value : {};
      const nextAuthors = toProfileMap(authorProfiles);
      const nextParentTitles = toParentTitleMap(parentPosts);
      if (mode === "merge") {
        setAuthorById((previous) => ({ ...previous, ...nextAuthors }));
        setParentTitleById((previous) => ({ ...previous, ...nextParentTitles }));
        setVoteStateByPost((previous) => ({ ...previous, ...voteStates }));
        return;
      }

      setAuthorById(nextAuthors);
      setParentTitleById(nextParentTitles);
      setVoteStateByPost(voteStates);
    },
    [],
  );

  useEffect(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setIsLoadingMore(false);
    setErrorMessage(null);

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
        setErrorMessage(error instanceof Error ? error.message : "Failed to load community feed.");
      } finally {
        if (token === requestToken.current) {
          setLoading(false);
        }
      }
    })();
  }, [sort, category, query, user?.id, hydrateFeedContext]);

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
          description: error instanceof Error ? error.message : "Unexpected error",
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
        await navigator.clipboard.writeText(post.enhancedPrompt || post.starterPrompt);
        toast({ title: "Prompt copied", description: "Prompt text copied to your clipboard." });
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

  return (
    <PageShell>
      <div className="community-typography" data-density="comfortable">
        <PageHero
          title="Community prompts"
          subtitle="Browse prompts, filter by category, then copy or remix."
        />

        <div className="relative mb-3 rounded-xl border border-border bg-card/85 shadow-sm">
          <div className="p-2 sm:p-0">
            <div className="relative">
              <label htmlFor="community-feed-search" className="sr-only">
                Search community posts
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
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
                placeholder="Search by title or use case"
                className="type-input h-11 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                aria-expanded={showCategorySuggestions}
                aria-controls={showCategorySuggestions ? categoryPanelId : undefined}
              />
            </div>
            {mobileEnhancementsEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="type-button-label mt-2 h-11 w-full items-center justify-between px-3"
                onClick={() => {
                  trackFirstMeaningfulAction("filter_drawer_opened");
                  setMobileCategorySheetOpen(true);
                }}
                data-testid="community-filter-trigger"
              >
                <span>Filter</span>
                <span className="type-meta truncate text-muted-foreground">{selectedCategoryLabel}</span>
              </Button>
            )}
          </div>

          {showCategorySuggestions && (
            <div
              id={categoryPanelId}
              className="type-post-body absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-border/70 bg-popover p-2 shadow-lg"
              role="listbox"
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
                      role="option"
                      aria-selected={isSelected}
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
              aria-describedby={undefined}
              data-testid="community-filter-sheet"
            >
              <DrawerHeader className="pb-1">
                <DrawerTitle className="type-post-title">Filter Categories</DrawerTitle>
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
          posts={posts}
          loading={loading}
          errorMessage={errorMessage}
          authorById={authorById}
          parentTitleById={parentTitleById}
          onCopyPrompt={handleCopyPrompt}
          onToggleVote={handleToggleVote}
          voteStateByPost={voteStateByPost}
          onCommentAdded={handleCommentAdded}
          onCommentThreadOpen={handleCommentThreadOpen}
          canVote={Boolean(user)}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
      </div>
    </PageShell>
  );
};

export default Community;
