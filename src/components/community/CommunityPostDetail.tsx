import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUp,
  BookmarkPlus,
  CheckCircle2,
  ExternalLink,
  Flag,
  GitBranch,
  MessageCircle,
  MoreHorizontal,
  Star,
  UserCheck,
  UserX,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { CommunityPost, CommunityProfile, VoteState, VoteType } from "@/lib/community";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/base/primitives/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
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
import { UI_STATUS_ROW_CLASSES, UI_STATUS_SURFACE_CLASSES } from "@/lib/ui-status";
import { cn } from "@/lib/utils";

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
  canRate?: boolean;
  ratingValue?: number | null;
  onRatePrompt?: (postId: string, rating: number | null) => void;
  canSaveToLibrary: boolean;
  onSaveToLibrary: (postId: string) => void;
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
  canRate = false,
  ratingValue = null,
  onRatePrompt,
  canSaveToLibrary,
  onSaveToLibrary,
  canModerate = false,
  canBlockAuthor = true,
  isAuthorBlocked = false,
  blockedUserIds = [],
  onReportPost,
  onReportComment,
  onBlockUser,
  onUnblockUser,
}: CommunityPostDetailProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const useMobileCommentsDrawer = isMobile && communityFeatureFlags.communityMobileEnhancements;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const createdAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const remixDiff = parseRemixDiff(post.remixDiff);
  const promptBody = (post.enhancedPrompt || post.starterPrompt || "").trim();
  const ratingAverage = post.ratingAverage ?? 0;
  const ratingCount = post.ratingCount ?? 0;
  const ratingSummaryAriaLabel = `Average rating ${ratingAverage.toFixed(1)} from ${ratingCount} rating${ratingCount === 1 ? "" : "s"}`;
  const commentsDescriptionId = `community-comments-description-${post.id}`;

  return (
    <div className="space-y-4">
      <Card className="space-y-4 border-border/80 bg-card/85 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-9 w-9 border border-border/60">
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
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              color="tertiary"
              size="sm"
              className="type-button-label h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => navigate(`/?remix=${post.id}`)}
            >
              Remix
            </Button>
            <Button
              type="button"
              color="tertiary"
              size="sm"
              className="type-button-label h-11 w-full gap-1.5 sm:h-9 sm:w-auto"
              disabled={!canSaveToLibrary}
              onClick={() => onSaveToLibrary(post.id)}
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save to Library
            </Button>
            {canModerate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    color="secondary"
                    size="sm"
                    className="h-11 w-11 sm:h-9 sm:w-9"
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

        <div className="space-y-1">
          <h1 className="type-post-title text-foreground">{post.title}</h1>
          {post.useCase && (
            <p className="type-post-body type-prose-measure type-wrap-safe text-muted-foreground">{post.useCase}</p>
          )}
        </div>

        {parentPost && (
          <div className="type-meta rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-primary">
            <span className="font-medium">Remixed from:</span>{" "}
            <Link to={`/community/${parentPost.id}`} className="type-link-inline type-wrap-safe">
              {parentPost.title}
            </Link>
          </div>
        )}

        {post.remixNote && (
          <div className="type-meta type-wrap-safe rounded-md border border-border/70 bg-background/60 px-3 py-2 text-muted-foreground">
            <span className="font-medium text-foreground">Remix note:</span> {post.remixNote}
          </div>
        )}

        {remixDiff && (
          <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="type-reply-label type-label-caps text-primary">Prompt diff</p>
              <Badge type="modern" className="type-chip h-5 px-1.5 font-mono">
                Unified
              </Badge>
            </div>

            {remixDiff.changes.length > 0 ? (
              <div className="type-code overflow-hidden rounded-md border border-border/80 bg-background/65 font-mono">
                {remixDiff.changes.map((change) => (
                  <div key={`${post.id}-${change.field}`} className="border-b border-border/70 last:border-b-0">
                    <div className="type-reply-label type-label-caps border-b border-border/70 px-3 py-1.5 text-muted-foreground">
                      {change.field}
                    </div>
                    <div className={`flex items-start gap-2 px-3 py-1.5 ${UI_STATUS_ROW_CLASSES.danger}`}>
                      <span className="mt-0.5 w-3 shrink-0 text-center font-semibold">-</span>
                      <span className="whitespace-pre-wrap wrap-break-word">{renderDiffValue(change.from)}</span>
                    </div>
                    <div className={`flex items-start gap-2 px-3 py-1.5 ${UI_STATUS_ROW_CLASSES.success}`}>
                      <span className="mt-0.5 w-3 shrink-0 text-center font-semibold">+</span>
                      <span className="whitespace-pre-wrap wrap-break-word">{renderDiffValue(change.to)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="type-help text-muted-foreground">No field-level text changes captured.</p>
            )}

            {(remixDiff.added_tags.length > 0 ||
              remixDiff.removed_tags.length > 0 ||
              remixDiff.category_changed) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {remixDiff.added_tags.length > 0 && (
                    <div className={`type-meta rounded-md px-3 py-2 ${UI_STATUS_SURFACE_CLASSES.success}`}>
                      <span className="font-semibold">Added tags</span>
                      <p className="type-code mt-1 font-mono">{remixDiff.added_tags.join(", ")}</p>
                    </div>
                  )}
                  {remixDiff.removed_tags.length > 0 && (
                    <div className={`type-meta rounded-md px-3 py-2 ${UI_STATUS_SURFACE_CLASSES.danger}`}>
                      <span className="font-semibold">Removed tags</span>
                      <p className="type-code mt-1 font-mono">{remixDiff.removed_tags.join(", ")}</p>
                    </div>
                  )}
                  {remixDiff.category_changed && (
                    <div className="type-meta rounded-md border border-border/70 bg-background/60 px-3 py-2 text-muted-foreground sm:col-span-2">
                      <span className="font-semibold text-foreground">Category changed</span>
                      <p className="type-wrap-safe mt-1">This remix is published under a different category than the parent prompt.</p>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge type="modern" className="type-chip border border-border bg-background text-foreground capitalize">
            {post.category}
          </Badge>
          {post.targetModel && <Badge type="modern" className="type-chip">{post.targetModel}</Badge>}
          {post.tags.slice(0, 8).map((tag) => (
            <Badge
              key={`${post.id}-${tag}`}
              type="modern"
              className="type-chip border border-border bg-background text-foreground"
            >
              #{tag}
            </Badge>
          ))}
        </div>

        <PromptPreviewPanel text={promptBody} mode="full" onCopy={() => onCopyPrompt(post)} />

        <div className="type-meta flex flex-wrap items-center gap-2 text-muted-foreground">
          <Button
            type="button"
            size="sm"
            color={voteState?.upvote ? "primary" : "secondary"}
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
            color={voteState?.verified ? "primary" : "secondary"}
            className="type-button-label interactive-chip h-11 gap-1.5 px-3 sm:h-9 sm:gap-1 sm:px-2.5"
            disabled={!canVote}
            onClick={() => onToggleVote(post.id, "verified")}
            data-testid="community-vote-verified"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="type-numeric">{post.verifiedCount}</span>
          </Button>
          <span className="type-numeric inline-flex items-center gap-1">
            <GitBranch className="h-3.5 w-3.5" />
            {post.remixCount}
          </span>
          {useMobileCommentsDrawer ? (
            <Button
              type="button"
              size="sm"
              color="primary"
              className="type-button-label h-11 gap-1.5 px-3 sm:h-9 sm:px-2.5"
              aria-label={`Comments ${post.commentCount}`}
              onClick={() => {
                setCommentsOpen(true);
                onCommentThreadOpen?.(post.id);
              }}
              data-testid="community-comments-thread-trigger"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Comments
              <Badge
                type="modern"
                className="type-reply-label type-numeric ml-0.5 h-4 min-w-4 px-1 leading-none"
                aria-hidden="true"
              >
                {post.commentCount}
              </Badge>
            </Button>
          ) : (
            <span className="type-numeric inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {post.commentCount}
            </span>
          )}
          <span
            aria-label={ratingSummaryAriaLabel}
            className="type-numeric inline-flex items-center gap-1.5 rounded-full border border-border/65 bg-background/65 px-2 py-1"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                ratingCount > 0 ? "fill-primary text-primary" : "text-muted-foreground",
              )}
            />
            {ratingAverage.toFixed(1)}
            <span className="text-muted-foreground/80">({ratingCount})</span>
          </span>
          {canRate && onRatePrompt && (
            <div className="inline-flex items-center gap-0.5 rounded-full border border-border/65 bg-background/65 p-0.5">
              {[1, 2, 3, 4, 5].map((value) => {
                const isActive = (ratingValue ?? 0) >= value;
                return (
                  <Button
                    key={`${post.id}-detail-rate-${value}`}
                    type="button"
                    color="tertiary"
                    size="sm"
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
      </Card>

      {!useMobileCommentsDrawer && (
        <CommunityComments
          postId={post.id}
          totalCount={post.commentCount}
          onCommentAdded={onCommentAdded}
          blockedUserIds={blockedUserIds}
          onReportComment={onReportComment}
          onBlockUser={onBlockUser}
          onUnblockUser={onUnblockUser}
          className="border-border/80 bg-card/85 p-4 sm:p-5"
        />
      )}

      {useMobileCommentsDrawer && (
        <Drawer open={commentsOpen} onOpenChange={setCommentsOpen}>
          <DrawerContent
            className="max-h-[86vh] gap-0 border-border/80 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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

      <Card className="space-y-3 border-border/80 bg-card/85 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="type-tab-label text-foreground">Remixes</h2>
          <Badge type="modern" className="type-chip type-numeric">{remixes.length}</Badge>
        </div>

        {remixes.length === 0 && (
          <p className="type-help text-muted-foreground">No remixes yet.</p>
        )}

        {remixes.map((remix) => {
          const remixAuthor = renderAuthor(authorById, remix.authorId);
          const created = formatDistanceToNow(new Date(remix.createdAt), { addSuffix: true });
          return (
            <div
              key={remix.id}
              className="rounded-md border border-border/70 bg-background/50 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="type-author type-wrap-safe text-foreground">{remix.title}</p>
                  <p className="type-meta text-muted-foreground">
                    by {remixAuthor} • {created}
                  </p>
                </div>
                <Button
                  type="button"
                  color="tertiary"
                  size="sm"
                  className="type-button-label h-11 px-3 sm:h-9 sm:px-2"
                  onClick={() => navigate(`/community/${remix.id}`)}
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
