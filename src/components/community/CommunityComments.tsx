import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CommunityComment, CommunityProfile } from "@/lib/community";
import { addComment, loadComments, loadProfilesByIds } from "@/lib/community";
import { getInitials, toProfileMap } from "@/lib/community-utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
import { Skeleton } from "@/components/base/primitives/skeleton";
import { Textarea } from "@/components/base/textarea";
import { cn } from "@/lib/utils";
import {
  ChatCircle as MessageCircle,
  DotsThreeOutline as MoreHorizontal,
  Flag,
  PaperPlaneTilt as Send,
  SignIn as LogIn,
  UserCheck,
  UserMinus as UserX,
} from "@phosphor-icons/react";

const COMMENTS_VIRTUALIZATION_THRESHOLD = 30;
const QUICK_REPLY_CHIPS = [
  "Great point - thanks for sharing.",
  "Can you share an example?",
  "I tried this and it worked well.",
] as const;

interface CommunityCommentsProps {
  postId: string;
  totalCount: number;
  compact?: boolean;
  autoFocusComposer?: boolean;
  onCommentAdded?: (postId: string) => void;
  blockedUserIds?: string[];
  onReportComment?: (commentId: string, userId: string, postId: string) => void;
  onBlockUser?: (userId: string) => void;
  onUnblockUser?: (userId: string) => void;
  className?: string;
}


