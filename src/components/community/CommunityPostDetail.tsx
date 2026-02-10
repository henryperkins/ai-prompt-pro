import { formatDistanceToNow } from "date-fns";
import {
  ArrowUp,
  BookmarkPlus,
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
  canSaveToLibrary: boolean;
  onSaveToLibrary: (postId: string) => void;
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

interface RemixDiffDisplay {
  changes: Array<{
    field: string;
    from: string | string[];
    to: string | string[];
  }>;
  added_tags: string[];
  removed_tags: string[];
  category_changed: boolean;
}

function parseRemixDiff(value: unknown): RemixDiffDisplay | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  const rawChanges = Array.isArray(candidate.changes) ? candidate.changes : [];
  const changes = rawChanges
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const field = typeof row.field === "string" ? row.field : null;
      const fromValue = row.from;
      const toValue = row.to;
      if (!field) return null;
      const from = Array.isArray(fromValue)
        ? fromValue.map((item) => String(item))
        : String(fromValue ?? "");
      const to = Array.isArray(toValue)
        ? toValue.map((item) => String(item))
        : String(toValue ?? "");
      return { field, from, to };
    })
    .filter((entry): entry is RemixDiffDisplay["changes"][number] => !!entry);

  const addedTags = Array.isArray(candidate.added_tags)
    ? candidate.added_tags.map((tag) => String(tag))
    : [];
  const removedTags = Array.isArray(candidate.removed_tags)
    ? candidate.removed_tags.map((tag) => String(tag))
    : [];
  const categoryChanged = Boolean(candidate.category_changed);

  if (!changes.length && !addedTags.length && !removedTags.length && !categoryChanged) {
    return null;
  }

  return {
    changes,
    added_tags: addedTags,
    removed_tags: removedTags,
    category_changed: categoryChanged,
  };
}

function stringifyDiffValue(value: string | string[]): string {
  if (Array.isArray(value)) return value.join(", ");
  return value;
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
  canSaveToLibrary,
  onSaveToLibrary,
}: CommunityPostDetailProps) {
  const createdAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const remixDiff = parseRemixDiff(post.remixDiff);

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
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              disabled={!canSaveToLibrary}
              onClick={() => onSaveToLibrary(post.id)}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save to Library
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

        {remixDiff && (
          <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <p className="font-medium text-primary">Remix diff</p>
            {remixDiff.changes.length > 0 && (
              <div className="space-y-1 text-muted-foreground">
                {remixDiff.changes.map((change) => (
                  <p key={`${post.id}-${change.field}`}>
                    <span className="font-medium text-foreground">{change.field}:</span>{" "}
                    {stringifyDiffValue(change.from)} → {stringifyDiffValue(change.to)}
                  </p>
                ))}
              </div>
            )}
            {remixDiff.added_tags.length > 0 && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Added tags:</span>{" "}
                {remixDiff.added_tags.join(", ")}
              </p>
            )}
            {remixDiff.removed_tags.length > 0 && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Removed tags:</span>{" "}
                {remixDiff.removed_tags.join(", ")}
              </p>
            )}
            {remixDiff.category_changed && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Category:</span> changed from parent
              </p>
            )}
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
