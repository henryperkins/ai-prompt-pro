import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { MessageCircle, Send } from "lucide-react";
import type { CommunityComment, CommunityProfile } from "@/lib/community";
import { addComment, loadComments, loadProfilesByIds } from "@/lib/community";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CommunityCommentsProps {
  postId: string;
  totalCount: number;
  compact?: boolean;
  onCommentAdded?: (postId: string) => void;
  className?: string;
}

function mapProfileById(profiles: CommunityProfile[]): Record<string, CommunityProfile> {
  return profiles.reduce<Record<string, CommunityProfile>>((map, profile) => {
    map[profile.id] = profile;
    return map;
  }, {});
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

export function CommunityComments({
  postId,
  totalCount,
  compact = false,
  onCommentAdded,
  className,
}: CommunityCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [authorById, setAuthorById] = useState<Record<string, CommunityProfile>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");

  const limit = compact ? 2 : 40;

  const loadThread = useCallback(async () => {
    setLoading(true);
    try {
      const nextComments = await loadComments(postId, { limit });
      setComments(nextComments);
      const authorIds = Array.from(new Set(nextComments.map((comment) => comment.userId)));
      const profiles = await loadProfilesByIds(authorIds);
      setAuthorById(mapProfileById(profiles));
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

  const handleSubmit = useCallback(async () => {
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

  const canComment = Boolean(user);

  return (
    <Card className={cn("space-y-3 border-border/80 bg-card/85 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          Comments
        </div>
        <Badge variant="secondary" className="text-[11px]">
          {totalCount}
        </Badge>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!loading && comments.length === 0 && (
        <p className="text-xs text-muted-foreground">Be the first to comment.</p>
      )}

      {!loading && comments.length > 0 && (
        <div
          className={cn(
            "space-y-2",
            !compact && "max-h-[45vh] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0",
          )}
        >
          {comments.map((comment) => {
            const author = authorById[comment.userId];
            const displayName = author?.displayName || "Community member";
            const createdAt = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
            return (
              <div key={comment.id} className="rounded-md border border-border/70 bg-background/60 p-2 text-xs">
                <div className="flex items-start gap-2">
                  <Avatar className="h-7 w-7 border border-border/60">
                    <AvatarImage src={author?.avatarUrl ?? undefined} alt={displayName} />
                    <AvatarFallback className="text-[10px]">{getInitials(displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{displayName}</span>
                      <span>{createdAt}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">{comment.body}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {compact && totalCount > comments.length && (
        <Link
          to={`/community/${postId}`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline sm:min-h-0 sm:text-xs"
        >
          View all comments
        </Link>
      )}

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={canComment ? "Write a comment..." : "Sign in to comment"}
          disabled={!canComment || submitting}
          className="min-h-[70px] bg-background"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={handleSubmit}
            disabled={!canComment || submitting || !draft.trim()}
            className="h-11 gap-1.5 px-4 text-sm sm:h-9 sm:px-3 sm:text-xs"
          >
            <Send className="h-3.5 w-3.5" />
            Post comment
          </Button>
        </div>
      </div>
    </Card>
  );
}
