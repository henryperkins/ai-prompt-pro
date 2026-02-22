import { memo, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, CheckCircle2, Database, Flag, GitBranch, MessageCircle, MoreHorizontal, Star, UserCheck, UserX } from "lucide-react";
import { Link } from "react-router-dom";
import type { CommunityPost, VoteState, VoteType } from "@/lib/community";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/base/primitives/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/base/primitives/dropdown-menu";
import { PromptPreviewPanel } from "@/components/community/PromptPreviewPanel";
import { CommunityComments } from "@/components/community/CommunityComments";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/base/primitives/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { communityFeatureFlags } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

interface CommunityPostCardProps {
  post: CommunityPost;
  isFeatured?: boolean;
  animationDelayMs?: number;
  authorName: string;
  authorAvatarUrl?: string | null;
  parentPostTitle?: string;
  onCopyPrompt: (post: CommunityPost) => void;
  onToggleVote: (postId: string, voteType: VoteType) => void;
  voteState?: VoteState;
  onCommentAdded: (postId: string) => void;
  onCommentThreadOpen?: (postId: string) => void;
  canVote: boolean;
  canRate?: boolean;
  ratingValue?: number | null;
  onRatePrompt?: (postId: string, rating: number | null) => void;
  canModerate?: boolean;
  canBlockAuthor?: boolean;
  isAuthorBlocked?: boolean;
  blockedUserIds?: string[];
  onReportPost?: (post: CommunityPost) => void;
  onReportComment?: (commentId: string, userId: string, postId: string) => void;
  onBlockUser?: (userId: string) => void;
  onUnblockUser?: (userId: string) => void;
}

