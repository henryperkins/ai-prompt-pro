import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUp,
  BookmarkPlus,
  CheckCircle2,
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { communityFeatureFlags } from "@/lib/feature-flags";

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
  onCommentThreadOpen?: (postId: string) => void;
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

function renderDiffValue(value: string | string[]): string {
  const normalized = stringifyDiffValue(value).trim();
  return normalized || "∅";
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
  onCommentThreadOpen,
  canVote,
  canSaveToLibrary,
  onSaveToLibrary,
}: CommunityPostDetailProps) {
  const isMobile = useIsMobile();
  const useMobileCommentsDrawer = isMobile && communityFeatureFlags.communityMobileEnhancements;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const createdAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const remixDiff = parseRemixDiff(post.remixDiff);
  const promptBody = (post.enhancedPrompt || post.starterPrompt || "").trim();

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
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button asChild variant="ghost" size="sm" className="h-11 w-full text-sm sm:h-8 sm:w-auto sm:text-xs">
              <Link to={`/?remix=${post.id}`}>Remix</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 w-full gap-1.5 text-sm sm:h-8 sm:w-auto sm:text-xs"
              disabled={!canSaveToLibrary}
              onClick={() => onSaveToLibrary(post.id)}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save to Library
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

        {post.remixNote && (
          <div className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Remix note:</span> {post.remixNote}
          </div>
        )}

        {remixDiff && (
          <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Prompt diff</p>
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-mono">
                Unified
              </Badge>
            </div>

            {remixDiff.changes.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border/80 bg-background/65 font-mono text-[11px]">
                {remixDiff.changes.map((change) => (
                  <div key={`${post.id}-${change.field}`} className="border-b border-border/70 last:border-b-0">
                    <div className="border-b border-border/70 px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {change.field}
                    </div>
                    <div className="flex items-start gap-2 bg-red-500/10 px-3 py-1.5 text-red-700 dark:text-red-300">
                      <span className="mt-0.5 w-3 shrink-0 text-center font-semibold">-</span>
                      <span className="whitespace-pre-wrap break-words">{renderDiffValue(change.from)}</span>
                    </div>
                    <div className="flex items-start gap-2 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-300">
                      <span className="mt-0.5 w-3 shrink-0 text-center font-semibold">+</span>
                      <span className="whitespace-pre-wrap break-words">{renderDiffValue(change.to)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No field-level text changes captured.</p>
            )}

            {(remixDiff.added_tags.length > 0 ||
              remixDiff.removed_tags.length > 0 ||
              remixDiff.category_changed) && (
              <div className="grid gap-2 sm:grid-cols-2">
                {remixDiff.added_tags.length > 0 && (
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <span className="font-semibold">Added tags</span>
                    <p className="mt-1 font-mono text-[11px]">{remixDiff.added_tags.join(", ")}</p>
                  </div>
                )}
                {remixDiff.removed_tags.length > 0 && (
                  <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                    <span className="font-semibold">Removed tags</span>
                    <p className="mt-1 font-mono text-[11px]">{remixDiff.removed_tags.join(", ")}</p>
                  </div>
                )}
                {remixDiff.category_changed && (
                  <div className="rounded-md border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                    <span className="font-semibold text-foreground">Category changed</span>
                    <p className="mt-1">This remix is published under a different category than the parent prompt.</p>
                  </div>
                )}
              </div>
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

        <PromptPreviewPanel text={promptBody} mode="full" onCopy={() => onCopyPrompt(post)} />

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Button
            type="button"
            size="sm"
            variant={voteState?.upvote ? "soft" : "outline"}
            className="interactive-chip h-11 gap-1.5 px-3 text-sm sm:h-8 sm:gap-1 sm:px-2.5 sm:text-[11px]"
            disabled={!canVote}
            onClick={() => onToggleVote(post.id, "upvote")}
            data-testid="community-vote-upvote"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            {post.upvoteCount}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={voteState?.verified ? "soft" : "outline"}
            className="interactive-chip h-11 gap-1.5 px-3 text-sm sm:h-8 sm:gap-1 sm:px-2.5 sm:text-[11px]"
            disabled={!canVote}
            onClick={() => onToggleVote(post.id, "verified")}
            data-testid="community-vote-verified"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {post.verifiedCount}
          </Button>
          <span className="inline-flex items-center gap-1">
            <GitBranch className="h-3.5 w-3.5" />
            {post.remixCount}
          </span>
          {useMobileCommentsDrawer ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-11 gap-1.5 px-3 text-sm sm:h-8 sm:px-2.5 sm:text-xs"
              onClick={() => {
                setCommentsOpen(true);
                onCommentThreadOpen?.(post.id);
              }}
              data-testid="community-comments-thread-trigger"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Open comments thread
              <Badge variant="secondary" className="ml-0.5 h-4 min-w-4 px-1 text-[10px] leading-none">
                {post.commentCount}
              </Badge>
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {post.commentCount}
            </span>
          )}
        </div>
      </Card>

      {!useMobileCommentsDrawer && (
        <CommunityComments
          postId={post.id}
          totalCount={post.commentCount}
          onCommentAdded={onCommentAdded}
          className="border-border/80 bg-card/85 p-4 sm:p-5"
        />
      )}

      {useMobileCommentsDrawer && (
        <Drawer open={commentsOpen} onOpenChange={setCommentsOpen}>
          <DrawerContent
            className="max-h-[85vh] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            aria-describedby={undefined}
            data-testid="community-comments-sheet"
          >
            <DrawerHeader className="pb-1">
              <DrawerTitle className="text-base">Comments</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <CommunityComments
                postId={post.id}
                totalCount={post.commentCount}
                onCommentAdded={onCommentAdded}
                className="border-border/70 bg-transparent p-0"
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

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
                <Button asChild variant="ghost" size="sm" className="h-11 px-3 text-sm sm:h-7 sm:px-2 sm:text-[11px]">
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