export function CommunityComments({
  postId,
  totalCount,
  compact = false,
  autoFocusComposer = false,
  onCommentAdded,
  blockedUserIds = [],
  onReportComment,
  onBlockUser,
  onUnblockUser,
  className,
}: CommunityCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [authorById, setAuthorById] = useState<Record<string, CommunityProfile>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const limit = compact ? 2 : 120;
  const commentsScrollRef = useRef<HTMLDivElement | null>(null);

  const loadThread = useCallback(async () => {
    setLoading(true);
    try {
      const nextComments = await loadComments(postId, { limit });
      setComments(nextComments);
      const authorIds = Array.from(new Set(nextComments.map((comment) => comment.userId)));
      const profiles = await loadProfilesByIds(authorIds);
      setAuthorById(toProfileMap(profiles));
    } catch (error) {
      toast({
        title: "Failed to load comments",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [limit, postId, toast]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (autoFocusComposer && composerRef.current) {
      const timer = setTimeout(() => composerRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [autoFocusComposer]);

  const handleSubmit = useCallback(async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Sign in to post comments.",
      });
      return;
    }

    const content = draft.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      const created = await addComment(postId, content);
      if (user && !(user.id in authorById)) {
        const displayName =
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email ||
          "You";
        setAuthorById((prev) => ({
          ...prev,
          [user.id]: {
            id: user.id,
            displayName,
            avatarUrl: user.user_metadata?.avatar_url || null,
          },
        }));
      }
      setComments((prev) => [created, ...prev].slice(0, limit));
      setDraft("");
      onCommentAdded?.(postId);
    } catch (error) {
      toast({
        title: "Failed to post comment",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [authorById, draft, limit, onCommentAdded, postId, toast, user]);

  const handleQuickReply = useCallback((text: string) => {
    setDraft((previous) => {
      const normalizedPrevious = previous.trim();
      if (!normalizedPrevious) {
        return text;
      }
      const separator = previous.endsWith(" ") ? "" : " ";
      return `${previous}${separator}${text}`;
    });

    window.setTimeout(() => {
      const composer = composerRef.current;
      if (!composer) return;
      composer.focus();
      const end = composer.value.length;
      composer.setSelectionRange(end, end);
    }, 0);
  }, []);

  const commentItems = useMemo(
    () =>
      comments.map((comment) => {
        const author = authorById[comment.userId];
        const displayName = author?.displayName || "Community member";
        const createdAt = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
        return {
          comment,
          author,
          displayName,
          createdAt,
        };
      }),
    [authorById, comments],
  );

  const blockedSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);
  const visibleCommentItems = useMemo(
    () => commentItems.filter((item) => !blockedSet.has(item.comment.userId)),
    [blockedSet, commentItems],
  );
  const hiddenCommentCount = commentItems.length - visibleCommentItems.length;
  const shouldVirtualize = !compact && visibleCommentItems.length >= COMMENTS_VIRTUALIZATION_THRESHOLD;
  const commentVirtualizer = useVirtualizer({
    count: shouldVirtualize ? visibleCommentItems.length : 0,
    getScrollElement: () => commentsScrollRef.current,
    estimateSize: () => 108,
    overscan: 8,
    measureElement: (element) => element.getBoundingClientRect().height,
    enabled: shouldVirtualize,
  });

  const canComment = Boolean(user);
  const hasCommentActions = Boolean(user?.id && (onReportComment || onBlockUser || onUnblockUser));
  const submitDisabled = submitting || (canComment && !draft.trim());
  const submitLabel = canComment ? "Post comment" : "Sign in to comment";

  function renderCommentRow(item: (typeof visibleCommentItems)[number]) {
    const canToggleBlock = Boolean(user?.id && user.id !== item.comment.userId);
    const isBlocked = blockedSet.has(item.comment.userId);

    return (
      <div className="rounded-lg border border-border/60 bg-background/70 px-2.5 py-2 sm:p-2.5">
        <div className="flex items-start gap-2">
          <Avatar className="h-7 w-7 border border-border/60">
            <AvatarImage src={item.author?.avatarUrl ?? undefined} alt={item.displayName} />
            <AvatarFallback className="type-reply-label">{getInitials(item.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="type-meta flex flex-wrap items-center gap-1.5 text-muted-foreground sm:gap-2">
              <Link to={`/profile/${item.comment.userId}`} className="type-author type-link-inline type-wrap-inline text-foreground">
                {item.displayName}
              </Link>
              <span className="type-timestamp">{item.createdAt}</span>
              {hasCommentActions && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      color="tertiary"
                      size="sm"
                      className="ml-auto h-7 w-7"
                      aria-label="Open comment moderation actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        onReportComment?.(item.comment.id, item.comment.userId, postId);
                      }}
                    >
                      <Flag className="mr-2 h-4 w-4" />
                      Report comment
                    </DropdownMenuItem>
                    {canToggleBlock && (
                      isBlocked ? (
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            onUnblockUser?.(item.comment.userId);
                          }}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Unblock user
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            onBlockUser?.(item.comment.userId);
                          }}
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Block user
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <p className="type-comment-body type-prose-measure type-wrap-safe mt-0.5 whitespace-pre-wrap text-foreground sm:mt-1">
              {item.comment.body}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("space-y-2.5 border-border/75 bg-card/90 p-2.5 sm:space-y-3 sm:p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="type-tab-label flex items-center gap-1.5 text-foreground sm:gap-2">
          <MessageCircle className="h-3.5 w-3.5" />
          Comments
        </div>
        <Badge type="modern" className="type-chip type-numeric h-5 min-w-5 px-1.5">
          {totalCount}
        </Badge>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      )}

      {!loading && comments.length === 0 && (
        <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-5 text-center">
          <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
          </span>
          <p className="type-post-title mt-2 text-foreground">No comments yet</p>
          <p className="type-help mt-1 text-muted-foreground">Be the first to share your thoughts.</p>
        </div>
      )}

      {!loading && hiddenCommentCount > 0 && (
        <p className="type-help text-muted-foreground">
          {hiddenCommentCount} comment{hiddenCommentCount === 1 ? "" : "s"} hidden from blocked users.
        </p>
      )}

      {!loading && visibleCommentItems.length > 0 && (
        <>
          {shouldVirtualize ? (
            <div
              ref={commentsScrollRef}
              className="max-h-[48vh] overflow-y-auto pr-1 sm:max-h-[52vh]"
              data-testid="community-comments-virtualized-list"
            >
              <div className="relative w-full" style={{ height: `${commentVirtualizer.getTotalSize()}px` }}>
                {commentVirtualizer.getVirtualItems().map((virtualItem) => {
                  const item = visibleCommentItems[virtualItem.index];
                  if (!item) return null;

                  return (
                    <div
                      key={item.comment.id}
                      ref={commentVirtualizer.measureElement}
                      className="absolute left-0 top-0 w-full pb-1.5 sm:pb-2"
                      style={{ transform: `translateY(${virtualItem.start}px)` }}
                    >
                      {renderCommentRow(item)}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              data-testid="community-comments-list"
              className={cn(
                "space-y-1.5 sm:space-y-2",
                !compact && "max-h-[42vh] overflow-y-auto pr-1 sm:max-h-[52vh] sm:pr-1",
              )}
            >
              {visibleCommentItems.map((item) => (
                <div key={item.comment.id}>
                  {renderCommentRow(item)}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {compact && totalCount > comments.length && (
        <Link
          to={`/community/${postId}`}
          className="type-button-label type-link-inline inline-flex min-h-11 items-center text-primary sm:min-h-0"
        >
          View all comments
        </Link>
      )}

      {canComment ? (
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_REPLY_CHIPS.map((chip) => (
              <Button
                key={`${postId}-${chip}`}
                type="button"
                size="sm"
                color="secondary"
                className="type-button-label h-10 rounded-full px-3 sm:h-8 sm:px-2.5"
                onClick={() => handleQuickReply(chip)}
                data-testid="community-quick-reply-chip"
              >
                {chip}
              </Button>
            ))}
          </div>
          <Textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Write a comment..."
            disabled={submitting}
            className="type-input type-wrap-safe min-h-19 rounded-lg border-border/70 bg-background/95 sm:min-h-22"
            enterKeyHint="send"
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <span className="type-meta text-muted-foreground">{draft.length}/2000</span>
            <Button
              type="button"
              size="sm"
              color="primary"
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="type-button-label h-11 gap-1.5 px-4 sm:h-9 sm:px-3"
              data-testid="community-comment-submit"
            >
              <Send className="h-3.5 w-3.5" />
              {submitLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-background/70 p-3">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="type-post-title text-foreground">Sign in to join the conversation</p>
              <p className="type-help mt-1 text-muted-foreground">
                Share feedback and remix tips with other creators.
              </p>
            </div>
          </div>
          <Button
            href="/"
            size="sm"
            color="primary"
            className="type-button-label mt-3 h-11 gap-1.5 px-4 sm:h-9 sm:px-3"
            data-testid="community-comment-submit"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in to comment
          </Button>
        </div>
      )}
    </Card>
  );
}
