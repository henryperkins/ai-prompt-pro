import { useMemo } from "react";
import type { CommunityPost, CommunityProfile, VoteState, VoteType } from "@/lib/community";
import { Card } from "@/components/base/card";
import { Skeleton } from "@/components/base/skeleton";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { StateCard } from "@/components/base/state-card";
import { Button } from "@/components/base/buttons/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIntersectionAutoLoad } from "@/hooks/useIntersectionAutoLoad";
import type { CommunityErrorKind } from "@/lib/community-errors";
import { cx } from "@/lib/utils/cx";
import { SpinnerGap as Loader2 } from "@phosphor-icons/react";

interface CommunityFeedProps {
  posts: CommunityPost[];
  loading: boolean;
  errorMessage?: string | null;
  errorType?: CommunityErrorKind;
  blockFilterReady?: boolean;
  followStateReady?: boolean;
  authorById: Record<string, CommunityProfile>;
  parentTitleById: Record<string, string>;
  onCopyPrompt: (post: CommunityPost) => void;
  onToggleVote: (postId: string, voteType: VoteType) => void;
  voteStateByPost: Record<string, VoteState>;
  onCommentAdded: (postId: string) => void;
  onCommentThreadOpen?: (postId: string) => void;
  onSharePost?: (post: CommunityPost) => void;
  onSaveToLibrary?: (postId: string) => void;
  followingUserIds?: Set<string>;
  onToggleFollow?: (userId: string, isFollowing: boolean) => void;
  canVote: boolean;
  canRate?: boolean;
  ratingByPost?: Record<string, number | null>;
  onRatePrompt?: (postId: string, rating: number | null) => void;
  currentUserId?: string | null;
  blockedUserIds?: string[];
  onReportPost?: (post: CommunityPost) => void;
  onReportComment?: (commentId: string, userId: string, postId: string) => void;
  onBlockUser?: (userId: string) => void;
  onUnblockUser?: (userId: string) => void;
  onTagClick?: (tag: string) => void;
  featuredPostId?: string | null;
  featuredPostBadgeLabel?: string;
  suppressAutoFeatured?: boolean;
  selectedPostId?: string | null;
  rawPostCount?: number;
  hiddenPostCount?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onRetry?: () => void;
}

function LoadingCard() {
  return (
    <Card className="pf-card space-y-3.5 border-border/80 bg-card/90 p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-28 w-full rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-20" />
      </div>
    </Card>
  );
}

