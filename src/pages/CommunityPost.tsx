import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { CommunityPostDetail } from "@/components/community/CommunityPostDetail";
import { CommunityReportDialog } from "@/components/community/CommunityReportDialog";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StateCard } from "@/components/ui/state-card";
import { useCommunityMobileTelemetry } from "@/hooks/useCommunityMobileTelemetry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  type CommunityPost as CommunityPostType,
  type CommunityProfile,
  loadPost,
  loadProfilesByIds,
  loadRemixes,
  remixToLibrary,
  loadMyVotes,
  toggleVote,
  type VoteState,
  type VoteType,
} from "@/lib/community";
import { toCommunityErrorState, type CommunityErrorState } from "@/lib/community-errors";
import { communityFeatureFlags } from "@/lib/feature-flags";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  blockCommunityUser,
  loadBlockedUserIds,
  submitCommunityReport,
  unblockCommunityUser,
} from "@/lib/community-moderation";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function toProfileMap(profiles: CommunityProfile[]): Record<string, CommunityProfile> {
  return profiles.reduce<Record<string, CommunityProfile>>((map, profile) => {
    map[profile.id] = profile;
    return map;
  }, {});
}

interface CommunityReportTarget {
  targetType: "post" | "comment";
  postId: string;
  commentId?: string;
  reportedUserId: string | null;
}

