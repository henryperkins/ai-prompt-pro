import { memo, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import type { CommunityPost, VoteState, VoteType } from "@/lib/community";
import { estimateTokens } from "@/lib/community-utils";
import { getInitials } from "@/lib/utils/get-initials";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";
import { Avatar } from "@/components/base/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/base/dropdown-menu";
import { PromptPreviewPanel } from "@/components/community/PromptPreviewPanel";
import { CommunityComments } from "@/components/community/CommunityComments";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/base/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { getCommunityPostRarityClass } from "@/lib/community-rarity";
import { cx } from "@/lib/utils/cx";
import {
  ArrowUp,
  BookmarkSimple as BookmarkPlus,
  ChatCircle as MessageCircle,
  CheckCircle as CheckCircle2,
  Copy,
  Database,
  DotsThreeOutline as MoreHorizontal,
  Flag,
  GitBranch,
  ShareNetwork as Share2,
  Star,
  UserCheck,
  UserMinus as UserX,
} from "@phosphor-icons/react";

interface CommunityPostCardProps {
  post: CommunityPost;
  isFeatured?: boolean;
  isSelected?: boolean;
  isDeemphasized?: boolean;
  animationDelayMs?: number;
  authorName: string;
  authorAvatarUrl?: string | null;
  parentPostTitle?: string;
  onCopyPrompt: (post: CommunityPost) => void;
  onToggleVote: (postId: string, voteType: VoteType) => void;
  voteState?: VoteState;
  onCommentAdded: (postId: string) => void;
  onCommentThreadOpen?: (postId: string) => void;
  onSharePost?: (post: CommunityPost) => void;
  onSaveToLibrary?: (postId: string) => void;
  followingUserIds?: Set<string>;
  followStateReady?: boolean;
  currentUserId?: string | null;
  onToggleFollow?: (userId: string, isFollowing: boolean) => void;
  canVote: boolean;
  canRate?: boolean;
  ratingValue?: number | null;
  onRatePrompt?: (postId: string, rating: number | null) => void;
  canModerate?: boolean;
  canBlockAuthor?: boolean;
  isAuthorBlocked?: boolean;
  blockFilterReady?: boolean;
  blockedUserIds?: string[];
  onReportPost?: (post: CommunityPost) => void;
  onReportComment?: (commentId: string, userId: string, postId: string) => void;
  onBlockUser?: (userId: string) => void;
  onUnblockUser?: (userId: string) => void;
  onTagClick?: (tag: string) => void;
  featuredBadgeLabel?: string;
}


function CommunityPostCardComponent({
  post,
  isFeatured = false,
  isSelected = false,
  isDeemphasized = false,
  animationDelayMs = 0,
  authorName,
  authorAvatarUrl,
  parentPostTitle,
  onCopyPrompt,
  onToggleVote,
  voteState,
  onCommentAdded,
  onCommentThreadOpen,
  onSharePost,
  onSaveToLibrary,
  followingUserIds,
  followStateReady = true,
  currentUserId,
  onToggleFollow,
  canVote,
  canRate: _canRate = false,
  ratingValue: _ratingValue = null,
  onRatePrompt: _onRatePrompt,
  canModerate = false,
  canBlockAuthor = true,
  isAuthorBlocked = false,
  blockFilterReady = true,
  blockedUserIds = [],
  onReportPost,
  onReportComment,
  onBlockUser,
  onUnblockUser,
  onTagClick,
  featuredBadgeLabel,
}: CommunityPostCardProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const useMobileCommentsDrawer = isMobile;
  const createdAgo = useMemo(
    () => formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }),
    [post.createdAt],
  );
  const [commentsOpen, setCommentsOpen] = useState(false);
  const promptBody = (post.enhancedPrompt || post.starterPrompt || "").trim();
  const tokenEstimate = useMemo(() => estimateTokens(promptBody), [promptBody]);
  const ratingAverage = post.ratingAverage ?? 0;
  const ratingCount = post.ratingCount ?? 0;
  const ratingSummaryAriaLabel = `Average rating ${ratingAverage.toFixed(1)} from ${ratingCount} rating${ratingCount === 1 ? "" : "s"}`;
  const visibleTags = useMemo(() => {
    const mobileMax = 2;
    const desktopMax = isSelected ? 6 : isDeemphasized ? 2 : 4;
    return post.tags.slice(0, isMobile ? mobileMax : desktopMax);
  }, [isDeemphasized, isMobile, isSelected, post.tags]);
  const postPath = `/community/${post.id}`;

  return (
    <Card
      role="article"
      data-selected={isSelected ? "true" : "false"}
      data-state={isSelected ? "selected" : "idle"}
      className={cx(
        "community-feed-card interactive-card pf-card overflow-hidden border-border/80 bg-card/90 p-4 sm:p-5",
        isSelected && "community-feed-card--selected ring-1 ring-primary/35",
        isDeemphasized && "community-feed-card--deemphasized",
        getCommunityPostRarityClass(post, isFeatured),
        isFeatured && "lg:col-span-2 bg-linear-to-br from-primary/10 via-card/90 to-card/85",
      )}
      style={{
        animationDelay: `${animationDelayMs}ms`,
        ...(isFeatured ? { borderColor: "hsl(var(--primary) / 0.35)" } : {}),
      }}
    >
      <div className={cx("space-y-3.5", isMobile && "space-y-3")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar size="sm" src={authorAvatarUrl ?? undefined} alt={authorName} initials={getInitials(authorName)} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link to={`/profile/${post.authorId}`} className="type-author type-link-inline type-wrap-inline text-foreground">
                  {authorName}
                </Link>
                {followStateReady && onToggleFollow && currentUserId && post.authorId !== currentUserId && (
                  <Button
                    type="button"
                    size="sm"
                    variant={followingUserIds?.has(post.authorId) ? "secondary" : "primary"}
                    className="type-button-label h-11 min-w-11 px-3 sm:h-9"
                    onClick={() => onToggleFollow(post.authorId, followingUserIds?.has(post.authorId) ?? false)}
                    data-testid="community-card-follow"
                  >
                    {followingUserIds?.has(post.authorId) ? "Following" : "Follow"}
                  </Button>
                )}
              </div>
              <p className="type-timestamp text-foreground/75">{createdAgo}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 self-start sm:self-auto sm:justify-end">
            {post.targetModel && (
              <Badge variant="modern" className="type-chip h-7 px-2.5 font-mono sm:h-6 sm:px-2">
                {post.targetModel}
              </Badge>
            )}
            <Badge
              variant="modern"
              className="type-chip h-7 border border-border bg-background px-2.5 text-foreground capitalize sm:h-6 sm:px-2"
            >
              {post.category}
            </Badge>
            {canModerate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    className="h-11 w-11 sm:h-10 sm:w-10"
                    aria-label="Open moderation actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onReportPost?.(post);
                    }}
                  >
                    <Flag className="mr-2 h-4 w-4" />
                    Report post
                  </DropdownMenuItem>
                  {canBlockAuthor && (isAuthorBlocked ? (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        onUnblockUser?.(post.authorId);
                      }}
                    >
                      <UserCheck className="mr-2 h-4 w-4" />
                      Unblock user
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        onBlockUser?.(post.authorId);
                      }}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Block user
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {post.remixedFrom && (
          <div className="type-meta rounded-md border border-primary/25 bg-primary/12 px-2.5 py-1.5 text-primary">
            <span className="font-medium">Remixed from:</span> {parentPostTitle || "another community prompt"}
          </div>
        )}

        <Link
          to={postPath}
          aria-label={`Open ${post.title}`}
          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {featuredBadgeLabel && (
            <Badge
              variant="modern"
              className="type-chip mb-1 border border-primary/35 bg-primary/12 text-primary"
            >
              {featuredBadgeLabel}
            </Badge>
          )}
          <h3 className={cx("type-post-title text-foreground", isFeatured && "sm:text-xl sm:leading-7")}>
            {post.title}
          </h3>
          {post.useCase && (
            <p className="type-post-body type-prose-measure type-wrap-safe mt-1.5 line-clamp-3 text-foreground/95">
              {post.useCase}
            </p>
          )}
        </Link>

        <PromptPreviewPanel
          text={promptBody}
          mode="compact"
          className={cx("pf-community-preview bg-background/65", isFeatured && "border-primary/25")}
          onCopy={() => onCopyPrompt(post)}
        />

        {visibleTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleTags.map((tag) => (
              <button
                key={`${post.id}-${tag}`}
                type="button"
                disabled={!onTagClick}
                onClick={() => onTagClick?.(tag)}
                aria-label={onTagClick ? `Filter by tag ${tag}` : undefined}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default"
              >
                <Badge
                  variant="modern"
                  className={cx(
                    "type-chip border border-border bg-background text-foreground",
                    onTagClick && "cursor-pointer hover:bg-muted",
                  )}
                >
                  #{tag}
                </Badge>
              </button>
            ))}
          </div>
        )}

        <div className="type-meta flex flex-wrap items-center justify-between gap-2.5 border-t border-border/65 pt-3 text-foreground/80">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="type-numeric inline-flex items-center gap-1 font-mono"
              title="Estimated token count (~1.35x word count)"
            >
              <Database className="h-3.5 w-3.5" />
              {tokenEstimate}t
            </span>
            <span className="type-numeric inline-flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" />
              {post.remixCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onSaveToLibrary && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="type-button-label utility-action-button"
                onClick={() => onSaveToLibrary(post.id)}
                data-testid="community-save-cta"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                Save
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="type-button-label utility-action-button min-w-[84px]"
              onClick={() => navigate(`/?remix=${post.id}`)}
              data-testid="community-remix-cta"
            >
              Remix
            </Button>
            {(onSharePost || onCopyPrompt) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    className="type-button-label utility-action-button h-11 w-11 p-0 sm:h-10 sm:w-10"
                    aria-label="More actions"
                    data-testid="community-card-overflow"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onSharePost && (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        onSharePost(post);
                      }}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Share post
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onCopyPrompt(post);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy prompt
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div
          className={cx(
            "type-meta gap-2.5 text-foreground/80",
            isMobile ? "flex flex-wrap items-center" : "flex flex-wrap items-center",
          )}
        >
          <Button
            type="button"
            size="sm"
            variant={voteState?.upvote ? "primary" : "secondary"}
            className="type-button-label interactive-chip h-11 min-w-11 gap-1.5 px-3 sm:h-9 sm:min-w-9 sm:gap-1 sm:px-2.5"
            disabled={!canVote}
            onClick={() => onToggleVote(post.id, "upvote")}
            data-testid="community-vote-upvote"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span className="type-numeric">{post.upvoteCount}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={voteState?.verified ? "primary" : "secondary"}
            className="type-button-label interactive-chip h-11 min-w-11 gap-1.5 px-3 sm:h-9 sm:min-w-9 sm:gap-1 sm:px-2.5"
            disabled={!canVote}
            onClick={() => onToggleVote(post.id, "verified")}
            data-testid="community-vote-verified"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="type-numeric">{post.verifiedCount}</span>
          </Button>
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            className="type-button-label interactive-chip h-11 min-w-11 gap-1.5 px-3 sm:h-9 sm:min-w-9 sm:px-2.5"
            aria-label={post.commentCount > 0 ? `Comments ${post.commentCount}` : "Comments"}
            onClick={() => {
              if (useMobileCommentsDrawer) {
                setCommentsOpen(true);
                onCommentThreadOpen?.(post.id);
                return;
              }
              setCommentsOpen((prev) => !prev);
            }}
            data-testid="community-comment-toggle"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {post.commentCount > 0 && (
              <span className="type-numeric">{post.commentCount}</span>
            )}
          </Button>
        </div>

        <div className="type-meta flex flex-wrap items-center gap-2 text-foreground/80">
          <span
            aria-label={ratingSummaryAriaLabel}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1.5"
          >
            <Star
              className={cx(
                "h-3.5 w-3.5",
                ratingCount > 0 ? "fill-primary text-primary" : "text-muted-foreground",
              )}
            />
            <span className="type-numeric">{ratingAverage.toFixed(1)}</span>
            <span className="type-numeric text-muted-foreground/80">({ratingCount})</span>
          </span>
        </div>

        {!useMobileCommentsDrawer && commentsOpen && (
          <CommunityComments
            postId={post.id}
            totalCount={post.commentCount}
            compact
            onCommentAdded={onCommentAdded}
            blockFilterReady={blockFilterReady}
            blockedUserIds={blockedUserIds}
            onReportComment={onReportComment}
            onBlockUser={onBlockUser}
            onUnblockUser={onUnblockUser}
          />
        )}

        {useMobileCommentsDrawer && (
          <Drawer open={commentsOpen} onOpenChange={setCommentsOpen}>
            <DrawerContent
              className="max-h-[84vh] gap-0 border-border/80 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              data-testid="community-comments-sheet"
            >
              <DrawerHeader className="border-b border-border/60 px-4 pb-2 pt-2.5">
                <DrawerTitle className="type-post-title">Comments</DrawerTitle>
                <DrawerDescription className="sr-only">
                  Read and add comments for this prompt.
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
                <CommunityComments
                  postId={post.id}
                  totalCount={post.commentCount}
                  onCommentAdded={onCommentAdded}
                  autoFocusComposer
                  blockFilterReady={blockFilterReady}
                  blockedUserIds={blockedUserIds}
                  onReportComment={onReportComment}
                  onBlockUser={onBlockUser}
                  onUnblockUser={onUnblockUser}
                  className="space-y-2 border-0 bg-transparent p-0 shadow-none"
                />
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </Card>
  );
}

function areVoteStatesEqual(previous?: VoteState, next?: VoteState): boolean {
  return (previous?.upvote ?? false) === (next?.upvote ?? false) &&
    (previous?.verified ?? false) === (next?.verified ?? false);
}

function areRatingsEqual(previous: number | null | undefined, next: number | null | undefined): boolean {
  return (previous ?? null) === (next ?? null);
}

function arePropsEqual(previous: CommunityPostCardProps, next: CommunityPostCardProps): boolean {
  return (
    previous.post === next.post &&
    previous.isFeatured === next.isFeatured &&
    previous.isSelected === next.isSelected &&
    previous.isDeemphasized === next.isDeemphasized &&
    previous.animationDelayMs === next.animationDelayMs &&
    previous.authorName === next.authorName &&
    previous.authorAvatarUrl === next.authorAvatarUrl &&
    previous.parentPostTitle === next.parentPostTitle &&
    previous.onCopyPrompt === next.onCopyPrompt &&
    previous.onToggleVote === next.onToggleVote &&
    previous.onCommentAdded === next.onCommentAdded &&
    previous.onCommentThreadOpen === next.onCommentThreadOpen &&
    previous.onSharePost === next.onSharePost &&
    previous.onSaveToLibrary === next.onSaveToLibrary &&
    previous.followingUserIds === next.followingUserIds &&
    previous.followStateReady === next.followStateReady &&
    previous.currentUserId === next.currentUserId &&
    previous.onToggleFollow === next.onToggleFollow &&
    previous.canVote === next.canVote &&
    previous.canRate === next.canRate &&
    areRatingsEqual(previous.ratingValue, next.ratingValue) &&
    previous.onRatePrompt === next.onRatePrompt &&
    previous.canModerate === next.canModerate &&
    previous.canBlockAuthor === next.canBlockAuthor &&
    previous.isAuthorBlocked === next.isAuthorBlocked &&
    previous.onReportPost === next.onReportPost &&
    previous.onReportComment === next.onReportComment &&
    previous.onBlockUser === next.onBlockUser &&
    previous.onUnblockUser === next.onUnblockUser &&
    previous.onTagClick === next.onTagClick &&
    previous.featuredBadgeLabel === next.featuredBadgeLabel &&
    previous.blockFilterReady === next.blockFilterReady &&
    previous.blockedUserIds === next.blockedUserIds &&
    areVoteStatesEqual(previous.voteState, next.voteState)
  );
}

export const CommunityPostCard = memo(CommunityPostCardComponent, arePropsEqual);
CommunityPostCard.displayName = "CommunityPostCard";
