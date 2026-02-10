import { formatDistanceToNow } from "date-fns";
import {
  ArrowUp,
  CheckCircle2,
  Copy,
  ExternalLink,
  GitBranch,
  MessageCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { CommunityPost, CommunityProfile, VoteState, VoteType } from "@/lib/community";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PromptPreviewPanel } from "@/components/community/PromptPreviewPanel";
import { CommunityComments } from "@/components/community/CommunityComments";

interface CommunityPostDetailProps {
  post: CommunityPost;
  authorName: string;
  authorAvatarUrl?: string | null;
  parentPost: CommunityPost | null;
  remixes: CommunityPost[];
  authorById: Record<string, CommunityProfile>;
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

function renderAuthor(authorById: Record<string, CommunityProfile>, authorId: string): string {
  return authorById[authorId]?.displayName || "Community member";
}

export function CommunityPostDetail({
  post,
  authorName,
  authorAvatarUrl,
  parentPost,
  remixes,
  authorById,
  onCopyPrompt,
  onToggleVote,
  voteState,
  onCommentAdded,
  canVote,
}: CommunityPostDetailProps) {
  const createdAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  return (
    <div className="space-y-4">
      <Card className="space-y-4 border-border/80 bg-card/85 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-9 w-9 border border-border/60">
              <AvatarImage src={authorAvatarUrl ?? undefined} alt={authorName} />
              <AvatarFallback className="text-[11px]">{getInitials(authorName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{authorName}</p>
              <p className="text-xs text-muted-foreground">{createdAgo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
              <Link to={`/?remix=${post.id}`}>Remix</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onCopyPrompt(post)}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy prompt
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">{post.title}</h1>
          {post.useCase && <p className="text-sm text-muted-foreground">{post.useCase}</p>}
        </div>

        {parentPost && (
          <div className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
            <span className="font-medium">Remixed from:</span>{" "}
            <Link to={`/community/${parentPost.id}`} className="underline underline-offset-2">
              {parentPost.title}
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="capitalize">
            {post.category}
          </Badge>
          {post.targetModel && <Badge variant="secondary">{post.targetModel}</Badge>}
          {post.tags.slice(0, 8).map((tag) => (
            <Badge key={`${post.id}-${tag}`} variant="outline">
              #{tag}
            </Badge>
          ))}
        </div>

        <PromptPreviewPanel text={post.enhancedPrompt} mode="full" />

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
      </Card>

      <CommunityComments
        postId={post.id}
        totalCount={post.commentCount}
        onCommentAdded={onCommentAdded}
        className="border-border/80 bg-card/85 p-4 sm:p-5"
      />

      <Card className="space-y-3 border-border/80 bg-card/85 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Remixes</h2>
          <Badge variant="secondary">{remixes.length}</Badge>
        </div>

        {remixes.length === 0 && (
          <p className="text-xs text-muted-foreground">No public remixes yet.</p>
        )}

        {remixes.map((remix) => {
          const remixAuthor = renderAuthor(authorById, remix.authorId);
          const created = formatDistanceToNow(new Date(remix.createdAt), { addSuffix: true });
          return (
            <div
              key={remix.id}
              className="rounded-md border border-border/70 bg-background/50 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{remix.title}</p>
                  <p className="text-muted-foreground">
                    by {remixAuthor} • {created}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                  <Link to={`/community/${remix.id}`}>
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
