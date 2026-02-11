import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { PageShell } from "@/components/PageShell";
import { Input } from "@/components/ui/input";
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
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestToken = useRef(0);
  const { toast } = useToast();
  const { user } = useAuth();

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
      }
    },
    [toast, user],
  );

  const handleCommentAdded = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post,
      ),
    );
  }, []);

  return (
    <PageShell>
        {/* Search bar with inline category chips */}
        <div className="mb-3 overflow-hidden rounded-xl border border-border bg-card/85 shadow-sm">
          <div className="relative">
            <label htmlFor="community-feed-search" className="sr-only">
              Search community posts
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="community-feed-search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search prompts by title or use case..."
              className="h-10 border-0 bg-transparent pl-9 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="border-t border-border/40 px-2 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    category === option.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort segmented control */}
        <div className="mb-4 flex rounded-lg bg-muted p-1">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSort(option.value)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-medium transition-all",
                sort === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

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
          canVote={Boolean(user)}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
        />
    </PageShell>
  );
};

export default Community;