export function CommunityFeed({
  posts,
  loading,
  errorMessage,
  errorType = "unknown",
  blockFilterReady = true,
  followStateReady = true,
  authorById,
  parentTitleById,
  onCopyPrompt,
  onToggleVote,
  voteStateByPost,
  onCommentAdded,
  onCommentThreadOpen,
  onSharePost,
  onSaveToLibrary,
  followingUserIds,
  onToggleFollow,
  canVote,
  canRate = false,
  ratingByPost = {},
  onRatePrompt,
  currentUserId,
  blockedUserIds = [],
  onReportPost,
  onReportComment,
  onBlockUser,
  onUnblockUser,
  onTagClick,
  featuredPostId,
  featuredPostBadgeLabel,
  suppressAutoFeatured = false,
  selectedPostId,
  rawPostCount,
  hiddenPostCount = 0,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onRetry,
}: CommunityFeedProps) {
  const isMobile = useIsMobile();
  const resolvedRawPostCount = rawPostCount ?? posts.length;
  const showsBlockedOnlyPage = posts.length === 0 && hiddenPostCount > 0 && resolvedRawPostCount > 0;
  const autoFeaturedPostId = !suppressAutoFeatured && !isMobile ? posts[0]?.id ?? null : null;
  const activeFeaturedPostId = featuredPostId ?? autoFeaturedPostId;
  const activeSelectedPostId = selectedPostId ?? null;
  const hasSelectedPost = Boolean(activeSelectedPostId);
  const renderedPosts = useMemo(
    () =>
      posts.map((post, index) => {
        const author = authorById[post.authorId];
        const authorName = author?.displayName || "Community member";
        const isSelected = activeSelectedPostId ? post.id === activeSelectedPostId : false;
        const isFeatured = activeFeaturedPostId ? post.id === activeFeaturedPostId : false;
        const isDeemphasized = hasSelectedPost && !isSelected;

        return (
          <CommunityPostCard
            key={post.id}
            post={post}
            isFeatured={isFeatured}
            isSelected={isSelected}
            isDeemphasized={isDeemphasized}
            animationDelayMs={Math.min(index, 8) * 40}
            authorName={authorName}
            authorAvatarUrl={author?.avatarUrl}
            parentPostTitle={post.remixedFrom ? parentTitleById[post.remixedFrom] : undefined}
            onCopyPrompt={onCopyPrompt}
            onToggleVote={onToggleVote}
            voteState={voteStateByPost[post.id]}
            onCommentAdded={onCommentAdded}
            onCommentThreadOpen={onCommentThreadOpen}
            onSharePost={onSharePost}
            onSaveToLibrary={onSaveToLibrary}
            followingUserIds={followingUserIds}
            followStateReady={followStateReady}
            currentUserId={currentUserId}
            onToggleFollow={onToggleFollow}
            canVote={canVote}
            canRate={canRate}
            ratingValue={ratingByPost[post.id] ?? null}
            onRatePrompt={onRatePrompt}
            canModerate={Boolean(currentUserId)}
            canBlockAuthor={currentUserId !== post.authorId}
            isAuthorBlocked={blockedUserIds.includes(post.authorId)}
            blockFilterReady={blockFilterReady}
            blockedUserIds={blockedUserIds}
            onReportPost={onReportPost}
            onReportComment={onReportComment}
            onBlockUser={onBlockUser}
            onUnblockUser={onUnblockUser}
            onTagClick={onTagClick}
            featuredBadgeLabel={isSelected
              ? (featuredPostBadgeLabel ?? "Selected")
              : (isFeatured && featuredPostBadgeLabel ? featuredPostBadgeLabel : undefined)}
          />
        );
      }),
    [
      posts,
      authorById,
      parentTitleById,
      onCopyPrompt,
      onToggleVote,
      voteStateByPost,
      onCommentAdded,
      onCommentThreadOpen,
      onSharePost,
      onSaveToLibrary,
      followingUserIds,
      followStateReady,
      onToggleFollow,
      canVote,
      canRate,
      ratingByPost,
      onRatePrompt,
      currentUserId,
      blockFilterReady,
      blockedUserIds,
      onReportPost,
      onReportComment,
      onBlockUser,
      onUnblockUser,
      onTagClick,
      activeFeaturedPostId,
      activeSelectedPostId,
      hasSelectedPost,
      featuredPostBadgeLabel,
    ],
  );

  const sentinelRef = useIntersectionAutoLoad({
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: onLoadMore ?? (() => {}),
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  if (errorMessage) {
    const title =
      errorType === "auth"
        ? "Sign in to view community posts"
        : errorType === "not_found"
          ? "Community content could not be found"
          : errorType === "network"
            ? "Couldn’t reach community feed"
            : errorType === "backend_unconfigured"
              ? "Community backend is not configured"
              : "Couldn’t load community feed";
    const description =
      errorType === "auth"
        ? "Sign in from Builder to load your personalized feed and interactions."
        : errorType === "network"
          ? "Check your connection and try again."
          : errorType === "backend_unconfigured"
            ? "Community services are not enabled yet. Finish setup, then retry."
            : errorMessage;
    const primaryAction =
      errorType === "auth"
        ? { label: "Go to Builder", to: "/" }
        : onRetry
          ? { label: "Retry", onClick: onRetry }
          : { label: "Go to Builder", to: "/" };
    const secondaryAction =
      errorType === "auth"
        ? { label: "Open Library", to: "/library" }
        : errorType === "not_found"
          ? { label: "Return to community", to: "/community" }
          : { label: "Open Library", to: "/library" };

    return (
      <div className="mb-6">
        <StateCard
          variant="error"
          title={title}
          description={description}
          primaryAction={primaryAction}
          secondaryAction={secondaryAction}
        />
      </div>
    );
  }

  if (!blockFilterReady) {
    return (
      <Card
        className="space-y-2.5 border-border/80 bg-muted/25 p-4 sm:p-5"
        data-testid="community-block-filter-loading-state"
      >
        <p className="ui-state-card-title text-foreground">Loading content protections</p>
        <p className="ui-state-card-body text-muted-foreground">
          We&apos;re checking your blocked-user list before showing community posts.
        </p>
      </Card>
    );
  }

  if (posts.length === 0) {
    if (showsBlockedOnlyPage) {
      return (
        <Card
          className="space-y-4 border-border/80 bg-muted/25 p-4 sm:p-5"
          data-testid="community-blocked-results-state"
        >
          <div className="space-y-1">
            <p className="ui-state-card-title text-foreground">Posts from blocked authors are hidden</p>
            <p className="ui-state-card-body text-muted-foreground">
              {hasMore
                ? "This page only includes authors you blocked. Load more to keep browsing unblocked prompts."
                : `${hiddenPostCount} post${hiddenPostCount === 1 ? "" : "s"} in this result set ${hiddenPostCount === 1 ? "is" : "are"} hidden because you blocked the author${hiddenPostCount === 1 ? "" : "s"}.`}
            </p>
          </div>
          {hasMore && onLoadMore && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="type-button-label h-11 px-4 sm:h-10 sm:px-3"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </Card>
      );
    }

    return (
      <StateCard
        variant="empty"
        title="No posts match these filters"
        description="Try a different search, sort option, or category."
        primaryAction={{ label: "Share your first prompt", to: "/" }}
        secondaryAction={{ label: "Open Library", to: "/library" }}
      />
    );
  }

  return (
    <div className={cx("community-feed-grid grid grid-cols-1 gap-4 lg:grid-cols-2", hasSelectedPost && "community-feed-grid--focus-mode")}>
      {renderedPosts}
      {hasMore && (
        <div className="space-y-2 py-2 lg:col-span-2">
          <div ref={sentinelRef} className="flex min-h-8 justify-center py-2" aria-hidden="true">
            {isLoadingMore && (
              <p className="type-help inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading more posts...
              </p>
            )}
          </div>
          {onLoadMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="type-button-label h-11 px-4 sm:h-10 sm:px-3"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
