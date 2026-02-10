import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, CheckCircle2, Copy, ExternalLink, GitBranch, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { CommunityPost, VoteState, VoteType } from "@/lib/community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PromptPreviewPanel } from "@/components/community/PromptPreviewPanel";
import { CommunityComments } from "@/components/community/CommunityComments";

interface CommunityPostCardProps {
  post: CommunityPost;
  authorName: string;
  authorAvatarUrl?: string | null;
  parentPostTitle?: string;
  onCopyPrompt: (post: CommunityPost) => void;
  onToggleVote: (postId: string, voteType: VoteType) => void;
  voteState?: VoteState;
  onCommentAdded: (postId: string) => void;
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

export function CommunityPostCard({
  post,
  authorName,
  authorAvatarUrl,
  parentPostTitle,
  onCopyPrompt,
  onToggleVote,
  voteState,
  onCommentAdded,
  canVote,
}: CommunityPostCardProps) {
  const createdAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <Card className="interactive-card overflow-hidden border-border/80 bg-card/85 p-3 sm:p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-8 w-8 border border-border/60">
              <AvatarImage src={authorAvatarUrl ?? undefined} alt={authorName} />
              <AvatarFallback className="text-[10px]">{getInitials(authorName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{authorName}</p>
              <p className="text-[11px] text-muted-foreground">{createdAgo}</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
            <Link to={`/community/${post.id}`}>
              View
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        {post.remixedFrom && (
          <div className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[11px] text-primary">
            <span className="font-medium">Remixed from:</span> {parentPostTitle || "another community prompt"}
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-foreground">{post.title}</h3>
          {post.useCase && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.useCase}</p>}
        </div>

        <PromptPreviewPanel text={post.enhancedPrompt} mode="compact" />

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] capitalize">
            {post.category}
          </Badge>
          {post.targetModel && (
            <Badge variant="secondary" className="text-[10px]">
              {post.targetModel}
            </Badge>
          )}
          {post.tags.slice(0, 4).map((tag) => (
            <Badge key={`${post.id}-${tag}`} variant="outline" className="text-[10px]">
              #{tag}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Button
            type="button"
            size="sm"
            variant={voteState?.upvote ? "soft" : "outline"}
            className="interactive-chip h-7 px-2 text-[11px] gap-1"
            disabled={!canVote}
            onClick={() => onToggleVote(post.id, "upvote")}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            {post.upvoteCount}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={voteState?.verified ? "soft" : "outline"}
            className="interactive-chip h-7 px-2 text-[11px] gap-1"
            disabled={!canVote}
            onClick={() => onToggleVote(post.id, "verified")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {post.verifiedCount}
          </Button>
          <span className="inline-flex items-center gap-1">
            <GitBranch className="h-3.5 w-3.5" />
            {post.remixCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {post.commentCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link to={`/?remix=${post.id}`}>Remix</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onCopyPrompt(post)}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="interactive-chip h-8 text-xs"
            onClick={() => setCommentsOpen((prev) => !prev)}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {commentsOpen ? "Hide comments" : "Comments"}
          </Button>
          <Button asChild variant="soft" size="sm" className="h-8 text-xs">
            <Link to={`/community/${post.id}`}>Open thread</Link>
          </Button>
        </div>

        {commentsOpen && (
          <CommunityComments
            postId={post.id}
            totalCount={post.commentCount}
            compact
            onCommentAdded={onCommentAdded}
          />
        )}
      </div>
    </Card>
  );
}
