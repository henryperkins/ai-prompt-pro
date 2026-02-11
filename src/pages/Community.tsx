import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { PageShell, PageHero } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";

const SORT_OPTIONS: Array<{ label: string; value: CommunitySort }> = [
  { label: "New", value: "new" },
  { label: "Popular", value: "popular" },
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
  const isMobile = useIsMobile();

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

  const activeSortLabel = useMemo(
    () => SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "New",
    [sort],
  );

  return (
    <PageShell>
        <PageHero
          title="Community Prompt Feed"
          subtitle="Browse developer-focused prompt recipes, filter by domain, and open any post to copy or remix."
        />

        <Card className="mb-4 space-y-3 border-border/80 bg-card/85 p-3 sm:mb-5 sm:p-4">
          <div className="relative">
            <label htmlFor="community-feed-search" className="sr-only">
              Search community posts
            </label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="community-feed-search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search by title or use case"
              className="h-9 pl-8 text-sm"
            />
          </div>

          {isMobile ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sort</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SORT_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={sort === option.value ? "default" : "outline"}
                      className="h-9 px-3 text-xs"
                      onClick={() => setSort(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="community-category-select" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Category
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger
                    id="community-category-select"
                    className="h-9 bg-background text-sm"
                    aria-label="Filter category"
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                {SORT_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={sort === option.value ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setSort(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              <div className="category-scroll-fade relative">
                <div className="overflow-x-auto">
                  <div className="flex min-w-max items-center gap-1.5 pb-1">
                    {CATEGORY_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={category === option.value ? "soft" : "ghost"}
                        className="interactive-chip h-7 text-xs"
                        onClick={() => setCategory(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{posts.length} posts</Badge>
            <span>Sorted by {activeSortLabel}</span>
            {query && <span>Search: “{query}”</span>}
          </div>
        </Card>

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