function getInitials(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function estimateTokens(text: string): string {
  const words = text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  const tokens = Math.max(1, Math.round(words * 1.35));
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
}

function CommunityPostCardComponent({
  post,
  isFeatured = false,
  animationDelayMs = 0,
  authorName,
  authorAvatarUrl,
  parentPostTitle,
  onCopyPrompt,
  onToggleVote,
  voteState,
  onCommentAdded,
  onCommentThreadOpen,
  canVote,
  canRate = false,
  ratingValue = null,
  onRatePrompt,
  canModerate = false,
  canBlockAuthor = true,
  isAuthorBlocked = false,
  blockedUserIds = [],
  onReportPost,
  onReportComment,
  onBlockUser,
  onUnblockUser,
}: CommunityPostCardProps) {
  const isMobile = useIsMobile();
  const useMobileCommentsDrawer = isMobile && communityFeatureFlags.communityMobileEnhancements;
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
    const desktopMax = isFeatured ? 6 : 4;
    return post.tags.slice(0, isMobile ? mobileMax : desktopMax);
  }, [isFeatured, isMobile, post.tags]);
  const postPath = `/community/${post.id}`;
  const commentsLabel = useMobileCommentsDrawer ? "Comments" : commentsOpen ? "Hide comments" : "Comments";
  const commentsDescriptionId = `community-comments-description-${post.id}`;

  return (
    <Card
      className={cn(
        "community-feed-card interactive-card overflow-hidden border-border/80 bg-card/85 p-3 sm:p-4",
        isFeatured && "lg:col-span-2 border-primary/35 bg-gradient-to-br from-primary/10 via-card/90 to-card/85",
      )}
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className={cn("space-y-3", isMobile && "space-y-2.5")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-8 w-8 border border-border/60">
              <AvatarImage src={authorAvatarUrl ?? undefined} alt={authorName} />
              <AvatarFallback className="type-reply-label">{getInitials(authorName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <Link to={`/profile/${post.authorId}`} className="type-author type-link-inline type-wrap-safe text-foreground">
                {authorName}
              </Link>
              <p className="type-timestamp text-muted-foreground">{createdAgo}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 self-start sm:self-auto sm:justify-end">
            {post.targetModel && (
              <Badge variant="secondary" className="type-chip h-6 px-2 font-mono sm:h-5 sm:px-1.5">
                {post.targetModel}
              </Badge>
            )}
            <Badge variant="outline" className="type-chip h-6 px-2 capitalize sm:h-5 sm:px-1.5">
              {post.category}
            </Badge>
            {canModerate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
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
          <div className="type-meta rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-primary">
            <span className="font-medium">Remixed from:</span> {parentPostTitle || "another community prompt"}
          </div>
        )}

        <Link
          to={postPath}
          aria-label={`Open ${post.title}`}
          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <h3 className={cn("type-post-title text-foreground", isFeatured && "sm:text-xl sm:leading-7")}>
            {post.title}
          </h3>
          {post.useCase && (
            <p className="type-post-body type-prose-measure type-wrap-safe mt-1 line-clamp-3 text-muted-foreground">
              {post.useCase}
            </p>
          )}
        </Link>

        <PromptPreviewPanel
          text={promptBody}
          mode="compact"
          className={cn("bg-background/65", isFeatured && "border-primary/25")}
          onCopy={() => onCopyPrompt(post)}
        />

        {visibleTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleTags.map((tag) => (
              <Badge key={`${post.id}-${tag}`} variant="outline" className="type-chip">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="type-meta flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span className="type-numeric inline-flex items-center gap-1 font-mono">
              <Database className="h-3.5 w-3.5" />
              {tokenEstimate}t
            </span>
            <span className="type-numeric inline-flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" />
              {post.remixCount}
            </span>
          </div>
          <Button
            asChild
            variant={isMobile || isFeatured ? "default" : "outline"}
            size="sm"
            className="type-button-label h-11 px-4 sm:h-9 sm:px-3"
            data-testid="community-remix-cta"
          >
            <Link to={`/?remix=${post.id}`}>Remix</Link>
          </Button>
        </div>

        <div
          className={cn(
            "type-meta gap-2 text-muted-foreground",
            isMobile ? "grid grid-cols-3" : "flex flex-wrap items-center",
          )}
        >
          <Button
            type="button"
            size="sm"
            variant={voteState?.upvote ? "soft" : "outline"}
            className="type-button-label interactive-chip h-11 gap-1.5 px-3 sm:h-9 sm:gap-1 sm:px-2.5"
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
            variant={voteState?.verified ? "soft" : "outline"}
            className="type-button-label interactive-chip h-11 gap-1.5 px-3 sm:h-9 sm:gap-1 sm:px-2.5"
            disabled={!canVote}
            onClick={() => onToggleVote(post.id, "verified")}
            data-testid="community-vote-verified"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="type-numeric">{post.verifiedCount}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="type-button-label interactive-chip h-11 gap-1.5 px-3 sm:h-9 sm:px-2.5"
            aria-label={post.commentCount > 0 ? `${commentsLabel} ${post.commentCount}` : commentsLabel}
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
            {commentsLabel}
            {post.commentCount > 0 && (
              <Badge
                variant="secondary"
                className="type-reply-label type-numeric ml-0.5 h-4 min-w-4 px-1 leading-none"
                aria-hidden="true"
              >
                {post.commentCount}
              </Badge>
            )}
          </Button>
        </div>

        <div className="type-meta flex flex-wrap items-center gap-2 text-muted-foreground">
          <span
            aria-label={ratingSummaryAriaLabel}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/65 bg-background/65 px-2 py-1"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                ratingCount > 0 ? "fill-primary text-primary" : "text-muted-foreground",
              )}
            />
            <span className="type-numeric">{ratingAverage.toFixed(1)}</span>
            <span className="type-numeric text-muted-foreground/80">({ratingCount})</span>
          </span>
          {canRate && onRatePrompt && (
            <div className="inline-flex items-center gap-0.5 rounded-full border border-border/65 bg-background/65 p-0.5">
              {[1, 2, 3, 4, 5].map((value) => {
                const isActive = (ratingValue ?? 0) >= value;
                return (
                  <Button
                    key={`${post.id}-rate-${value}`}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full p-0 sm:h-7 sm:w-7"
                    aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
                    onClick={() => onRatePrompt(post.id, ratingValue === value ? null : value)}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isActive ? "fill-primary text-primary" : "text-muted-foreground",
                      )}
                    />
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {!useMobileCommentsDrawer && commentsOpen && (
          <CommunityComments
            postId={post.id}
            totalCount={post.commentCount}
            compact
            onCommentAdded={onCommentAdded}
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
              aria-describedby={commentsDescriptionId}
              data-testid="community-comments-sheet"
            >
              <DrawerHeader className="border-b border-border/60 px-4 pb-2 pt-2.5">
                <DrawerTitle className="type-post-title">Comments</DrawerTitle>
                <DrawerDescription id={commentsDescriptionId} className="sr-only">
                  Read and add comments for this prompt.
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
                <CommunityComments
                  postId={post.id}
                  totalCount={post.commentCount}
                  onCommentAdded={onCommentAdded}
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
    previous.animationDelayMs === next.animationDelayMs &&
    previous.authorName === next.authorName &&
    previous.authorAvatarUrl === next.authorAvatarUrl &&
    previous.parentPostTitle === next.parentPostTitle &&
    previous.onCopyPrompt === next.onCopyPrompt &&
    previous.onToggleVote === next.onToggleVote &&
    previous.onCommentAdded === next.onCommentAdded &&
    previous.onCommentThreadOpen === next.onCommentThreadOpen &&
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
    previous.blockedUserIds === next.blockedUserIds &&
    areVoteStatesEqual(previous.voteState, next.voteState)
  );
}

export const CommunityPostCard = memo(CommunityPostCardComponent, arePropsEqual);
CommunityPostCard.displayName = "CommunityPostCard";
