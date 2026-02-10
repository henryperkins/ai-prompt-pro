import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { CommunityPostDetail } from "@/components/community/CommunityPostDetail";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  type CommunityPost as CommunityPostType,
  type CommunityProfile,
  loadPost,
  loadProfilesByIds,
  loadRemixes,
  loadMyVotes,
  toggleVote,
  type VoteState,
  type VoteType,
} from "@/lib/community";

function toProfileMap(profiles: CommunityProfile[]): Record<string, CommunityProfile> {
  return profiles.reduce<Record<string, CommunityProfile>>((map, profile) => {
    map[profile.id] = profile;
    return map;
  }, {});
}

const CommunityPost = () => {
  const { postId } = useParams<{ postId: string }>();
  const requestToken = useRef(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [post, setPost] = useState<CommunityPostType | null>(null);
  const [parentPost, setParentPost] = useState<CommunityPostType | null>(null);
  const [remixes, setRemixes] = useState<CommunityPostType[]>([]);
  const [authorById, setAuthorById] = useState<Record<string, CommunityProfile>>({});
  const [voteState, setVoteState] = useState<VoteState | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      setErrorMessage("Missing community post id.");
      return;
    }

    const token = ++requestToken.current;
    setLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const loadedPost = await loadPost(postId);
        if (token !== requestToken.current) return;

        if (!loadedPost) {
          setPost(null);
          setParentPost(null);
          setRemixes([]);
          setAuthorById({});
          setErrorMessage("This community post is unavailable.");
          return;
        }

        const [loadedParent, loadedRemixes, voteStates] = await Promise.all([
          loadedPost.remixedFrom ? loadPost(loadedPost.remixedFrom) : Promise.resolve(null),
          loadRemixes(loadedPost.id),
          loadMyVotes([loadedPost.id]),
        ]);

        if (token !== requestToken.current) return;

        const authorIds = Array.from(
          new Set([
            loadedPost.authorId,
            ...(loadedParent ? [loadedParent.authorId] : []),
            ...loadedRemixes.map((remix) => remix.authorId),
          ]),
        );
        const profiles = await loadProfilesByIds(authorIds);
        if (token !== requestToken.current) return;

        setPost(loadedPost);
        setParentPost(loadedParent);
        setRemixes(loadedRemixes);
        setAuthorById(toProfileMap(profiles));
        setVoteState(voteStates[loadedPost.id] ?? { upvote: false, verified: false });
      } catch (error) {
        if (token !== requestToken.current) return;
        setPost(null);
        setParentPost(null);
        setRemixes([]);
        setAuthorById({});
        setVoteState(null);
        setErrorMessage(error instanceof Error ? error.message : "Failed to load this post.");
      } finally {
        if (token === requestToken.current) {
          setLoading(false);
        }
      }
    })();
  }, [postId, user?.id]);

  const handleCopyPrompt = useCallback(
    async (target: CommunityPostType) => {
      try {
        await navigator.clipboard.writeText(target.enhancedPrompt || target.starterPrompt);
        toast({ title: "Prompt copied", description: "Prompt text copied to your clipboard." });
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
      }
    },
    [toast, user],
  );

  const handleCommentAdded = useCallback((targetId: string) => {
    setPost((prev) => {
      if (!prev || prev.id !== targetId) return prev;
      return { ...prev, commentCount: prev.commentCount + 1 };
    });
  }, []);

  const postAuthor = post ? authorById[post.authorId] : null;
  const postAuthorName = postAuthor?.displayName || "Community member";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header isDark={isDark} onToggleTheme={() => setIsDark((prev) => !prev)} />

      <main className="flex-1 container mx-auto px-4 py-4 sm:py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
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

        {!loading && errorMessage && (
          <Card className="space-y-3 border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button asChild variant="outline" size="sm" className="h-8 w-fit text-xs">
              <Link to="/community">Return to community feed</Link>
            </Button>
          </Card>
        )}

        {!loading && !errorMessage && post && (
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
            canVote={Boolean(user)}
          />
        )}
      </main>
    </div>
  );
};

export default CommunityPost;
