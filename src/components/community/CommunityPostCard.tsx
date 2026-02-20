import { memo, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, CheckCircle2, Database, GitBranch, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { CommunityPost, VoteState, VoteType } from "@/lib/community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PromptPreviewPanel } from "@/components/community/PromptPreviewPanel";
import { CommunityComments } from "@/components/community/CommunityComments";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
  const visibleTags = useMemo(() => {
    const mobileMax = 2;
    const desktopMax = isFeatured ? 6 : 4;
    return post.tags.slice(0, isMobile ? mobileMax : desktopMax);
  }, [isFeatured, isMobile, post.tags]);
  const postPath = `/community/${post.id}`;
  const commentsLabel = useMobileCommentsDrawer ? "Comments" : commentsOpen ? "Hide comments" : "Comments";

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
              <p className="type-author truncate text-foreground">{authorName}</p>
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
              >
                {post.commentCount}
              </Badge>
            )}
          </Button>
        </div>

        {!useMobileCommentsDrawer && commentsOpen && (
          <CommunityComments
            postId={post.id}
            totalCount={post.commentCount}
            compact
            onCommentAdded={onCommentAdded}
          />
        )}

        {useMobileCommentsDrawer && (
          <Drawer open={commentsOpen} onOpenChange={setCommentsOpen}>
            <DrawerContent
              className="max-h-[84vh] gap-0 border-border/80 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              aria-describedby={undefined}
              data-testid="community-comments-sheet"
            >
              <DrawerHeader className="border-b border-border/60 px-4 pb-2 pt-2.5">
                <DrawerTitle className="type-post-title">Comments</DrawerTitle>
              </DrawerHeader>
              <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
                <CommunityComments
                  postId={post.id}
                  totalCount={post.commentCount}
                  onCommentAdded={onCommentAdded}
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
    areVoteStatesEqual(previous.voteState, next.voteState)
  );
}

export const CommunityPostCard = memo(CommunityPostCardComponent, arePropsEqual);
CommunityPostCard.displayName = "CommunityPostCard";