const CommunityPost = () => {
  const { postId } = useParams<{ postId: string }>();
  const requestToken = useRef(0);
  const voteInFlightByPost = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const mobileEnhancementsEnabled = isMobile && communityFeatureFlags.communityMobileEnhancements;
  const { trackInteraction } = useCommunityMobileTelemetry({
    enabled: mobileEnhancementsEnabled,
    surface: "community_post",
  });
  const [post, setPost] = useState<CommunityPostType | null>(null);
  const [parentPost, setParentPost] = useState<CommunityPostType | null>(null);
  const [remixes, setRemixes] = useState<CommunityPostType[]>([]);
  const [authorById, setAuthorById] = useState<Record<string, CommunityProfile>>({});
  const [voteState, setVoteState] = useState<VoteState | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<CommunityErrorState | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [reportTarget, setReportTarget] = useState<CommunityReportTarget | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setBlockedUserIds([]);
      return;
    }

    let cancelled = false;
    void loadBlockedUserIds()
      .then((ids) => {
        if (!cancelled) {
          setBlockedUserIds(ids);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load blocked users:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const resetPostState = () => {
      setPost(null);
      setParentPost(null);
      setRemixes([]);
      setAuthorById({});
      setVoteState(null);
    };

    if (!postId || !isUuid(postId)) {
      resetPostState();
      setLoading(false);
      setErrorState({
        kind: "not_found",
        message: "This link is invalid or expired.",
      });
      return;
    }

    const token = ++requestToken.current;
    setLoading(true);
    setErrorState(null);

    void (async () => {
      try {
        const loadedPost = await loadPost(postId);
        if (token !== requestToken.current) return;

        if (!loadedPost) {
          resetPostState();
          setErrorState({
            kind: "not_found",
            message: "This community post is unavailable.",
          });
          return;
        }

        const [loadedParentResult, loadedRemixesResult, voteStatesResult] = await Promise.allSettled([
          loadedPost.remixedFrom ? loadPost(loadedPost.remixedFrom) : Promise.resolve(null),
          loadRemixes(loadedPost.id),
          loadMyVotes([loadedPost.id]),
        ]);

        if (token !== requestToken.current) return;

        const loadedParent = loadedParentResult.status === "fulfilled" ? loadedParentResult.value : null;
        const loadedRemixes = loadedRemixesResult.status === "fulfilled" ? loadedRemixesResult.value : [];
        const voteStates = voteStatesResult.status === "fulfilled" ? voteStatesResult.value : {};
        const authorIds = Array.from(
          new Set([
            loadedPost.authorId,
            ...(loadedParent ? [loadedParent.authorId] : []),
            ...loadedRemixes.map((remix) => remix.authorId),
          ]),
        );
        const profilesResult = await Promise.allSettled([loadProfilesByIds(authorIds)]);
        if (token !== requestToken.current) return;
        const profiles =
          profilesResult[0].status === "fulfilled"
            ? profilesResult[0].value
            : [];

        setPost(loadedPost);
        setParentPost(loadedParent);
        setRemixes(loadedRemixes);
        setAuthorById(toProfileMap(profiles));
        setVoteState(voteStates[loadedPost.id] ?? { upvote: false, verified: false });
      } catch (error) {
        if (token !== requestToken.current) return;
        resetPostState();
        setErrorState(toCommunityErrorState(error, "Failed to load this post right now. Please try again."));
      } finally {
        if (token === requestToken.current) {
          setLoading(false);
        }
      }
    })();
  }, [postId, user?.id, retryNonce]);

  const handleCopyPrompt = useCallback(
    async (target: CommunityPostType) => {
      try {
        await copyTextToClipboard(target.enhancedPrompt || target.starterPrompt);
        toast({
          title: "Prompt copied",
          description: "Prompt text copied with context-ready formatting.",
        });
      } catch {
        toast({
          title: "Copy failed",
          description: "Could not access clipboard in this browser context.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleToggleVote = useCallback(
    async (targetId: string, voteType: VoteType) => {
      if (!user) {
        toast({ title: "Sign in required", description: "Create an account to vote." });
        return;
      }
      if (voteInFlightByPost.current.has(targetId)) return;
      trackInteraction("reaction", `vote_${voteType}`, {
        postId: targetId,
      });
      voteInFlightByPost.current.add(targetId);
      try {
        const result = await toggleVote(targetId, voteType);
        setVoteState((prev) => ({
          upvote: voteType === "upvote" ? result.active : prev?.upvote ?? false,
          verified: voteType === "verified" ? result.active : prev?.verified ?? false,
        }));
        setPost((prev) => {
          if (!prev) return prev;
          const delta = result.active ? 1 : -1;
          if (voteType === "upvote") {
            return { ...prev, upvoteCount: Math.max(0, prev.upvoteCount + delta) };
          }
          return { ...prev, verifiedCount: Math.max(0, prev.verifiedCount + delta) };
        });
      } catch (error) {
        toast({
          title: "Vote failed",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      } finally {
        voteInFlightByPost.current.delete(targetId);
      }
    },
    [toast, trackInteraction, user],
  );

  const handleCommentAdded = useCallback((targetId: string) => {
    trackInteraction("comment", "comment_added", { postId: targetId });
    setPost((prev) => {
      if (!prev || prev.id !== targetId) return prev;
      return { ...prev, commentCount: prev.commentCount + 1 };
    });
  }, [trackInteraction]);

  const handleCommentThreadOpen = useCallback((targetId: string) => {
    trackInteraction("comment", "thread_opened", { postId: targetId });
  }, [trackInteraction]);

  const handleSaveToLibrary = useCallback(
    async (targetId: string) => {
      if (!user) {
        toast({ title: "Sign in required", description: "Create an account to save remixes." });
        return;
      }

      try {
        const saved = await remixToLibrary(targetId);
        toast({
          title: "Saved to Library",
          description: `“${saved.title}” is now in your private prompts.`,
        });
      } catch (error) {
        toast({
          title: "Failed to save remix",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [toast, user],
  );

  const handleReportPost = useCallback((targetPost: CommunityPostType) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to report content." });
      return;
    }

    setReportTarget({
      targetType: "post",
      postId: targetPost.id,
      reportedUserId: targetPost.authorId,
    });
  }, [toast, user]);

  const handleReportComment = useCallback((commentId: string, userId: string, postId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to report content." });
      return;
    }

    setReportTarget({
      targetType: "comment",
      postId,
      commentId,
      reportedUserId: userId,
    });
  }, [toast, user]);

  const handleBlockUser = useCallback(async (targetUserId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to block users." });
      return;
    }
    if (targetUserId === user.id) return;

    try {
      await blockCommunityUser(targetUserId);
      setBlockedUserIds((previous) => (
        previous.includes(targetUserId) ? previous : [...previous, targetUserId]
      ));
      toast({ title: "User blocked", description: "Posts and comments from this user are hidden." });
    } catch (error) {
      toast({
        title: "Could not block user",
        description: error instanceof Error ? error.message : "Unexpected moderation error.",
        variant: "destructive",
      });
    }
  }, [toast, user]);

  const handleUnblockUser = useCallback(async (targetUserId: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to manage blocked users." });
      return;
    }

    try {
      await unblockCommunityUser(targetUserId);
      setBlockedUserIds((previous) => previous.filter((id) => id !== targetUserId));
      toast({ title: "User unblocked" });
    } catch (error) {
      toast({
        title: "Could not unblock user",
        description: error instanceof Error ? error.message : "Unexpected moderation error.",
        variant: "destructive",
      });
    }
  }, [toast, user]);

  const handleSubmitReport = useCallback(async (payload: { reason: string; details: string }) => {
    if (!reportTarget) return;

    setReportSubmitting(true);
    try {
      await submitCommunityReport({
        targetType: reportTarget.targetType,
        postId: reportTarget.postId,
        commentId: reportTarget.commentId ?? null,
        reportedUserId: reportTarget.reportedUserId,
        reason: payload.reason,
        details: payload.details,
      });
      setReportTarget(null);
      toast({ title: "Report submitted", description: "Thanks. Our team will review this content." });
    } catch (error) {
      toast({
        title: "Could not submit report",
        description: error instanceof Error ? error.message : "Unexpected moderation error.",
        variant: "destructive",
      });
    } finally {
      setReportSubmitting(false);
    }
  }, [reportTarget, toast]);

  const postAuthor = post ? authorById[post.authorId] : null;
  const postAuthorName = postAuthor?.displayName || "Community member";
  const postAuthorBlocked = post ? blockedUserIds.includes(post.authorId) : false;
  const handleRetry = useCallback(() => {
    setRetryNonce((prev) => prev + 1);
  }, []);
  const errorTitle =
    errorState?.kind === "auth"
      ? "Sign in to access this community post"
      : errorState?.kind === "network"
        ? "Couldn’t reach this community post"
        : errorState?.kind === "backend_unconfigured"
          ? "Community backend is not configured"
          : "This post is unavailable";
  const errorSecondaryAction =
    errorState?.kind === "auth"
      ? { label: "Go to Builder and sign in", to: "/" }
      : { label: "Return to community feed", to: "/community" };

  return (
    <PageShell>
      <div className="community-typography" data-density="comfortable">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="type-button-label h-11 px-4 sm:h-8 sm:px-3">
            <Link to="/community">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to feed
            </Link>
          </Button>
        </div>

        {loading && (
          <div className="space-y-3">
            <Card className="space-y-3 p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-44 w-full rounded-md" />
            </Card>
            <Card className="space-y-2 p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </Card>
          </div>
        )}

        {!loading && errorState && (
          <StateCard
            variant="error"
            title={errorTitle}
            description={errorState.message}
            primaryAction={{ label: "Retry", onClick: handleRetry }}
            secondaryAction={errorSecondaryAction}
          />
        )}

        {!loading && !errorState && post && postAuthorBlocked && (
          <StateCard
            variant="empty"
            title="You blocked this user"
            description="Posts and comments from blocked users are hidden until you unblock them."
            primaryAction={{ label: "Unblock user", onClick: () => void handleUnblockUser(post.authorId) }}
            secondaryAction={{ label: "Return to community feed", to: "/community" }}
          />
        )}

        {!loading && !errorState && post && !postAuthorBlocked && (
          <CommunityPostDetail
            post={post}
            authorName={postAuthorName}
            authorAvatarUrl={postAuthor?.avatarUrl}
            parentPost={parentPost}
            remixes={remixes}
            authorById={authorById}
            onCopyPrompt={handleCopyPrompt}
            onToggleVote={handleToggleVote}
            voteState={voteState ?? undefined}
            onCommentAdded={handleCommentAdded}
            onCommentThreadOpen={handleCommentThreadOpen}
            canVote={Boolean(user)}
            canSaveToLibrary={Boolean(user)}
            onSaveToLibrary={handleSaveToLibrary}
            canModerate={Boolean(user)}
            canBlockAuthor={Boolean(user?.id && user.id !== post.authorId)}
            isAuthorBlocked={blockedUserIds.includes(post.authorId)}
            blockedUserIds={blockedUserIds}
            onReportPost={handleReportPost}
            onReportComment={handleReportComment}
            onBlockUser={handleBlockUser}
            onUnblockUser={handleUnblockUser}
          />
        )}

        <CommunityReportDialog
          open={reportTarget !== null}
          targetLabel={reportTarget?.targetType ?? "content"}
          submitting={reportSubmitting}
          onOpenChange={(open) => {
            if (!open && !reportSubmitting) {
              setReportTarget(null);
            }
          }}
          onSubmit={handleSubmitReport}
        />
      </div>
    </PageShell>
  );
};

export default CommunityPost;
