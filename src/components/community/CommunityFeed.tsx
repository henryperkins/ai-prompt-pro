import { useMemo } from "react";
import type { CommunityPost, CommunityProfile, VoteState, VoteType } from "@/lib/community";
import { Card } from "@/components/base/primitives/card";
import { Skeleton } from "@/components/base/primitives/skeleton";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";
import { StateCard } from "@/components/base/primitives/state-card";
import { Button } from "@/components/base/buttons/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIntersectionAutoLoad } from "@/hooks/useIntersectionAutoLoad";
import type { CommunityErrorKind } from "@/lib/community-errors";
import { Loader2 } from "lucide-react";

interface CommunityFeedProps {
  posts: CommunityPost[];
  loading: boolean;
  errorMessage?: string | null;
  errorType?: CommunityErrorKind;
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
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onRetry?: () => void;
}

function LoadingCard() {
  return (
    <Card className="pf-card space-y-3 border-border/80 bg-card/85 p-4">
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
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onRetry,
}: CommunityFeedProps) {
  const isMobile = useIsMobile();
  const renderedPosts = useMemo(
    () =>
      posts.map((post, index) => {
        const author = authorById[post.authorId];
        const authorName = author?.displayName || "Community member";
        const isFeatured = featuredPostId
          ? post.id === featuredPostId
          : !suppressAutoFeatured && !isMobile && index === 0;

        return (
          <CommunityPostCard
            key={post.id}
            post={post}
            isFeatured={isFeatured}
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
            currentUserId={currentUserId}
            onToggleFollow={onToggleFollow}
            canVote={canVote}
            canRate={canRate}
            ratingValue={ratingByPost[post.id] ?? null}
            onRatePrompt={onRatePrompt}
            canModerate={Boolean(currentUserId)}
            canBlockAuthor={currentUserId !== post.authorId}
            isAuthorBlocked={blockedUserIds.includes(post.authorId)}
            blockedUserIds={blockedUserIds}
            onReportPost={onReportPost}
            onReportComment={onReportComment}
            onBlockUser={onBlockUser}
            onUnblockUser={onUnblockUser}
            onTagClick={onTagClick}
            featuredBadgeLabel={featuredPostId && post.id === featuredPostId ? featuredPostBadgeLabel : undefined}
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
      onToggleFollow,
      canVote,
      canRate,
      ratingByPost,
      onRatePrompt,
      currentUserId,
      blockedUserIds,
      onReportPost,
      onReportComment,
      onBlockUser,
      onUnblockUser,
      onTagClick,
      featuredPostId,
      featuredPostBadgeLabel,
      suppressAutoFeatured,
      isMobile,
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
        ? "Sign in to access this community view"
        : errorType === "not_found"
          ? "Community content could not be found"
          : errorType === "network"
            ? "Couldn’t reach community feed"
            : errorType === "backend_unconfigured"
              ? "Community backend is not configured"
              : "Couldn’t load community feed";
    const secondaryAction =
      errorType === "auth"
        ? { label: "Go to Builder and sign in", to: "/" }
        : errorType === "not_found"
          ? { label: "Return to community", to: "/community" }
          : { label: "Open Library", to: "/library" };

    return (
      <StateCard
        variant="error"
        title={title}
        description={errorMessage}
        primaryAction={onRetry ? { label: "Retry", onClick: onRetry } : { label: "Go to Builder", to: "/" }}
        secondaryAction={secondaryAction}
      />
    );
  }

  if (posts.length === 0) {
    return (
      <StateCard
        variant="empty"
        title="No posts match."
        description="Try another filter or share a prompt."
        primaryAction={{ label: "Share your first prompt", to: "/" }}
        secondaryAction={{ label: "Open Library", to: "/library" }}
      />
    );
  }

  return (
    <div className="community-feed-grid grid grid-cols-1 gap-3 lg:grid-cols-2">
      {renderedPosts}
      {hasMore && (
        <div className="space-y-2 py-2 lg:col-span-2">
          <div ref={sentinelRef} className="flex justify-center py-2" aria-hidden="true">
            {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
          {onLoadMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                color="secondary"
                size="sm"
                className="type-button-label h-11 px-4 sm:h-9 sm:px-3"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
