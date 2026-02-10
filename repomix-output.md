This file is a merged representation of a subset of the codebase, containing specifically included files and files not matching ignore patterns, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src/**, supabase/functions/**, agent_service/**, index.html, vite.config.ts, vitest.config.ts, tsconfig*.json, tailwind.config.ts, postcss.config.js, eslint.config.js, components.json, package.json
- Files matching these patterns are excluded: node_modules/**, dist/**, .venv/**, __pycache__/**, *.pyc, bun.lockb, package-lock.json, src/components/ui/**, *.log, *.local, .env*, !.env.example, clip*.md, product-spec.md, repomix-output.md
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Long base64 data strings (e.g., data:image/png;base64,...) have been truncated to reduce token count
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
agent_service/
  main.py
  README.md
  requirements.txt
src/
  components/
    community/
      CommunityComments.tsx
      CommunityFeed.tsx
      CommunityPostCard.tsx
      CommunityPostDetail.tsx
      PromptPreviewPanel.tsx
    AuthDialog.tsx
    BuilderTabs.tsx
    ContextIntegrations.tsx
    ContextInterview.tsx
    ContextPanel.tsx
    ContextQualityMeter.tsx
    ContextSourceChips.tsx
    Header.tsx
    NavLink.tsx
    OutputPanel.tsx
    ProjectNotes.tsx
    PromptInput.tsx
    PromptLibrary.tsx
    QualityScore.tsx
    StructuredContextForm.tsx
    ToneControls.tsx
    VersionHistory.tsx
  hooks/
    use-mobile.tsx
    use-toast.ts
    useAuth.tsx
    usePromptBuilder.ts
  integrations/
    supabase/
      client.ts
      types.ts
  lib/
    ai-client.ts
    community.ts
    context-types.ts
    persistence.ts
    prompt-builder.ts
    prompt-categories.ts
    saved-prompt-shared.ts
    section-health.ts
    template-store.ts
    templates.ts
    text-diff.ts
    utils.ts
  pages/
    Community.tsx
    CommunityPost.tsx
    Index.tsx
    NotFound.tsx
  test/
    edge-auth.test.ts
    example.test.ts
    index-remix-param.test.tsx
    persistence.test.ts
    prompt-categories.test.ts
    rls-community-comments.test.ts
    rls-community-votes.test.ts
    section-health.test.ts
    setup.ts
    template-store.test.ts
    text-diff.test.ts
    usePromptBuilder.test.tsx
  App.css
  App.tsx
  index.css
  main.tsx
  vite-env.d.ts
supabase/
  functions/
    _shared/
      security.ts
    enhance-prompt/
      index.ts
    extract-url/
      index.ts
components.json
eslint.config.js
index.html
package.json
postcss.config.js
tailwind.config.ts
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vite.config.ts
vitest.config.ts
```

# Files

## File: agent_service/README.md
````markdown
# Agent Service (Microsoft Agent Framework + Azure OpenAI Responses)

This service hosts a Microsoft Agent Framework agent that uses Azure OpenAI Responses API with your `gpt-5.2` deployment.

## 1) Create a Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r agent_service/requirements.txt
```

## 2) Configure environment

```bash
export AZURE_OPENAI_ENDPOINT="https://<your-resource>.openai.azure.com"
export AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME="gpt-5.2"
export AZURE_OPENAI_API_VERSION="preview"
export AZURE_OPENAI_API_KEY="<your-azure-openai-key>"
# or use base URL form instead of endpoint
# export AZURE_OPENAI_BASE_URL="https://<your-resource>.openai.azure.com/openai/v1/"
```

Optional shared secret between Supabase Edge Function and this service:

```bash
export AGENT_SERVICE_TOKEN="<shared-secret>"
```

Optional GPT-5 reasoning/output controls (Responses API):

```bash
export AZURE_OPENAI_MAX_OUTPUT_TOKENS="4096"
export AZURE_OPENAI_REASONING_EFFORT="minimal"   # none|minimal|low|medium|high|xhigh
export AZURE_OPENAI_REASONING_SUMMARY="auto"     # auto|concise|detailed
export AZURE_OPENAI_TEXT_VERBOSITY="low"         # low|medium|high
```

Optional hosted web search tool:

```bash
export ENABLE_HOSTED_WEB_SEARCH="true"           # true|false
export HOSTED_WEB_SEARCH_CITY="Seattle"          # optional
export HOSTED_WEB_SEARCH_REGION="WA"             # optional
export HOSTED_WEB_SEARCH_COUNTRY="US"            # optional
```

Optional advanced AzureOpenAIResponsesClient settings:

```bash
export AZURE_OPENAI_AD_TOKEN="<aad-token>"       # optional alternative auth
export AZURE_OPENAI_TOKEN_ENDPOINT="https://cognitiveservices.azure.com/.default"
export AZURE_OPENAI_INSTRUCTION_ROLE="system"    # or developer
export AZURE_OPENAI_ENV_FILE_PATH=".env.agent"
export AZURE_OPENAI_ENV_FILE_ENCODING="utf-8"
export AZURE_OPENAI_DEFAULT_HEADERS_JSON='{"x-trace-id":"prompt-enhancer"}'
```

If you do not set `AZURE_OPENAI_API_KEY`, the service uses `AzureCliCredential` (run `az login`).

## 3) Run the service

```bash
uvicorn agent_service.main:app --host 0.0.0.0 --port 8001 --reload
```

Health check:

```bash
curl http://localhost:8001/health
```
````

## File: src/components/community/CommunityComments.tsx
````typescript
import { useCallback, useEffect, useMemo, useState } from "react";
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
  }, [draft, limit, onCommentAdded, postId, toast]);

  const canComment = Boolean(user);

  const sortedComments = useMemo(() => comments, [comments]);

  return (
    <Card className={cn("interactive-card space-y-3 border-border/80 bg-card/85 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          Comments
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {totalCount}
        </Badge>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!loading && sortedComments.length === 0 && (
        <p className="text-xs text-muted-foreground">Be the first to comment.</p>
      )}

      {!loading && sortedComments.length > 0 && (
        <div className="space-y-2">
          {sortedComments.map((comment) => {
            const author = authorById[comment.userId];
            const displayName = author?.displayName || "Community member";
            const createdAt = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
            return (
              <div key={comment.id} className="rounded-md border border-border/70 bg-background/60 p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{displayName}</span>
                  <span>{createdAt}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{comment.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {compact && totalCount > sortedComments.length && (
        <Link
          to={`/community/${postId}`}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
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
            variant="outline"
            onClick={handleSubmit}
            disabled={!canComment || submitting || !draft.trim()}
            className="interactive-chip gap-1 text-xs"
          >
            <Send className="h-3.5 w-3.5" />
            Post comment
          </Button>
        </div>
      </div>
    </Card>
  );
}
````

## File: src/components/community/CommunityFeed.tsx
````typescript
import type { CommunityPost, CommunityProfile, VoteState, VoteType } from "@/lib/community";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityPostCard } from "@/components/community/CommunityPostCard";

interface CommunityFeedProps {
  posts: CommunityPost[];
  loading: boolean;
  errorMessage?: string | null;
  authorById: Record<string, CommunityProfile>;
  parentTitleById: Record<string, string>;
  onCopyPrompt: (post: CommunityPost) => void;
  onToggleVote: (postId: string, voteType: VoteType) => void;
  voteStateByPost: Record<string, VoteState>;
  onCommentAdded: (postId: string) => void;
  canVote: boolean;
}

function LoadingCard() {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-28 w-full rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-20" />
      </div>
    </Card>
  );
}

export function CommunityFeed({
  posts,
  loading,
  errorMessage,
  authorById,
  parentTitleById,
  onCopyPrompt,
  onToggleVote,
  voteStateByPost,
  onCommentAdded,
  canVote,
}: CommunityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {errorMessage}
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        No posts match this filter yet. Try another category or search term.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const author = authorById[post.authorId];
        const authorName = author?.displayName || "Community member";

        return (
          <CommunityPostCard
            key={post.id}
            post={post}
            authorName={authorName}
            authorAvatarUrl={author?.avatarUrl}
            parentPostTitle={post.remixedFrom ? parentTitleById[post.remixedFrom] : undefined}
            onCopyPrompt={onCopyPrompt}
            onToggleVote={onToggleVote}
            voteState={voteStateByPost[post.id]}
            onCommentAdded={onCommentAdded}
            canVote={canVote}
          />
        );
      })}
    </div>
  );
}
````

## File: src/components/community/CommunityPostCard.tsx
````typescript
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
````

## File: src/components/community/CommunityPostDetail.tsx
````typescript
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
````

## File: src/components/community/PromptPreviewPanel.tsx
````typescript
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PromptPreviewPanelProps {
  text: string;
  mode?: "compact" | "full";
  className?: string;
}

const COMPACT_EXPAND_THRESHOLD = 260;

export function PromptPreviewPanel({ text, mode = "compact", className }: PromptPreviewPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const normalized = text.trim();

  useEffect(() => {
    setExpanded(false);
  }, [normalized]);

  const canExpand = mode === "compact" && normalized.length > COMPACT_EXPAND_THRESHOLD;
  const isCollapsed = mode === "compact" && !expanded && canExpand;

  return (
    <div className={cn("rounded-lg border border-border/80 bg-muted/35 p-3 sm:p-4", className)}>
      <div className="relative">
        <pre
          className={cn(
            "font-mono text-[11px] sm:text-xs leading-5 text-foreground/95 whitespace-pre-wrap break-words",
            isCollapsed && "line-clamp-6",
          )}
        >
          {normalized || "No prompt content available yet."}
        </pre>
        {isCollapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg bg-gradient-to-t from-muted/95 via-muted/70 to-transparent" />
        )}
      </div>
      {canExpand && (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Collapse preview" : "Expand preview"}
          </Button>
        </div>
      )}
    </div>
  );
}
````

## File: src/components/AuthDialog.tsx
````typescript
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === "signup") {
      if (result.session) {
        onOpenChange(false);
        resetForm();
        return;
      }
      setConfirmationSent(true);
      return;
    }

    // Login succeeded — close
    onOpenChange(false);
    resetForm();
  };

  const handleOAuth = async (provider: "github" | "google") => {
    setError("");
    const result = await signInWithOAuth(provider);
    if (result.error) {
      setError(result.error);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setError("");
    setConfirmationSent(false);
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setConfirmationSent(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "login" ? "Sign in" : "Create account"}
          </DialogTitle>
        </DialogHeader>

        {confirmationSent ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Check your email for a confirmation link, then sign in.
            </p>
            <Button variant="outline" onClick={() => { setMode("login"); setConfirmationSent(false); }}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* OAuth buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => handleOAuth("github")}>
                <GitHubIcon className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button variant="outline" onClick={() => handleOAuth("google")}>
                <GoogleIcon className="w-4 h-4 mr-2" />
                Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "login" ? "No account? " : "Already have an account? "}
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                onClick={toggleMode}
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
````

## File: src/components/ContextIntegrations.tsx
````typescript
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { DatabaseConnection, RagParameters } from "@/lib/context-types";
import { Database, Plus, X } from "lucide-react";

interface ContextIntegrationsProps {
  databaseConnections: DatabaseConnection[];
  rag: RagParameters;
  onUpdateDatabaseConnections: (connections: DatabaseConnection[]) => void;
  onUpdateRag: (updates: Partial<RagParameters>) => void;
}

const PROVIDER_OPTIONS: DatabaseConnection["provider"][] = [
  "postgres",
  "mysql",
  "sqlite",
  "mongodb",
  "other",
];

export function ContextIntegrations({
  databaseConnections,
  rag,
  onUpdateDatabaseConnections,
  onUpdateRag,
}: ContextIntegrationsProps) {
  const [draft, setDraft] = useState<{
    label: string;
    provider: DatabaseConnection["provider"];
    connectionRef: string;
    database: string;
    schema: string;
    tables: string;
    readOnly: boolean;
  }>({
    label: "",
    provider: "postgres",
    connectionRef: "",
    database: "",
    schema: "",
    tables: "",
    readOnly: true,
  });

  const addDatabase = () => {
    if (!draft.connectionRef.trim() || !draft.database.trim()) return;
    const next: DatabaseConnection = {
      id: `db-${Date.now()}`,
      label: draft.label.trim() || draft.database.trim(),
      provider: draft.provider,
      connectionRef: draft.connectionRef.trim(),
      database: draft.database.trim(),
      schema: draft.schema.trim(),
      tables: draft.tables
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      readOnly: draft.readOnly,
      lastValidatedAt: Date.now(),
    };
    onUpdateDatabaseConnections([...databaseConnections, next]);
    setDraft({
      label: "",
      provider: draft.provider,
      connectionRef: "",
      database: "",
      schema: "",
      tables: "",
      readOnly: true,
    });
  };

  const removeDatabase = (id: string) => {
    onUpdateDatabaseConnections(databaseConnections.filter((db) => db.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-foreground">Database connections</Label>
          <Badge variant="secondary" className="text-[10px]">
            {databaseConnections.length}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={draft.label}
            onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="Label (optional)"
            className="h-8 text-xs"
          />
          <Select
            value={draft.provider}
            onValueChange={(provider: DatabaseConnection["provider"]) =>
              setDraft((prev) => ({ ...prev, provider }))
            }
          >
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((provider) => (
                <SelectItem key={provider} value={provider} className="text-xs capitalize">
                  {provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={draft.connectionRef}
            onChange={(e) => setDraft((prev) => ({ ...prev, connectionRef: e.target.value }))}
            placeholder="Connection ref (secret ID)"
            className="h-8 text-xs"
          />
          <Input
            value={draft.database}
            onChange={(e) => setDraft((prev) => ({ ...prev, database: e.target.value }))}
            placeholder="Database name"
            className="h-8 text-xs"
          />
          <Input
            value={draft.schema}
            onChange={(e) => setDraft((prev) => ({ ...prev, schema: e.target.value }))}
            placeholder="Schema (optional)"
            className="h-8 text-xs"
          />
          <Input
            value={draft.tables}
            onChange={(e) => setDraft((prev) => ({ ...prev, tables: e.target.value }))}
            placeholder="Tables CSV (optional)"
            className="h-8 text-xs"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={draft.readOnly}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, readOnly: value }))}
              className="scale-90"
            />
            <Label className="text-[10px] text-muted-foreground">Read-only</Label>
          </div>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={addDatabase}>
            <Plus className="w-3 h-3" />
            Add DB
          </Button>
        </div>

        {databaseConnections.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {databaseConnections.map((db) => (
              <Badge key={db.id} variant="secondary" className="gap-1.5 text-[10px]">
                <Database className="w-3 h-3" />
                {db.label}
                <button
                  onClick={() => removeDatabase(db.id)}
                  className="rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                  aria-label={`Remove ${db.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-foreground">RAG parameters</Label>
          <Switch
            checked={rag.enabled}
            onCheckedChange={(enabled) => onUpdateRag({ enabled })}
            className="scale-90"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={rag.vectorStoreRef}
            onChange={(e) => onUpdateRag({ vectorStoreRef: e.target.value })}
            placeholder="Vector store ref"
            className="h-8 text-xs"
            disabled={!rag.enabled}
          />
          <Input
            value={rag.namespace}
            onChange={(e) => onUpdateRag({ namespace: e.target.value })}
            placeholder="Namespace"
            className="h-8 text-xs"
            disabled={!rag.enabled}
          />
          <Select
            value={rag.retrievalStrategy}
            onValueChange={(retrievalStrategy: RagParameters["retrievalStrategy"]) =>
              onUpdateRag({ retrievalStrategy })
            }
            disabled={!rag.enabled}
          >
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hybrid" className="text-xs">
                Hybrid
              </SelectItem>
              <SelectItem value="semantic" className="text-xs">
                Semantic
              </SelectItem>
              <SelectItem value="keyword" className="text-xs">
                Keyword
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={String(rag.topK)}
            onChange={(e) => onUpdateRag({ topK: Number(e.target.value) || 0 })}
            placeholder="topK"
            className="h-8 text-xs"
            disabled={!rag.enabled}
          />
          <Input
            value={String(rag.minScore)}
            onChange={(e) => onUpdateRag({ minScore: Number(e.target.value) || 0 })}
            placeholder="minScore (0..1)"
            className="h-8 text-xs"
            disabled={!rag.enabled}
          />
          <Input
            value={String(rag.chunkWindow)}
            onChange={(e) => onUpdateRag({ chunkWindow: Number(e.target.value) || 0 })}
            placeholder="chunkWindow"
            className="h-8 text-xs"
            disabled={!rag.enabled}
          />
        </div>
        <Input
          value={rag.documentRefs.join(", ")}
          onChange={(e) =>
            onUpdateRag({
              documentRefs: e.target.value
                .split(",")
                .map((ref) => ref.trim())
                .filter(Boolean),
            })
          }
          placeholder="Document refs CSV"
          className="h-8 text-xs"
          disabled={!rag.enabled}
        />
      </div>
    </div>
  );
}
````

## File: src/components/ContextQualityMeter.tsx
````typescript
import { CheckCircle2, Circle } from "lucide-react";
import type { ContextConfig } from "@/lib/context-types";
import { scoreContext } from "@/lib/context-types";

interface ContextQualityMeterProps {
  contextConfig: ContextConfig;
}

export function ContextQualityMeter({ contextConfig }: ContextQualityMeterProps) {
  const { score, checks } = scoreContext(contextConfig);

  const getScoreColor = () => {
    if (score >= 75) return "text-primary";
    if (score >= 50) return "text-accent-foreground";
    return "text-destructive";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Context completeness</span>
        <span className={`text-xs font-bold ${getScoreColor()}`}>{score}%</span>
      </div>
      <div className="space-y-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-2">
            {check.met ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div>
              <span className="text-xs text-foreground">{check.label}</span>
              {!check.met && (
                <p className="text-[10px] text-muted-foreground">{check.tip}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
````

## File: src/components/NavLink.tsx
````typescript
import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
````

## File: src/components/ProjectNotes.tsx
````typescript
import { Textarea } from "@/components/ui/textarea";
import { StickyNote } from "lucide-react";

interface ProjectNotesProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProjectNotes({ value, onChange }: ProjectNotesProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
        <label className="text-xs font-medium text-foreground">
          Project notes
        </label>
        <span className="text-[10px] text-muted-foreground">(reusable across prompts)</span>
      </div>
      <Textarea
        placeholder="Persistent notes, brand voice guidelines, key facts, or any context you reuse across prompts..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[80px] bg-background text-sm"
      />
    </div>
  );
}
````

## File: src/components/PromptLibrary.tsx
````typescript
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
import { cn } from "@/lib/utils";
import { templates, categoryLabels, type PromptTemplate } from "@/lib/templates";
import type { PromptShareInput, PromptSummary } from "@/lib/persistence";
import {
  Sparkles,
  Layout,
  Server,
  Layers,
  Cloud,
  Database,
  Brain,
  Shield,
  FlaskConical,
  Cable,
  Bot,
  BookOpen,
  Trash2,
  Search,
  ArrowDownUp,
  Share2,
  Lock,
  GitBranch,
  MessageCircle,
} from "lucide-react";

interface PromptLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedPrompts: PromptSummary[];
  canShareSavedPrompts: boolean;
  onSelectTemplate: (template: PromptTemplate) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onShareSaved: (id: string, input?: PromptShareInput) => void | Promise<void>;
  onUnshareSaved: (id: string) => void | Promise<void>;
}

type SavedPromptSort = "recent" | "name" | "revision";

const categoryIcons: Record<string, React.ReactNode> = {
  general: <Sparkles className="w-4 h-4" />,
  frontend: <Layout className="w-4 h-4" />,
  backend: <Server className="w-4 h-4" />,
  fullstack: <Layers className="w-4 h-4" />,
  devops: <Cloud className="w-4 h-4" />,
  data: <Database className="w-4 h-4" />,
  "ml-ai": <Brain className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  testing: <FlaskConical className="w-4 h-4" />,
  api: <Cable className="w-4 h-4" />,
  automation: <Bot className="w-4 h-4" />,
  docs: <BookOpen className="w-4 h-4" />,
};

const categoryCardSkins: Record<
  string,
  {
    card: string;
    iconWrap: string;
    badge: string;
    action: string;
  }
> = {
  general: {
    card:
      "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary/45",
    iconWrap: "bg-primary/15 text-primary",
    badge: "border-transparent bg-primary/15 text-primary",
    action: "border-primary/30 bg-primary/10 text-primary",
  },
  frontend: {
    card:
      "border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-card to-card hover:border-cyan-500/45",
    iconWrap: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    badge: "border-transparent bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    action: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  backend: {
    card:
      "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card hover:border-emerald-500/45",
    iconWrap: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    badge: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    action: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  fullstack: {
    card:
      "border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-card to-card hover:border-violet-500/45",
    iconWrap: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    badge: "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300",
    action: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  devops: {
    card:
      "border-slate-500/25 bg-gradient-to-br from-slate-500/10 via-card to-card hover:border-slate-500/45",
    iconWrap: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    badge: "border-transparent bg-slate-500/15 text-slate-700 dark:text-slate-300",
    action: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  data: {
    card:
      "border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-card hover:border-amber-500/45",
    iconWrap: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    badge: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    action: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  "ml-ai": {
    card:
      "border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 via-card to-card hover:border-fuchsia-500/45",
    iconWrap: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    badge: "border-transparent bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    action: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  },
  security: {
    card:
      "border-red-500/25 bg-gradient-to-br from-red-500/10 via-card to-card hover:border-red-500/45",
    iconWrap: "bg-red-500/15 text-red-700 dark:text-red-300",
    badge: "border-transparent bg-red-500/15 text-red-700 dark:text-red-300",
    action: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  testing: {
    card:
      "border-lime-500/25 bg-gradient-to-br from-lime-500/10 via-card to-card hover:border-lime-500/45",
    iconWrap: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
    badge: "border-transparent bg-lime-500/15 text-lime-700 dark:text-lime-300",
    action: "border-lime-500/30 bg-lime-500/10 text-lime-700 dark:text-lime-300",
  },
  api: {
    card:
      "border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-card to-card hover:border-indigo-500/45",
    iconWrap: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    badge: "border-transparent bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    action: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  automation: {
    card:
      "border-teal-500/25 bg-gradient-to-br from-teal-500/10 via-card to-card hover:border-teal-500/45",
    iconWrap: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    badge: "border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-300",
    action: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  docs: {
    card:
      "border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-card to-card hover:border-orange-500/45",
    iconWrap: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    badge: "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300",
    action: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
};

function formatUpdatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseTags(value: string): string[] | undefined {
  const tags = Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 8);

  return tags.length > 0 ? tags : undefined;
}

function PromptList({
  activeCategory,
  setActiveCategory,
  query,
  onQueryChange,
  sortBy,
  onSortByChange,
  savedPrompts,
  canShareSavedPrompts,
  onSelectTemplate,
  onSelectSaved,
  onDeleteSaved,
  onShareSaved,
  onUnshareSaved,
  onClose,
}: {
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  sortBy: SavedPromptSort;
  onSortByChange: (sort: SavedPromptSort) => void;
  savedPrompts: PromptSummary[];
  canShareSavedPrompts: boolean;
  onSelectTemplate: (t: PromptTemplate) => void;
  onSelectSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onShareSaved: (id: string, input?: PromptShareInput) => void | Promise<void>;
  onUnshareSaved: (id: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const categories = ["all", ...Object.keys(categoryLabels)];
  const normalizedQuery = query.trim().toLowerCase();
  const [sharePrompt, setSharePrompt] = useState<PromptSummary | null>(null);
  const [shareName, setShareName] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareTags, setShareTags] = useState("");
  const [shareCategory, setShareCategory] = useState("general");
  const [shareUseCase, setShareUseCase] = useState("");
  const [shareTargetModel, setShareTargetModel] = useState("");
  const [shareConfirmedSafe, setShareConfirmedSafe] = useState(false);

  const handleOpenShareDialog = (prompt: PromptSummary) => {
    setSharePrompt(prompt);
    setShareName(prompt.name);
    setShareDescription(prompt.description);
    setShareTags(prompt.tags.join(", "));
    setShareCategory(prompt.category || "general");
    setShareUseCase(prompt.useCase || "");
    setShareTargetModel(prompt.targetModel || "");
    setShareConfirmedSafe(false);
  };

  const handleCloseShareDialog = () => {
    setSharePrompt(null);
    setShareConfirmedSafe(false);
  };

  const handleShareSavedPrompt = async () => {
    if (!sharePrompt) return;
    if (!shareName.trim() || !shareUseCase.trim() || !shareConfirmedSafe) return;

    await Promise.resolve(
      onShareSaved(sharePrompt.id, {
        title: shareName.trim(),
        description: shareDescription.trim() || undefined,
        category: shareCategory,
        tags: parseTags(shareTags),
        targetModel: shareTargetModel.trim() || undefined,
        useCase: shareUseCase.trim(),
      }),
    );
    handleCloseShareDialog();
  };

  const filteredSaved = useMemo(() => {
    const matches = savedPrompts.filter((prompt) => {
      if (!normalizedQuery) return true;
      const haystack = [prompt.name, prompt.description, prompt.tags.join(" "), prompt.starterPrompt, prompt.category]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    const sorted = [...matches];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "revision") {
      sorted.sort((a, b) => b.revision - a.revision);
    } else {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return sorted;
  }, [savedPrompts, normalizedQuery, sortBy]);

  const filtered = useMemo(() => {
    const scoped =
      activeCategory === "all"
        ? templates
        : templates.filter((template) => template.category === activeCategory);

    return scoped.filter((template) => {
      if (!normalizedQuery) return true;
      const haystack = [
        template.name,
        template.description,
        template.starterPrompt,
        template.category,
        template.tone,
        template.complexity,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeCategory, normalizedQuery]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 pb-2 border-b border-border/60">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search prompts by name, description, tags, or starter text"
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowDownUp className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(value: SavedPromptSort) => onSortByChange(value)}>
            <SelectTrigger className="h-8 text-xs min-w-[138px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent" className="text-xs">Most Recent</SelectItem>
              <SelectItem value="name" className="text-xs">Name (A-Z)</SelectItem>
              <SelectItem value="revision" className="text-xs">Revision (High)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-medium text-foreground">My Prompts</h3>
          <Badge variant="secondary" className="text-[10px]">
            {filteredSaved.length}
          </Badge>
        </div>

        {savedPrompts.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No saved prompts yet. Use "Save Prompt" from the output panel.
          </p>
        )}

        {savedPrompts.length > 0 && filteredSaved.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No saved prompts match this search.
          </p>
        )}

        {filteredSaved.map((prompt) => (
          <Card
            key={prompt.id}
            className="interactive-card p-3 hover:border-primary/50 group"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="space-y-1 min-w-0 flex-1 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  onSelectSaved(prompt.id);
                  onClose();
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {prompt.name}
                  </h4>
                  <Badge variant="outline" className="text-[10px]">
                    r{prompt.revision}
                  </Badge>
                  {prompt.isShared ? (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Share2 className="w-3 h-3" />
                      Shared
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Lock className="w-3 h-3" />
                      Private
                    </Badge>
                  )}
                  {prompt.remixedFrom && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <GitBranch className="w-3 h-3" />
                      Remixed
                    </Badge>
                  )}
                </div>
                {prompt.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{prompt.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground/90 line-clamp-2">
                  <span className="font-medium text-foreground/80">Start:</span> {prompt.starterPrompt}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="capitalize">{prompt.category || "general"}</span>
                  <span>•</span>
                  <span>{formatUpdatedAt(prompt.updatedAt)}</span>
                  <span>•</span>
                  <span>{prompt.sourceCount} sources</span>
                  <span>•</span>
                  <span>{prompt.databaseCount} DB</span>
                </div>
                {prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prompt.tags.slice(0, 4).map((tag) => (
                      <Badge key={`${prompt.id}-${tag}`} variant="outline" className="text-[10px]">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {prompt.isShared && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>▲ {prompt.upvoteCount}</span>
                    <span>🔀 {prompt.remixCount}</span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {prompt.commentCount}
                    </span>
                  </div>
                )}
              </button>
              <div className="flex flex-col gap-1">
                {prompt.isShared ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onUnshareSaved(prompt.id);
                    }}
                  >
                    Unshare
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    disabled={!canShareSavedPrompts}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenShareDialog(prompt);
                    }}
                    title={!canShareSavedPrompts ? "Sign in to share prompts." : undefined}
                  >
                    Share
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteSaved(prompt.id);
                  }}
                  aria-label={`Delete ${prompt.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-foreground">Starter Templates</h3>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2 py-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="interactive-chip gap-1.5 text-xs capitalize h-7 sm:h-8"
            >
              {cat !== "all" && categoryIcons[cat]}
              {cat === "all" ? "All" : categoryLabels[cat]}
            </Button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 sm:space-y-3 pr-1">
          {filtered.length === 0 && (
            <Card className="p-4 text-center border-dashed">
              <p className="text-sm text-muted-foreground">No starter templates match this search.</p>
            </Card>
          )}
          {filtered.map((template) => {
            const skin = categoryCardSkins[template.category] ?? categoryCardSkins.general;
            return (
              <Card
                key={template.id}
                className={cn(
                  "interactive-card group overflow-hidden border",
                  skin.card,
                )}
              >
                <button
                  type="button"
                  className="w-full p-3 sm:p-4 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    onSelectTemplate(template);
                    onClose();
                  }}
                >
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full",
                            skin.iconWrap,
                          )}
                        >
                          {categoryIcons[template.category] ?? categoryIcons.general}
                        </span>
                        <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {template.name}
                        </h3>
                        <Badge variant="outline" className={cn("text-[10px] capitalize", skin.badge)}>
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                      <p className="text-[11px] text-muted-foreground/90 line-clamp-2">
                        <span className="font-medium text-foreground/80">Start:</span> {template.starterPrompt}
                      </p>
                      <div className="flex gap-1 mt-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {template.tone}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {template.complexity}
                        </Badge>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center rounded-md border px-2.5 h-8",
                        skin.action,
                      )}
                    >
                      Use
                    </span>
                  </div>
                </button>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog
        open={sharePrompt !== null}
        onOpenChange={(open) => {
          if (!open) handleCloseShareDialog();
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Share Prompt</DialogTitle>
            <DialogDescription>Publish this saved prompt to the community feed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={shareName}
              onChange={(event) => setShareName(event.target.value)}
              placeholder="Prompt title"
              className="bg-background"
            />
            <Select value={shareCategory} onValueChange={setShareCategory}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={shareDescription}
              onChange={(event) => setShareDescription(event.target.value)}
              placeholder="Description (optional)"
              className="min-h-[80px] bg-background"
            />
            <Input
              value={shareTags}
              onChange={(event) => setShareTags(event.target.value)}
              placeholder="Tags (comma-separated, optional)"
              className="bg-background"
            />
            <Textarea
              value={shareUseCase}
              onChange={(event) => setShareUseCase(event.target.value)}
              placeholder="Use case (required)"
              className="min-h-[90px] bg-background"
            />
            <Input
              value={shareTargetModel}
              onChange={(event) => setShareTargetModel(event.target.value)}
              placeholder="Target model (optional)"
              className="bg-background"
            />
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={shareConfirmedSafe}
                onChange={(event) => setShareConfirmedSafe(event.target.checked)}
                className="mt-0.5"
              />
              <span>I confirm this prompt contains no secrets or private data.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseShareDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleShareSavedPrompt()}
              disabled={!shareName.trim() || !shareUseCase.trim() || !shareConfirmedSafe}
            >
              Share Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PromptLibrary({
  open,
  onOpenChange,
  savedPrompts,
  canShareSavedPrompts,
  onSelectTemplate,
  onSelectSaved,
  onDeleteSaved,
  onShareSaved,
  onUnshareSaved,
}: PromptLibraryProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SavedPromptSort>("recent");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Prompt Library</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-auto flex-1 flex flex-col">
            <PromptList
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              query={query}
              onQueryChange={setQuery}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              savedPrompts={savedPrompts}
              canShareSavedPrompts={canShareSavedPrompts}
              onSelectTemplate={onSelectTemplate}
              onSelectSaved={onSelectSaved}
              onDeleteSaved={onDeleteSaved}
              onShareSaved={onShareSaved}
              onUnshareSaved={onUnshareSaved}
              onClose={() => onOpenChange(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">Prompt Library</DialogTitle>
        </DialogHeader>
        <PromptList
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          query={query}
          onQueryChange={setQuery}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          savedPrompts={savedPrompts}
          canShareSavedPrompts={canShareSavedPrompts}
          onSelectTemplate={onSelectTemplate}
          onSelectSaved={onSelectSaved}
          onDeleteSaved={onDeleteSaved}
          onShareSaved={onShareSaved}
          onUnshareSaved={onUnshareSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
````

## File: src/components/StructuredContextForm.tsx
````typescript
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import type { StructuredContext } from "@/lib/context-types";
import { structuredFieldsMeta } from "@/lib/context-types";

interface StructuredContextFormProps {
  values: StructuredContext;
  onUpdate: (updates: Partial<StructuredContext>) => void;
}

export function StructuredContextForm({ values, onUpdate }: StructuredContextFormProps) {
  const [showExamples, setShowExamples] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-foreground">Structured context</label>
      {structuredFieldsMeta.map((field) => (
        <div key={field.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">{field.label}</label>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] gap-0.5 text-muted-foreground"
              onClick={() =>
                setShowExamples(showExamples === field.key ? null : field.key)
              }
            >
              <Lightbulb className="w-3 h-3" />
              {showExamples === field.key ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </Button>
          </div>
          <Input
            placeholder={field.placeholder}
            value={values[field.key]}
            onChange={(e) => onUpdate({ [field.key]: e.target.value })}
            className="bg-background h-9 text-sm"
          />
          {showExamples === field.key && (
            <div className="rounded-md border border-border bg-muted/30 p-2 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Good examples
              </p>
              {field.examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => onUpdate({ [field.key]: ex })}
                  className="block w-full text-left text-xs text-foreground hover:text-primary transition-colors py-0.5 cursor-pointer"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
````

## File: src/hooks/use-toast.ts
````typescript
import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
````

## File: src/hooks/useAuth.tsx
````typescript
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session, Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; session: Session | null; user: User | null }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; session: Session | null; user: User | null }>;
  signInWithOAuth: (provider: Provider) => Promise<{ error: string | null; session: Session | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      // Ignore anonymous sessions — treat them as unauthenticated
      if (s?.user?.is_anonymous) {
        setSession(null);
        setUser(null);
      } else {
        setSession(s);
        setUser(s?.user ?? null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user?.is_anonymous) {
        setSession(null);
        setUser(null);
      } else {
        setSession(s);
        setUser(s?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return {
      error: error?.message ?? null,
      session: data.session,
      user: data.user,
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return {
      error: error?.message ?? null,
      session: data.session,
      user: data.user,
    };
  }, []);

  const signInWithOAuth = useCallback(async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null, session: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
````

## File: src/lib/community.ts
````typescript
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { normalizePromptCategory } from "@/lib/prompt-categories";
import type { PromptConfig } from "@/lib/prompt-builder";
import { defaultConfig } from "@/lib/prompt-builder";
import {
  deletePrompt as deleteSavedPromptForUser,
  sharePrompt as shareSavedPromptForUser,
  unsharePrompt as unshareSavedPromptForUser,
} from "@/lib/persistence";
import {
  escapePostgrestLikePattern,
  isPostgrestError,
  normalizePromptTags,
  type SavedPromptRow,
} from "@/lib/saved-prompt-shared";
import {
  collectTemplateWarnings,
  computeTemplateFingerprint,
  inferTemplateStarterPrompt,
  normalizeTemplateConfig,
} from "@/lib/template-store";

const SAVED_PROMPT_SELECT_COLUMNS =
  "id, user_id, title, description, category, tags, config, built_prompt, enhanced_prompt, fingerprint, revision, is_shared, target_model, use_case, remixed_from, remix_note, remix_diff, created_at, updated_at";
const COMMUNITY_POST_SELECT_COLUMNS =
  "id, saved_prompt_id, author_id, title, enhanced_prompt, description, use_case, category, tags, target_model, is_public, public_config, starter_prompt, remixed_from, remix_note, remix_diff, upvote_count, verified_count, remix_count, comment_count, created_at, updated_at";

export type PromptSort = "recent" | "name" | "revision";
export type CommunitySort = "new" | "popular" | "most_remixed" | "verified";
export type VoteType = "upvote" | "verified";
export interface VoteState {
  upvote: boolean;
  verified: boolean;
}

export interface SavedPromptSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  starterPrompt: string;
  updatedAt: number;
  createdAt: number;
  revision: number;
  schemaVersion: number;
  sourceCount: number;
  databaseCount: number;
  ragEnabled: boolean;
  isShared: boolean;
  targetModel: string;
  useCase: string;
  remixedFrom: string | null;
}

export interface SavedPromptRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  config: PromptConfig;
  builtPrompt: string;
  enhancedPrompt: string;
  fingerprint: string;
  revision: number;
  isShared: boolean;
  targetModel: string;
  useCase: string;
  remixedFrom: string | null;
  remixNote: string;
  remixDiff: Json | null;
  createdAt: number;
  updatedAt: number;
}

export interface SavePromptInput {
  id?: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  config: PromptConfig;
  builtPrompt?: string;
  enhancedPrompt?: string;
  targetModel?: string;
  useCase?: string;
  isShared?: boolean;
  remixedFrom?: string | null;
  remixNote?: string;
  remixDiff?: Json | null;
}

export interface SavePromptResult {
  outcome: "created" | "updated" | "unchanged";
  prompt: SavedPromptRecord;
  warnings: string[];
}

export interface ListMyPromptsInput {
  query?: string;
  category?: string;
  tag?: string;
  sort?: PromptSort;
  limit?: number;
}

export interface LoadFeedInput {
  sort?: CommunitySort;
  category?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface LoadCommentsInput {
  limit?: number;
  cursor?: string;
}

export interface CommunityPost {
  id: string;
  savedPromptId: string;
  authorId: string;
  title: string;
  enhancedPrompt: string;
  description: string;
  useCase: string;
  category: string;
  tags: string[];
  targetModel: string;
  isPublic: boolean;
  publicConfig: PromptConfig;
  starterPrompt: string;
  remixedFrom: string | null;
  remixNote: string;
  remixDiff: Json | null;
  upvoteCount: number;
  verifiedCount: number;
  remixCount: number;
  commentCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CommunityComment {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface CommunityProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface RemixDiff {
  changes: Array<{
    field: string;
    from: string | string[];
    to: string | string[];
  }>;
  added_tags: string[];
  removed_tags: string[];
  category_changed: boolean;
}

interface CommunityPostRow {
  id: string;
  saved_prompt_id: string;
  author_id: string;
  title: string;
  enhanced_prompt: string;
  description: string;
  use_case: string;
  category: string;
  tags: string[] | null;
  target_model: string;
  is_public: boolean;
  public_config: Json;
  starter_prompt: string;
  remixed_from: string | null;
  remix_note: string;
  remix_diff: Json | null;
  upvote_count: number;
  verified_count: number;
  remix_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

interface CommunityCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface CommunityProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

function clampText(value: string | undefined, max: number): string {
  return (value || "").trim().slice(0, max);
}

function clampTitle(value: string): string {
  const normalized = value.trim().slice(0, 200);
  return normalized || "Untitled Prompt";
}

function mapSavedPromptRow(row: SavedPromptRow): SavedPromptRecord {
  const cfg = normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags ?? [],
    config: cfg,
    builtPrompt: row.built_prompt,
    enhancedPrompt: row.enhanced_prompt,
    fingerprint: row.fingerprint ?? "",
    revision: row.revision,
    isShared: row.is_shared,
    targetModel: row.target_model,
    useCase: row.use_case,
    remixedFrom: row.remixed_from,
    remixNote: row.remix_note,
    remixDiff: row.remix_diff,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapSavedPromptSummary(row: SavedPromptRow): SavedPromptSummary {
  const cfg = normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags ?? [],
    starterPrompt: inferTemplateStarterPrompt(cfg),
    updatedAt: new Date(row.updated_at).getTime(),
    createdAt: new Date(row.created_at).getTime(),
    revision: row.revision,
    schemaVersion: 2,
    sourceCount: cfg.contextConfig.sources.length,
    databaseCount: cfg.contextConfig.databaseConnections.length,
    ragEnabled: cfg.contextConfig.rag.enabled,
    isShared: row.is_shared,
    targetModel: row.target_model,
    useCase: row.use_case,
    remixedFrom: row.remixed_from,
  };
}

function mapCommunityPost(row: CommunityPostRow): CommunityPost {
  return {
    id: row.id,
    savedPromptId: row.saved_prompt_id,
    authorId: row.author_id,
    title: row.title,
    enhancedPrompt: row.enhanced_prompt,
    description: row.description,
    useCase: row.use_case,
    category: row.category,
    tags: row.tags ?? [],
    targetModel: row.target_model,
    isPublic: row.is_public,
    publicConfig: normalizeTemplateConfig((row.public_config ?? defaultConfig) as unknown as PromptConfig),
    starterPrompt: row.starter_prompt,
    remixedFrom: row.remixed_from,
    remixNote: row.remix_note,
    remixDiff: row.remix_diff,
    upvoteCount: row.upvote_count,
    verifiedCount: row.verified_count,
    remixCount: row.remix_count,
    commentCount: row.comment_count,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapCommunityComment(row: CommunityCommentRow): CommunityComment {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapCommunityProfile(row: CommunityProfileRow): CommunityProfile {
  return {
    id: row.id,
    displayName: row.display_name?.trim() || "Community member",
    avatarUrl: row.avatar_url,
  };
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (isPostgrestError(error)) return new Error(error.message || fallback);
  return new Error(fallback);
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw toError(error, "Authentication failed.");
  const user = data.user;
  if (!user?.id || user.is_anonymous) {
    throw new Error("Sign in required.");
  }
  return user.id;
}

export async function listMyPrompts(input: ListMyPromptsInput = {}): Promise<SavedPromptSummary[]> {
  const { query, category, tag, sort = "recent", limit = 100 } = input;
  const userId = await requireUserId();

  try {
    let builder = supabase
      .from("saved_prompts")
      .select(SAVED_PROMPT_SELECT_COLUMNS)
      .eq("user_id", userId)
      .limit(Math.min(Math.max(limit, 1), 200));

    if (category && category !== "all") {
      builder = builder.eq("category", category);
    }

    if (tag) {
      builder = builder.contains("tags", [tag.toLowerCase()]);
    }

    if (query?.trim()) {
      const escaped = escapePostgrestLikePattern(query.trim());
      builder = builder.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%,use_case.ilike.%${escaped}%`,
      );
    }

    if (sort === "name") {
      builder = builder.order("title", { ascending: true });
    } else if (sort === "revision") {
      builder = builder.order("revision", { ascending: false }).order("updated_at", { ascending: false });
    } else {
      builder = builder.order("updated_at", { ascending: false });
    }

    const { data, error } = await builder;
    if (error) throw error;
    return (data || []).map((row) => mapSavedPromptSummary(row as SavedPromptRow));
  } catch (error) {
    throw toError(error, "Failed to load your prompts.");
  }
}

export async function loadMyPromptById(id: string): Promise<SavedPromptRecord | null> {
  const userId = await requireUserId();

  try {
    const { data, error } = await supabase
      .from("saved_prompts")
      .select(SAVED_PROMPT_SELECT_COLUMNS)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapSavedPromptRow(data as SavedPromptRow);
  } catch (error) {
    throw toError(error, "Failed to load prompt.");
  }
}

export async function savePrompt(input: SavePromptInput): Promise<SavePromptResult> {
  const userId = await requireUserId();
  const title = clampTitle(input.title);
  const normalizedConfig = normalizeTemplateConfig(input.config);
  const normalizedDescription = clampText(input.description, 500);
  const normalizedCategory = normalizePromptCategory(input.category) ?? "general";
  const normalizedTags = normalizePromptTags(input.tags);
  const normalizedTargetModel = clampText(input.targetModel, 80);
  const normalizedUseCase = clampText(input.useCase, 500);
  const normalizedBuiltPrompt = input.builtPrompt || "";
  const normalizedEnhancedPrompt = input.enhancedPrompt || "";
  const normalizedRemixNote = clampText(input.remixNote, 500);
  const fingerprint = computeTemplateFingerprint(normalizedConfig);
  const warnings = collectTemplateWarnings(normalizedConfig);

  try {
    let existing: SavedPromptRow | null = null;

    if (input.id) {
      const { data: byId, error: byIdError } = await supabase
        .from("saved_prompts")
        .select(SAVED_PROMPT_SELECT_COLUMNS)
        .eq("id", input.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (byIdError) throw byIdError;
      existing = (byId as SavedPromptRow | null) || null;
    } else {
      const { data: byTitle, error: lookupError } = await supabase
        .from("saved_prompts")
        .select(SAVED_PROMPT_SELECT_COLUMNS)
        .eq("user_id", userId)
        .ilike("title", escapePostgrestLikePattern(title))
        .order("updated_at", { ascending: false })
        .limit(1);

      if (lookupError) throw lookupError;
      existing = ((byTitle && byTitle[0]) as SavedPromptRow | undefined) || null;
    }

    if (existing?.fingerprint === fingerprint) {
      if (existing.is_shared !== !!input.isShared) {
        const { data: sharedRow, error: shareError } = await supabase
          .from("saved_prompts")
          .update({ is_shared: !!input.isShared })
          .eq("id", existing.id)
          .eq("user_id", userId)
          .eq("revision", existing.revision)
          .select(SAVED_PROMPT_SELECT_COLUMNS)
          .maybeSingle();

        if (shareError) throw shareError;
        if (sharedRow) {
          return {
            outcome: "updated",
            prompt: mapSavedPromptRow(sharedRow as SavedPromptRow),
            warnings,
          };
        }
      }

      return {
        outcome: "unchanged",
        prompt: mapSavedPromptRow(existing),
        warnings,
      };
    }

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        title,
        description: normalizedDescription,
        category: normalizedCategory,
        tags: normalizedTags,
        config: normalizedConfig as unknown as Json,
        built_prompt: normalizedBuiltPrompt,
        enhanced_prompt: normalizedEnhancedPrompt,
        fingerprint,
        revision: existing.revision + 1,
        is_shared: input.isShared ?? existing.is_shared,
        target_model: normalizedTargetModel,
        use_case: normalizedUseCase,
        remixed_from: input.remixedFrom ?? existing.remixed_from,
        remix_note: normalizedRemixNote,
        remix_diff: input.remixDiff ?? null,
      };

      const { data: updated, error } = await supabase
        .from("saved_prompts")
        .update(updatePayload)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .eq("revision", existing.revision)
        .select(SAVED_PROMPT_SELECT_COLUMNS)
        .maybeSingle();

      if (error) throw error;
      if (!updated) {
        throw new Error("Prompt was modified elsewhere. Please refresh and try again.");
      }

      return {
        outcome: "updated",
        prompt: mapSavedPromptRow(updated as SavedPromptRow),
        warnings,
      };
    }

    const { data: created, error: insertError } = await supabase
      .from("saved_prompts")
      .insert({
        user_id: userId,
        title,
        description: normalizedDescription,
        category: normalizedCategory,
        tags: normalizedTags,
        config: normalizedConfig as unknown as Json,
        built_prompt: normalizedBuiltPrompt,
        enhanced_prompt: normalizedEnhancedPrompt,
        fingerprint,
        is_shared: !!input.isShared,
        target_model: normalizedTargetModel,
        use_case: normalizedUseCase,
        remixed_from: input.remixedFrom ?? null,
        remix_note: normalizedRemixNote,
        remix_diff: input.remixDiff ?? null,
      })
      .select(SAVED_PROMPT_SELECT_COLUMNS)
      .single();

    if (insertError) throw insertError;
    if (!created) throw new Error("Prompt save returned no data.");

    return {
      outcome: "created",
      prompt: mapSavedPromptRow(created as SavedPromptRow),
      warnings,
    };
  } catch (error) {
    throw toError(error, "Failed to save prompt.");
  }
}

export async function deletePrompt(id: string): Promise<boolean> {
  const userId = await requireUserId();

  try {
    return await deleteSavedPromptForUser(userId, id);
  } catch (error) {
    throw toError(error, "Failed to delete prompt.");
  }
}

export async function sharePrompt(
  savedPromptId: string,
  shareMeta?: {
    useCase?: string;
    targetModel?: string;
    category?: string;
    tags?: string[];
    title?: string;
    description?: string;
  },
): Promise<boolean> {
  const userId = await requireUserId();

  try {
    return await shareSavedPromptForUser(userId, savedPromptId, {
      useCase: shareMeta?.useCase,
      targetModel: shareMeta?.targetModel,
      category: shareMeta?.category,
      tags: shareMeta?.tags,
      title: shareMeta?.title,
      description: shareMeta?.description,
    });
  } catch (error) {
    throw toError(error, "Failed to share prompt.");
  }
}

export async function unsharePrompt(savedPromptId: string): Promise<boolean> {
  const userId = await requireUserId();

  try {
    return await unshareSavedPromptForUser(userId, savedPromptId);
  } catch (error) {
    throw toError(error, "Failed to unshare prompt.");
  }
}

export async function loadFeed(input: LoadFeedInput = {}): Promise<CommunityPost[]> {
  const { sort = "new", category, search, cursor, limit = 25 } = input;

  try {
    let builder = supabase
      .from("community_posts")
      .select(COMMUNITY_POST_SELECT_COLUMNS)
      .eq("is_public", true)
      .limit(Math.min(Math.max(limit, 1), 100));

    if (category && category !== "all") {
      builder = builder.eq("category", category);
    }

    if (search?.trim()) {
      const escaped = escapePostgrestLikePattern(search.trim());
      builder = builder.or(`title.ilike.%${escaped}%,use_case.ilike.%${escaped}%`);
    }

    if (cursor) {
      builder = builder.lt("created_at", cursor);
    }

    if (sort === "popular") {
      builder = builder.order("upvote_count", { ascending: false }).order("created_at", { ascending: false });
    } else if (sort === "most_remixed") {
      builder = builder.order("remix_count", { ascending: false }).order("created_at", { ascending: false });
    } else if (sort === "verified") {
      builder = builder.order("verified_count", { ascending: false }).order("created_at", { ascending: false });
    } else {
      builder = builder.order("created_at", { ascending: false });
    }

    const { data, error } = await builder;
    if (error) throw error;
    return (data || []).map((row) => mapCommunityPost(row as CommunityPostRow));
  } catch (error) {
    throw toError(error, "Failed to load community feed.");
  }
}

export async function loadPost(postId: string): Promise<CommunityPost | null> {
  try {
    const { data, error } = await supabase
      .from("community_posts")
      .select(COMMUNITY_POST_SELECT_COLUMNS)
      .eq("id", postId)
      .eq("is_public", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapCommunityPost(data as CommunityPostRow);
  } catch (error) {
    throw toError(error, "Failed to load community post.");
  }
}

export async function loadPostsByIds(postIds: string[]): Promise<CommunityPost[]> {
  const uniqueIds = Array.from(new Set(postIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from("community_posts")
      .select(COMMUNITY_POST_SELECT_COLUMNS)
      .in("id", uniqueIds)
      .eq("is_public", true);

    if (error) throw error;
    return (data || []).map((row) => mapCommunityPost(row as CommunityPostRow));
  } catch (error) {
    throw toError(error, "Failed to load related community posts.");
  }
}

export async function loadProfilesByIds(userIds: string[]): Promise<CommunityProfile[]> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  try {
    const { data, error } = await supabase.rpc("community_profiles_by_ids", {
      input_ids: uniqueIds,
    });

    if (error) throw error;
    return (data || []).map((row) => mapCommunityProfile(row as CommunityProfileRow));
  } catch (error) {
    throw toError(error, "Failed to load community profiles.");
  }
}

export async function loadRemixes(postId: string): Promise<CommunityPost[]> {
  try {
    const { data, error } = await supabase
      .from("community_posts")
      .select(COMMUNITY_POST_SELECT_COLUMNS)
      .eq("remixed_from", postId)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => mapCommunityPost(row as CommunityPostRow));
  } catch (error) {
    throw toError(error, "Failed to load remixes.");
  }
}

export async function loadMyVotes(postIds: string[]): Promise<Record<string, VoteState>> {
  const uniqueIds = Array.from(new Set(postIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw toError(userError, "Failed to load vote status.");
  }
  if (!userData.user || userData.user.is_anonymous) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from("community_votes")
      .select("post_id, vote_type")
      .eq("user_id", userData.user.id)
      .in("post_id", uniqueIds);

    if (error) throw error;
    const voteState: Record<string, VoteState> = {};
    uniqueIds.forEach((id) => {
      voteState[id] = { upvote: false, verified: false };
    });
    (data || []).forEach((row) => {
      const entry = voteState[row.post_id] ?? { upvote: false, verified: false };
      if (row.vote_type === "upvote") entry.upvote = true;
      if (row.vote_type === "verified") entry.verified = true;
      voteState[row.post_id] = entry;
    });
    return voteState;
  } catch (error) {
    throw toError(error, "Failed to load vote status.");
  }
}

export async function toggleVote(
  postId: string,
  voteType: VoteType,
): Promise<{ active: boolean; rowId: string | null }> {
  const userId = await requireUserId();

  try {
    const { data: removed, error: deleteError } = await supabase
      .from("community_votes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("vote_type", voteType)
      .select("id")
      .maybeSingle();

    if (deleteError) throw deleteError;
    if (removed?.id) {
      return { active: false, rowId: null };
    }

    const { data: upserted, error: upsertError } = await supabase
      .from("community_votes")
      .upsert(
        {
          post_id: postId,
          user_id: userId,
          vote_type: voteType,
        },
        {
          onConflict: "post_id,user_id,vote_type",
          ignoreDuplicates: true,
        },
      )
      .select("id")
      .maybeSingle();

    if (upsertError) throw upsertError;
    if (upserted?.id) {
      return { active: true, rowId: upserted.id };
    }

    const { data: existing, error: lookupError } = await supabase
      .from("community_votes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("vote_type", voteType)
      .maybeSingle();

    if (lookupError) throw lookupError;
    return { active: true, rowId: existing?.id ?? null };
  } catch (error) {
    throw toError(error, "Failed to submit vote.");
  }
}

export async function addComment(postId: string, body: string): Promise<CommunityComment> {
  const userId = await requireUserId();
  const content = body.trim();
  if (!content) throw new Error("Comment is required.");

  try {
    const { data, error } = await supabase
      .from("community_comments")
      .insert({
        post_id: postId,
        user_id: userId,
        body: content,
      })
      .select("id, post_id, user_id, body, created_at, updated_at")
      .single();

    if (error) throw error;
    if (!data) throw new Error("Comment creation returned no data.");
    return mapCommunityComment(data as CommunityCommentRow);
  } catch (error) {
    throw toError(error, "Failed to add comment.");
  }
}

export async function loadComments(postId: string, options: LoadCommentsInput = {}): Promise<CommunityComment[]> {
  const { limit = 25, cursor } = options;

  try {
    const { data: visiblePost, error: postError } = await supabase
      .from("community_posts")
      .select("id")
      .eq("id", postId)
      .eq("is_public", true)
      .maybeSingle();

    if (postError) throw postError;
    if (!visiblePost) return [];

    let builder = supabase
      .from("community_comments")
      .select("id, post_id, user_id, body, created_at, updated_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));

    if (cursor) {
      builder = builder.lt("created_at", cursor);
    }

    const { data, error } = await builder;
    if (error) throw error;
    return (data || []).map((row) => mapCommunityComment(row as CommunityCommentRow));
  } catch (error) {
    throw toError(error, "Failed to load comments.");
  }
}

export async function remixToLibrary(
  postId: string,
  options?: { title?: string; remixNote?: string },
): Promise<SavedPromptRecord> {
  const userId = await requireUserId();

  try {
    const { data: postRow, error: postError } = await supabase
      .from("community_posts")
      .select(COMMUNITY_POST_SELECT_COLUMNS)
      .eq("id", postId)
      .eq("is_public", true)
      .single();

    if (postError) throw postError;
    const post = mapCommunityPost(postRow as CommunityPostRow);
    const title = clampTitle(options?.title || `Remix of ${post.title}`);
    const config = normalizeTemplateConfig(post.publicConfig);

    const { data: created, error: insertError } = await supabase
      .from("saved_prompts")
      .insert({
        user_id: userId,
        title,
        description: clampText(post.description, 500),
        category: post.category,
        tags: normalizePromptTags(post.tags),
        config: config as unknown as Json,
        built_prompt: post.starterPrompt,
        enhanced_prompt: post.enhancedPrompt,
        fingerprint: computeTemplateFingerprint(config),
        is_shared: false,
        target_model: clampText(post.targetModel, 80),
        use_case: clampText(post.useCase, 500),
        remixed_from: post.id,
        remix_note: clampText(options?.remixNote, 500),
        remix_diff: null,
      })
      .select(SAVED_PROMPT_SELECT_COLUMNS)
      .single();

    if (insertError) throw insertError;
    if (!created) throw new Error("Failed to create remixed prompt.");
    return mapSavedPromptRow(created as SavedPromptRow);
  } catch (error) {
    throw toError(error, "Failed to remix prompt to your library.");
  }
}

function toComparableValue(value: unknown): string | string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  return value == null ? "" : String(value);
}

function shallowEqualValue(a: string | string[], b: string | string[]): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((entry, index) => entry === b[index]);
  }
  return a === b;
}

export function computeRemixDiff(
  parentConfig: PromptConfig,
  childConfig: PromptConfig,
  options?: {
    parentTags?: string[];
    childTags?: string[];
    parentCategory?: string;
    childCategory?: string;
  },
): RemixDiff {
  const parent = normalizeTemplateConfig(parentConfig);
  const child = normalizeTemplateConfig(childConfig);

  const fields: Array<keyof PromptConfig> = [
    "role",
    "task",
    "tone",
    "complexity",
    "lengthPreference",
    "format",
    "constraints",
    "examples",
  ];

  const changes: RemixDiff["changes"] = [];

  fields.forEach((field) => {
    const from = toComparableValue(parent[field]);
    const to = toComparableValue(child[field]);
    if (!shallowEqualValue(from, to)) {
      changes.push({ field, from, to });
    }
  });

  const parentTags = normalizePromptTags(options?.parentTags);
  const childTags = normalizePromptTags(options?.childTags);

  const addedTags = childTags.filter((tag) => !parentTags.includes(tag));
  const removedTags = parentTags.filter((tag) => !childTags.includes(tag));

  return {
    changes,
    added_tags: addedTags,
    removed_tags: removedTags,
    category_changed:
      (options?.parentCategory || "general").trim().toLowerCase() !==
      (options?.childCategory || "general").trim().toLowerCase(),
  };
}
````

## File: src/lib/prompt-categories.ts
````typescript
export const PROMPT_CATEGORIES = [
  "general",
  "frontend",
  "backend",
  "fullstack",
  "devops",
  "data",
  "ml-ai",
  "security",
  "testing",
  "api",
  "automation",
  "docs",
  "content",
  "analysis",
  "creative",
  "business",
  "education",
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  general: "General",
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Fullstack",
  devops: "DevOps",
  data: "Data",
  "ml-ai": "ML / AI",
  security: "Security",
  testing: "Testing",
  api: "API",
  automation: "Automation",
  docs: "Docs",
  content: "Content",
  analysis: "Analysis",
  creative: "Creative",
  business: "Business",
  education: "Education",
};

export const PROMPT_CATEGORY_OPTIONS: ReadonlyArray<{ value: PromptCategory; label: string }> = PROMPT_CATEGORIES.map(
  (value) => ({
    value,
    label: PROMPT_CATEGORY_LABELS[value],
  }),
);

const PROMPT_CATEGORY_SET = new Set<string>(PROMPT_CATEGORIES);

export function isPromptCategory(value: string): value is PromptCategory {
  return PROMPT_CATEGORY_SET.has(value);
}

export function normalizePromptCategory(category?: string): PromptCategory | undefined {
  if (category === undefined) return undefined;
  const normalized = category.trim().toLowerCase();
  if (!normalized) return "general";
  return isPromptCategory(normalized) ? normalized : "general";
}
````

## File: src/lib/saved-prompt-shared.ts
````typescript
import type { PostgrestError } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";

export interface SavedPromptRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[] | null;
  config: Json | null;
  built_prompt: string;
  enhanced_prompt: string;
  fingerprint: string | null;
  revision: number;
  is_shared: boolean;
  target_model: string;
  use_case: string;
  remixed_from: string | null;
  remix_note: string;
  remix_diff: Json | null;
  created_at: string;
  updated_at: string;
}

export type SavedPromptListRow = Omit<
  SavedPromptRow,
  "built_prompt" | "enhanced_prompt" | "remix_note" | "remix_diff"
>;

export function isPostgrestError(value: unknown): value is PostgrestError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.message === "string" && typeof candidate.code === "string";
}

function normalizeTagsCore(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20),
    ),
  );
}

export function normalizePromptTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  return normalizeTagsCore(tags);
}

export function normalizePromptTagsOptional(tags?: string[]): string[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  return normalizeTagsCore(tags);
}

export function escapePostgrestLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
````

## File: src/lib/section-health.ts
````typescript
import type { PromptConfig } from "@/lib/prompt-builder";

export type SectionHealthState = "empty" | "in_progress" | "complete";

export interface SectionHealth {
  builder: SectionHealthState;
  context: SectionHealthState;
  tone: SectionHealthState;
  quality: SectionHealthState;
}

function resolveState(
  signalCount: number,
  thresholds: { inProgress: number; complete: number },
): SectionHealthState {
  if (signalCount >= thresholds.complete) return "complete";
  if (signalCount >= thresholds.inProgress) return "in_progress";
  return "empty";
}

export function getSectionHealth(config: PromptConfig, qualityTotal: number): SectionHealth {
  const hasValue = (value: string, minLength = 1) => value.trim().length >= minLength;

  const contextStructuredCount = Object.values(config.contextConfig.structured).filter(
    (value) => typeof value === "string" && hasValue(value, 2),
  ).length;
  const contextInterviewCount = config.contextConfig.interviewAnswers.filter(
    (answer) => hasValue(answer.answer, 2),
  ).length;
  const hasRag =
    config.contextConfig.rag.enabled && hasValue(config.contextConfig.rag.vectorStoreRef, 2);
  const hasIntegrations = config.contextConfig.databaseConnections.length > 0 || hasRag;

  const builderSignalCount =
    (config.role || hasValue(config.customRole, 2) ? 1 : 0) +
    (hasValue(config.task, 8) ? 1 : 0) +
    (config.format.length > 0 || hasValue(config.customFormat, 2) || config.lengthPreference !== "standard"
      ? 1
      : 0) +
    (hasValue(config.examples, 12) ? 1 : 0) +
    (config.constraints.length > 0 || hasValue(config.customConstraint, 2) ? 1 : 0);

  const contextSignalCount =
    (config.contextConfig.sources.length > 0 ? 1 : 0) +
    (contextStructuredCount >= 4 ? 2 : contextStructuredCount >= 1 ? 1 : 0) +
    (contextInterviewCount >= 2 ? 1 : contextInterviewCount === 1 ? 0.5 : 0) +
    (hasIntegrations ? 1 : 0) +
    (hasValue(config.contextConfig.projectNotes, 30) ? 1 : 0);

  const toneSignalCount = [
    config.tone !== "Professional",
    config.complexity !== "Moderate",
  ].filter(Boolean).length;

  return {
    builder: resolveState(builderSignalCount, { inProgress: 1, complete: 4 }),
    context: resolveState(contextSignalCount, { inProgress: 1, complete: 3 }),
    tone: resolveState(toneSignalCount, { inProgress: 1, complete: 2 }),
    quality:
      qualityTotal >= 75 ? "complete" : qualityTotal >= 50 ? "in_progress" : "empty",
  };
}
````

## File: src/lib/text-diff.ts
````typescript
export type DiffLineType = "context" | "add" | "remove";

export interface DiffLine {
  type: DiffLineType;
  value: string;
}

export interface LineDiffResult {
  lines: DiffLine[];
  added: number;
  removed: number;
}

function splitLines(input: string): string[] {
  if (!input) return [];
  return input.replace(/\r\n/g, "\n").split("\n");
}

export function buildLineDiff(before: string, after: string): LineDiffResult {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const beforeLen = beforeLines.length;
  const afterLen = afterLines.length;

  const lcs: number[][] = Array.from({ length: beforeLen + 1 }, () =>
    Array.from({ length: afterLen + 1 }, () => 0)
  );

  for (let i = beforeLen - 1; i >= 0; i -= 1) {
    for (let j = afterLen - 1; j >= 0; j -= 1) {
      if (beforeLines[i] === afterLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;

  while (i < beforeLen && j < afterLen) {
    if (beforeLines[i] === afterLines[j]) {
      lines.push({ type: "context", value: beforeLines[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ type: "remove", value: beforeLines[i] });
      removed += 1;
      i += 1;
    } else {
      lines.push({ type: "add", value: afterLines[j] });
      added += 1;
      j += 1;
    }
  }

  while (i < beforeLen) {
    lines.push({ type: "remove", value: beforeLines[i] });
    removed += 1;
    i += 1;
  }

  while (j < afterLen) {
    lines.push({ type: "add", value: afterLines[j] });
    added += 1;
    j += 1;
  }

  return { lines, added, removed };
}
````

## File: src/lib/utils.ts
````typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
````

## File: src/pages/Community.tsx
````typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Header } from "@/components/Header";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  type CommunityPost,
  type CommunityProfile,
  type CommunitySort,
  type VoteState,
  type VoteType,
  loadFeed,
  loadMyVotes,
  loadPostsByIds,
  loadProfilesByIds,
  toggleVote,
} from "@/lib/community";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";

const SORT_OPTIONS: Array<{ label: string; value: CommunitySort }> = [
  { label: "New", value: "new" },
  { label: "Popular", value: "popular" },
  { label: "Most Remixed", value: "most_remixed" },
  { label: "Verified", value: "verified" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All" },
  ...PROMPT_CATEGORY_OPTIONS,
];

function toProfileMap(profiles: CommunityProfile[]): Record<string, CommunityProfile> {
  return profiles.reduce<Record<string, CommunityProfile>>((map, profile) => {
    map[profile.id] = profile;
    return map;
  }, {});
}

function toParentTitleMap(posts: CommunityPost[]): Record<string, string> {
  return posts.reduce<Record<string, string>>((map, post) => {
    map[post.id] = post.title;
    return map;
  }, {});
}

const Community = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [authorById, setAuthorById] = useState<Record<string, CommunityProfile>>({});
  const [parentTitleById, setParentTitleById] = useState<Record<string, string>>({});
  const [voteStateByPost, setVoteStateByPost] = useState<Record<string, VoteState>>({});
  const [sort, setSort] = useState<CommunitySort>("new");
  const [category, setCategory] = useState("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestToken = useRef(0);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const token = ++requestToken.current;
    setLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const nextPosts = await loadFeed({
          sort,
          category,
          search: query || undefined,
          limit: 60,
        });
        if (token !== requestToken.current) return;

        setPosts(nextPosts);

        const authorIds = Array.from(new Set(nextPosts.map((post) => post.authorId)));
        const parentIds = Array.from(
          new Set(nextPosts.map((post) => post.remixedFrom).filter((value): value is string => !!value)),
        );

        const [authorProfiles, parentPosts, voteStates] = await Promise.all([
          loadProfilesByIds(authorIds),
          loadPostsByIds(parentIds),
          loadMyVotes(nextPosts.map((post) => post.id)),
        ]);

        if (token !== requestToken.current) return;
        setAuthorById(toProfileMap(authorProfiles));
        setParentTitleById(toParentTitleMap(parentPosts));
        setVoteStateByPost(voteStates);
      } catch (error) {
        if (token !== requestToken.current) return;
        setPosts([]);
        setAuthorById({});
        setParentTitleById({});
        setVoteStateByPost({});
        setErrorMessage(error instanceof Error ? error.message : "Failed to load community feed.");
      } finally {
        if (token === requestToken.current) {
          setLoading(false);
        }
      }
    })();
  }, [sort, category, query, user?.id]);

  const handleCopyPrompt = useCallback(
    async (post: CommunityPost) => {
      try {
        await navigator.clipboard.writeText(post.enhancedPrompt || post.starterPrompt);
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
    async (postId: string, voteType: VoteType) => {
      if (!user) {
        toast({ title: "Sign in required", description: "Create an account to vote." });
        return;
      }
      try {
        const result = await toggleVote(postId, voteType);
        setVoteStateByPost((prev) => ({
          ...prev,
          [postId]: {
            upvote: voteType === "upvote" ? result.active : prev[postId]?.upvote ?? false,
            verified: voteType === "verified" ? result.active : prev[postId]?.verified ?? false,
          },
        }));
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;
            const delta = result.active ? 1 : -1;
            if (voteType === "upvote") {
              return { ...post, upvoteCount: Math.max(0, post.upvoteCount + delta) };
            }
            return { ...post, verifiedCount: Math.max(0, post.verifiedCount + delta) };
          }),
        );
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

  const handleCommentAdded = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post,
      ),
    );
  }, []);

  const activeSortLabel = useMemo(
    () => SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "New",
    [sort],
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header isDark={isDark} onToggleTheme={() => setIsDark((prev) => !prev)} />

      <main className="flex-1 container mx-auto px-4 py-4 sm:py-6">
        <div className="delight-hero mb-4 text-center sm:mb-6">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Community Prompt Feed</h1>
          <p className="mx-auto mt-1 max-w-2xl text-sm text-muted-foreground">
            Browse developer-focused prompt recipes, filter by domain, and open any post to copy or remix.
          </p>
        </div>

        <Card className="mb-4 space-y-3 border-border/80 bg-card/85 p-3 sm:mb-5 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search by title or use case"
              className="h-9 pl-8 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {SORT_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={sort === option.value ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setSort(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-1.5 pb-1">
              {CATEGORY_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={category === option.value ? "soft" : "ghost"}
                  className="interactive-chip h-7 text-[11px]"
                  onClick={() => setCategory(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{posts.length} posts</Badge>
            <span>Sorted by {activeSortLabel}</span>
            {query && <span>Search: “{query}”</span>}
          </div>
        </Card>

        <CommunityFeed
          posts={posts}
          loading={loading}
          errorMessage={errorMessage}
          authorById={authorById}
          parentTitleById={parentTitleById}
          onCopyPrompt={handleCopyPrompt}
          onToggleVote={handleToggleVote}
          voteStateByPost={voteStateByPost}
          onCommentAdded={handleCommentAdded}
          canVote={Boolean(user)}
        />
      </main>
    </div>
  );
};

export default Community;
````

## File: src/pages/CommunityPost.tsx
````typescript
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
````

## File: src/pages/NotFound.tsx
````typescript
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
````

## File: src/test/edge-auth.test.ts
````typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuthenticatedUser } from "../../supabase/functions/_shared/security";

type DenoEnvMap = Record<string, string | undefined>;

declare global {
  // Minimal Deno surface needed by the auth helper during tests.
  var Deno: { env: { get: (key: string) => string | undefined } };
}

function stubDenoEnv(values: DenoEnvMap) {
  const get = vi.fn((key: string) => values[key]);
  vi.stubGlobal("Deno", { env: { get } });
  return get;
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe("requireAuthenticatedUser", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("accepts authenticated bearer tokens via Supabase Auth", async () => {
    stubDenoEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "user-1", is_anonymous: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { authorization: "Bearer token123" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "user-1", isAnonymous: false });
    expect(fetchMock).toHaveBeenCalledWith("https://project.supabase.co/auth/v1/user", {
      headers: {
        Authorization: "Bearer token123",
        apikey: "anon-key",
      },
    });
  });

  it("rejects invalid bearer tokens", async () => {
    stubDenoEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { authorization: "Bearer badtoken" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("Invalid or expired Supabase session.");
    }
  });

  it("returns 503 when bearer auth is enabled but Supabase env vars are missing", async () => {
    stubDenoEnv({
      SUPABASE_URL: undefined,
      SUPABASE_ANON_KEY: undefined,
      SUPABASE_PUBLISHABLE_KEY: undefined,
      SUPABASE_KEY: undefined,
      ALLOW_UNVERIFIED_JWT_FALLBACK: undefined,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { authorization: "Bearer some-session-token" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Authentication service is unavailable because Supabase auth is not configured.");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("supports optional decoded-JWT fallback when Supabase auth config is missing", async () => {
    stubDenoEnv({
      SUPABASE_URL: undefined,
      SUPABASE_ANON_KEY: undefined,
      SUPABASE_PUBLISHABLE_KEY: undefined,
      SUPABASE_KEY: undefined,
      ALLOW_UNVERIFIED_JWT_FALLBACK: "true",
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const token = buildUnsignedJwt({
      sub: "user-local-dev",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new Request("http://example.test", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "user-local-dev", isAnonymous: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks decoded-JWT fallback in production unless explicitly overridden", async () => {
    stubDenoEnv({
      SUPABASE_URL: undefined,
      SUPABASE_ANON_KEY: undefined,
      SUPABASE_PUBLISHABLE_KEY: undefined,
      SUPABASE_KEY: undefined,
      ALLOW_UNVERIFIED_JWT_FALLBACK: "true",
      ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION: undefined,
      NODE_ENV: "production",
    });

    const token = buildUnsignedJwt({
      sub: "user-prod",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new Request("http://example.test", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Authentication service is unavailable because Supabase auth is not configured.");
    }
  });

  it("allows decoded-JWT fallback in production only with explicit override", async () => {
    stubDenoEnv({
      SUPABASE_URL: undefined,
      SUPABASE_ANON_KEY: undefined,
      SUPABASE_PUBLISHABLE_KEY: undefined,
      SUPABASE_KEY: undefined,
      ALLOW_UNVERIFIED_JWT_FALLBACK: "true",
      ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION: "true",
      NODE_ENV: "production",
    });

    const token = buildUnsignedJwt({
      sub: "user-prod-override",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new Request("http://example.test", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "user-prod-override", isAnonymous: false });
  });

  it("returns 503 when Supabase auth is unavailable and fallback is disabled", async () => {
    stubDenoEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
      ALLOW_UNVERIFIED_JWT_FALLBACK: undefined,
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { authorization: "Bearer token123" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toBe("Authentication service is temporarily unavailable. Please try again.");
    }
  });

  it("supports optional decoded-JWT fallback when Supabase auth is unavailable", async () => {
    stubDenoEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
      ALLOW_UNVERIFIED_JWT_FALLBACK: "true",
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    const token = buildUnsignedJwt({
      sub: "user-fallback",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = new Request("http://example.test", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "user-fallback", isAnonymous: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("accepts anonymous access via apikey when no bearer token", async () => {
    stubDenoEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { apikey: "anon-key" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "anon", isAnonymous: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts publishable-format keys if no anon key is configured", async () => {
    stubDenoEnv({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: undefined,
      SUPABASE_PUBLISHABLE_KEY: undefined,
      SUPABASE_KEY: undefined,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new Request("http://example.test", {
      headers: { apikey: "sb_publishable_test_key" },
    });

    const result = await requireAuthenticatedUser(req);
    expect(result).toEqual({ ok: true, userId: "anon", isAnonymous: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
````

## File: src/test/example.test.ts
````typescript
import { describe, it, expect } from "vitest";

describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
````

## File: src/test/index-remix-param.test.tsx
````typescript
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { defaultConfig } from "@/lib/prompt-builder";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  usePromptBuilder: vi.fn(),
  savePrompt: vi.fn(),
  saveAndSharePrompt: vi.fn(),
  clearRemix: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/lib/ai-client", () => ({
  streamEnhance: vi.fn(),
}));

vi.mock("@/components/Header", () => ({
  Header: () => null,
}));

vi.mock("@/components/PromptInput", () => ({
  PromptInput: () => null,
}));

vi.mock("@/components/BuilderTabs", () => ({
  BuilderTabs: () => null,
}));

vi.mock("@/components/ContextPanel", () => ({
  ContextPanel: () => null,
}));

vi.mock("@/components/ToneControls", () => ({
  ToneControls: () => null,
}));

vi.mock("@/components/QualityScore", () => ({
  QualityScore: () => null,
}));

vi.mock("@/components/OutputPanel", () => ({
  OutputPanel: ({
    onSavePrompt,
    onSaveAndSharePrompt,
  }: {
    onSavePrompt: (input: { name: string }) => void;
    onSaveAndSharePrompt: (input: { name: string; useCase: string }) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSavePrompt({ name: "Saved Prompt" })}>
        save prompt
      </button>
      <button
        type="button"
        onClick={() =>
          onSaveAndSharePrompt({
            name: "Shared Prompt",
            useCase: "Demonstrate clear remix behavior",
          })
        }
      >
        save and share prompt
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => mocks.usePromptBuilder(),
}));

function buildSaveResult(name: string) {
  return {
    outcome: "created",
    warnings: [],
    record: {
      metadata: {
        name,
        revision: 1,
      },
    },
  };
}

function buildPromptBuilderState() {
  return {
    config: defaultConfig,
    updateConfig: vi.fn(),
    resetConfig: vi.fn(),
    clearOriginalPrompt: vi.fn(),
    builtPrompt: "Built prompt",
    score: { total: 75 },
    enhancedPrompt: "",
    setEnhancedPrompt: vi.fn(),
    isEnhancing: false,
    setIsEnhancing: vi.fn(),
    isSignedIn: true,
    versions: [],
    saveVersion: vi.fn(),
    loadTemplate: vi.fn(),
    savePrompt: mocks.savePrompt,
    saveAndSharePrompt: mocks.saveAndSharePrompt,
    shareSavedPrompt: vi.fn(),
    unshareSavedPrompt: vi.fn(),
    saveAsTemplate: vi.fn(),
    loadSavedTemplate: vi.fn(),
    deleteSavedTemplate: vi.fn(),
    templateSummaries: [],
    remixContext: {
      postId: "post_1",
      parentTitle: "Parent Prompt",
      parentAuthor: "Parent Author",
    },
    startRemix: vi.fn(),
    clearRemix: mocks.clearRemix,
    updateContextSources: vi.fn(),
    updateDatabaseConnections: vi.fn(),
    updateRagParameters: vi.fn(),
    updateContextStructured: vi.fn(),
    updateContextInterview: vi.fn(),
    updateProjectNotes: vi.fn(),
    toggleDelimiters: vi.fn(),
  };
}

function LocationSearch() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

async function renderIndexAtRemixUrl() {
  const { default: Index } = await import("@/pages/Index");
  render(
    <MemoryRouter initialEntries={["/?remix=post_1"]}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Index />
              <LocationSearch />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Index remix query param clearing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.savePrompt.mockResolvedValue(buildSaveResult("Saved Prompt"));
    mocks.saveAndSharePrompt.mockResolvedValue(buildSaveResult("Shared Prompt"));
    mocks.usePromptBuilder.mockReturnValue(buildPromptBuilderState());
  });

  it("removes ?remix after save", async () => {
    await renderIndexAtRemixUrl();
    expect(screen.getByTestId("location-search").textContent).toBe("?remix=post_1");

    fireEvent.click(screen.getByRole("button", { name: "save prompt" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(mocks.clearRemix).toHaveBeenCalledTimes(1);
  });

  it("removes ?remix after save and share", async () => {
    await renderIndexAtRemixUrl();
    expect(screen.getByTestId("location-search").textContent).toBe("?remix=post_1");

    fireEvent.click(screen.getByRole("button", { name: "save and share prompt" }));

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
    expect(mocks.clearRemix).toHaveBeenCalledTimes(1);
  });
});
````

## File: src/test/prompt-categories.test.ts
````typescript
import { describe, expect, it } from "vitest";
import {
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
  PROMPT_CATEGORY_OPTIONS,
  isPromptCategory,
  normalizePromptCategory,
} from "@/lib/prompt-categories";

describe("prompt category taxonomy", () => {
  it("includes the full saved prompt category set", () => {
    expect(PROMPT_CATEGORIES).toEqual([
      "general",
      "frontend",
      "backend",
      "fullstack",
      "devops",
      "data",
      "ml-ai",
      "security",
      "testing",
      "api",
      "automation",
      "docs",
      "content",
      "analysis",
      "creative",
      "business",
      "education",
    ]);
  });

  it("exposes label and option entries for each category", () => {
    expect(PROMPT_CATEGORY_OPTIONS).toHaveLength(PROMPT_CATEGORIES.length);
    PROMPT_CATEGORIES.forEach((category) => {
      expect(PROMPT_CATEGORY_LABELS[category]).toBeTypeOf("string");
      expect(PROMPT_CATEGORY_OPTIONS.some((option) => option.value === category)).toBe(true);
    });
  });

  it("normalizes category input safely", () => {
    expect(normalizePromptCategory(undefined)).toBeUndefined();
    expect(normalizePromptCategory("")).toBe("general");
    expect(normalizePromptCategory("BUSINESS")).toBe("business");
    expect(normalizePromptCategory("not-a-category")).toBe("general");
    expect(isPromptCategory("content")).toBe(true);
    expect(isPromptCategory("unknown")).toBe(false);
  });
});
````

## File: src/test/rls-community-comments.test.ts
````typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const describeIfEnv = hasSupabaseEnv ? describe : describe.skip;

if (!hasSupabaseEnv && process.env.CI) {
  describe("community_comments RLS (env)", () => {
    it("requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY", () => {
      throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY for RLS tests.");
    });
  });
}

function createAdminClient() {
  return createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function createAnonClient() {
  return createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

describeIfEnv("community_comments RLS", () => {
  let admin: ReturnType<typeof createAdminClient>;
  let anon: ReturnType<typeof createAnonClient>;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const authorEmail = `rls-comments-author-${suffix}@example.com`;
  const commenterEmail = `rls-comments-commenter-${suffix}@example.com`;
  const authorPassword = `Passw0rd!${suffix}`;
  const commenterPassword = `Passw0rd!${suffix}`;

  let authorId = "";
  let commenterId = "";
  let savedPromptId = "";
  let postId = "";
  let commentId = "";

  beforeAll(async () => {
    admin = createAdminClient();
    anon = createAnonClient();

    const { data: author, error: authorError } = await admin.auth.admin.createUser({
      email: authorEmail,
      password: authorPassword,
      email_confirm: true,
    });
    if (authorError || !author.user?.id) {
      throw new Error(`Failed to create author: ${authorError?.message || "missing id"}`);
    }
    authorId = author.user.id;

    const { data: commenter, error: commenterError } = await admin.auth.admin.createUser({
      email: commenterEmail,
      password: commenterPassword,
      email_confirm: true,
    });
    if (commenterError || !commenter.user?.id) {
      throw new Error(`Failed to create commenter: ${commenterError?.message || "missing id"}`);
    }
    commenterId = commenter.user.id;

    const { data: savedPrompt, error: savedPromptError } = await admin
      .from("saved_prompts")
      .insert({
        user_id: authorId,
        title: "RLS Comment Prompt",
        description: "",
        category: "general",
        tags: [],
        config: {},
        built_prompt: "",
        enhanced_prompt: "",
        target_model: "",
        use_case: "",
      })
      .select("id")
      .single();
    if (savedPromptError || !savedPrompt?.id) {
      throw new Error(`Failed to create saved prompt: ${savedPromptError?.message || "missing id"}`);
    }
    savedPromptId = savedPrompt.id;

    const { data: post, error: postError } = await admin
      .from("community_posts")
      .insert({
        saved_prompt_id: savedPromptId,
        author_id: authorId,
        title: "RLS Comment Post",
        enhanced_prompt: "Sample",
        description: "",
        use_case: "",
        category: "general",
        tags: [],
        target_model: "",
        is_public: true,
        public_config: {},
        starter_prompt: "Starter",
        remix_note: "",
        remix_diff: null,
      })
      .select("id")
      .single();
    if (postError || !post?.id) {
      throw new Error(`Failed to create community post: ${postError?.message || "missing id"}`);
    }
    postId = post.id;

    const { data: comment, error: commentError } = await admin
      .from("community_comments")
      .insert({
        post_id: postId,
        user_id: commenterId,
        body: "Visible until unshared",
      })
      .select("id")
      .single();
    if (commentError || !comment?.id) {
      throw new Error(`Failed to create comment: ${commentError?.message || "missing id"}`);
    }
    commentId = comment.id;
  });

  afterAll(async () => {
    if (commentId) {
      await admin.from("community_comments").delete().eq("id", commentId);
    }
    if (postId) {
      await admin.from("community_posts").delete().eq("id", postId);
    }
    if (savedPromptId) {
      await admin.from("saved_prompts").delete().eq("id", savedPromptId);
    }
    if (authorId) {
      await admin.auth.admin.deleteUser(authorId);
    }
    if (commenterId) {
      await admin.auth.admin.deleteUser(commenterId);
    }
  });

  it("hides comments after the parent post becomes private", async () => {
    const { data: beforeUnshare, error: beforeError } = await anon
      .from("community_comments")
      .select("id")
      .eq("id", commentId);

    expect(beforeError).toBeNull();
    expect(beforeUnshare?.length).toBe(1);
    expect(beforeUnshare?.[0]?.id).toBe(commentId);

    const { error: unshareError } = await admin
      .from("community_posts")
      .update({ is_public: false })
      .eq("id", postId);
    if (unshareError) {
      throw new Error(`Failed to unshare post: ${unshareError.message}`);
    }

    const { data: stillStored, error: storedError } = await admin
      .from("community_comments")
      .select("id")
      .eq("id", commentId);
    expect(storedError).toBeNull();
    expect(stillStored?.length).toBe(1);

    const { data: anonAfter, error: anonAfterError } = await anon
      .from("community_comments")
      .select("id")
      .eq("id", commentId);
    expect(anonAfterError).toBeNull();
    expect(anonAfter).toEqual([]);

    const commenterClient = createAnonClient();
    const { error: signInError } = await commenterClient.auth.signInWithPassword({
      email: commenterEmail,
      password: commenterPassword,
    });
    if (signInError) {
      throw new Error(`Failed to sign in commenter: ${signInError.message}`);
    }

    const { data: commenterAfter, error: commenterAfterError } = await commenterClient
      .from("community_comments")
      .select("id")
      .eq("id", commentId);
    expect(commenterAfterError).toBeNull();
    expect(commenterAfter).toEqual([]);
  });
});
````

## File: src/test/rls-community-votes.test.ts
````typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
const describeIfEnv = hasSupabaseEnv ? describe : describe.skip;

if (!hasSupabaseEnv && process.env.CI) {
  describe("community_votes RLS (env)", () => {
    it("requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY", () => {
      throw new Error("Missing SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY for RLS tests.");
    });
  });
}

function createAdminClient() {
  return createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function createAnonClient() {
  return createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

describeIfEnv("community_votes RLS", () => {
  let admin: ReturnType<typeof createAdminClient>;
  let anon: ReturnType<typeof createAnonClient>;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const user1Email = `rls-user1-${suffix}@example.com`;
  const user2Email = `rls-user2-${suffix}@example.com`;
  const user1Password = `Passw0rd!${suffix}`;
  const user2Password = `Passw0rd!${suffix}`;

  let user1Id = "";
  let user2Id = "";
  let savedPromptId = "";
  let postId = "";
  let voteId = "";

  beforeAll(async () => {
    admin = createAdminClient();
    anon = createAnonClient();

    const { data: user1, error: user1Error } = await admin.auth.admin.createUser({
      email: user1Email,
      password: user1Password,
      email_confirm: true,
    });
    if (user1Error || !user1.user?.id) {
      throw new Error(`Failed to create user1: ${user1Error?.message || "missing id"}`);
    }
    user1Id = user1.user.id;

    const { data: user2, error: user2Error } = await admin.auth.admin.createUser({
      email: user2Email,
      password: user2Password,
      email_confirm: true,
    });
    if (user2Error || !user2.user?.id) {
      throw new Error(`Failed to create user2: ${user2Error?.message || "missing id"}`);
    }
    user2Id = user2.user.id;

    const { data: savedPrompt, error: savedPromptError } = await admin
      .from("saved_prompts")
      .insert({
        user_id: user1Id,
        title: "RLS Test Prompt",
        description: "",
        category: "general",
        tags: [],
        config: {},
        built_prompt: "",
        enhanced_prompt: "",
        target_model: "",
        use_case: "",
      })
      .select("id")
      .single();
    if (savedPromptError || !savedPrompt?.id) {
      throw new Error(`Failed to create saved prompt: ${savedPromptError?.message || "missing id"}`);
    }
    savedPromptId = savedPrompt.id;

    const { data: post, error: postError } = await admin
      .from("community_posts")
      .insert({
        saved_prompt_id: savedPromptId,
        author_id: user1Id,
        title: "RLS Test Post",
        enhanced_prompt: "Sample",
        description: "",
        use_case: "",
        category: "general",
        tags: [],
        target_model: "",
        is_public: true,
        public_config: {},
        starter_prompt: "Starter",
        remix_note: "",
        remix_diff: null,
      })
      .select("id")
      .single();
    if (postError || !post?.id) {
      throw new Error(`Failed to create community post: ${postError?.message || "missing id"}`);
    }
    postId = post.id;

    const { data: vote, error: voteError } = await admin
      .from("community_votes")
      .insert({
        post_id: postId,
        user_id: user1Id,
        vote_type: "upvote",
      })
      .select("id")
      .single();
    if (voteError || !vote?.id) {
      throw new Error(`Failed to create community vote: ${voteError?.message || "missing id"}`);
    }
    voteId = vote.id;
  });

  afterAll(async () => {
    if (voteId) {
      await admin.from("community_votes").delete().eq("id", voteId);
    }
    if (postId) {
      await admin.from("community_posts").delete().eq("id", postId);
    }
    if (savedPromptId) {
      await admin.from("saved_prompts").delete().eq("id", savedPromptId);
    }
    if (user1Id) {
      await admin.auth.admin.deleteUser(user1Id);
    }
    if (user2Id) {
      await admin.auth.admin.deleteUser(user2Id);
    }
  });

  it("does not expose votes to anon or other users", async () => {
    const { data: anonData, error: anonError } = await anon
      .from("community_votes")
      .select("id")
      .eq("id", voteId);

    expect(anonError).toBeNull();
    expect(anonData).toEqual([]);

    const user2Client = createAnonClient();
    const { error: signInError } = await user2Client.auth.signInWithPassword({
      email: user2Email,
      password: user2Password,
    });
    if (signInError) {
      throw new Error(`Failed to sign in user2: ${signInError.message}`);
    }

    const { data: otherData, error: otherError } = await user2Client
      .from("community_votes")
      .select("id")
      .eq("id", voteId);

    expect(otherError).toBeNull();
    expect(otherData).toEqual([]);
  });

  it("allows the vote owner to read their vote", async () => {
    const user1Client = createAnonClient();
    const { error: signInError } = await user1Client.auth.signInWithPassword({
      email: user1Email,
      password: user1Password,
    });
    if (signInError) {
      throw new Error(`Failed to sign in user1: ${signInError.message}`);
    }

    const { data, error } = await user1Client
      .from("community_votes")
      .select("id")
      .eq("id", voteId);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0]?.id).toBe(voteId);
  });
});
````

## File: src/test/section-health.test.ts
````typescript
import { describe, expect, it } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
import { getSectionHealth } from "@/lib/section-health";

function buildConfig(overrides?: Partial<PromptConfig>): PromptConfig {
  return {
    ...defaultConfig,
    ...overrides,
    contextConfig: {
      ...defaultConfig.contextConfig,
      ...overrides?.contextConfig,
      sources: overrides?.contextConfig?.sources || [],
      databaseConnections: overrides?.contextConfig?.databaseConnections || [],
      rag: {
        ...defaultConfig.contextConfig.rag,
        ...overrides?.contextConfig?.rag,
      },
      structured: {
        ...defaultConfig.contextConfig.structured,
        ...overrides?.contextConfig?.structured,
      },
      interviewAnswers: overrides?.contextConfig?.interviewAnswers || [],
    },
  };
}

describe("getSectionHealth", () => {
  it("marks sections empty for untouched defaults", () => {
    const health = getSectionHealth(buildConfig(), 22);
    expect(health).toEqual({
      builder: "empty",
      context: "empty",
      tone: "empty",
      quality: "empty",
    });
  });

  it("marks builder and tone as complete once key signals are present", () => {
    const health = getSectionHealth(
      buildConfig({
        role: "Software Developer",
        task: "Refactor this function",
        format: ["Markdown"],
        constraints: ["Avoid jargon"],
        tone: "Technical",
        complexity: "Advanced",
      }),
      80,
    );

    expect(health.builder).toBe("complete");
    expect(health.tone).toBe("complete");
    expect(health.quality).toBe("complete");
  });

  it("marks context complete when at least three context channels are filled", () => {
    const health = getSectionHealth(
      buildConfig({
        contextConfig: {
          ...defaultConfig.contextConfig,
          sources: [
            {
              id: "src-1",
              type: "text",
              title: "Notes",
              rawContent: "Context notes",
              summary: "Context notes",
              addedAt: Date.now(),
            },
          ],
          structured: {
            ...defaultConfig.contextConfig.structured,
            audience: "Engineering managers",
          },
          projectNotes: "Ship by Friday with launch notes, QA checklist, and rollback plan.",
        },
      }),
      58,
    );

    expect(health.context).toBe("complete");
    expect(health.quality).toBe("in_progress");
  });

  it("marks tone in progress when only one tone control changed", () => {
    const health = getSectionHealth(
      buildConfig({
        tone: "Creative",
      }),
      45,
    );

    expect(health.tone).toBe("in_progress");
    expect(health.quality).toBe("empty");
  });
});
````

## File: src/test/setup.ts
````typescript
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
````

## File: src/test/text-diff.test.ts
````typescript
import { describe, expect, it } from "vitest";
import { buildLineDiff } from "@/lib/text-diff";

describe("buildLineDiff", () => {
  it("returns only context lines for identical text", () => {
    const diff = buildLineDiff("a\nb\nc", "a\nb\nc");
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.lines.every((line) => line.type === "context")).toBe(true);
  });

  it("marks removed and added lines in git-like order", () => {
    const diff = buildLineDiff("role\ntask\nformat", "role\ntask updated\nformat\nnotes");
    expect(diff.removed).toBe(1);
    expect(diff.added).toBe(2);
    expect(diff.lines.map((line) => `${line.type}:${line.value}`)).toEqual([
      "context:role",
      "remove:task",
      "add:task updated",
      "context:format",
      "add:notes",
    ]);
  });

  it("handles empty before/after payloads", () => {
    const addOnly = buildLineDiff("", "new line");
    expect(addOnly.removed).toBe(0);
    expect(addOnly.added).toBe(1);

    const removeOnly = buildLineDiff("old line", "");
    expect(removeOnly.removed).toBe(1);
    expect(removeOnly.added).toBe(0);
  });
});
````

## File: src/App.css
````css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}

@keyframes logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  a:nth-of-type(2) .logo {
    animation: logo-spin infinite 20s linear;
  }
}

.card {
  padding: 2em;
}

.read-the-docs {
  color: #888;
}
````

## File: components.json
````json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
````

## File: eslint.config.js
````javascript
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
````

## File: index.html
````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Prompt Pro — Prompt Builder & Community</title>
    <meta name="description" content="Build, enhance, and share AI prompts with structured context, scoring, and community collaboration." />
    <meta name="author" content="Lakefront Digital" />

    <meta property="og:title" content="AI Prompt Pro" />
    <meta property="og:description" content="Build, enhance, and share AI prompts with structured context, scoring, and community collaboration." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://prompt.lakefrontdigital.io" />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="AI Prompt Pro" />
    <meta name="twitter:description" content="Build, enhance, and share AI prompts with structured context, scoring, and community collaboration." />
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
````

## File: postcss.config.js
````javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
````

## File: tsconfig.app.json
````json
{
  "compilerOptions": {
    "types": ["vitest/globals"],
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitAny": false,
    "noFallthroughCasesInSwitch": false,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
````

## File: tsconfig.json
````json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "noImplicitAny": false,
    "noUnusedParameters": false,
    "skipLibCheck": true,
    "allowJs": true,
    "noUnusedLocals": false,
    "strictNullChecks": false
  }
}
````

## File: tsconfig.node.json
````json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
````

## File: vite.config.ts
````typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
````

## File: vitest.config.ts
````typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
````

## File: agent_service/main.py
````python
import json
import os
from functools import lru_cache
from typing import Annotated, Any, AsyncIterator, Mapping

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agent_framework import HostedWebSearchTool
from agent_framework.azure import AzureOpenAIResponsesClient
from agent_framework.observability import configure_otel_providers
from azure.identity import AzureCliCredential

# ---------------------------------------------------------------------------
# Observability – OpenTelemetry auto-instrumentation for agent spans/metrics.
# Reads standard OpenTelemetry env vars automatically:
#   ENABLE_INSTRUMENTATION=true        – master switch (disabled by default)
#   ENABLE_CONSOLE_EXPORTERS=true      – emit spans/metrics to stdout
#   OTEL_EXPORTER_OTLP_ENDPOINT=…      – send to an OTLP collector
#   ENABLE_SENSITIVE_DATA=true          – include prompt/completion text in spans
# ---------------------------------------------------------------------------
if os.getenv("ENABLE_INSTRUMENTATION", "").strip().lower() in {"1", "true", "yes", "on"}:
    configure_otel_providers()

MAX_PROMPT_CHARS = int(os.getenv("MAX_PROMPT_CHARS", "16000"))

PROMPT_ENHANCER_INSTRUCTIONS = """You are an expert prompt engineer. Your job is to take a structured prompt and enhance it to be more effective, clear, and optimized for large language models.

Rules:
- Keep the original intent perfectly intact
- Improve clarity, specificity, and structure
- Add helpful instructions the user may have missed
- Use clear section headers (Role, Task, Context, Format, Constraints)
- Be concise but thorough
- Return ONLY the enhanced prompt text, no explanations or meta-commentary
- Do not wrap in markdown code blocks
- Maintain a professional and direct tone
- Use available tools when useful to verify structure before finalizing"""

CORE_SECTIONS = ("Role", "Task", "Context", "Format", "Constraints")


class EnhanceRequest(BaseModel):
    prompt: str


class HealthResponse(BaseModel):
    ok: bool
    deployment: str


def inspect_prompt_structure(
    prompt: Annotated[str, Field(description="The prompt draft to inspect for required sections.")],
) -> dict[str, object]:
    """Inspect a prompt draft and report whether core sections are present."""
    normalized = prompt.lower()

    def has_section(name: str) -> bool:
        token = name.lower()
        patterns = (
            f"{token}:",
            f"{token} -",
            f"## {token}",
            f"### {token}",
            f"[{token}]",
        )
        return any(pattern in normalized for pattern in patterns)

    present = [section for section in CORE_SECTIONS if has_section(section)]
    missing = [section for section in CORE_SECTIONS if section not in present]
    return {
        "present_sections": present,
        "missing_sections": missing,
        "char_count": len(prompt),
    }


def _normalize_enum(name: str, value: str, allowed: tuple[str, ...]) -> str:
    normalized = value.strip().lower()
    if normalized not in allowed:
        raise RuntimeError(
            f"{name} has invalid value '{value}'. Allowed values: {', '.join(allowed)}"
        )
    return normalized


def _normalize_bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(
        f"{name} has invalid value '{raw}'. Allowed values: true/false, 1/0, yes/no, on/off."
    )


def _build_agent_tools() -> list[object]:
    tools: list[object] = [inspect_prompt_structure]
    if not _normalize_bool_env("ENABLE_HOSTED_WEB_SEARCH", default=False):
        return tools

    city = os.getenv("HOSTED_WEB_SEARCH_CITY")
    country = os.getenv("HOSTED_WEB_SEARCH_COUNTRY")
    region = os.getenv("HOSTED_WEB_SEARCH_REGION")

    location_payload: dict[str, str] = {}
    if city and city.strip():
        location_payload["city"] = city.strip()
    if country and country.strip():
        location_payload["country"] = country.strip()
    if region and region.strip():
        location_payload["region"] = region.strip()

    additional_properties = {"user_location": location_payload} if location_payload else None
    tools.append(
        HostedWebSearchTool(
            description="Search the web for up-to-date, factual context when needed.",
            additional_properties=additional_properties,
        )
    )
    return tools


def _build_run_options() -> dict[str, object]:
    options: dict[str, object] = {}
    max_output_tokens = os.getenv("AZURE_OPENAI_MAX_OUTPUT_TOKENS")
    reasoning_effort = os.getenv("AZURE_OPENAI_REASONING_EFFORT")
    reasoning_summary = os.getenv("AZURE_OPENAI_REASONING_SUMMARY")
    text_verbosity = os.getenv("AZURE_OPENAI_TEXT_VERBOSITY")

    if max_output_tokens:
        try:
            value = int(max_output_tokens)
        except ValueError as exc:
            raise RuntimeError("AZURE_OPENAI_MAX_OUTPUT_TOKENS must be an integer.") from exc
        if value <= 0:
            raise RuntimeError("AZURE_OPENAI_MAX_OUTPUT_TOKENS must be greater than 0.")
        options["max_output_tokens"] = value

    reasoning: dict[str, str] = {}
    if reasoning_effort:
        reasoning["effort"] = _normalize_enum(
            "AZURE_OPENAI_REASONING_EFFORT",
            reasoning_effort,
            ("none", "minimal", "low", "medium", "high", "xhigh"),
        )
    if reasoning_summary:
        reasoning["summary"] = _normalize_enum(
            "AZURE_OPENAI_REASONING_SUMMARY",
            reasoning_summary,
            ("auto", "concise", "detailed"),
        )
    if reasoning:
        options["reasoning"] = reasoning

    if text_verbosity:
        options["text"] = {
            "verbosity": _normalize_enum(
                "AZURE_OPENAI_TEXT_VERBOSITY",
                text_verbosity,
                ("low", "medium", "high"),
            )
        }

    return options


def _resolve_deployment_name() -> str:
    return os.getenv("AZURE_OPENAI_RESPONSES_DEPLOYMENT_NAME", "gpt-5.2")


def _derive_responses_base_url(endpoint: str) -> str:
    normalized = endpoint.strip()
    if not normalized:
        raise RuntimeError("AZURE_OPENAI_ENDPOINT must not be empty when provided.")
    if normalized.endswith("/openai/v1/"):
        return normalized
    if normalized.endswith("/openai/v1"):
        return f"{normalized}/"
    return f"{normalized.rstrip('/')}/openai/v1/"


def _build_responses_client() -> AzureOpenAIResponsesClient:
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    base_url = os.getenv("AZURE_OPENAI_BASE_URL")
    if endpoint is not None:
        endpoint = endpoint.strip() or None
    if base_url is not None:
        base_url = base_url.strip() or None
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "preview")
    deployment_name = _resolve_deployment_name()
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    ad_token = os.getenv("AZURE_OPENAI_AD_TOKEN")
    token_endpoint = os.getenv("AZURE_OPENAI_TOKEN_ENDPOINT")
    instruction_role = os.getenv("AZURE_OPENAI_INSTRUCTION_ROLE")
    env_file_path = os.getenv("AZURE_OPENAI_ENV_FILE_PATH")
    env_file_encoding = os.getenv("AZURE_OPENAI_ENV_FILE_ENCODING")
    default_headers_raw = os.getenv("AZURE_OPENAI_DEFAULT_HEADERS_JSON")

    if not endpoint and not base_url:
        raise RuntimeError("Either AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_BASE_URL is required.")

    # Agent Framework may build a deployment-scoped base URL from endpoint-only config.
    # For Responses API we want the v1 base URL when no explicit base_url is supplied.
    if endpoint and not base_url:
        base_url = _derive_responses_base_url(endpoint)

    default_headers: Mapping[str, str] | None = None
    if default_headers_raw and default_headers_raw.strip():
        try:
            parsed = json.loads(default_headers_raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError("AZURE_OPENAI_DEFAULT_HEADERS_JSON must be valid JSON.") from exc
        if not isinstance(parsed, dict) or not all(
            isinstance(key, str) and isinstance(value, str) for key, value in parsed.items()
        ):
            raise RuntimeError(
                "AZURE_OPENAI_DEFAULT_HEADERS_JSON must be a JSON object of string keys and values."
            )
        default_headers = parsed

    client_kwargs: dict[str, Any] = {
        "deployment_name": deployment_name,
        "api_version": api_version,
    }

    if endpoint:
        client_kwargs["endpoint"] = endpoint
    if base_url:
        client_kwargs["base_url"] = base_url
    if token_endpoint:
        client_kwargs["token_endpoint"] = token_endpoint
    if instruction_role:
        client_kwargs["instruction_role"] = instruction_role
    if env_file_path:
        client_kwargs["env_file_path"] = env_file_path
    if env_file_encoding:
        client_kwargs["env_file_encoding"] = env_file_encoding
    if default_headers:
        client_kwargs["default_headers"] = default_headers

    if api_key:
        client_kwargs["api_key"] = api_key
    elif ad_token:
        client_kwargs["ad_token"] = ad_token
    else:
        client_kwargs["credential"] = AzureCliCredential()

    return AzureOpenAIResponsesClient(**client_kwargs)


@lru_cache(maxsize=1)
def get_agent() -> Any:
    client = _build_responses_client()
    agent_kwargs = {
        "name": "PromptEnhancer",
        "instructions": PROMPT_ENHANCER_INSTRUCTIONS,
        "tools": _build_agent_tools(),
    }

    as_agent = getattr(client, "as_agent", None)
    if callable(as_agent):
        return as_agent(**agent_kwargs)

    # Backward-compat fallback for older agent-framework-core releases.
    create_agent = getattr(client, "create_agent", None)
    if callable(create_agent):
        try:
            return create_agent(**agent_kwargs)
        except TypeError:
            # Some legacy versions used positional parameters for these fields.
            return create_agent(
                agent_kwargs["name"],
                agent_kwargs["instructions"],
                agent_kwargs["tools"],
            )

    raise RuntimeError(
        "Installed agent-framework-core client does not provide as_agent/create_agent. "
        "Upgrade agent-framework-core to a supported version."
    )


def _validate_service_token(header_token: str | None) -> None:
    expected_token = os.getenv("AGENT_SERVICE_TOKEN")
    if expected_token and header_token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid or missing service token.")


async def _stream_sse(prompt: str) -> AsyncIterator[str]:
    agent = get_agent()
    message = f"Please enhance this prompt:\n\n{prompt}"
    run_options = _build_run_options()

    try:
        async for chunk in agent.run_stream(message, options=run_options):
            text = getattr(chunk, "text", None)
            if not text:
                continue

            # Emit a Chat Completions-compatible SSE chunk so the existing client parser keeps working.
            payload = {"choices": [{"delta": {"content": text}}]}
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

        yield "data: [DONE]\n\n"
    except Exception as exc:  # pragma: no cover - defensive streaming fallback
        error_payload = {"error": str(exc)}
        yield f"data: {json.dumps(error_payload, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"


app = FastAPI(title="Prompt Enhancer Agent Service", version="1.0.0")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(ok=True, deployment=_resolve_deployment_name())


@app.post("/enhance")
async def enhance(
    body: EnhanceRequest,
    x_agent_token: str | None = Header(default=None),
) -> StreamingResponse:
    _validate_service_token(x_agent_token)

    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required.")

    if len(prompt) > MAX_PROMPT_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Prompt is too large. Maximum {MAX_PROMPT_CHARS} characters.",
        )

    # Validate configuration before starting the stream so config errors are returned as JSON.
    try:
        get_agent()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return StreamingResponse(
        _stream_sse(prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
````

## File: agent_service/requirements.txt
````
agent-framework-core>=1.0.0b0
azure-identity>=1.21.0
fastapi>=0.116.1
uvicorn[standard]>=0.35.0
opentelemetry-exporter-otlp-proto-grpc>=1.30.0
````

## File: src/components/ContextInterview.tsx
````typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { MessageSquareText, ChevronRight, Check } from "lucide-react";
import { interviewQuestions } from "@/lib/context-types";
import type { InterviewAnswer } from "@/lib/context-types";
import { cn } from "@/lib/utils";

interface ContextInterviewProps {
  answers: InterviewAnswer[];
  onUpdate: (answers: InterviewAnswer[]) => void;
}

export function ContextInterview({ answers, onUpdate }: ContextInterviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const getAnswer = (qId: string) => answers.find((a) => a.questionId === qId)?.answer || "";

  const setAnswer = (qId: string, question: string, answer: string) => {
    const existing = answers.filter((a) => a.questionId !== qId);
    onUpdate([...existing, { questionId: qId, question, answer }]);
  };

  const answeredCount = answers.filter((a) => a.answer.trim()).length;
  const currentQ = interviewQuestions[currentStep];

  if (!expanded) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="interactive-chip w-full gap-2 text-xs justify-between"
          onClick={() => setExpanded(true)}
        >
          <span className="flex items-center gap-2">
            <MessageSquareText className="w-3.5 h-3.5" />
            Ask me for missing context
          </span>
          {answeredCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {answeredCount}/{interviewQuestions.length}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">
            Context interview ({currentStep + 1}/{interviewQuestions.length})
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="interactive-chip h-6 text-xs"
          onClick={() => setExpanded(false)}
        >
          Minimize
        </Button>
      </div>

      <p className="text-sm font-medium text-foreground">{currentQ.question}</p>

      {currentQ.options ? (
        <div className="flex flex-wrap gap-2">
          {currentQ.options.map((opt) => {
            const selected = getAnswer(currentQ.id) === opt;
            return (
              <button
                type="button"
                key={opt}
                className={cn(
                  badgeVariants({ variant: selected ? "default" : "outline" }),
                  "interactive-chip cursor-pointer select-none text-xs"
                )}
                onClick={() => setAnswer(currentQ.id, currentQ.question, selected ? "" : opt)}
                aria-pressed={selected}
              >
                {selected && <Check className="w-3 h-3 mr-1" />}
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <Input
          placeholder="Type your answer..."
          value={getAnswer(currentQ.id)}
          onChange={(e) => setAnswer(currentQ.id, currentQ.question, e.target.value)}
          className="bg-background h-9 text-sm"
        />
      )}

      <div className="flex justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="interactive-chip text-xs"
          disabled={currentStep === 0}
          onClick={() => setCurrentStep((s) => s - 1)}
        >
          Previous
        </Button>
        {currentStep < interviewQuestions.length - 1 ? (
          <Button
            variant="outline"
            size="sm"
            className="interactive-chip text-xs gap-1"
            onClick={() => setCurrentStep((s) => s + 1)}
          >
            Next
            <ChevronRight className="w-3 h-3" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="interactive-chip text-xs gap-1"
            onClick={() => setExpanded(false)}
          >
            <Check className="w-3 h-3" />
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
````

## File: src/components/QualityScore.tsx
````typescript
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface QualityScoreProps {
  score: {
    total: number;
    clarity: number;
    context: number;
    specificity: number;
    structure: number;
    tips: string[];
  };
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}/{max}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

export function QualityScore({ score }: QualityScoreProps) {
  const getColor = (total: number) => {
    if (total >= 75) return "text-primary";
    if (total >= 50) return "text-accent-foreground";
    return "text-destructive";
  };

  return (
    <Card className="p-3 sm:p-4 bg-card border-border">
      <div className="flex items-center gap-3 mb-3 sm:mb-4">
        <div className={`text-2xl sm:text-3xl font-bold ${getColor(score.total)}`}>{score.total}</div>
        <div>
          <p className="text-sm font-medium text-foreground">Quality Score</p>
          <p className="text-xs text-muted-foreground">out of 100</p>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
        <ScoreBar label="Clarity" value={score.clarity} max={25} />
        <ScoreBar label="Context" value={score.context} max={25} />
        <ScoreBar label="Specificity" value={score.specificity} max={25} />
        <ScoreBar label="Structure" value={score.structure} max={25} />
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        {score.tips.map((tip, i) => (
          <div key={i} className="flex gap-2 text-xs">
            {score.total >= 75 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <span className="text-muted-foreground">{tip}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
````

## File: src/components/ToneControls.tsx
````typescript
import { Button } from "@/components/ui/button";
import { toneOptions, complexityOptions } from "@/lib/prompt-builder";

interface ToneControlsProps {
  tone: string;
  complexity: string;
  onUpdate: (updates: { tone?: string; complexity?: string }) => void;
}

export function ToneControls({ tone, complexity, onUpdate }: ToneControlsProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2">
        <label className="text-xs sm:text-sm font-medium text-foreground">Tone</label>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {toneOptions.map((t) => (
            <Button
              key={t}
              variant={tone === t ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdate({ tone: t })}
              className="text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs sm:text-sm font-medium text-foreground">Complexity</label>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {complexityOptions.map((c) => (
            <Button
              key={c}
              variant={complexity === c ? "default" : "outline"}
              size="sm"
              onClick={() => onUpdate({ complexity: c })}
              className="text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
````

## File: src/components/VersionHistory.tsx
````typescript
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, RotateCcw } from "lucide-react";

interface Version {
  id: string;
  name: string;
  prompt: string;
  timestamp: number;
}

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: Version[];
  onRestore: (prompt: string) => void;
}

export function VersionHistory({ open, onOpenChange, versions, onRestore }: VersionHistoryProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[400px] md:w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-foreground">Version History</SheetTitle>
        </SheetHeader>
        <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
          {versions.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No saved versions yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Save a prompt to see it here.</p>
            </div>
          ) : (
            versions.map((version) => (
              <Card key={version.id} className="p-3 sm:p-4 group">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{version.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(version.timestamp).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 sm:mt-2 line-clamp-3 font-mono">
                      {version.prompt}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1 text-xs"
                    onClick={() => {
                      onRestore(version.prompt);
                      onOpenChange(false);
                    }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
````

## File: src/hooks/use-mobile.tsx
````typescript
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
````

## File: src/integrations/supabase/client.ts
````typescript
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  (SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : undefined);
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing Supabase env. Set VITE_SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID) and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
````

## File: src/lib/context-types.ts
````typescript
export type ContextSourceType = "text" | "url" | "file" | "database" | "rag";
export type SourceValidationStatus = "unknown" | "valid" | "stale" | "invalid";

export interface ContextReference {
  kind: "url" | "file" | "database" | "rag";
  refId: string;
  locator: string;
  permissionScope?: string;
}

export interface SourceValidation {
  status: SourceValidationStatus;
  checkedAt?: number;
  message?: string;
}

export interface ContextSource {
  id: string;
  type: ContextSourceType;
  title: string;
  rawContent: string;
  summary: string;
  addedAt: number;
  reference?: ContextReference;
  validation?: SourceValidation;
}

export interface DatabaseConnection {
  id: string;
  label: string;
  provider: "postgres" | "mysql" | "sqlite" | "mongodb" | "other";
  connectionRef: string;
  database: string;
  schema?: string;
  tables: string[];
  readOnly: boolean;
  lastValidatedAt?: number;
}

export interface RagParameters {
  enabled: boolean;
  vectorStoreRef: string;
  namespace: string;
  topK: number;
  minScore: number;
  retrievalStrategy: "semantic" | "hybrid" | "keyword";
  documentRefs: string[];
  chunkWindow: number;
}

export interface StructuredContext {
  audience: string;
  product: string;
  offer: string;
  mustInclude: string;
  excludedTopics: string;
}

export interface InterviewAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface ContextConfig {
  sources: ContextSource[];
  databaseConnections: DatabaseConnection[];
  rag: RagParameters;
  structured: StructuredContext;
  interviewAnswers: InterviewAnswer[];
  useDelimiters: boolean;
  projectNotes: string;
}

export const defaultContextConfig: ContextConfig = {
  sources: [],
  databaseConnections: [],
  rag: {
    enabled: false,
    vectorStoreRef: "",
    namespace: "",
    topK: 5,
    minScore: 0.2,
    retrievalStrategy: "hybrid",
    documentRefs: [],
    chunkWindow: 3,
  },
  structured: {
    audience: "",
    product: "",
    offer: "",
    mustInclude: "",
    excludedTopics: "",
  },
  interviewAnswers: [],
  useDelimiters: true,
  projectNotes: "",
};

export const structuredFieldsMeta: {
  key: keyof StructuredContext;
  label: string;
  placeholder: string;
  examples: string[];
}[] = [
  {
    key: "audience",
    label: "Audience",
    placeholder: "Who is this for?",
    examples: [
      "Marketing managers at B2B SaaS companies",
      "First-year university students studying biology",
      "Non-technical startup founders",
    ],
  },
  {
    key: "product",
    label: "Product / Subject",
    placeholder: "What product, topic, or subject is this about?",
    examples: [
      "A project management tool for remote teams",
      "The French Revolution (1789–1799)",
      "React Server Components",
    ],
  },
  {
    key: "offer",
    label: "Goal / Offer",
    placeholder: "What are you offering or trying to achieve?",
    examples: [
      "Free 14-day trial with no credit card required",
      "A comprehensive summary for exam prep",
      "A persuasive pitch deck for Series A investors",
    ],
  },
  {
    key: "mustInclude",
    label: "Must-include facts",
    placeholder: "Key facts, data, or points that must appear",
    examples: [
      "Revenue grew 200% YoY; 10k active users",
      "Must mention GDPR compliance and SOC 2",
      "Include the 3 main causes and 5 consequences",
    ],
  },
  {
    key: "excludedTopics",
    label: "Excluded topics",
    placeholder: "What should the model NOT cover?",
    examples: [
      "Don't mention competitor pricing",
      "Avoid medical advice or diagnoses",
      "Skip implementation details; focus on concepts",
    ],
  },
];

export const interviewQuestions = [
  {
    id: "goal",
    question: "Which of these best describes your goal?",
    options: [
      "Create new content from scratch",
      "Rewrite or improve existing content",
      "Analyze or summarize information",
      "Generate structured data or code",
      "Brainstorm or explore ideas",
    ],
  },
  {
    id: "success",
    question: "What does a successful output look like? (one sentence)",
    options: null, // free text
  },
  {
    id: "inputs",
    question: "What inputs do you have available?",
    options: [
      "Raw notes or bullet points",
      "Existing document(s) to reference",
      "URLs or web sources",
      "Data in spreadsheet/CSV/JSON",
      "Nothing yet — starting from scratch",
    ],
  },
  {
    id: "constraints",
    question: "What should the model NOT do?",
    options: [
      "Don't invent facts or statistics",
      "Don't use overly technical language",
      "Don't exceed a specific word count",
      "Don't include opinions — facts only",
      "No specific constraints",
    ],
  },
  {
    id: "audience_level",
    question: "How much does your audience already know about this topic?",
    options: [
      "Complete beginners",
      "Some familiarity",
      "Intermediate practitioners",
      "Advanced experts",
    ],
  },
];

function splitIntoSentences(content: string): string[] {
  const normalized = content.replace(/\n+/g, " ").trim();
  if (!normalized) return [];
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char !== "." && char !== "!" && char !== "?") continue;

    const next = normalized[i + 1];
    if (next !== " " && next !== undefined) continue;

    const sentence = normalized.slice(start, i + 1).trim();
    if (sentence) sentences.push(sentence);

    let j = i + 1;
    while (normalized[j] === " ") j += 1;
    start = j;
    i = j - 1;
  }

  const tail = normalized.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

export function summarizeSource(content: string): string {
  const sentences = splitIntoSentences(content).filter((s) => s.trim().length > 10);

  if (sentences.length <= 5) {
    return sentences.map((s) => `• ${s.trim()}`).join("\n");
  }

  // Pick the first 3 and last 2 sentences as a heuristic summary.
  const picked = [...sentences.slice(0, 3), ...sentences.slice(-2)];
  return picked.map((s) => `• ${s.trim()}`).join("\n");
}

export function buildContextBlock(ctx: ContextConfig, useDelimiters: boolean): string {
  const sections: string[] = [];

  // Structured fields
  const structuredParts: string[] = [];
  const { structured } = ctx;
  if (structured.audience) structuredParts.push(`Audience: ${structured.audience}`);
  if (structured.product) structuredParts.push(`Subject: ${structured.product}`);
  if (structured.offer) structuredParts.push(`Goal: ${structured.offer}`);
  if (structured.mustInclude) structuredParts.push(`Must include: ${structured.mustInclude}`);
  if (structured.excludedTopics) structuredParts.push(`Excluded: ${structured.excludedTopics}`);

  if (structuredParts.length > 0) {
    if (useDelimiters) {
      sections.push(`<background>\n${structuredParts.join("\n")}\n</background>`);
    } else {
      sections.push(`**Background:**\n${structuredParts.join("\n")}`);
    }
  }

  // Sources
  if (ctx.sources.length > 0) {
    const sourceLines = ctx.sources.map(
      (s) =>
        `[${s.type.toUpperCase()}: ${s.title}]` +
        (s.reference ? ` [ref=${s.reference.refId}]` : "") +
        `\n${s.summary}`
    );
    if (useDelimiters) {
      sections.push(`<sources>\n${sourceLines.join("\n\n")}\n</sources>`);
    } else {
      sections.push(`**Sources:**\n${sourceLines.join("\n\n")}`);
    }
  }

  // Database connections
  if (ctx.databaseConnections.length > 0) {
    const dbLines = ctx.databaseConnections.map((db) => {
      const tableSegment = db.tables.length > 0 ? ` tables=${db.tables.join(",")}` : "";
      const schemaSegment = db.schema ? ` schema=${db.schema}` : "";
      return `[DB: ${db.label}] ref=${db.connectionRef} db=${db.database}${schemaSegment}${tableSegment} readOnly=${db.readOnly}`;
    });
    if (useDelimiters) {
      sections.push(`<database-connections>\n${dbLines.join("\n")}\n</database-connections>`);
    } else {
      sections.push(`**Database Connections:**\n${dbLines.join("\n")}`);
    }
  }

  // RAG parameters
  if (ctx.rag.enabled && ctx.rag.vectorStoreRef.trim()) {
    const ragLines = [
      `vectorStoreRef: ${ctx.rag.vectorStoreRef}`,
      `namespace: ${ctx.rag.namespace || "default"}`,
      `retrievalStrategy: ${ctx.rag.retrievalStrategy}`,
      `topK: ${ctx.rag.topK}`,
      `minScore: ${ctx.rag.minScore}`,
      `chunkWindow: ${ctx.rag.chunkWindow}`,
      ctx.rag.documentRefs.length > 0 ? `documentRefs: ${ctx.rag.documentRefs.join(", ")}` : "",
    ].filter(Boolean);

    if (useDelimiters) {
      sections.push(`<rag-parameters>\n${ragLines.join("\n")}\n</rag-parameters>`);
    } else {
      sections.push(`**RAG Parameters:**\n${ragLines.join("\n")}`);
    }
  }

  // Project notes
  if (ctx.projectNotes.trim()) {
    if (useDelimiters) {
      sections.push(`<project-notes>\n${ctx.projectNotes.trim()}\n</project-notes>`);
    } else {
      sections.push(`**Project Notes:**\n${ctx.projectNotes.trim()}`);
    }
  }

  // Interview answers
  const answeredQ = ctx.interviewAnswers.filter((a) => a.answer.trim());
  if (answeredQ.length > 0) {
    const qaLines = answeredQ.map((a) => `Q: ${a.question}\nA: ${a.answer}`);
    if (useDelimiters) {
      sections.push(`<context-interview>\n${qaLines.join("\n\n")}\n</context-interview>`);
    } else {
      sections.push(`**Context Interview:**\n${qaLines.join("\n\n")}`);
    }
  }

  return sections.join("\n\n");
}

export function scoreContext(ctx: ContextConfig): {
  score: number;
  checks: { label: string; met: boolean; tip: string }[];
} {
  const checks: { label: string; met: boolean; tip: string }[] = [];

  const hasObjective =
    ctx.structured.offer.trim().length > 0 ||
    ctx.interviewAnswers.some((a) => a.questionId === "goal" && a.answer.trim());
  checks.push({
    label: "Clear objective",
    met: hasObjective,
    tip: "Fill in the Goal/Offer field or complete the context interview.",
  });

  const hasBackground =
    ctx.structured.audience.trim().length > 0 ||
    ctx.structured.product.trim().length > 0 ||
    ctx.sources.length > 0;
  checks.push({
    label: "Enough background",
    met: hasBackground,
    tip: "Add audience, subject info, or attach source material.",
  });

  const hasConstraints =
    ctx.structured.excludedTopics.trim().length > 0 ||
    ctx.interviewAnswers.some((a) => a.questionId === "constraints" && a.answer.trim());
  checks.push({
    label: "Defined constraints",
    met: hasConstraints,
    tip: "Specify excluded topics or constraints so the model knows boundaries.",
  });

  const hasExample =
    ctx.structured.mustInclude.trim().length > 0 || ctx.sources.length > 0;
  checks.push({
    label: "Supporting evidence",
    met: hasExample,
    tip: "Add must-include facts or attach a source for grounded output.",
  });

  const metCount = checks.filter((c) => c.met).length;
  const score = Math.round((metCount / checks.length) * 100);

  return { score, checks };
}
````

## File: src/lib/persistence.ts
````typescript
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { RemixDiff } from "@/lib/community";
import { normalizePromptCategory } from "@/lib/prompt-categories";
import type { PromptConfig } from "@/lib/prompt-builder";
import { defaultConfig } from "@/lib/prompt-builder";
import {
  escapePostgrestLikePattern,
  isPostgrestError,
  normalizePromptTagsOptional,
  type SavedPromptListRow,
  type SavedPromptRow,
} from "@/lib/saved-prompt-shared";
import {
  collectTemplateWarnings,
  computeTemplateFingerprint,
  deriveExternalReferencesFromConfig,
  inferTemplateStarterPrompt,
  listTemplateSummaries as listLocalTemplates,
  loadTemplateById as loadLocalTemplate,
  normalizeTemplateConfig,
  saveTemplateSnapshot as saveLocalTemplate,
  deleteTemplateById as deleteLocalTemplate,
  type TemplateSummary,
  type TemplateLoadResult,
  type SaveTemplateResult,
  type TemplateSaveInput,
} from "@/lib/template-store";

const DRAFT_KEY = "promptforge-draft";
const SAVED_PROMPT_FULL_SELECT_COLUMNS =
  "id, user_id, title, description, category, tags, config, built_prompt, enhanced_prompt, fingerprint, revision, is_shared, target_model, use_case, remixed_from, remix_note, remix_diff, created_at, updated_at";
const SAVED_PROMPT_LIST_SELECT_COLUMNS =
  "id, user_id, title, description, category, tags, config, fingerprint, revision, is_shared, target_model, use_case, remixed_from, created_at, updated_at";

type PersistenceErrorCode = "unauthorized" | "conflict" | "network" | "unknown";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PersistenceError";
    this.code = code;
  }
}

export interface PromptSummary extends TemplateSummary {
  category: string;
  isShared: boolean;
  targetModel: string;
  useCase: string;
  remixedFrom: string | null;
  builtPrompt: string;
  enhancedPrompt: string;
  upvoteCount: number;
  verifiedCount: number;
  remixCount: number;
  commentCount: number;
}

export interface PromptSaveInput extends TemplateSaveInput {
  category?: string;
  builtPrompt?: string;
  enhancedPrompt?: string;
  targetModel?: string;
  useCase?: string;
  isShared?: boolean;
  remixedFrom?: string | null;
  remixNote?: string;
  remixDiff?: RemixDiff | null;
}

export interface PromptShareInput {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  targetModel?: string;
  useCase?: string;
}

export function getPersistenceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function mapPostgrestError(error: PostgrestError, fallback: string): PersistenceError {
  const message = (error.message || fallback).trim() || fallback;
  const isUnauthorized =
    error.code === "42501" ||
    /row-level security|permission denied|insufficient privilege|not authenticated|jwt/i.test(message);

  if (isUnauthorized) {
    return new PersistenceError("unauthorized", message, { cause: error });
  }

  if (error.code === "23505") {
    return new PersistenceError("conflict", message, { cause: error });
  }

  return new PersistenceError("unknown", message, { cause: error });
}

function toPersistenceError(error: unknown, fallback: string): PersistenceError {
  if (error instanceof PersistenceError) return error;
  if (isPostgrestError(error)) return mapPostgrestError(error, fallback);
  if (error instanceof Error) {
    if (/network|failed to fetch|fetch failed|connection/i.test(error.message)) {
      return new PersistenceError("network", error.message, { cause: error });
    }
    return new PersistenceError("unknown", error.message || fallback, { cause: error });
  }
  return new PersistenceError("unknown", fallback, { cause: error });
}

function normalizeDescription(description?: string): string | undefined {
  if (description === undefined) return undefined;
  return description.trim().slice(0, 500);
}

function normalizeUseCase(useCase?: string): string | undefined {
  if (useCase === undefined) return undefined;
  return useCase.trim().slice(0, 500);
}

function normalizeTargetModel(targetModel?: string): string | undefined {
  if (targetModel === undefined) return undefined;
  return targetModel.trim().slice(0, 80);
}

function normalizeRemixNote(remixNote?: string): string | undefined {
  if (remixNote === undefined) return undefined;
  return remixNote.trim().slice(0, 500);
}

function toPresetName(value: string): string {
  const normalized = value.trim().slice(0, 200);
  return normalized || "Untitled Prompt";
}

// ---------------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------------

export async function loadDraft(userId: string | null): Promise<PromptConfig | null> {
  if (!userId) {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as PromptConfig) : null;
    } catch {
      return null;
    }
  }

  try {
    const { data, error } = await supabase
      .from("drafts")
      .select("config")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to load cloud draft.");
    if (!data) return null;
    return data.config as unknown as PromptConfig;
  } catch (error) {
    throw toPersistenceError(error, "Failed to load cloud draft.");
  }
}

export async function saveDraft(userId: string | null, config: PromptConfig): Promise<void> {
  if (!userId) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
    } catch {
      // quota errors are intentionally ignored to keep the UI responsive
    }
    return;
  }

  try {
    const { error } = await supabase.from("drafts").upsert(
      {
        user_id: userId,
        config: config as unknown as Json,
      },
      { onConflict: "user_id" },
    );
    if (error) throw mapPostgrestError(error, "Failed to save cloud draft.");
  } catch (error) {
    throw toPersistenceError(error, "Failed to save cloud draft.");
  }
}

export function clearLocalDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Prompt persistence (saved_prompts)
// ---------------------------------------------------------------------------

export async function loadPrompts(userId: string | null): Promise<PromptSummary[]> {
  if (!userId) {
    return listLocalTemplates().map((template) => ({
      ...template,
      category: "general",
      isShared: false,
      targetModel: "",
      useCase: "",
      remixedFrom: null,
      builtPrompt: "",
      enhancedPrompt: "",
      upvoteCount: 0,
      verifiedCount: 0,
      remixCount: 0,
      commentCount: 0,
    }));
  }

  try {
    const { data, error } = await supabase
      .from("saved_prompts")
      .select(SAVED_PROMPT_LIST_SELECT_COLUMNS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw mapPostgrestError(error, "Failed to load prompts.");
    if (!data) return [];

    const savedRows = data as SavedPromptListRow[];
    const promptIds = savedRows.map((row) => row.id);
    const metricsByPromptId = new Map<
      string,
      {
        upvote_count: number;
        verified_count: number;
        remix_count: number;
        comment_count: number;
      }
    >();

    if (promptIds.length > 0) {
      const { data: postMetrics, error: postMetricsError } = await supabase
        .from("community_posts")
        .select("saved_prompt_id, upvote_count, verified_count, remix_count, comment_count")
        .in("saved_prompt_id", promptIds)
        .eq("is_public", true);

      if (!postMetricsError && postMetrics) {
        postMetrics.forEach((post) => {
          metricsByPromptId.set(post.saved_prompt_id, {
            upvote_count: post.upvote_count,
            verified_count: post.verified_count,
            remix_count: post.remix_count,
            comment_count: post.comment_count,
          });
        });
      }
    }

    return savedRows.map((savedRow) => {
      const metrics = metricsByPromptId.get(savedRow.id);
      const cfg = normalizeTemplateConfig((savedRow.config ?? defaultConfig) as unknown as PromptConfig);
      return {
        id: savedRow.id,
        name: savedRow.title,
        description: savedRow.description,
        tags: savedRow.tags ?? [],
        starterPrompt: inferTemplateStarterPrompt(cfg),
        updatedAt: new Date(savedRow.updated_at).getTime(),
        createdAt: new Date(savedRow.created_at).getTime(),
        revision: savedRow.revision,
        schemaVersion: 2,
        sourceCount: cfg.contextConfig.sources.length,
        databaseCount: cfg.contextConfig.databaseConnections.length,
        ragEnabled: cfg.contextConfig.rag.enabled,
        category: savedRow.category,
        isShared: savedRow.is_shared,
        targetModel: savedRow.target_model,
        useCase: savedRow.use_case,
        remixedFrom: savedRow.remixed_from,
        builtPrompt: "",
        enhancedPrompt: "",
        upvoteCount: metrics?.upvote_count ?? 0,
        verifiedCount: metrics?.verified_count ?? 0,
        remixCount: metrics?.remix_count ?? 0,
        commentCount: metrics?.comment_count ?? 0,
      } satisfies PromptSummary;
    });
  } catch (error) {
    throw toPersistenceError(error, "Failed to load prompts.");
  }
}

export async function loadPromptById(userId: string | null, id: string): Promise<TemplateLoadResult | null> {
  if (!userId) return loadLocalTemplate(id);

  try {
    const { data, error } = await supabase
      .from("saved_prompts")
      .select(SAVED_PROMPT_FULL_SELECT_COLUMNS)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to load prompt.");
    if (!data) return null;

    const row = data as SavedPromptRow;
    const cfg = normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
    return {
      record: rowToRecord(row, cfg),
      warnings: collectTemplateWarnings(cfg),
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to load prompt.");
  }
}

function hasMetadataChanges(existing: SavedPromptRow, input: PromptSaveInput): boolean {
  const normalizedDescription = normalizeDescription(input.description);
  const normalizedTags = normalizePromptTagsOptional(input.tags);
  const normalizedCategory = normalizePromptCategory(input.category);
  const normalizedUseCase = normalizeUseCase(input.useCase);
  const normalizedTargetModel = normalizeTargetModel(input.targetModel);
  const normalizedRemixNote = normalizeRemixNote(input.remixNote);

  if (normalizedDescription !== undefined && normalizedDescription !== existing.description) return true;
  if (normalizedCategory !== undefined && normalizedCategory !== existing.category) return true;
  if (normalizedUseCase !== undefined && normalizedUseCase !== existing.use_case) return true;
  if (normalizedTargetModel !== undefined && normalizedTargetModel !== existing.target_model) return true;
  if (normalizedRemixNote !== undefined && normalizedRemixNote !== existing.remix_note) return true;

  if (normalizedTags !== undefined) {
    const existingTags = existing.tags ?? [];
    if (
      normalizedTags.length !== existingTags.length ||
      normalizedTags.some((tag, index) => tag !== existingTags[index])
    ) {
      return true;
    }
  }

  if (input.builtPrompt !== undefined && input.builtPrompt !== existing.built_prompt) return true;
  if (input.enhancedPrompt !== undefined && input.enhancedPrompt !== existing.enhanced_prompt) return true;
  if (input.isShared !== undefined && input.isShared !== existing.is_shared) return true;
  if (input.remixedFrom !== undefined && input.remixedFrom !== existing.remixed_from) return true;
  if (input.remixDiff !== undefined && JSON.stringify(input.remixDiff) !== JSON.stringify(existing.remix_diff)) {
    return true;
  }

  return false;
}

export async function savePrompt(userId: string | null, input: PromptSaveInput): Promise<SaveTemplateResult> {
  if (!userId) {
    return saveLocalTemplate({
      name: toPresetName(input.name || ""),
      description: input.description,
      tags: input.tags,
      config: input.config,
    });
  }

  const name = toPresetName(input.name || "");
  if (!name) throw new PersistenceError("unknown", "Prompt title is required.");

  const normalizedConfig = normalizeTemplateConfig(input.config);
  const normalizedDescription = normalizeDescription(input.description);
  const normalizedCategory = normalizePromptCategory(input.category) ?? "general";
  const normalizedTargetModel = normalizeTargetModel(input.targetModel);
  const normalizedUseCase = normalizeUseCase(input.useCase);
  const normalizedRemixNote = normalizeRemixNote(input.remixNote);
  const fingerprint = computeTemplateFingerprint(normalizedConfig);
  const warnings = collectTemplateWarnings(normalizedConfig);
  const tags = normalizePromptTagsOptional(input.tags);

  try {
    const { data: existingRows, error: lookupError } = await supabase
      .from("saved_prompts")
      .select(SAVED_PROMPT_FULL_SELECT_COLUMNS)
      .eq("user_id", userId)
      .ilike("title", escapePostgrestLikePattern(name))
      .order("updated_at", { ascending: false })
      .limit(1);

    if (lookupError) throw mapPostgrestError(lookupError, "Failed to save prompt.");
    const existing = (existingRows?.[0] as SavedPromptRow | null) ?? null;

    if (existing?.fingerprint === fingerprint && !hasMetadataChanges(existing, input)) {
      return {
        outcome: "unchanged",
        record: rowToRecord(existing, normalizedConfig),
        warnings,
      };
    }

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        title: name,
        tags: tags ?? existing.tags ?? [],
        config: normalizedConfig as unknown as Json,
        fingerprint,
        revision: existing.revision + 1,
      };
      if (normalizedDescription !== undefined) {
        updatePayload.description = normalizedDescription;
      }
      if (input.category !== undefined) {
        updatePayload.category = normalizedCategory;
      }
      if (input.builtPrompt !== undefined) {
        updatePayload.built_prompt = input.builtPrompt;
      }
      if (input.enhancedPrompt !== undefined) {
        updatePayload.enhanced_prompt = input.enhancedPrompt;
      }
      if (normalizedTargetModel !== undefined) {
        updatePayload.target_model = normalizedTargetModel;
      }
      if (normalizedUseCase !== undefined) {
        updatePayload.use_case = normalizedUseCase;
      }
      if (input.isShared !== undefined) {
        updatePayload.is_shared = input.isShared;
      }
      if (input.remixedFrom !== undefined) {
        updatePayload.remixed_from = input.remixedFrom;
      }
      if (normalizedRemixNote !== undefined) {
        updatePayload.remix_note = normalizedRemixNote;
      }
      if (input.remixDiff !== undefined) {
        updatePayload.remix_diff = input.remixDiff as unknown as Json;
      }

      const { data: updated, error } = await supabase
        .from("saved_prompts")
        .update(updatePayload)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .eq("revision", existing.revision)
        .select(SAVED_PROMPT_FULL_SELECT_COLUMNS)
        .maybeSingle();

      if (error) throw mapPostgrestError(error, "Failed to update prompt.");
      if (!updated) {
        throw new PersistenceError("conflict", "Prompt was modified elsewhere. Please refresh and try again.");
      }
      return {
        outcome: "updated",
        record: rowToRecord(updated as SavedPromptRow, normalizedConfig),
        warnings,
      };
    }

    const { data: created, error: insertError } = await supabase
      .from("saved_prompts")
      .insert({
        user_id: userId,
        title: name,
        description: normalizedDescription ?? "",
        category: normalizedCategory,
        tags: tags ?? [],
        config: normalizedConfig as unknown as Json,
        built_prompt: input.builtPrompt ?? "",
        enhanced_prompt: input.enhancedPrompt ?? "",
        fingerprint,
        is_shared: input.isShared ?? false,
        target_model: normalizedTargetModel ?? "",
        use_case: normalizedUseCase ?? "",
        remixed_from: input.remixedFrom ?? null,
        remix_note: normalizedRemixNote ?? "",
        remix_diff: (input.remixDiff as unknown as Json) ?? null,
      })
      .select(SAVED_PROMPT_FULL_SELECT_COLUMNS)
      .single();

    if (insertError) {
      throw mapPostgrestError(insertError, "Failed to save prompt.");
    }
    if (!created) throw new PersistenceError("unknown", "Prompt save returned no data.");

    return {
      outcome: "created",
      record: rowToRecord(created as SavedPromptRow, normalizedConfig),
      warnings,
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to save prompt.");
  }
}

export async function sharePrompt(
  userId: string | null,
  id: string,
  input: PromptShareInput = {},
): Promise<boolean> {
  if (!userId) {
    throw new PersistenceError("unauthorized", "Sign in to share prompts.");
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("saved_prompts")
      .select("id, use_case")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) throw mapPostgrestError(existingError, "Failed to share prompt.");
    if (!existing) return false;

    const normalizedUseCaseInput = input.useCase !== undefined
      ? normalizeUseCase(input.useCase) ?? ""
      : undefined;
    const effectiveUseCase = (normalizedUseCaseInput ?? existing.use_case ?? "").trim();
    if (!effectiveUseCase) {
      throw new PersistenceError("unknown", "Use case is required before sharing.");
    }

    const updatePayload: Record<string, unknown> = {
      is_shared: true,
      use_case: effectiveUseCase,
    };

    if (input.title !== undefined) updatePayload.title = toPresetName(input.title);
    if (input.description !== undefined) updatePayload.description = normalizeDescription(input.description) ?? "";
    if (input.category !== undefined) updatePayload.category = normalizePromptCategory(input.category) ?? "general";
    if (input.tags !== undefined) updatePayload.tags = normalizePromptTagsOptional(input.tags) ?? [];
    if (input.targetModel !== undefined) updatePayload.target_model = normalizeTargetModel(input.targetModel) ?? "";

    const { data, error } = await supabase
      .from("saved_prompts")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to share prompt.");
    return !!data;
  } catch (error) {
    throw toPersistenceError(error, "Failed to share prompt.");
  }
}

export async function unsharePrompt(userId: string | null, id: string): Promise<boolean> {
  if (!userId) {
    throw new PersistenceError("unauthorized", "Sign in to unshare prompts.");
  }

  try {
    const { data, error } = await supabase
      .from("saved_prompts")
      .update({ is_shared: false })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to unshare prompt.");
    return !!data;
  } catch (error) {
    throw toPersistenceError(error, "Failed to unshare prompt.");
  }
}

export async function deletePrompt(userId: string | null, id: string): Promise<boolean> {
  if (!userId) return deleteLocalTemplate(id);

  try {
    const { data, error } = await supabase
      .from("saved_prompts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to delete prompt.");
    return !!data;
  } catch (error) {
    throw toPersistenceError(error, "Failed to delete prompt.");
  }
}

// ---------------------------------------------------------------------------
// Prompt versions
// ---------------------------------------------------------------------------

export interface PromptVersion {
  id: string;
  name: string;
  prompt: string;
  timestamp: number;
}

export async function loadVersions(userId: string | null): Promise<PromptVersion[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("prompt_versions")
      .select("id, name, prompt, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw mapPostgrestError(error, "Failed to load version history.");
    if (!data) return [];

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      prompt: row.prompt,
      timestamp: new Date(row.created_at).getTime(),
    }));
  } catch (error) {
    throw toPersistenceError(error, "Failed to load version history.");
  }
}

export async function saveVersion(
  userId: string | null,
  name: string,
  prompt: string,
): Promise<PromptVersion | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from("prompt_versions")
      .insert({ user_id: userId, name, prompt })
      .select("id, name, prompt, created_at")
      .single();

    if (error) throw mapPostgrestError(error, "Failed to save version.");
    if (!data) throw new PersistenceError("unknown", "Version save returned no data.");

    return {
      id: data.id,
      name: data.name,
      prompt: data.prompt,
      timestamp: new Date(data.created_at).getTime(),
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to save version.");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToRecord(row: SavedPromptRow, normalizedConfig?: PromptConfig) {
  const cfg = normalizedConfig || normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
  return {
    metadata: {
      id: row.id,
      name: row.title,
      description: row.description,
      tags: row.tags ?? [],
      schemaVersion: 2,
      revision: row.revision,
      fingerprint: row.fingerprint ?? "",
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      category: row.category,
      isShared: row.is_shared,
      targetModel: row.target_model,
      useCase: row.use_case,
      remixedFrom: row.remixed_from,
      builtPrompt: row.built_prompt,
      enhancedPrompt: row.enhanced_prompt,
    },
    state: {
      promptConfig: cfg,
      externalReferences: deriveExternalReferencesFromConfig(cfg),
    },
  };
}
````

## File: src/test/persistence.test.ts
````typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

function buildConfig(overrides?: Partial<PromptConfig>): PromptConfig {
  return {
    ...defaultConfig,
    ...overrides,
    contextConfig: {
      ...defaultConfig.contextConfig,
      ...overrides?.contextConfig,
      sources: overrides?.contextConfig?.sources || [],
      databaseConnections: overrides?.contextConfig?.databaseConnections || [],
      rag: {
        ...defaultConfig.contextConfig.rag,
        ...overrides?.contextConfig?.rag,
      },
      structured: {
        ...defaultConfig.contextConfig.structured,
        ...overrides?.contextConfig?.structured,
      },
      interviewAnswers: overrides?.contextConfig?.interviewAnswers || [],
    },
  };
}

function buildSavedPromptRow(config: PromptConfig, overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "tpl_1",
    user_id: "user_1",
    title: "Preset",
    description: "",
    category: "general",
    tags: [],
    built_prompt: "",
    enhanced_prompt: "",
    config,
    fingerprint: "fingerprint",
    revision: 1,
    is_shared: false,
    target_model: "",
    use_case: "",
    remixed_from: null,
    remix_note: "",
    remix_diff: null,
    created_at: "2026-02-09T00:00:00.000Z",
    updated_at: "2026-02-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("persistence", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("normalizes prompt payloads before cloud insert and preserves warnings", async () => {
    const { savePrompt } = await import("@/lib/persistence");
    let insertedPayload: Record<string, unknown> | null = null;

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          ilike: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });

    fromMock.mockReturnValueOnce({
      insert: (payload: Record<string, unknown>) => {
        insertedPayload = payload;
        return {
          select: () => ({
            single: async () => ({
              data: {
                id: "tpl_1",
                user_id: payload.user_id,
                title: payload.title,
                description: payload.description,
                category: payload.category,
                tags: payload.tags,
                built_prompt: payload.built_prompt,
                enhanced_prompt: payload.enhanced_prompt,
                config: payload.config,
                fingerprint: payload.fingerprint,
                revision: 1,
                is_shared: payload.is_shared,
                target_model: payload.target_model,
                use_case: payload.use_case,
                remixed_from: payload.remixed_from,
                remix_note: payload.remix_note,
                remix_diff: payload.remix_diff,
                created_at: "2026-02-09T00:00:00.000Z",
                updated_at: "2026-02-09T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        };
      },
    });

    const result = await savePrompt("user_1", {
      name: "Risky",
      config: buildConfig({
        task: "Investigate incident",
        contextConfig: {
          ...defaultConfig.contextConfig,
          sources: [
            {
              id: "url-1",
              type: "url",
              title: "Runbook",
              rawContent: "https://example.com/runbook",
              summary: "",
              addedAt: Date.now(),
            },
          ],
          databaseConnections: [
            {
              id: "db-1",
              label: "Primary",
              provider: "postgres",
              connectionRef: "",
              database: "app",
              schema: "public",
              tables: ["events"],
              readOnly: false,
            },
          ],
          rag: {
            ...defaultConfig.contextConfig.rag,
            enabled: true,
            vectorStoreRef: "",
            topK: 0,
          },
        },
      }),
    });

    const source = (insertedPayload?.config as PromptConfig).contextConfig.sources[0];
    expect(source.rawContent).toBe("");
    expect(typeof insertedPayload?.fingerprint).toBe("string");
    expect(result.outcome).toBe("created");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns false on delete when no row is removed", async () => {
    const { deletePrompt } = await import("@/lib/persistence");

    fromMock.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    await expect(deletePrompt("user_1", "missing")).resolves.toBe(false);
  });

  it("loads prompt summaries without selecting full prompt text blobs", async () => {
    const { loadPrompts } = await import("@/lib/persistence");
    const listRow = buildSavedPromptRow(buildConfig({ task: "Summarize logs" }));
    const { built_prompt, enhanced_prompt, remix_note, remix_diff, ...summaryRow } = listRow;
    void built_prompt;
    void enhanced_prompt;
    void remix_note;
    void remix_diff;

    let selectedColumns = "";

    fromMock.mockReturnValueOnce({
      select: (columns: string) => {
        selectedColumns = columns;
        return {
          eq: () => ({
            order: async () => ({ data: [summaryRow], error: null }),
          }),
        };
      },
    });

    fromMock.mockReturnValueOnce({
      select: () => ({
        in: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
    });

    const summaries = await loadPrompts("user_1");
    expect(selectedColumns).not.toContain("built_prompt");
    expect(selectedColumns).not.toContain("enhanced_prompt");
    expect(summaries[0]?.builtPrompt).toBe("");
    expect(summaries[0]?.enhancedPrompt).toBe("");
  });

  it("throws typed unauthorized errors for load failures", async () => {
    const { loadPromptById } = await import("@/lib/persistence");

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: {
                code: "42501",
                message: 'new row violates row-level security policy for table "saved_prompts"',
                details: "",
                hint: "",
              },
            }),
          }),
        }),
      }),
    });

    await expect(loadPromptById("user_1", "tpl_1")).rejects.toMatchObject({
      name: "PersistenceError",
      code: "unauthorized",
    });
  });

  it("escapes wildcard characters and uses revision locking when updating prompts", async () => {
    const { savePrompt } = await import("@/lib/persistence");
    const existingConfig = buildConfig({ task: "Current task" });
    const nextConfig = buildConfig({ task: "Updated task" });
    const existingRow = buildSavedPromptRow(existingConfig, {
      id: "tpl_existing",
      title: "100%_Coverage",
      description: "keep me",
      fingerprint: "old-fingerprint",
      revision: 4,
    });
    const updatedRow = buildSavedPromptRow(nextConfig, {
      id: "tpl_existing",
      title: "100%_Coverage",
      description: "",
      fingerprint: "new-fingerprint",
      revision: 5,
      updated_at: "2026-02-10T00:00:00.000Z",
    });

    let lookupPattern = "";
    let revisionFilter: number | null = null;
    let updatePayload: Record<string, unknown> | null = null;

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          ilike: (_column: string, pattern: string) => {
            lookupPattern = pattern;
            return {
              order: () => ({
                limit: async () => ({ data: [existingRow], error: null }),
              }),
            };
          },
        }),
      }),
    });

    const updateChain = {
      eq: vi.fn((column: string, value: unknown) => {
        if (column === "revision") revisionFilter = Number(value);
        return updateChain;
      }),
      select: vi.fn(() => ({
        maybeSingle: async () => ({ data: updatedRow, error: null }),
      })),
    };

    fromMock.mockReturnValueOnce({
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        return updateChain;
      },
    });

    const result = await savePrompt("user_1", {
      name: "100%_Coverage",
      description: "",
      config: nextConfig,
    });

    expect(lookupPattern).toBe("100\\%\\_Coverage");
    expect(revisionFilter).toBe(4);
    expect(updatePayload?.description).toBe("");
    expect(result.outcome).toBe("updated");
  });

  it("requires use case text before sharing a prompt", async () => {
    const { sharePrompt } = await import("@/lib/persistence");
    const updateSpy = vi.fn();

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "tpl_1", use_case: "" }, error: null }),
          }),
        }),
      }),
    });

    fromMock.mockReturnValueOnce({
      update: updateSpy,
    });

    await expect(sharePrompt("user_1", "tpl_1")).rejects.toMatchObject({
      name: "PersistenceError",
      message: "Use case is required before sharing.",
    });

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("normalizes use case text before sharing", async () => {
    const { sharePrompt } = await import("@/lib/persistence");
    let updatePayload: Record<string, unknown> | null = null;

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: "tpl_1", use_case: "" }, error: null }),
          }),
        }),
      }),
    });

    fromMock.mockReturnValueOnce({
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: { id: "tpl_1" }, error: null }),
              }),
            }),
          }),
        };
      },
    });

    await expect(
      sharePrompt("user_1", "tpl_1", {
        useCase: "  Build onboarding emails  ",
      }),
    ).resolves.toBe(true);

    expect(updatePayload?.use_case).toBe("Build onboarding emails");
    expect(updatePayload?.is_shared).toBe(true);
  });
});
````

## File: src/test/usePromptBuilder.test.tsx
````typescript
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";

const LOCAL_VERSIONS_KEY = "promptforge-local-versions";

const mocks = vi.hoisted(() => ({
  authUser: { current: { id: "user_a" } as { id: string } | null },
  toast: vi.fn(),
  loadDraft: vi.fn(),
  saveDraft: vi.fn(),
  clearLocalDraft: vi.fn(),
  loadPrompts: vi.fn(),
  savePrompt: vi.fn(),
  sharePrompt: vi.fn(),
  unsharePrompt: vi.fn(),
  loadPromptById: vi.fn(),
  deletePrompt: vi.fn(),
  loadVersions: vi.fn(),
  saveVersion: vi.fn(),
  getPersistenceErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.authUser.current }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/persistence", () => ({
  loadDraft: (...args: unknown[]) => mocks.loadDraft(...args),
  saveDraft: (...args: unknown[]) => mocks.saveDraft(...args),
  clearLocalDraft: (...args: unknown[]) => mocks.clearLocalDraft(...args),
  loadPrompts: (...args: unknown[]) => mocks.loadPrompts(...args),
  savePrompt: (...args: unknown[]) => mocks.savePrompt(...args),
  sharePrompt: (...args: unknown[]) => mocks.sharePrompt(...args),
  unsharePrompt: (...args: unknown[]) => mocks.unsharePrompt(...args),
  loadPromptById: (...args: unknown[]) => mocks.loadPromptById(...args),
  deletePrompt: (...args: unknown[]) => mocks.deletePrompt(...args),
  loadVersions: (...args: unknown[]) => mocks.loadVersions(...args),
  saveVersion: (...args: unknown[]) => mocks.saveVersion(...args),
  getPersistenceErrorMessage: (...args: unknown[]) => mocks.getPersistenceErrorMessage(...args),
}));

function buildConfig(overrides?: Partial<PromptConfig>): PromptConfig {
  return {
    ...defaultConfig,
    ...overrides,
    contextConfig: {
      ...defaultConfig.contextConfig,
      ...overrides?.contextConfig,
      sources: overrides?.contextConfig?.sources || [],
      databaseConnections: overrides?.contextConfig?.databaseConnections || [],
      rag: {
        ...defaultConfig.contextConfig.rag,
        ...overrides?.contextConfig?.rag,
      },
      structured: {
        ...defaultConfig.contextConfig.structured,
        ...overrides?.contextConfig?.structured,
      },
      interviewAnswers: overrides?.contextConfig?.interviewAnswers || [],
    },
  };
}

describe("usePromptBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.authUser.current = { id: "user_a" };
    mocks.loadDraft.mockResolvedValue(buildConfig({ role: "User A role" }));
    mocks.loadPrompts.mockResolvedValue([]);
    mocks.loadVersions.mockResolvedValue([]);
    mocks.saveDraft.mockResolvedValue(undefined);
    mocks.savePrompt.mockResolvedValue(null);
    mocks.sharePrompt.mockResolvedValue(false);
    mocks.unsharePrompt.mockResolvedValue(false);
    mocks.loadPromptById.mockResolvedValue(null);
    mocks.deletePrompt.mockResolvedValue(false);
    mocks.saveVersion.mockResolvedValue(null);
  });

  it("clears prior in-memory state immediately when auth user changes", async () => {
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result, rerender } = renderHook(() => usePromptBuilder());

    await waitFor(() => {
      expect(result.current.config.role).toBe("User A role");
    });

    act(() => {
      result.current.setEnhancedPrompt("Sensitive output from user A");
    });
    expect(result.current.enhancedPrompt).toBe("Sensitive output from user A");

    mocks.authUser.current = { id: "user_b" };
    mocks.loadDraft.mockRejectedValueOnce(new Error("Failed to load draft"));
    mocks.loadPrompts.mockResolvedValueOnce([]);
    mocks.loadVersions.mockResolvedValueOnce([]);

    rerender();

    expect(result.current.config).toEqual(defaultConfig);
    expect(result.current.enhancedPrompt).toBe("");

    await waitFor(() => {
      expect(mocks.loadDraft).toHaveBeenCalledWith("user_b");
    });

    expect(result.current.config).toEqual(defaultConfig);
    expect(result.current.enhancedPrompt).toBe("");
  });

  it("persists guest versions locally and migrates them on sign-in", async () => {
    mocks.authUser.current = null;
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result, rerender } = renderHook(() => usePromptBuilder());

    act(() => {
      result.current.setEnhancedPrompt("Guest version content");
    });

    await waitFor(() => {
      expect(result.current.enhancedPrompt).toBe("Guest version content");
    });

    act(() => {
      result.current.saveVersion("Guest Version 1");
    });

    await waitFor(() => {
      expect(result.current.versions).toHaveLength(1);
    });

    const storedBeforeLogin = localStorage.getItem(LOCAL_VERSIONS_KEY);
    expect(storedBeforeLogin).not.toBeNull();
    expect(JSON.parse(storedBeforeLogin || "[]")).toHaveLength(1);

    mocks.authUser.current = { id: "user_b" };
    mocks.loadDraft.mockResolvedValueOnce(buildConfig({ role: "Cloud role" }));
    mocks.loadPrompts.mockResolvedValueOnce([]);
    mocks.loadVersions.mockResolvedValueOnce([
      {
        id: "cloud-1",
        name: "Cloud Version",
        prompt: "Cloud history",
        timestamp: Date.now(),
      },
    ]);

    rerender();

    await waitFor(() => {
      expect(mocks.saveVersion).toHaveBeenCalledWith("user_b", "Guest Version 1", "Guest version content");
    });

    expect(localStorage.getItem(LOCAL_VERSIONS_KEY)).toBeNull();
    await waitFor(() => {
      expect(result.current.versions[0]?.id).toBe("cloud-1");
    });
  });

  it("warns when cloud draft is skipped because user edited during hydration", async () => {
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result, rerender } = renderHook(() => usePromptBuilder());

    await waitFor(() => {
      expect(result.current.config.role).toBe("User A role");
    });

    const deferredDraft = createDeferred<PromptConfig | null>();
    mocks.authUser.current = { id: "user_b" };
    mocks.loadDraft.mockReturnValueOnce(deferredDraft.promise);
    mocks.loadPrompts.mockResolvedValueOnce([]);
    mocks.loadVersions.mockResolvedValueOnce([]);

    rerender();

    act(() => {
      result.current.updateConfig({ role: "Local edit before hydrate" });
    });

    deferredDraft.resolve(buildConfig({ role: "Cloud role should not replace edit" }));

    await waitFor(() => {
      expect(result.current.config.role).toBe("Local edit before hydrate");
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Cloud draft was not applied",
      }),
    );
  });

  it("rejects save-and-share for signed-out users before any save attempt", async () => {
    mocks.authUser.current = null;
    const { usePromptBuilder } = await import("@/hooks/usePromptBuilder");
    const { result } = renderHook(() => usePromptBuilder());

    await expect(
      result.current.saveAndSharePrompt({
        title: "Share me",
        useCase: "A valid use case",
      }),
    ).rejects.toThrow("Sign in to share prompts.");

    expect(mocks.savePrompt).not.toHaveBeenCalled();
    expect(mocks.sharePrompt).not.toHaveBeenCalled();
  });
});
````

## File: src/main.tsx
````typescript
import { createRoot } from "react-dom/client";
import "@fontsource-variable/work-sans/wght.css";
import "@fontsource-variable/inconsolata/wght.css";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
````

## File: src/vite-env.d.ts
````typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
````

## File: src/components/BuilderTabs.tsx
````typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { badgeVariants } from "@/components/ui/badge";
import { User, Target, Layout, Lightbulb, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PromptConfig,
  roles,
  formatOptions,
  constraintOptions,
  lengthOptions,
} from "@/lib/prompt-builder";

interface BuilderTabsProps {
  config: PromptConfig;
  onUpdate: (updates: Partial<PromptConfig>) => void;
}

export function BuilderTabs({ config, onUpdate }: BuilderTabsProps) {
  const toggleFormat = (format: string) => {
    const next = config.format.includes(format)
      ? config.format.filter((f) => f !== format)
      : [...config.format, format];
    onUpdate({ format: next });
  };

  const toggleConstraint = (constraint: string) => {
    const next = config.constraints.includes(constraint)
      ? config.constraints.filter((c) => c !== constraint)
      : [...config.constraints, constraint];
    onUpdate({ constraints: next });
  };

  return (
    <Tabs defaultValue="role" className="w-full">
      <TabsList className="w-full grid grid-cols-5 h-auto gap-1 bg-muted/30 p-1">
        <TabsTrigger value="role" aria-label="Role tab" className="interactive-chip gap-1 text-xs px-2">
          <User className="w-3 h-3" />
          <span className="hidden sm:inline">Role</span>
        </TabsTrigger>
        <TabsTrigger value="task" aria-label="Task tab" className="interactive-chip gap-1 text-xs px-2">
          <Target className="w-3 h-3" />
          <span className="hidden sm:inline">Task</span>
        </TabsTrigger>
        <TabsTrigger value="format" aria-label="Format tab" className="interactive-chip gap-1 text-xs px-2">
          <Layout className="w-3 h-3" />
          <span className="hidden sm:inline">Format</span>
        </TabsTrigger>
        <TabsTrigger value="examples" aria-label="Examples tab" className="interactive-chip gap-1 text-xs px-2">
          <Lightbulb className="w-3 h-3" />
          <span className="hidden sm:inline">Examples</span>
        </TabsTrigger>
        <TabsTrigger value="constraints" aria-label="Rules tab" className="interactive-chip gap-1 text-xs px-2">
          <Shield className="w-3 h-3" />
          <span className="hidden sm:inline">Rules</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="role" className="space-y-3 mt-4">
        <p className="text-xs text-muted-foreground">Who should the AI be?</p>
        <Select value={config.role} onValueChange={(v) => onUpdate({ role: v })}>
          <SelectTrigger className="bg-background" aria-label="Select role">
            <SelectValue placeholder="Select a role..." />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Or type a custom role..."
          value={config.customRole}
          onChange={(e) => onUpdate({ customRole: e.target.value })}
          className="bg-background"
          aria-label="Custom role input"
        />
      </TabsContent>

      <TabsContent value="task" className="space-y-3 mt-4">
        <p className="text-xs text-muted-foreground">What exactly do you want done?</p>
        <Textarea
          placeholder="Define the task clearly..."
          value={config.task}
          onChange={(e) => onUpdate({ task: e.target.value })}
          className="min-h-[100px] bg-background"
          aria-label="Task description"
        />
      </TabsContent>

      <TabsContent value="format" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">How should the answer be structured?</p>
        <div className="flex flex-wrap gap-2">
          {formatOptions.map((format) => (
            <button
              type="button"
              key={format}
              className={cn(
                badgeVariants({
                  variant: config.format.includes(format) ? "default" : "outline",
                }),
                "interactive-chip cursor-pointer select-none"
              )}
              onClick={() => toggleFormat(format)}
              aria-pressed={config.format.includes(format)}
            >
              {format}
            </button>
          ))}
        </div>
        <Input
          placeholder="Custom format..."
          value={config.customFormat}
          onChange={(e) => onUpdate({ customFormat: e.target.value })}
          className="bg-background"
          aria-label="Custom format"
        />
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Length</Label>
          <Select value={config.lengthPreference} onValueChange={(v) => onUpdate({ lengthPreference: v })}>
            <SelectTrigger className="bg-background" aria-label="Length preference">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lengthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TabsContent>

      <TabsContent value="examples" className="space-y-3 mt-4">
        <p className="text-xs text-muted-foreground">Show, don't just tell — provide example inputs/outputs</p>
        <Textarea
          placeholder="Add example inputs and outputs to guide the AI..."
          value={config.examples}
          onChange={(e) => onUpdate({ examples: e.target.value })}
          className="min-h-[120px] bg-background font-mono text-sm"
          aria-label="Examples input"
        />
      </TabsContent>

      <TabsContent value="constraints" className="space-y-4 mt-4">
        <p className="text-xs text-muted-foreground">Set boundaries to improve quality</p>
        <div className="space-y-3">
          {constraintOptions.map((constraint) => (
            <div key={constraint} className="flex items-center gap-2">
              <Checkbox
                id={constraint}
                checked={config.constraints.includes(constraint)}
                onCheckedChange={() => toggleConstraint(constraint)}
              />
              <Label htmlFor={constraint} className="text-sm cursor-pointer">
                {constraint}
              </Label>
            </div>
          ))}
        </div>
        <Input
          placeholder="Add custom constraint..."
          value={config.customConstraint}
          onChange={(e) => onUpdate({ customConstraint: e.target.value })}
          className="bg-background"
          aria-label="Custom constraint"
        />
      </TabsContent>
    </Tabs>
  );
}
````

## File: src/components/ContextPanel.tsx
````typescript
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ContextSourceChips } from "@/components/ContextSourceChips";
import { StructuredContextForm } from "@/components/StructuredContextForm";
import { ContextInterview } from "@/components/ContextInterview";
import { ProjectNotes } from "@/components/ProjectNotes";
import { ContextIntegrations } from "@/components/ContextIntegrations";
import { ContextQualityMeter } from "@/components/ContextQualityMeter";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type {
  ContextConfig,
  ContextSource,
  StructuredContext,
  InterviewAnswer,
  DatabaseConnection,
  RagParameters,
} from "@/lib/context-types";

interface ContextPanelProps {
  contextConfig: ContextConfig;
  onUpdateSources: (sources: ContextSource[]) => void;
  onUpdateDatabaseConnections: (connections: DatabaseConnection[]) => void;
  onUpdateRag: (updates: Partial<RagParameters>) => void;
  onUpdateStructured: (updates: Partial<StructuredContext>) => void;
  onUpdateInterview: (answers: InterviewAnswer[]) => void;
  onUpdateProjectNotes: (notes: string) => void;
  onToggleDelimiters: (value: boolean) => void;
}

function SectionCollapsible({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5">
          <ChevronRight
            className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          />
          {title}
        </span>
        {badge}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pb-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function ContextPanel({
  contextConfig,
  onUpdateSources,
  onUpdateDatabaseConnections,
  onUpdateRag,
  onUpdateStructured,
  onUpdateInterview,
  onUpdateProjectNotes,
  onToggleDelimiters,
}: ContextPanelProps) {
  const handleAddSource = (source: ContextSource) => {
    onUpdateSources([...contextConfig.sources, source]);
  };

  const handleRemoveSource = (id: string) => {
    onUpdateSources(contextConfig.sources.filter((s) => s.id !== id));
  };

  const structuredCount = Object.values(contextConfig.structured).filter(
    (v) => typeof v === "string" && v.trim().length > 0
  ).length;

  const hasNotes = contextConfig.projectNotes.trim().length > 0;
  const interviewCount = contextConfig.interviewAnswers.filter(
    (a) => a.answer.trim().length > 0
  ).length;
  const integrationCount =
    contextConfig.databaseConnections.length + (contextConfig.rag.enabled ? 1 : 0);

  return (
    <div className="space-y-1">
      {/* Sources — always visible */}
      <ContextSourceChips
        sources={contextConfig.sources}
        onAdd={handleAddSource}
        onRemove={handleRemoveSource}
      />

      {/* Structured fields — collapsible */}
      <SectionCollapsible
        title="Structured Fields"
        badge={
          structuredCount > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {structuredCount} filled
            </Badge>
          ) : undefined
        }
      >
        <StructuredContextForm
          values={contextConfig.structured}
          onUpdate={onUpdateStructured}
        />
      </SectionCollapsible>

      <SectionCollapsible
        title="Integrations"
        badge={
          integrationCount > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {integrationCount} active
            </Badge>
          ) : undefined
        }
      >
        <ContextIntegrations
          databaseConnections={contextConfig.databaseConnections}
          rag={contextConfig.rag}
          onUpdateDatabaseConnections={onUpdateDatabaseConnections}
          onUpdateRag={onUpdateRag}
        />
      </SectionCollapsible>

      {/* Interview — collapsible */}
      <SectionCollapsible
        title="Context Interview"
        badge={
          interviewCount > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {interviewCount} answered
            </Badge>
          ) : undefined
        }
      >
        <ContextInterview
          answers={contextConfig.interviewAnswers}
          onUpdate={onUpdateInterview}
        />
      </SectionCollapsible>

      {/* Project notes — collapsible */}
      <SectionCollapsible
        title="Project Notes"
        badge={
          hasNotes ? (
            <Badge variant="secondary" className="text-[10px]">
              has notes
            </Badge>
          ) : undefined
        }
      >
        <ProjectNotes
          value={contextConfig.projectNotes}
          onChange={onUpdateProjectNotes}
        />
      </SectionCollapsible>

      {/* Settings & quality — compact row */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <Switch
            checked={contextConfig.useDelimiters}
            onCheckedChange={onToggleDelimiters}
            className="scale-90"
          />
          <Label className="text-[10px] text-muted-foreground">Delimiters</Label>
        </div>
        <ContextQualityMeter contextConfig={contextConfig} />
      </div>
    </div>
  );
}
````

## File: src/components/PromptInput.tsx
````typescript
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function PromptInput({ value, onChange, onClear }: PromptInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">Your Prompt</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{value.length} chars</span>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              aria-label="Clear prompt text"
              className="interactive-chip h-6 px-2 text-xs gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Clear Prompt
            </Button>
          )}
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your basic prompt here... (e.g., 'Write a blog post about AI')"
        className="min-h-[80px] sm:min-h-[120px] resize-none bg-background border-input text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        aria-label="Original prompt input"
      />
    </div>
  );
}
````

## File: src/integrations/supabase/types.ts
````typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      community_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          category: string
          comment_count: number
          created_at: string
          description: string
          enhanced_prompt: string
          id: string
          is_public: boolean
          public_config: Json
          remix_count: number
          remix_diff: Json | null
          remix_note: string
          remixed_from: string | null
          saved_prompt_id: string
          starter_prompt: string
          tags: string[]
          target_model: string
          title: string
          updated_at: string
          upvote_count: number
          use_case: string
          verified_count: number
        }
        Insert: {
          author_id: string
          category?: string
          comment_count?: number
          created_at?: string
          description?: string
          enhanced_prompt: string
          id?: string
          is_public?: boolean
          public_config?: Json
          remix_count?: number
          remix_diff?: Json | null
          remix_note?: string
          remixed_from?: string | null
          saved_prompt_id: string
          starter_prompt?: string
          tags?: string[]
          target_model?: string
          title: string
          updated_at?: string
          upvote_count?: number
          use_case?: string
          verified_count?: number
        }
        Update: {
          author_id?: string
          category?: string
          comment_count?: number
          created_at?: string
          description?: string
          enhanced_prompt?: string
          id?: string
          is_public?: boolean
          public_config?: Json
          remix_count?: number
          remix_diff?: Json | null
          remix_note?: string
          remixed_from?: string | null
          saved_prompt_id?: string
          starter_prompt?: string
          tags?: string[]
          target_model?: string
          title?: string
          updated_at?: string
          upvote_count?: number
          use_case?: string
          verified_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_remixed_from_fkey"
            columns: ["remixed_from"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_saved_prompt_id_fkey"
            columns: ["saved_prompt_id"]
            isOneToOne: true
            referencedRelation: "saved_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          config: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          created_at: string
          id: string
          name: string
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          prompt?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_prompts: {
        Row: {
          built_prompt: string
          category: string
          config: Json
          created_at: string
          description: string
          enhanced_prompt: string
          fingerprint: string | null
          id: string
          is_shared: boolean
          remix_diff: Json | null
          remix_note: string
          remixed_from: string | null
          revision: number
          tags: string[]
          target_model: string
          title: string
          updated_at: string
          use_case: string
          user_id: string
        }
        Insert: {
          built_prompt?: string
          category?: string
          config?: Json
          created_at?: string
          description?: string
          enhanced_prompt?: string
          fingerprint?: string | null
          id?: string
          is_shared?: boolean
          remix_diff?: Json | null
          remix_note?: string
          remixed_from?: string | null
          revision?: number
          tags?: string[]
          target_model?: string
          title: string
          updated_at?: string
          use_case?: string
          user_id: string
        }
        Update: {
          built_prompt?: string
          category?: string
          config?: Json
          created_at?: string
          description?: string
          enhanced_prompt?: string
          fingerprint?: string | null
          id?: string
          is_shared?: boolean
          remix_diff?: Json | null
          remix_note?: string
          remixed_from?: string | null
          revision?: number
          tags?: string[]
          target_model?: string
          title?: string
          updated_at?: string
          use_case?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_prompts_remixed_from_fkey"
            columns: ["remixed_from"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          config: Json
          created_at: string
          description: string
          fingerprint: string | null
          id: string
          name: string
          revision: number
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string
          fingerprint?: string | null
          id?: string
          name: string
          revision?: number
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string
          fingerprint?: string | null
          id?: string
          name?: string
          revision?: number
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      community_profiles_by_ids: {
        Args: {
          input_ids: string[]
        }
        Returns: {
          avatar_url: string | null
          display_name: string | null
          id: string
        }[]
      }
      is_non_anonymous_account: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      refresh_community_post_metrics: {
        Args: {
          target_post_id: string
        }
        Returns: undefined
      }
      strip_sensitive_prompt_config: {
        Args: {
          input_config: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
````

## File: src/lib/prompt-builder.ts
````typescript
import type { ContextConfig } from "@/lib/context-types";
import { defaultContextConfig, buildContextBlock } from "@/lib/context-types";

export interface PromptConfig {
  originalPrompt: string;
  role: string;
  customRole: string;
  task: string;
  context: string;
  contextConfig: ContextConfig;
  format: string[];
  customFormat: string;
  lengthPreference: string;
  examples: string;
  constraints: string[];
  customConstraint: string;
  tone: string;
  complexity: string;
}

export const defaultConfig: PromptConfig = {
  originalPrompt: "",
  role: "",
  customRole: "",
  task: "",
  context: "",
  contextConfig: defaultContextConfig,
  format: [],
  customFormat: "",
  lengthPreference: "standard",
  examples: "",
  constraints: [],
  customConstraint: "",
  tone: "Professional",
  complexity: "Moderate",
};

export const roles = [
  "Expert Copywriter",
  "Data Analyst",
  "Software Developer",
  "Teacher",
  "Business Consultant",
  "Creative Director",
  "Marketing Specialist",
  "UX Designer",
  "Financial Advisor",
  "Research Scientist",
  "Product Manager",
  "Legal Advisor",
  "Medical Professional",
  "Journalist",
  "Technical Writer",
];

export const formatOptions = [
  "Bullet points",
  "Numbered list",
  "Paragraph form",
  "Table",
  "JSON",
  "Markdown",
  "Code block",
];

export const constraintOptions = [
  "Avoid jargon",
  "Use formal tone",
  "Be conversational",
  "Include citations",
  "Think step-by-step",
];

export const toneOptions = ["Professional", "Casual", "Technical", "Creative", "Academic"];
export const complexityOptions = ["Simple", "Moderate", "Advanced"];
export const lengthOptions = [
  { value: "brief", label: "Brief (~100 words)" },
  { value: "standard", label: "Standard (~300 words)" },
  { value: "detailed", label: "Detailed (500+ words)" },
];

export function buildPrompt(config: PromptConfig): string {
  const parts: string[] = [];

  const actualRole = config.customRole || config.role;
  if (actualRole) {
    parts.push(`**Role:** Act as a ${actualRole}.`);
  }

  if (config.task || config.originalPrompt) {
    parts.push(`**Task:** ${config.task || config.originalPrompt}`);
  }

  // Rich context from ContextPanel
  const contextBlock = buildContextBlock(config.contextConfig, config.contextConfig.useDelimiters);
  if (contextBlock) {
    parts.push(contextBlock);
  }

  // Legacy context field (for backward compat / simple usage)
  if (config.context && !contextBlock) {
    parts.push(`**Context:** ${config.context}`);
  }

  const formats = [...config.format];
  if (config.customFormat) formats.push(config.customFormat);
  if (formats.length > 0) {
    const lengthLabel =
      config.lengthPreference === "brief"
        ? "Keep it brief (~100 words)"
        : config.lengthPreference === "detailed"
          ? "Be detailed (500+ words)"
          : "Standard length (~300 words)";
    parts.push(`**Format:** Present the response as ${formats.join(", ")}. ${lengthLabel}.`);
  }

  if (config.examples) {
    parts.push(`**Examples:**\n${config.examples}`);
  }

  const allConstraints = [...config.constraints];
  if (config.customConstraint) allConstraints.push(config.customConstraint);
  if (config.tone) allConstraints.push(`Use a ${config.tone.toLowerCase()} tone`);
  if (config.complexity) allConstraints.push(`Target ${config.complexity.toLowerCase()} complexity level`);

  if (allConstraints.length > 0) {
    parts.push(`**Constraints:**\n${allConstraints.map((c) => `- ${c}`).join("\n")}`);
  }

  return parts.join("\n\n");
}

export function scorePrompt(config: PromptConfig): {
  total: number;
  clarity: number;
  context: number;
  specificity: number;
  structure: number;
  tips: string[];
} {
  let clarity = 0;
  let context = 0;
  let specificity = 0;
  let structure = 0;
  const tips: string[] = [];

  // Clarity (0-25)
  if (config.task || config.originalPrompt) {
    const taskLen = (config.task || config.originalPrompt).length;
    clarity = Math.min(25, Math.round((taskLen / 100) * 25));
  }
  if (clarity < 15) tips.push("Make your task description more specific and detailed.");

  // Context (0-25) — now includes structured context
  if (config.context) {
    context = Math.min(15, Math.round((config.context.length / 150) * 15));
  }
  const ctx = config.contextConfig;
  if (ctx.sources.length > 0) context += 5;
  if (ctx.databaseConnections.length > 0) context += 3;
  if (ctx.rag.enabled && ctx.rag.vectorStoreRef.trim()) context += 3;
  if (ctx.structured.audience || ctx.structured.product) context += 4;
  if (ctx.structured.offer) context += 3;
  if (ctx.interviewAnswers.filter((a) => a.answer.trim()).length > 0) context += 3;
  if (ctx.projectNotes.trim()) context += 2;
  if (config.role || config.customRole) context = Math.min(25, context + 5);
  context = Math.min(25, context);
  if (context < 15) tips.push("Use the Context & Sources panel to add structured background info.");

  // Specificity (0-25)
  if (config.format.length > 0) specificity += 8;
  if (config.lengthPreference) specificity += 5;
  if (config.examples) specificity += 7;
  if (config.constraints.length > 0) specificity += 5;
  specificity = Math.min(25, specificity);
  if (specificity < 15) tips.push("Specify output format, length, or provide examples for better results.");

  // Structure (0-25)
  if (config.role || config.customRole) structure += 7;
  if (config.tone) structure += 5;
  if (config.complexity) structure += 5;
  if (config.constraints.length >= 2) structure += 4;
  if (config.format.length > 0) structure += 4;
  structure = Math.min(25, structure);
  if (structure < 15) tips.push("Select a role, tone, and constraints to improve prompt structure.");

  if (tips.length === 0) tips.push("Great prompt! You've covered all the essentials.");

  return {
    total: clarity + context + specificity + structure,
    clarity,
    context,
    specificity,
    structure,
  tips,
  };
}
````

## File: src/lib/templates.ts
````typescript
export type PromptCategory =
  | "general"
  | "frontend"
  | "backend"
  | "fullstack"
  | "devops"
  | "data"
  | "ml-ai"
  | "security"
  | "testing"
  | "api"
  | "automation"
  | "docs";

export interface PromptTemplate {
  id: string;
  name: string;
  category: PromptCategory;
  description: string;
  starterPrompt: string;
  role: string;
  task: string;
  context: string;
  format: string[];
  lengthPreference: string;
  tone: string;
  complexity: string;
  constraints: string[];
  examples: string;
}

export const templates: PromptTemplate[] = [
  {
    id: "blog-post",
    name: "Blog Post Writer",
    category: "docs",
    description: "Create engaging blog posts on any topic with SEO optimization",
    starterPrompt: "Write a 1,200-word blog post about edge AI for small businesses.",
    role: "Expert Copywriter & SEO Specialist",
    task: "Write a comprehensive, engaging blog post",
    context: "The blog targets a general audience interested in learning new topics. Content should be informative yet accessible.",
    format: ["Markdown"],
    lengthPreference: "detailed",
    tone: "Professional",
    complexity: "Moderate",
    constraints: ["Include citations", "Think step-by-step"],
    examples: "",
  },
  {
    id: "social-media",
    name: "Social Media Post",
    category: "general",
    description: "Craft attention-grabbing social media content",
    starterPrompt: "Create 3 LinkedIn posts announcing our spring product launch.",
    role: "Social Media Marketing Expert",
    task: "Create engaging social media posts that drive engagement",
    context: "Posts should be platform-optimized and include relevant hashtags. Focus on shareability.",
    format: ["Bullet points"],
    lengthPreference: "brief",
    tone: "Casual",
    complexity: "Simple",
    constraints: ["Be conversational"],
    examples: "",
  },
  {
    id: "email-campaign",
    name: "Email Campaign",
    category: "general",
    description: "Write persuasive email sequences",
    starterPrompt: "Draft a 4-email onboarding sequence for new trial users.",
    role: "Email Marketing Strategist",
    task: "Write a compelling email that converts readers",
    context: "Professional email targeting potential customers. Should follow email marketing best practices.",
    format: ["Paragraph form"],
    lengthPreference: "standard",
    tone: "Professional",
    complexity: "Moderate",
    constraints: ["Use formal tone"],
    examples: "",
  },
  {
    id: "data-analysis",
    name: "Data Analysis Report",
    category: "data",
    description: "Analyze datasets and provide actionable insights",
    starterPrompt: "Analyze this churn dataset and summarize the top 5 retention risks.",
    role: "Senior Data Analyst",
    task: "Analyze the provided data and generate a comprehensive report with insights",
    context: "Data-driven analysis targeting business decision makers who need actionable recommendations.",
    format: ["Table", "Bullet points"],
    lengthPreference: "detailed",
    tone: "Technical",
    complexity: "Advanced",
    constraints: ["Include citations", "Think step-by-step", "Avoid jargon"],
    examples: "",
  },
  {
    id: "code-review",
    name: "Code Review",
    category: "testing",
    description: "Thorough code review with improvement suggestions",
    starterPrompt: "Review this TypeScript API handler for bugs, security, and performance.",
    role: "Senior Software Engineer",
    task: "Review the provided code for bugs, performance issues, and best practices",
    context: "Code review for a production application. Focus on security, maintainability, and performance.",
    format: ["Code block", "Bullet points"],
    lengthPreference: "detailed",
    tone: "Technical",
    complexity: "Advanced",
    constraints: ["Think step-by-step"],
    examples: "",
  },
  {
    id: "brainstorm",
    name: "Brainstorming Session",
    category: "general",
    description: "Generate creative ideas and explore possibilities",
    starterPrompt: "Brainstorm 20 campaign ideas for a zero-budget local fitness app launch.",
    role: "Creative Director & Innovation Consultant",
    task: "Generate diverse, creative ideas and explore possibilities",
    context: "Open-ended creative brainstorming session. Push boundaries and think outside the box.",
    format: ["Numbered list"],
    lengthPreference: "detailed",
    tone: "Creative",
    complexity: "Moderate",
    constraints: ["Be conversational"],
    examples: "",
  },
  {
    id: "story-writing",
    name: "Story Writing",
    category: "general",
    description: "Craft compelling narratives and stories",
    starterPrompt: "Write a short sci-fi story about a city powered by memories.",
    role: "Published Fiction Author",
    task: "Write a compelling story with vivid characters and engaging plot",
    context: "Creative fiction writing. Focus on character development, dialogue, and narrative tension.",
    format: ["Paragraph form"],
    lengthPreference: "detailed",
    tone: "Creative",
    complexity: "Advanced",
    constraints: [],
    examples: "",
  },
  {
    id: "business-proposal",
    name: "Business Proposal",
    category: "general",
    description: "Create professional business proposals",
    starterPrompt: "Draft a proposal to redesign a retailer's ecommerce checkout flow.",
    role: "Business Development Consultant",
    task: "Draft a professional business proposal",
    context: "Formal business document targeting potential clients or stakeholders. Should demonstrate value proposition clearly.",
    format: ["Markdown", "Bullet points"],
    lengthPreference: "detailed",
    tone: "Professional",
    complexity: "Advanced",
    constraints: ["Use formal tone", "Include citations"],
    examples: "",
  },
  {
    id: "lesson-plan",
    name: "Lesson Plan",
    category: "docs",
    description: "Design structured educational lesson plans",
    starterPrompt: "Create a 45-minute lesson plan to teach photosynthesis to 8th graders.",
    role: "Experienced Educator & Curriculum Designer",
    task: "Create a structured, engaging lesson plan",
    context: "Educational content designed for effective learning outcomes. Include activities, assessments, and clear objectives.",
    format: ["Numbered list", "Bullet points"],
    lengthPreference: "detailed",
    tone: "Professional",
    complexity: "Moderate",
    constraints: ["Avoid jargon", "Think step-by-step"],
    examples: "",
  },
  {
    id: "explainer",
    name: "Concept Explainer",
    category: "docs",
    description: "Explain complex topics in simple terms",
    starterPrompt: "Explain how neural networks work using simple everyday analogies.",
    role: "Expert Teacher & Science Communicator",
    task: "Explain a complex concept in simple, easy-to-understand terms",
    context: "Educational explanation for beginners. Use analogies and real-world examples.",
    format: ["Paragraph form", "Bullet points"],
    lengthPreference: "standard",
    tone: "Casual",
    complexity: "Simple",
    constraints: ["Avoid jargon", "Be conversational"],
    examples: "",
  },
];

export const categoryLabels: Record<PromptCategory, string> = {
  general: "General",
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Fullstack",
  devops: "DevOps",
  data: "Data",
  "ml-ai": "ML / AI",
  security: "Security",
  testing: "Testing",
  api: "API",
  automation: "Automation",
  docs: "Docs",
};

export const categoryColors: Record<PromptCategory, string> = {
  general: "bg-primary/10 text-primary",
  frontend: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  backend: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  fullstack: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  devops: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  data: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "ml-ai": "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  security: "bg-red-500/10 text-red-700 dark:text-red-300",
  testing: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
  api: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  automation: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  docs: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
};
````

## File: src/test/template-store.test.ts
````typescript
import { beforeEach, describe, expect, it } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
import {
  clearAllTemplatesForTest,
  loadTemplateById,
  listTemplateSummaries,
  saveTemplateSnapshot,
} from "@/lib/template-store";

const TEMPLATE_STORAGE_KEY = "promptforge-template-snapshots";

function buildConfig(overrides?: Partial<PromptConfig>): PromptConfig {
  return {
    ...defaultConfig,
    ...overrides,
    contextConfig: {
      ...defaultConfig.contextConfig,
      ...overrides?.contextConfig,
      sources: overrides?.contextConfig?.sources || [],
      databaseConnections: overrides?.contextConfig?.databaseConnections || [],
      rag: {
        ...defaultConfig.contextConfig.rag,
        ...overrides?.contextConfig?.rag,
      },
      structured: {
        ...defaultConfig.contextConfig.structured,
        ...overrides?.contextConfig?.structured,
      },
      interviewAnswers: overrides?.contextConfig?.interviewAnswers || [],
    },
  };
}

describe("template-store", () => {
  beforeEach(() => {
    clearAllTemplatesForTest();
  });

  it("saves idempotently by name + fingerprint and revisions updates", () => {
    const config = buildConfig({
      task: "Build a deployment checklist",
      contextConfig: {
        ...defaultConfig.contextConfig,
        sources: [
          {
            id: "src-1",
            type: "url",
            title: "Runbook",
            rawContent: "https://example.com/runbook",
            summary: "Deployment runbook",
            addedAt: Date.now(),
            reference: {
              kind: "url",
              refId: "url:runbook",
              locator: "https://example.com/runbook",
            },
          },
        ],
      },
    });

    const created = saveTemplateSnapshot({ name: "Ops Template", tags: ["ops", "deploy"], config });
    const unchanged = saveTemplateSnapshot({ name: "Ops Template", tags: ["ops"], config });
    const updated = saveTemplateSnapshot({
      name: "Ops Template",
      config: buildConfig({ ...config, task: "Build a safer deployment checklist" }),
    });

    expect(created.outcome).toBe("created");
    expect(unchanged.outcome).toBe("unchanged");
    expect(unchanged.record.metadata.revision).toBe(1);
    expect(updated.outcome).toBe("updated");
    expect(updated.record.metadata.revision).toBe(2);

    const summaries = listTemplateSummaries();
    expect(summaries[0].tags).toEqual(["ops", "deploy"]);
    expect(summaries[0].starterPrompt).toContain("Build a safer deployment checklist");
  });

  it("stores external sources as references and strips raw payloads", () => {
    const result = saveTemplateSnapshot({
      name: "External Sources",
      config: buildConfig({
        task: "Summarize these sources",
        contextConfig: {
          ...defaultConfig.contextConfig,
          sources: [
            {
              id: "url-1",
              type: "url",
              title: "Product docs",
              rawContent: "Long fetched article body",
              summary: "External URL summary",
              addedAt: Date.now(),
              reference: {
                kind: "url",
                refId: "url:product-docs",
                locator: "https://example.com/docs",
              },
            },
            {
              id: "file-1",
              type: "file",
              title: "roadmap.pdf",
              rawContent: "Very long extracted PDF text",
              summary: "Roadmap excerpt",
              addedAt: Date.now(),
              reference: {
                kind: "file",
                refId: "file:roadmap.pdf",
                locator: "roadmap.pdf",
              },
            },
            {
              id: "text-1",
              type: "text",
              title: "Inline notes",
              rawContent: "Keep this text payload",
              summary: "Inline notes",
              addedAt: Date.now(),
            },
          ],
        },
      }),
    });

    const loaded = loadTemplateById(result.record.metadata.id);
    expect(loaded).not.toBeNull();
    const [urlSource, fileSource, textSource] = loaded!.record.state.promptConfig.contextConfig.sources;
    expect(urlSource.rawContent).toBe("");
    expect(fileSource.rawContent).toBe("");
    expect(textSource.rawContent).toContain("Keep this text payload");
    expect(loaded!.record.state.externalReferences.length).toBeGreaterThanOrEqual(2);
  });

  it("returns warnings for risky integrations and invalid rag config", () => {
    const result = saveTemplateSnapshot({
      name: "Risky Integration",
      config: buildConfig({
        task: "Diagnose production issue",
        contextConfig: {
          ...defaultConfig.contextConfig,
          databaseConnections: [
            {
              id: "db-1",
              label: "Primary DB",
              provider: "postgres",
              connectionRef: "",
              database: "app",
              schema: "public",
              tables: ["events"],
              readOnly: false,
            },
          ],
          rag: {
            ...defaultConfig.contextConfig.rag,
            enabled: true,
            vectorStoreRef: "",
            topK: 0,
            minScore: 1.5,
          },
        },
      }),
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.join(" ")).toContain("readOnly");
    expect(result.warnings.join(" ")).toContain("vectorStoreRef");
  });

  it("migrates legacy template payloads from array format", () => {
    localStorage.setItem(
      TEMPLATE_STORAGE_KEY,
      JSON.stringify([
        {
          id: "legacy-1",
          name: "Legacy",
          description: "old format",
          role: "Senior Developer",
          task: "Review architecture",
          context: "Legacy context",
          format: ["Markdown"],
          lengthPreference: "standard",
          tone: "Technical",
          complexity: "Advanced",
          constraints: ["Think step-by-step"],
          examples: "",
        },
      ])
    );

    const summaries = listTemplateSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].name).toBe("Legacy");
    const loaded = loadTemplateById(summaries[0].id);
    expect(loaded).not.toBeNull();
    expect(loaded!.record.metadata.schemaVersion).toBe(2);
  });
});
````

## File: src/App.tsx
````typescript
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Community from "./pages/Community";
import CommunityPost from "./pages/CommunityPost";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/:postId" element={<CommunityPost />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
````

## File: supabase/functions/_shared/security.ts
````typescript
type RateState = {
  count: number;
  resetAt: number;
};

type RateLimitOk = { ok: true; remaining: number; resetAt: number };
type RateLimitFail = { ok: false; retryAfterSeconds: number; resetAt: number };
type RateLimitResult = RateLimitOk | RateLimitFail;

const rateLimitStores = new Map<string, Map<string, RateState>>();

type AllowedOrigins =
  | { mode: "any" }
  | { mode: "set"; origins: Set<string> };

function getEnvValue(name: string): string | undefined {
  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env;
  if (denoEnv?.get) {
    return denoEnv.get(name);
  }
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return nodeEnv?.[name];
}

function parseAllowedOrigins(): AllowedOrigins {
  const configured = getEnvValue("ALLOWED_ORIGINS");
  if (!configured || !configured.trim()) {
    return { mode: "any" };
  }

  const raw = configured.trim();
  if (raw === "*" || raw.toLowerCase() === "any") {
    return { mode: "any" };
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return { mode: "any" };
  }

  return { mode: "set", origins: new Set(origins) };
}

const allowedOrigins = parseAllowedOrigins();

function baseCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function resolveCors(req: Request):
  | { ok: true; headers: Record<string, string>; origin: string }
  | { ok: false; headers: Record<string, string>; status: number; error: string } {
  const origin = req.headers.get("origin")?.trim();
  if (!origin) {
    return {
      ok: true,
      headers: baseCorsHeaders("null"),
      origin: "null",
    };
  }

  if (allowedOrigins.mode === "set" && !allowedOrigins.origins.has(origin)) {
    return {
      ok: false,
      headers: baseCorsHeaders("null"),
      status: 403,
      error: "Origin is not allowed.",
    };
  }

  return {
    ok: true,
    headers: baseCorsHeaders(origin),
    origin,
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "=");
    const decoded = atob(payload);
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isPublishableKeyLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("sb_publishable_");
}

function isLegacyAnonJwt(value: string): boolean {
  const claims = decodeJwtPayload(value.trim());
  if (!claims) return false;
  return claims.role === "anon";
}

function isProjectApiKeyLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return isPublishableKeyLike(trimmed) || isLegacyAnonJwt(trimmed);
}

type SupabaseAuthConfig = {
  supabaseUrl: string | null;
  anonKey: string | null;
};

type SupabaseUserFetchResult =
  | { ok: true; id: string; isAnonymous: boolean }
  | { ok: false; reason: "invalid_token" | "unavailable" };

let hasLoggedAuthConfigWarning = false;
let hasLoggedJwtFallbackWarning = false;
let hasLoggedJwtFallbackProductionWarning = false;

function getSupabaseUrl(): string | null {
  const raw = getEnvValue("SUPABASE_URL") || getEnvValue("SUPABASE_PROJECT_URL");
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function getSupabaseAnonKey(): string | null {
  return (
    getEnvValue("SUPABASE_ANON_KEY") ||
    getEnvValue("SUPABASE_PUBLISHABLE_KEY") ||
    getEnvValue("SUPABASE_KEY")
  );
}

function getSupabaseAuthConfig(): SupabaseAuthConfig {
  return {
    supabaseUrl: getSupabaseUrl(),
    anonKey: getSupabaseAnonKey(),
  };
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isProductionEnvironment(): boolean {
  if (getEnvValue("DENO_DEPLOYMENT_ID")) return true;

  const envValue = (
    getEnvValue("APP_ENV") ||
    getEnvValue("ENVIRONMENT") ||
    getEnvValue("NODE_ENV") ||
    ""
  )
    .trim()
    .toLowerCase();

  return envValue === "prod" || envValue === "production";
}

function allowUnverifiedJwtFallback(): boolean {
  if (!isTruthyEnv(getEnvValue("ALLOW_UNVERIFIED_JWT_FALLBACK"))) {
    return false;
  }

  if (!isProductionEnvironment()) {
    return true;
  }

  if (isTruthyEnv(getEnvValue("ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION"))) {
    return true;
  }

  if (!hasLoggedJwtFallbackProductionWarning) {
    hasLoggedJwtFallbackProductionWarning = true;
    console.error(
      "ALLOW_UNVERIFIED_JWT_FALLBACK is ignored in production by default. "
        + "Set ALLOW_UNVERIFIED_JWT_FALLBACK_IN_PRODUCTION=true only for emergency recovery scenarios.",
    );
  }

  return false;
}

function numericClaim(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectBooleanFlag(source: unknown, key: string): boolean {
  if (!source || typeof source !== "object") return false;
  return (source as Record<string, unknown>)[key] === true;
}

function decodeUserFromJwt(token: string): { id: string; isAnonymous: boolean } | null {
  const claims = decodeJwtPayload(token.trim());
  if (!claims) return null;

  const subject = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!subject) return null;

  const exp = numericClaim(claims.exp);
  if (exp !== null && Date.now() >= exp * 1000) return null;

  const isAnonymous =
    claims.role === "anon" ||
    claims.is_anonymous === true ||
    objectBooleanFlag(claims.app_metadata, "is_anonymous") ||
    objectBooleanFlag(claims.user_metadata, "is_anonymous");

  return {
    id: subject,
    isAnonymous,
  };
}

function tryDecodeUserFromJwtFallback(
  bearerToken: string,
  reason: "missing_config" | "auth_unavailable",
): { id: string; isAnonymous: boolean } | null {
  if (!allowUnverifiedJwtFallback()) return null;
  const decodedUser = decodeUserFromJwt(bearerToken);
  if (!decodedUser) return null;

  if (!hasLoggedJwtFallbackWarning) {
    hasLoggedJwtFallbackWarning = true;
    console.warn(
      `ALLOW_UNVERIFIED_JWT_FALLBACK is enabled; accepting decoded JWT claims without signature verification (${reason}).`,
    );
  }

  return decodedUser;
}

async function fetchSupabaseUser(
  bearerToken: string,
  config: { supabaseUrl: string; anonKey: string },
): Promise<SupabaseUserFetchResult> {
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        apikey: config.anonKey,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "invalid_token" };
    }
    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }

    const data = (await response.json()) as {
      id?: string;
      is_anonymous?: boolean;
      app_metadata?: { is_anonymous?: boolean };
      user_metadata?: { is_anonymous?: boolean };
    };

    if (!data?.id) {
      return { ok: false, reason: "invalid_token" };
    }

    const isAnonymous =
      Boolean(data.is_anonymous) ||
      Boolean(data.app_metadata?.is_anonymous) ||
      Boolean(data.user_metadata?.is_anonymous);

    return { ok: true, id: data.id, isAnonymous };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function requireAuthenticatedUser(
  req: Request,
): Promise<{ ok: true; userId: string; isAnonymous: boolean } | { ok: false; status: number; error: string }> {
  const authConfig = getSupabaseAuthConfig();
  const anonKey = authConfig.anonKey;
  const isAnonKey = (value: string) =>
    anonKey ? value.trim() === anonKey.trim() : isProjectApiKeyLike(value);
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const apiKey = req.headers.get("apikey")?.trim() || "";
    if (isAnonKey(apiKey)) {
      return {
        ok: true,
        userId: "anon",
        isAnonymous: true,
      };
    }
    return {
      ok: false,
      status: 401,
      error: "Missing bearer token.",
    };
  }

  const bearerToken = match[1].trim();
  const apiKey = req.headers.get("apikey")?.trim() || "";
  if (
    isAnonKey(bearerToken) ||
    (apiKey && apiKey === bearerToken && isAnonKey(apiKey))
  ) {
    return {
      ok: true,
      userId: "anon",
      isAnonymous: true,
    };
  }

  if (!authConfig.supabaseUrl || !authConfig.anonKey) {
    const fallbackUser = tryDecodeUserFromJwtFallback(bearerToken, "missing_config");
    if (fallbackUser) {
      return {
        ok: true,
        userId: fallbackUser.id,
        isAnonymous: fallbackUser.isAnonymous,
      };
    }

    if (!hasLoggedAuthConfigWarning) {
      hasLoggedAuthConfigWarning = true;
      console.error(
        "SUPABASE_URL and SUPABASE_ANON_KEY are required to validate bearer tokens. "
          + "Set those env vars or enable ALLOW_UNVERIFIED_JWT_FALLBACK for local development only.",
      );
    }

    return {
      ok: false,
      status: 503,
      error: "Authentication service is unavailable because Supabase auth is not configured.",
    };
  }

  const supabaseUser = await fetchSupabaseUser(bearerToken, {
    supabaseUrl: authConfig.supabaseUrl,
    anonKey: authConfig.anonKey,
  });
  if (supabaseUser.ok) {
    return {
      ok: true,
      userId: supabaseUser.id,
      isAnonymous: supabaseUser.isAnonymous,
    };
  }

  if (supabaseUser.reason === "unavailable") {
    const fallbackUser = tryDecodeUserFromJwtFallback(bearerToken, "auth_unavailable");
    if (fallbackUser) {
      return {
        ok: true,
        userId: fallbackUser.id,
        isAnonymous: fallbackUser.isAnonymous,
      };
    }

    return {
      ok: false,
      status: 503,
      error: "Authentication service is temporarily unavailable. Please try again.",
    };
  }

  return {
    ok: false,
    status: 401,
    error: "Invalid or expired Supabase session.",
  };
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstHop] = forwardedFor.split(",");
    if (firstHop?.trim()) return firstHop.trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return "unknown";
}

function getStore(scope: string): Map<string, RateState> {
  const existing = rateLimitStores.get(scope);
  if (existing) return existing;
  const created = new Map<string, RateState>();
  rateLimitStores.set(scope, created);
  return created;
}

function pruneStore(store: Map<string, RateState>, now: number): void {
  for (const [key, state] of store.entries()) {
    if (state.resetAt <= now) {
      store.delete(key);
    }
  }
}

function applyRateLimitMemory(options: {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const { scope, key, limit, windowMs } = options;
  const store = getStore(scope);
  const now = Date.now();

  if (store.size > 5000) {
    pruneStore(store, now);
  }

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      resetAt: now + windowMs,
    };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  store.set(key, current);
  return {
    ok: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

type DenoKv = Deno.Kv;
type DenoKvEntry<T> = Deno.KvEntryMaybe<T>;

let kvPromise: Promise<DenoKv | null> | null = null;

async function getKv(): Promise<DenoKv | null> {
  if (!kvPromise) {
    kvPromise = (async () => {
      const openKv = (Deno as typeof Deno & { openKv?: () => Promise<DenoKv> }).openKv;
      if (typeof openKv !== "function") return null;
      try {
        return await openKv();
      } catch {
        return null;
      }
    })();
  }

  return kvPromise;
}

async function applyRateLimitKv(
  kv: DenoKv,
  options: {
    scope: string;
    key: string;
    limit: number;
    windowMs: number;
  },
): Promise<RateLimitResult> {
  const { scope, key, limit, windowMs } = options;
  const now = Date.now();
  const bucketStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = bucketStart + windowMs;
  const expiryMs = Math.max(1, resetAt - now);
  const kvKey = ["rate-limit", scope, key, bucketStart] as const;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await kv.get<number>(kvKey);
    const count = typeof current.value === "number" ? current.value : 0;

    if (count >= limit) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        resetAt,
      };
    }

    const next = count + 1;
    const atomic = kv.atomic();
    if (current.versionstamp) {
      atomic.check(current as DenoKvEntry<number>);
    } else {
      atomic.check({ key: kvKey, versionstamp: null });
    }
    atomic.set(kvKey, next, { expireIn: expiryMs });

    const commit = await atomic.commit();
    if (commit.ok) {
      return {
        ok: true,
        remaining: Math.max(0, limit - next),
        resetAt,
      };
    }
  }

  return applyRateLimitMemory(options);
}

export async function applyRateLimit(options: {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const kv = await getKv();
  if (kv) {
    return applyRateLimitKv(kv, options);
  }
  return applyRateLimitMemory(options);
}
````

## File: src/components/ContextSourceChips.tsx
````typescript
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { X, Link, FileText, Type, Plus, Upload, Loader2, Globe } from "lucide-react";
import type { ContextSource } from "@/lib/context-types";
import { summarizeSource } from "@/lib/context-types";
import { extractUrl } from "@/lib/ai-client";
import { toast } from "@/hooks/use-toast";

interface ContextSourceChipsProps {
  sources: ContextSource[];
  onAdd: (source: ContextSource) => void;
  onRemove: (id: string) => void;
}

type AddMode = "text" | "url" | null;

const ALLOWED_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".xml", ".log", ".yaml", ".yml"];
const MAX_FILE_SIZE = 500 * 1024; // 500KB

function normalizeUrlInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function ContextSourceChips({ sources, onAdd, onRemove }: ContextSourceChipsProps) {
  const [mode, setMode] = useState<AddMode>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleAdd = () => {
    if (!content.trim()) return;
    const isUrl = mode === "url";
    const trimmedUrl = urlInput.trim();
    const normalizedUrl = isUrl ? normalizeUrlInput(trimmedUrl) : null;
    if (isUrl && !normalizedUrl) {
      toast({
        title: "Invalid URL",
        description: "Enter a valid http(s) URL before saving this source.",
        variant: "destructive",
      });
      return;
    }
    const resolvedUrl = normalizedUrl ?? "";
    const source: ContextSource = {
      id: Date.now().toString(),
      type: isUrl ? "url" : "text",
      title:
        title.trim() ||
        (isUrl
          ? (() => {
              try {
                return new URL(resolvedUrl).hostname;
              } catch {
                return `Source ${sources.length + 1}`;
              }
            })()
          : `Snippet ${sources.length + 1}`),
      rawContent: content.trim(),
      summary: summarizeSource(content.trim()),
      addedAt: Date.now(),
      reference: isUrl
        ? {
            kind: "url",
            refId: `url:${resolvedUrl}`,
            locator: resolvedUrl,
            permissionScope: "public",
          }
        : undefined,
      validation: isUrl
        ? {
            status: "unknown",
            checkedAt: Date.now(),
          }
        : undefined,
    };
    onAdd(source);
    setTitle("");
    setContent("");
    setUrlInput("");
    setMode(null);
    setDialogOpen(false);
  };

  // --- Drag & Drop ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      files.forEach((file) => {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          toast({
            title: "Unsupported file type",
            description: `"${file.name}" is not supported. Use ${ALLOWED_EXTENSIONS.join(", ")}.`,
            variant: "destructive",
          });
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: "File too large",
            description: `"${file.name}" exceeds the 500 KB limit.`,
            variant: "destructive",
          });
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          const source: ContextSource = {
            id: `${Date.now()}-${file.name}`,
            type: "file",
            title: file.name,
            rawContent: text,
            summary: summarizeSource(text),
            addedAt: Date.now(),
            reference: {
              kind: "file",
              refId: `file:${file.name}:${file.lastModified}`,
              locator: file.name,
            },
            validation: {
              status: "unknown",
              checkedAt: Date.now(),
            },
          };
          onAdd(source);
          toast({ title: "File added", description: `"${file.name}" added as context source.` });
        };
        reader.onerror = () => {
          toast({
            title: "Read error",
            description: `Could not read "${file.name}".`,
            variant: "destructive",
          });
        };
        reader.readAsText(file);
      });
    },
    [onAdd]
  );

  // --- URL Fetch ---
  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetching(true);
    try {
      const result = await extractUrl(urlInput.trim());
      setTitle(result.title);
      setContent(result.content);
      toast({ title: "Content extracted", description: "Key points extracted from the URL." });
    } catch (err) {
      toast({
        title: "Extraction failed",
        description: err instanceof Error ? err.message : "Could not fetch or extract content. You can still paste content manually.",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const chipIcon = (type: ContextSource["type"]) => {
    if (type === "url") return <Link className="w-3 h-3" />;
    if (type === "file") return <FileText className="w-3 h-3" />;
    return <Type className="w-3 h-3" />;
  };

  return (
    <div className="space-y-2">
      {/* Drop zone — compact */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed transition-colors p-2 sm:p-3 text-center ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        }`}
      >
        <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
          <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>Drop files ({ALLOWED_EXTENSIONS.slice(0, 4).join(", ")}…)</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">Sources</label>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Plus className="w-3 h-3" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add source material</DialogTitle>
            </DialogHeader>

            {!mode ? (
              <div className="grid grid-cols-2 gap-3 py-4">
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => setMode("text")}
                >
                  <Type className="w-5 h-5" />
                  <span className="text-xs">Paste text</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col gap-2"
                  onClick={() => setMode("url")}
                >
                  <Globe className="w-5 h-5" />
                  <span className="text-xs">Fetch from URL</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                {mode === "url" && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="bg-background flex-1"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleFetchUrl}
                      disabled={!urlInput.trim() || isFetching}
                      className="shrink-0 gap-1.5"
                    >
                      {isFetching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Globe className="w-3.5 h-3.5" />
                      )}
                      {isFetching ? "Fetching…" : "Fetch"}
                    </Button>
                  </div>
                )}
                <Input
                  placeholder={mode === "url" ? "Page title (auto-filled on fetch)" : "Source title (optional)"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-background"
                />
                <Textarea
                  placeholder={
                    mode === "url"
                      ? "Extracted content will appear here, or paste manually…"
                      : "Paste your text, notes, or data here…"
                  }
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[100px] sm:min-h-[120px] bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  Long content will be auto-summarized into compact bullet points.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMode(null);
                      setTitle("");
                      setContent("");
                      setUrlInput("");
                    }}
                  >
                    Back
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={!content.trim()}>
                    Add source
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {sources.map((source) => (
            <Badge
              key={source.id}
              variant="secondary"
              className="gap-1 sm:gap-1.5 pr-1 max-w-[180px] sm:max-w-[200px] group cursor-default"
              title={`${source.title}\n${source.summary}`}
            >
              {chipIcon(source.type)}
              <span className="truncate text-[11px] sm:text-xs">{source.title}</span>
              <button
                onClick={() => onRemove(source.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                aria-label={`Remove ${source.title}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {sources.length === 0 && (
        <p className="text-[11px] sm:text-xs text-muted-foreground">
          No sources yet. Add text, fetch URLs, or drop files.
        </p>
      )}
    </div>
  );
}
````

## File: supabase/functions/enhance-prompt/index.ts
````typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  applyRateLimit,
  getClientIp,
  jsonResponse,
  requireAuthenticatedUser,
  resolveCors,
} from "../_shared/security.ts";

const MAX_PROMPT_CHARS = Number(Deno.env.get("MAX_PROMPT_CHARS") || "16000");
const ENHANCE_PER_MINUTE = Number(Deno.env.get("ENHANCE_PER_MINUTE") || "12");
const ENHANCE_PER_DAY = Number(Deno.env.get("ENHANCE_PER_DAY") || "300");
const AGENT_SERVICE_URL = Deno.env.get("AGENT_SERVICE_URL");
const AGENT_SERVICE_TOKEN = Deno.env.get("AGENT_SERVICE_TOKEN");

function normalizeAgentServiceUrl(raw: string): string {
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

serve(async (req) => {
  const cors = resolveCors(req);

  if (req.method === "OPTIONS") {
    if (!cors.ok) {
      return jsonResponse({ error: cors.error }, cors.status, cors.headers);
    }
    return new Response("ok", { headers: cors.headers });
  }

  if (!cors.ok) {
    return jsonResponse({ error: cors.error }, cors.status, cors.headers);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, cors.headers);
  }

  try {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status, cors.headers);
    }

    const clientIp = getClientIp(req);
    const minuteLimit = await applyRateLimit({
      scope: "enhance-minute",
      key: `${auth.userId}:${clientIp}`,
      limit: ENHANCE_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!minuteLimit.ok) {
      return jsonResponse(
        { error: "Rate limit exceeded. Please try again later." },
        429,
        cors.headers,
        {
          "Retry-After": String(minuteLimit.retryAfterSeconds),
        },
      );
    }

    const dailyKey = auth.isAnonymous ? `${auth.userId}:${clientIp}` : auth.userId;
    const dailyLimit = await applyRateLimit({
      scope: "enhance-day",
      key: dailyKey,
      limit: ENHANCE_PER_DAY,
      windowMs: 86_400_000,
    });
    if (!dailyLimit.ok) {
      return jsonResponse(
        { error: "Daily quota exceeded. Please try again tomorrow." },
        429,
        cors.headers,
        {
          "Retry-After": String(dailyLimit.retryAfterSeconds),
        },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400, cors.headers);
    }

    const promptRaw = (body as { prompt?: unknown })?.prompt;
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
    if (!prompt) {
      return jsonResponse({ error: "Prompt is required." }, 400, cors.headers);
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return jsonResponse(
        { error: `Prompt is too large. Maximum ${MAX_PROMPT_CHARS} characters.` },
        413,
        cors.headers,
      );
    }

    if (!AGENT_SERVICE_URL) {
      throw new Error("AGENT_SERVICE_URL is not configured");
    }

    const agentServiceUrl = normalizeAgentServiceUrl(AGENT_SERVICE_URL);

    console.log("Enhancing prompt, length:", prompt?.length);

    const response = await fetch(`${agentServiceUrl}/enhance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AGENT_SERVICE_TOKEN ? { "x-agent-token": AGENT_SERVICE_TOKEN } : {}),
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const trimmedErrorText = errorText.trim();
      let errorMessage = "AI enhancement failed. Please try again.";
      try {
        const parsed = JSON.parse(errorText) as { detail?: unknown; error?: unknown };
        if (typeof parsed.detail === "string" && parsed.detail.trim()) {
          errorMessage = parsed.detail.trim();
        } else if (typeof parsed.error === "string" && parsed.error.trim()) {
          errorMessage = parsed.error.trim();
        }
      } catch {
        if (trimmedErrorText) errorMessage = trimmedErrorText;
      }

      if (
        response.status >= 500 &&
        (!errorMessage || errorMessage === "Internal Server Error")
      ) {
        errorMessage =
          "Agent service returned a 500 error. Check AGENT_SERVICE_URL and the agent service logs.";
      }

      console.error("Agent service error:", response.status, errorMessage);

      return jsonResponse(
        { error: errorMessage },
        response.status >= 400 && response.status < 600 ? response.status : 500,
        cors.headers,
      );
    }

    console.log("Streaming response back to client");

    return new Response(response.body, {
      headers: {
        ...cors.headers,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("enhance-prompt error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
      cors.headers,
    );
  }
});
````

## File: supabase/functions/extract-url/index.ts
````typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  applyRateLimit,
  getClientIp,
  jsonResponse,
  requireAuthenticatedUser,
  resolveCors,
} from "../_shared/security.ts";

const MAX_URL_CHARS = Number(Deno.env.get("MAX_URL_CHARS") || "2048");
const EXTRACT_PER_MINUTE = Number(Deno.env.get("EXTRACT_PER_MINUTE") || "6");
const EXTRACT_PER_DAY = Number(Deno.env.get("EXTRACT_PER_DAY") || "120");
const FETCH_TIMEOUT_MS = Number(Deno.env.get("EXTRACT_FETCH_TIMEOUT_MS") || "15000");

function stripHtml(html: string): string {
  // Remove script and style blocks entirely
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractTitle(html: string, url: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 120);
  }
  try {
    return new URL(url).hostname;
  } catch {
    return "Extracted content";
  }
}

function parseInputUrl(input: string): URL | null {
  if (!input.trim()) return null;
  const candidate = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.message.toLowerCase().includes("timed out");
}

serve(async (req) => {
  const cors = resolveCors(req);

  if (req.method === "OPTIONS") {
    if (!cors.ok) {
      return jsonResponse({ error: cors.error }, cors.status, cors.headers);
    }
    return new Response("ok", { headers: cors.headers });
  }

  if (!cors.ok) {
    return jsonResponse({ error: cors.error }, cors.status, cors.headers);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, cors.headers);
  }

  try {
    const auth = await requireAuthenticatedUser(req);
    if (!auth.ok) {
      return jsonResponse({ error: auth.error }, auth.status, cors.headers);
    }

    const clientIp = getClientIp(req);
    const minuteLimit = await applyRateLimit({
      scope: "extract-minute",
      key: `${auth.userId}:${clientIp}`,
      limit: EXTRACT_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!minuteLimit.ok) {
      return jsonResponse(
        { error: "Rate limit exceeded. Please try again later." },
        429,
        cors.headers,
        {
          "Retry-After": String(minuteLimit.retryAfterSeconds),
        },
      );
    }

    const dailyKey = auth.isAnonymous ? `${auth.userId}:${clientIp}` : auth.userId;
    const dailyLimit = await applyRateLimit({
      scope: "extract-day",
      key: dailyKey,
      limit: EXTRACT_PER_DAY,
      windowMs: 86_400_000,
    });
    if (!dailyLimit.ok) {
      return jsonResponse(
        { error: "Daily quota exceeded. Please try again tomorrow." },
        429,
        cors.headers,
        {
          "Retry-After": String(dailyLimit.retryAfterSeconds),
        },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400, cors.headers);
    }

    const rawUrl = (body as { url?: unknown })?.url;
    const urlInput = typeof rawUrl === "string" ? rawUrl.trim() : "";

    if (!urlInput) {
      return jsonResponse({ error: "A valid URL is required." }, 400, cors.headers);
    }
    if (urlInput.length > MAX_URL_CHARS) {
      return jsonResponse(
        { error: `URL is too large. Maximum ${MAX_URL_CHARS} characters.` },
        413,
        cors.headers,
      );
    }

    const parsedUrl = parseInputUrl(urlInput);
    if (!parsedUrl) {
      return jsonResponse({ error: "Invalid URL format." }, 400, cors.headers);
    }

    console.log("Fetching URL:", parsedUrl.href);

    let pageResp: Response;
    try {
      pageResp = await fetch(parsedUrl.href, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PromptForge/1.0; +https://promptforge.app)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        return jsonResponse(
          { error: "Timed out while fetching the URL." },
          504,
          cors.headers,
        );
      }
      throw error;
    }

    if (!pageResp.ok) {
      console.error("Failed to fetch URL:", pageResp.status);
      return jsonResponse(
        { error: `Could not fetch URL (status ${pageResp.status})` },
        422,
        cors.headers,
      );
    }

    const html = await pageResp.text();
    const title = extractTitle(html, parsedUrl.href);
    let plainText = stripHtml(html);

    // Truncate to ~8000 chars to stay within token budget
    if (plainText.length > 8000) {
      plainText = plainText.slice(0, 8000) + "…";
    }

    if (plainText.length < 50) {
      return jsonResponse(
        { error: "Page had too little readable text content." },
        422,
        cors.headers,
      );
    }

    console.log("Extracted text length:", plainText.length, "| Title:", title);

    // Send to AI gateway for extraction
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let aiResp: Response;
    try {
      aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are a content extractor. Given raw text from a web page, extract the 5-10 most important and relevant points as concise bullet points. Focus on facts, data, and key claims. Omit navigation text, ads, and boilerplate. Return only the bullet points, one per line, prefixed with a bullet character (•).",
            },
            {
              role: "user",
              content: `Extract the key points from this page:\n\n${plainText}`,
            },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        return jsonResponse(
          { error: "Timed out while extracting content." },
          504,
          cors.headers,
        );
      }
      throw error;
    }

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);

      if (aiResp.status === 429) {
        return jsonResponse(
          { error: "Rate limit exceeded. Please try again in a moment." },
          429,
          cors.headers,
        );
      }
      if (aiResp.status === 402) {
        return jsonResponse(
          { error: "AI credits depleted. Please add funds to continue." },
          402,
          cors.headers,
        );
      }

      return jsonResponse(
        { error: "Failed to extract content from the page." },
        500,
        cors.headers,
      );
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    console.log("Extraction complete, content length:", content.length);

    return jsonResponse({ title, content }, 200, cors.headers);
  } catch (e) {
    console.error("extract-url error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
      cors.headers,
    );
  }
});
````

## File: package.json
````json
{
  "name": "vite_react_shadcn_ts",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "check:prod": "npm run lint && npm test && npm run build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:rls": "dotenv -- vitest run src/test/rls-community-*.test.ts",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@fontsource-variable/inconsolata": "^5.2.8",
    "@fontsource-variable/work-sans": "^5.2.8",
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.11",
    "@radix-ui/react-alert-dialog": "^1.1.14",
    "@radix-ui/react-aspect-ratio": "^1.1.7",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-checkbox": "^1.3.2",
    "@radix-ui/react-collapsible": "^1.1.11",
    "@radix-ui/react-context-menu": "^2.2.15",
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-hover-card": "^1.1.14",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-menubar": "^1.1.15",
    "@radix-ui/react-navigation-menu": "^1.2.13",
    "@radix-ui/react-popover": "^1.1.14",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-radio-group": "^1.3.7",
    "@radix-ui/react-scroll-area": "^1.2.9",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slider": "^1.3.5",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.5",
    "@radix-ui/react-tabs": "^1.1.12",
    "@radix-ui/react-toast": "^1.2.14",
    "@radix-ui/react-toggle": "^1.1.9",
    "@radix-ui/react-toggle-group": "^1.1.10",
    "@radix-ui/react-tooltip": "^1.2.7",
    "@supabase/supabase-js": "^2.95.3",
    "@tanstack/react-query": "^5.83.0",
    "baseline-browser-mapping": "^2.9.19",
    "caniuse-lite": "^1.0.30001769",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^3.6.0",
    "embla-carousel-react": "^8.6.0",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.462.0",
    "next-themes": "^0.3.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.61.1",
    "react-resizable-panels": "^2.1.9",
    "react-router-dom": "^6.30.3",
    "recharts": "^2.15.4",
    "sonner": "^1.7.4",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "vaul": "^0.9.9",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@playwright/test": "^1.58.2",
    "@tailwindcss/typography": "^0.5.16",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^22.16.5",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react-swc": "^3.11.0",
    "autoprefixer": "^10.4.21",
    "dotenv-cli": "^11.0.0",
    "eslint": "^9.32.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^15.15.0",
    "jsdom": "^20.0.3",
    "lovable-tagger": "^1.1.13",
    "postcss": "^8.5.6",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.38.0",
    "vite": "^5.4.21",
    "vitest": "^3.2.4"
  }
}
````

## File: tailwind.config.ts
````typescript
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		boxShadow: {
  			'2xs': 'var(--shadow-2xs)',
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			'2xl': 'var(--shadow-2xl)'
  		},
  		fontFamily: {
  			sans: [
  				'Work Sans Variable',
  				'ui-sans-serif',
  				'system-ui',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica Neue',
  				'Arial',
  				'Noto Sans',
  				'sans-serif'
  			],
  			serif: [
  				'ui-serif',
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			],
  			mono: [
  				'Inconsolata Variable',
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'Liberation Mono',
  				'Courier New',
  				'monospace'
  			]
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
````

## File: src/lib/ai-client.ts
````typescript
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  (SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : undefined);
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

let bootstrapTokenPromise: Promise<string> | null = null;
const ANON_AUTH_DISABLED_KEY = "ai-prompt-pro:anon-auth-disabled";

function readAnonAuthDisabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ANON_AUTH_DISABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function persistAnonAuthDisabled(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(ANON_AUTH_DISABLED_KEY, "1");
    } else {
      window.localStorage.removeItem(ANON_AUTH_DISABLED_KEY);
    }
  } catch {
    // Ignore storage errors (private mode, disabled storage, etc.).
  }
}

let anonAuthDisabled = readAnonAuthDisabled();

function shouldPersistAnonAuthDisabled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; status?: unknown; code?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  const code = typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
  const status = typeof candidate.status === "number" ? candidate.status : null;

  if (code.includes("anonymous") || code.includes("provider_disabled")) {
    return true;
  }

  if (!message) return false;
  const suggestsAnonymousIsDisabled =
    message.includes("anonymous") &&
    (message.includes("disabled") || message.includes("not enabled") || message.includes("unsupported"));

  if (!suggestsAnonymousIsDisabled) return false;
  return status === null || status >= 400;
}

function assertSupabaseEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing Supabase env. Set VITE_SUPABASE_URL (or VITE_SUPABASE_PROJECT_ID) and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
    );
  }
}

function functionUrl(name: "enhance-prompt" | "extract-url"): string {
  assertSupabaseEnv();
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function getAccessToken(): Promise<string> {
  assertSupabaseEnv();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Could not read auth session: ${sessionError.message}`);
  }
  if (session?.access_token) {
    return session.access_token;
  }

  if (!anonAuthDisabled) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error && data.session?.access_token) {
      anonAuthDisabled = false;
      persistAnonAuthDisabled(false);
      return data.session.access_token;
    }
    if (error && shouldPersistAnonAuthDisabled(error)) {
      // Anonymous sign-ins are disabled in this project — stop retrying across refreshes.
      anonAuthDisabled = true;
      persistAnonAuthDisabled(true);
    }
  }

  // Fallback for projects where anonymous auth is disabled:
  // use the project publishable key for Edge Function calls.
  return SUPABASE_PUBLISHABLE_KEY as string;
}

async function getAccessTokenWithBootstrap(): Promise<string> {
  if (!bootstrapTokenPromise) {
    bootstrapTokenPromise = getAccessToken().finally(() => {
      bootstrapTokenPromise = null;
    });
  }
  return bootstrapTokenPromise;
}

async function functionHeaders(): Promise<Record<string, string>> {
  assertSupabaseEnv();
  const accessToken = await getAccessTokenWithBootstrap();
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY as string,
    Authorization: `Bearer ${accessToken}`,
  };
}

function extractSseError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as { error?: unknown };
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  if (data.error && typeof data.error === "object") {
    const message = (data.error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return null;
}

function extractTextValue(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (!value || typeof value !== "object") return null;
  const obj = value as { text?: unknown; content?: unknown; output_text?: unknown; delta?: unknown };
  if (typeof obj.text === "string" && obj.text) return obj.text;
  if (typeof obj.content === "string" && obj.content) return obj.content;
  if (typeof obj.output_text === "string" && obj.output_text) return obj.output_text;
  if (typeof obj.delta === "string" && obj.delta) return obj.delta;
  return null;
}

function extractSseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    choices?: Array<{ delta?: { content?: unknown } }>;
    type?: unknown;
    delta?: unknown;
    output_text?: unknown;
    text?: unknown;
    item?: unknown;
  };

  const chatCompletionsDelta = data.choices?.[0]?.delta?.content;
  if (typeof chatCompletionsDelta === "string" && chatCompletionsDelta) {
    return chatCompletionsDelta;
  }

  // Codex-style turn/item streaming event shape.
  if (typeof data.type === "string") {
    const eventType = data.type;
    if (eventType === "item/delta" || eventType === "item.delta") {
      return (
        extractTextValue(data.delta) ||
        extractTextValue((data.item as { delta?: unknown } | undefined)?.delta) ||
        extractTextValue(data.item)
      );
    }
    if (eventType === "item/completed" || eventType === "item.completed") {
      return (
        extractTextValue(data.text) ||
        extractTextValue((data.item as { text?: unknown } | undefined)?.text) ||
        extractTextValue(data.output_text)
      );
    }
  }

  // Responses API streaming event shape.
  if (data.type === "response.output_text.delta" && typeof data.delta === "string" && data.delta) {
    return data.delta;
  }

  // Fallback for any adapter that emits output_text directly.
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  return null;
}

export async function streamEnhance({
  prompt,
  onDelta,
  onDone,
  onError,
}: {
  prompt: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const headers = await functionHeaders();
    const resp = await fetch(functionUrl("enhance-prompt"), {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ error: "Enhancement failed" }));
      onError(errorData.error || `Error: ${resp.status}`);
      return;
    }

    if (!resp.body) {
      onError("No response body");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let terminalError: string | null = null;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const parsedError = extractSseError(parsed);
          if (parsedError) {
            terminalError = parsedError;
            streamDone = true;
            break;
          }

          const content = extractSseText(parsed);
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (terminalError) {
      onError(terminalError);
      return;
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const parsedError = extractSseError(parsed);
          if (parsedError) {
            terminalError = parsedError;
            break;
          }
          const content = extractSseText(parsed);
          if (content) onDelta(content);
        } catch {
          /* ignore */
        }
      }
    }

    if (terminalError) {
      onError(terminalError);
      return;
    }

    onDone();
  } catch (e) {
    console.error("Stream error:", e);
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}

export async function extractUrl(url: string): Promise<{ title: string; content: string }> {
  const headers = await functionHeaders();
  const resp = await fetch(functionUrl("extract-url"), {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: "Extraction failed" }));
    throw new Error(errorData.error || `Error: ${resp.status}`);
  }

  return resp.json();
}
````

## File: src/lib/template-store.ts
````typescript
import type {
  ContextConfig,
  ContextReference,
  ContextSource,
  ContextSourceType,
  DatabaseConnection,
  RagParameters,
  SourceValidationStatus,
} from "@/lib/context-types";
import { defaultContextConfig } from "@/lib/context-types";
import type { PromptConfig } from "@/lib/prompt-builder";
import { defaultConfig } from "@/lib/prompt-builder";

const STORAGE_KEY = "promptforge-template-snapshots";
const CURRENT_SCHEMA_VERSION = 2;
const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 14;

type SaveOutcome = "created" | "updated" | "unchanged";

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  tags: string[];
  schemaVersion: number;
  revision: number;
  fingerprint: string;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateExternalReference {
  sourceId: string;
  sourceType: ContextSourceType;
  refId: string;
  locator: string;
  title: string;
  permissionScope?: string;
  status: SourceValidationStatus;
  checkedAt?: number;
}

export interface TemplateState {
  promptConfig: PromptConfig;
  externalReferences: TemplateExternalReference[];
}

export interface TemplateRecord {
  metadata: TemplateMetadata;
  state: TemplateState;
}

export interface TemplateSaveInput {
  name: string;
  description?: string;
  tags?: string[];
  config: PromptConfig;
}

export interface SaveTemplateResult {
  outcome: SaveOutcome;
  record: TemplateRecord;
  warnings: string[];
}

export interface TemplateLoadResult {
  record: TemplateRecord;
  warnings: string[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  starterPrompt: string;
  updatedAt: number;
  createdAt: number;
  revision: number;
  schemaVersion: number;
  sourceCount: number;
  databaseCount: number;
  ragEnabled: boolean;
}

interface TemplateEnvelope {
  schemaVersion: number;
  records: unknown[];
}

interface LegacyTemplateRecordV1 {
  name: string;
  role: string;
  task: string;
  context: string;
  id?: string;
  description?: string;
  format?: string[];
  lengthPreference?: string;
  tone?: string;
  complexity?: string;
  constraints?: string[];
  examples?: string;
}

function isLegacyTemplateRecordV1(value: unknown): value is LegacyTemplateRecordV1 {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.role === "string" &&
    typeof value.task === "string" &&
    typeof value.context === "string"
  );
}

export const TEMPLATE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "PromptTemplateSnapshot",
  type: "object",
  required: ["metadata", "state"],
  properties: {
    metadata: {
      type: "object",
      required: ["id", "name", "schemaVersion", "revision", "fingerprint", "createdAt", "updatedAt"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        schemaVersion: { type: "integer", minimum: 1 },
        revision: { type: "integer", minimum: 1 },
        fingerprint: { type: "string" },
        createdAt: { type: "integer" },
        updatedAt: { type: "integer" },
      },
      additionalProperties: false,
    },
    state: {
      type: "object",
      required: ["promptConfig", "externalReferences"],
      properties: {
        promptConfig: { type: "object" },
        externalReferences: {
          type: "array",
          items: {
            type: "object",
            required: ["sourceId", "sourceType", "refId", "locator", "title", "status"],
          },
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeContextConfig(input?: ContextConfig): ContextConfig {
  const raw = input || defaultContextConfig;
  const rag: RagParameters = {
    ...defaultContextConfig.rag,
    ...raw.rag,
    documentRefs: Array.isArray(raw.rag?.documentRefs) ? raw.rag.documentRefs : [],
  };

  const databaseConnections: DatabaseConnection[] = Array.isArray(raw.databaseConnections)
    ? raw.databaseConnections.map((db) => ({
        id: db.id || generateId("db"),
        label: db.label || db.connectionRef || "Database",
        provider: db.provider || "other",
        connectionRef: db.connectionRef || "",
        database: db.database || "",
        schema: db.schema || "",
        tables: Array.isArray(db.tables) ? db.tables : [],
        readOnly: db.readOnly !== false,
        lastValidatedAt: db.lastValidatedAt,
      }))
    : [];

  return {
    ...defaultContextConfig,
    ...raw,
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    databaseConnections,
    rag,
    structured: { ...defaultContextConfig.structured, ...raw.structured },
    interviewAnswers: Array.isArray(raw.interviewAnswers) ? raw.interviewAnswers : [],
  };
}

export function normalizeTemplateConfig(config: PromptConfig): PromptConfig {
  const merged: PromptConfig = {
    ...defaultConfig,
    ...config,
    contextConfig: mergeContextConfig(config.contextConfig),
    format: Array.isArray(config.format) ? config.format : [],
    constraints: Array.isArray(config.constraints) ? config.constraints : [],
  };

  return {
    ...merged,
    contextConfig: {
      ...merged.contextConfig,
      sources: merged.contextConfig.sources.map((source) => normalizeSource(source)),
    },
  };
}

export function computeTemplateFingerprint(config: PromptConfig): string {
  const canonical = cloneDeep(config);
  canonical.contextConfig.sources = canonical.contextConfig.sources.map((source) => ({
    ...source,
    addedAt: 0,
    validation: source.validation
      ? {
          ...source.validation,
          checkedAt: 0,
        }
      : source.validation,
  }));
  canonical.contextConfig.databaseConnections = canonical.contextConfig.databaseConnections.map((db) => ({
    ...db,
    lastValidatedAt: 0,
  }));
  return fnv1aHash(stableStringify(canonical));
}

function createReference(source: ContextSource): ContextReference | undefined {
  if (source.type === "text") return source.reference;
  const defaultLocator =
    source.type === "url"
      ? source.rawContent.trim()
      : source.type === "file"
        ? source.title
        : source.title || source.id;
  const fallbackRefId = `${source.type}:${source.id}`;

  if (source.type === "url" || source.type === "file" || source.type === "database" || source.type === "rag") {
    return {
      kind: source.type,
      refId: source.reference?.refId || fallbackRefId,
      locator: source.reference?.locator || defaultLocator,
      permissionScope: source.reference?.permissionScope,
    };
  }

  return source.reference;
}

function normalizeSource(source: ContextSource): ContextSource {
  const normalizedReference = createReference(source);
  const shouldStripRaw =
    source.type === "url" || source.type === "file" || source.type === "database" || source.type === "rag";

  return {
    ...source,
    title: source.title || "Source",
    rawContent: shouldStripRaw ? "" : source.rawContent || "",
    summary: source.summary || "",
    reference: normalizedReference,
    validation: validateSource({ ...source, reference: normalizedReference }),
  };
}

function validateSource(source: ContextSource): ContextSource["validation"] {
  const checkedAt = Date.now();
  if (source.type === "text") {
    return { status: "valid", checkedAt };
  }

  if (!source.reference?.refId || !source.reference.locator) {
    return { status: "invalid", checkedAt, message: "Missing external reference ID or locator." };
  }

  if (source.type === "url") {
    try {
      const url = new URL(source.reference.locator);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { status: "invalid", checkedAt, message: "URL sources must use http(s)." };
      }
    } catch {
      return { status: "invalid", checkedAt, message: "Malformed URL reference." };
    }
  }

  if (source.validation?.checkedAt && checkedAt - source.validation.checkedAt > STALE_AFTER_MS) {
    return { status: "stale", checkedAt: source.validation.checkedAt, message: "Source requires re-validation." };
  }

  return { status: "unknown", checkedAt };
}

function validateDatabaseConnections(databases: DatabaseConnection[]): string[] {
  const warnings: string[] = [];

  databases.forEach((db) => {
    if (!db.connectionRef.trim()) warnings.push(`DB "${db.label}" is missing connectionRef.`);
    if (!db.database.trim()) warnings.push(`DB "${db.label}" is missing database name.`);
    if (!db.readOnly) warnings.push(`DB "${db.label}" should be readOnly for template safety.`);
    if (db.lastValidatedAt && Date.now() - db.lastValidatedAt > STALE_AFTER_MS) {
      warnings.push(`DB "${db.label}" permissions may be stale.`);
    }
  });

  return warnings;
}

function validateRag(rag: RagParameters): string[] {
  if (!rag.enabled) return [];
  const warnings: string[] = [];
  if (!rag.vectorStoreRef.trim()) warnings.push("RAG is enabled but vectorStoreRef is missing.");
  if (rag.topK < 1 || rag.topK > 100) warnings.push("RAG topK must be between 1 and 100.");
  if (rag.minScore < 0 || rag.minScore > 1) warnings.push("RAG minScore must be between 0 and 1.");
  if (rag.chunkWindow < 1 || rag.chunkWindow > 20) warnings.push("RAG chunkWindow must be between 1 and 20.");
  return warnings;
}

export function collectTemplateWarnings(config: PromptConfig): string[] {
  const warnings: string[] = [];
  config.contextConfig.sources.forEach((source) => {
    if (source.validation?.status === "invalid") {
      warnings.push(`${source.title}: ${source.validation.message || "Invalid source reference."}`);
    }
    if (source.validation?.status === "stale") {
      warnings.push(`${source.title}: source reference should be re-validated.`);
    }
  });

  warnings.push(...validateDatabaseConnections(config.contextConfig.databaseConnections));
  warnings.push(...validateRag(config.contextConfig.rag));
  return warnings;
}

export function deriveExternalReferencesFromConfig(config: PromptConfig): TemplateExternalReference[] {
  const sourceRefs: TemplateExternalReference[] = config.contextConfig.sources
    .filter((source) => source.type !== "text")
    .map((source) => ({
      sourceId: source.id,
      sourceType: source.type,
      refId: source.reference?.refId || `${source.type}:${source.id}`,
      locator: source.reference?.locator || source.title,
      title: source.title,
      permissionScope: source.reference?.permissionScope,
      status: source.validation?.status || "unknown",
      checkedAt: source.validation?.checkedAt,
    }));

  const dbRefs: TemplateExternalReference[] = config.contextConfig.databaseConnections.map((db) => ({
    sourceId: db.id,
    sourceType: "database",
    refId: db.connectionRef,
    locator: `${db.database}${db.schema ? `.${db.schema}` : ""}`,
    title: db.label,
    permissionScope: db.readOnly ? "read_only" : "read_write",
    status: db.connectionRef.trim() && db.database.trim() ? "unknown" : "invalid",
    checkedAt: db.lastValidatedAt,
  }));

  const ragRefs: TemplateExternalReference[] =
    config.contextConfig.rag.enabled && config.contextConfig.rag.vectorStoreRef.trim()
      ? [
          {
            sourceId: `rag:${config.contextConfig.rag.vectorStoreRef}`,
            sourceType: "rag",
            refId: config.contextConfig.rag.vectorStoreRef,
            locator: config.contextConfig.rag.namespace || "default",
            title: "Vector Store",
            status: "unknown",
            checkedAt: Date.now(),
          },
          ...config.contextConfig.rag.documentRefs.map((docId) => ({
            sourceId: `rag-doc:${docId}`,
            sourceType: "rag" as const,
            refId: docId,
            locator: config.contextConfig.rag.vectorStoreRef,
            title: `RAG Document ${docId}`,
            status: "unknown" as const,
            checkedAt: Date.now(),
          })),
        ]
      : [];

  return [...sourceRefs, ...dbRefs, ...ragRefs];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function fnv1aHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseEnvelope(raw: string | null): TemplateEnvelope {
  if (!raw) return { schemaVersion: CURRENT_SCHEMA_VERSION, records: [] };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { schemaVersion: 1, records: parsed };
    }
    if (isRecord(parsed) && Array.isArray(parsed.records)) {
      return {
        schemaVersion:
          typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : CURRENT_SCHEMA_VERSION,
        records: parsed.records,
      };
    }
  } catch {
    // fall through
  }
  return { schemaVersion: CURRENT_SCHEMA_VERSION, records: [] };
}

function migrateLegacyV1(legacy: LegacyTemplateRecordV1): TemplateRecord {
  const now = Date.now();
  const config: PromptConfig = normalizeTemplateConfig({
    ...defaultConfig,
    role: legacy.role || "",
    task: legacy.task || "",
    context: legacy.context || "",
    format: Array.isArray(legacy.format) ? legacy.format : [],
    lengthPreference: legacy.lengthPreference || "standard",
    tone: legacy.tone || "Professional",
    complexity: legacy.complexity || "Moderate",
    constraints: Array.isArray(legacy.constraints) ? legacy.constraints : [],
    examples: legacy.examples || "",
  });
  const fingerprint = computeTemplateFingerprint(config);
  return {
    metadata: {
      id: legacy.id || generateId("tpl"),
      name: legacy.name || "Migrated Preset",
      description: legacy.description || "",
      tags: [],
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      fingerprint,
      createdAt: now,
      updatedAt: now,
    },
    state: {
      promptConfig: config,
      externalReferences: deriveExternalReferencesFromConfig(config),
    },
  };
}

function parseTemplateRecord(raw: unknown): TemplateRecord | null {
  if (!isRecord(raw)) return null;

  if ("metadata" in raw && "state" in raw && isRecord(raw.metadata) && isRecord(raw.state)) {
    const metadata = raw.metadata;
    const state = raw.state;
    if (typeof metadata.name !== "string" || typeof metadata.id !== "string") return null;
    const normalizedConfig = normalizeTemplateConfig((state.promptConfig || defaultConfig) as PromptConfig);
    const externalReferences = Array.isArray(state.externalReferences)
      ? (state.externalReferences as TemplateExternalReference[])
      : deriveExternalReferencesFromConfig(normalizedConfig);

    return {
      metadata: {
        id: metadata.id,
        name: metadata.name,
        description: typeof metadata.description === "string" ? metadata.description : "",
        tags: Array.isArray(metadata.tags) ? metadata.tags.filter((t): t is string => typeof t === "string") : [],
        schemaVersion:
          typeof metadata.schemaVersion === "number" ? metadata.schemaVersion : CURRENT_SCHEMA_VERSION,
        revision: typeof metadata.revision === "number" && metadata.revision > 0 ? metadata.revision : 1,
        fingerprint:
          typeof metadata.fingerprint === "string"
            ? metadata.fingerprint
            : computeTemplateFingerprint(normalizedConfig),
        createdAt: typeof metadata.createdAt === "number" ? metadata.createdAt : Date.now(),
        updatedAt: typeof metadata.updatedAt === "number" ? metadata.updatedAt : Date.now(),
      },
      state: {
        promptConfig: normalizedConfig,
        externalReferences,
      },
    };
  }

  if (isLegacyTemplateRecordV1(raw)) {
    return migrateLegacyV1(raw);
  }
  return null;
}

function readAllRecords(): TemplateRecord[] {
  if (typeof window === "undefined") return [];
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  const envelope = parseEnvelope(raw);
  const records = envelope.records.map(parseTemplateRecord).filter((r): r is TemplateRecord => !!r);
  return records.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
}

function writeAllRecords(records: TemplateRecord[]): void {
  if (typeof window === "undefined") return;
  const payload: TemplateEnvelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    records: records.map((record) => cloneDeep(record)),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures to avoid crashing the UI.
  }
}

function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clipText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

export function inferTemplateStarterPrompt(config: PromptConfig): string {
  const candidates = [
    config.task,
    config.originalPrompt,
    config.contextConfig.structured.offer,
    config.contextConfig.structured.product,
  ];
  const first = candidates.map(toSingleLine).find((value) => value.length > 0);
  if (!first) {
    return "Start by stating the goal, audience, and desired output format.";
  }
  return clipText(first, 120);
}

export function listTemplateSummaries(): TemplateSummary[] {
  return readAllRecords().map((record) => ({
    id: record.metadata.id,
    name: record.metadata.name,
    description: record.metadata.description,
    tags: record.metadata.tags,
    starterPrompt: inferTemplateStarterPrompt(record.state.promptConfig),
    updatedAt: record.metadata.updatedAt,
    createdAt: record.metadata.createdAt,
    revision: record.metadata.revision,
    schemaVersion: record.metadata.schemaVersion,
    sourceCount: record.state.promptConfig.contextConfig.sources.length,
    databaseCount: record.state.promptConfig.contextConfig.databaseConnections.length,
    ragEnabled: record.state.promptConfig.contextConfig.rag.enabled,
  }));
}

export function loadTemplateById(id: string): TemplateLoadResult | null {
  const records = readAllRecords();
  const record = records.find((entry) => entry.metadata.id === id);
  if (!record) return null;
  return {
    record: cloneDeep(record),
    warnings: collectTemplateWarnings(record.state.promptConfig),
  };
}

export function saveTemplateSnapshot(input: TemplateSaveInput): SaveTemplateResult {
  const name = input.name.trim();
  if (!name) throw new Error("Preset name is required.");

  const now = Date.now();
  const normalizedConfig = normalizeTemplateConfig(input.config);
  const normalizedDescription = input.description === undefined ? undefined : input.description.trim();
  const fingerprint = computeTemplateFingerprint(normalizedConfig);
  const warnings = collectTemplateWarnings(normalizedConfig);
  const records = readAllRecords();
  const existingIndex = records.findIndex((record) => record.metadata.name.toLowerCase() === name.toLowerCase());

  if (existingIndex >= 0) {
    const existing = records[existingIndex];
    if (existing.metadata.fingerprint === fingerprint) {
      return {
        outcome: "unchanged",
        record: cloneDeep(existing),
        warnings,
      };
    }

    const updated: TemplateRecord = {
      metadata: {
        ...existing.metadata,
        description: normalizedDescription ?? existing.metadata.description,
        tags: Array.isArray(input.tags) ? input.tags.map((tag) => tag.trim()).filter(Boolean) : existing.metadata.tags,
        revision: existing.metadata.revision + 1,
        fingerprint,
        updatedAt: now,
      },
      state: {
        promptConfig: normalizedConfig,
        externalReferences: deriveExternalReferencesFromConfig(normalizedConfig),
      },
    };

    const next = [...records];
    next.splice(existingIndex, 1, updated);
    writeAllRecords(next);
    return { outcome: "updated", record: cloneDeep(updated), warnings };
  }

  const created: TemplateRecord = {
    metadata: {
      id: generateId("tpl"),
      name,
      description: normalizedDescription ?? "",
      tags: Array.isArray(input.tags) ? input.tags.map((tag) => tag.trim()).filter(Boolean) : [],
      schemaVersion: CURRENT_SCHEMA_VERSION,
      revision: 1,
      fingerprint,
      createdAt: now,
      updatedAt: now,
    },
    state: {
      promptConfig: normalizedConfig,
      externalReferences: deriveExternalReferencesFromConfig(normalizedConfig),
    },
  };

  writeAllRecords([created, ...records]);
  return { outcome: "created", record: cloneDeep(created), warnings };
}

export function deleteTemplateById(id: string): boolean {
  const records = readAllRecords();
  const next = records.filter((record) => record.metadata.id !== id);
  if (next.length === records.length) return false;
  writeAllRecords(next);
  return true;
}

export function clearAllTemplatesForTest(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures in constrained environments.
  }
}
````

## File: src/index.css
````css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Definition of the design system. All colors, gradients, fonts, etc should be defined here. 
All colors MUST be HSL.
*/

@layer base {
  :root {
    --background: 0 0% 96%;
    --foreground: 0 0% 9%;

    --card: 0 0% 98%;
    --card-foreground: 0 0% 9%;

    --popover: 0 0% 89%;
    --popover-foreground: 0 0% 9%;

    --primary: 161 93% 30%;
    --primary-foreground: 151 80% 95%;

    --secondary: 0 0% 32%;
    --secondary-foreground: 0 0% 98%;

    --muted: 0 0% 63%;
    --muted-foreground: 0 0% 9%;

    --accent: 166 76% 96%;
    --accent-foreground: 173 80% 40%;

    --destructive: 0 72% 50%;
    --destructive-foreground: 0 85% 97%;

    --border: 0 0% 83%;
    --input: 0 0% 83%;
    --ring: 161 93% 30%;

    --radius: 0.75rem;

    --sidebar-background: 0 0% 98%;

    --sidebar-foreground: 0 0% 9%;

    --sidebar-primary: 161 93% 30%;

    --sidebar-primary-foreground: 151 80% 95%;

    --sidebar-accent: 0 0% 32%;

    --sidebar-accent-foreground: 0 0% 98%;

    --sidebar-border: 0 0% 83%;

    --sidebar-ring: 161 93% 30%;

    --chart-1: 158 64% 51%;

    --chart-2: 141 69% 58%;

    --chart-3: 172 66% 50%;

    --chart-4: 82 77% 55%;

    --chart-5: 0 0% 45%;

    --sidebar: 0 0% 98%;

    --font-sans: 'Work Sans Variable', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;

    --font-serif: ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;

    --font-mono: 'Inconsolata Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;

    --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);

    --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);

    --shadow-sm: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);

    --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);

    --shadow-md: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 2px 4px -1px hsl(0 0% 0% / 0.1);

    --shadow-lg: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 4px 6px -1px hsl(0 0% 0% / 0.1);

    --shadow-xl: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 8px 10px -1px hsl(0 0% 0% / 0.1);

    --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);

    --tracking-normal: 0em;

    --spacing: 0.25rem;

    --delight-warm: 161 90% 36%;
    --delight-cool: 189 78% 42%;
    --delight-glow: 161 95% 34%;
    --delight-surface: 0 0% 100%;
    --motion-snap: cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .dark {
    --background: 0 0% 9%;
    --foreground: 0 0% 98%;

    --card: 0 0% 14%;
    --card-foreground: 0 0% 98%;

    --popover: 0 0% 25%;
    --popover-foreground: 0 0% 98%;

    --primary: 158 64% 51%;
    --primary-foreground: 165 91% 9%;

    --secondary: 0 0% 45%;
    --secondary-foreground: 0 0% 98%;

    --muted: 0 0% 45%;
    --muted-foreground: 0 0% 98%;

    --accent: 178 84% 10%;
    --accent-foreground: 172 66% 50%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 85% 97%;

    --border: 0 0% 32%;
    --input: 0 0% 32%;
    --ring: 158 64% 51%;
    --sidebar-background: 240 5.9% 10%;
    --sidebar-foreground: 0 0% 98%;
    --sidebar-primary: 158 64% 51%;
    --sidebar-primary-foreground: 165 91% 9%;
    --sidebar-accent: 172 66% 50%;
    --sidebar-accent-foreground: 178 84% 10%;
    --sidebar-border: 0 0% 32%;
    --sidebar-ring: 158 64% 51%;
    --chart-1: 156 71% 66%;
    --chart-2: 141 76% 73%;
    --chart-3: 170 76% 64%;
    --chart-4: 81 84% 67%;
    --chart-5: 0 0% 45%;
    --sidebar: 0 0% 14%;
    --shadow-2xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
    --shadow-xs: 0 1px 3px 0px hsl(0 0% 0% / 0.05);
    --shadow-sm: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
    --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1);
    --shadow-md: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 2px 4px -1px hsl(0 0% 0% / 0.1);
    --shadow-lg: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 4px 6px -1px hsl(0 0% 0% / 0.1);
    --shadow-xl: 0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 8px 10px -1px hsl(0 0% 0% / 0.1);
    --shadow-2xl: 0 1px 3px 0px hsl(0 0% 0% / 0.25);
    --delight-warm: 158 72% 54%;
    --delight-cool: 188 82% 56%;
    --delight-glow: 160 85% 58%;
    --delight-surface: 0 0% 16%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    background-image:
      radial-gradient(1100px 520px at -6% -12%, hsl(var(--delight-warm) / 0.17), transparent 58%),
      radial-gradient(900px 500px at 102% -8%, hsl(var(--delight-cool) / 0.12), transparent 56%),
      linear-gradient(180deg, hsl(var(--background)), hsl(var(--background)));
    background-attachment: fixed;
  }
}

@keyframes delight-hero-drift {
  0%,
  100% {
    background-position: 0% 0%, 100% 0%;
  }
  50% {
    background-position: 6% 12%, 94% -8%;
  }
}

@keyframes delight-enhance-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 hsl(var(--delight-glow) / 0.3), 0 16px 36px -24px hsl(var(--delight-glow) / 0.55);
  }
  50% {
    box-shadow: 0 0 0 8px hsl(var(--delight-glow) / 0), 0 20px 42px -22px hsl(var(--delight-glow) / 0.78);
  }
}

@keyframes delight-enhance-ignite {
  0% {
    transform: translateY(0) scale(0.995);
    box-shadow: 0 10px 24px -20px hsl(var(--delight-glow) / 0.38);
  }
  55% {
    transform: translateY(-1px) scale(1.016);
    box-shadow: 0 18px 38px -20px hsl(var(--delight-glow) / 0.86);
  }
  100% {
    transform: translateY(0) scale(1);
    box-shadow: 0 14px 30px -20px hsl(var(--delight-glow) / 0.65);
  }
}

@keyframes delight-enhance-stream {
  0%,
  100% {
    transform: translateY(0);
    box-shadow: 0 13px 30px -22px hsl(var(--delight-glow) / 0.58);
  }
  50% {
    transform: translateY(-1px);
    box-shadow: 0 18px 36px -18px hsl(var(--delight-glow) / 0.82);
  }
}

@keyframes delight-enhance-settle-button {
  0% {
    transform: translateY(0) scale(1);
    box-shadow: 0 14px 30px -20px hsl(var(--delight-glow) / 0.68);
  }
  60% {
    transform: translateY(-1px) scale(1.01);
    box-shadow: 0 20px 38px -18px hsl(var(--delight-glow) / 0.85);
  }
  100% {
    transform: translateY(0) scale(1);
    box-shadow: 0 14px 30px -20px hsl(var(--delight-glow) / 0.62);
  }
}

@keyframes delight-enhance-success-wave {
  from {
    transform: scale(0.5);
    opacity: 0.62;
  }
  to {
    transform: scale(1.55);
    opacity: 0;
  }
}

@keyframes delight-enhance-sheen {
  from {
    transform: translateX(-130%);
  }
  to {
    transform: translateX(130%);
  }
}

@keyframes delight-settle {
  0% {
    transform: translateY(2px) scale(0.995);
    box-shadow: 0 0 0 0 hsl(var(--delight-glow) / 0);
  }
  60% {
    transform: translateY(-1px) scale(1.003);
    box-shadow: 0 0 0 6px hsl(var(--delight-glow) / 0.08);
  }
  100% {
    transform: translateY(0) scale(1);
    box-shadow: 0 10px 26px -18px hsl(var(--delight-glow) / 0.4);
  }
}

@layer components {
  .delight-hero {
    @apply rounded-2xl border border-border/70 px-4 py-5 sm:px-6 sm:py-7 shadow-sm;
    background-image:
      radial-gradient(480px 180px at 8% -12%, hsl(var(--delight-warm) / 0.2), transparent 58%),
      radial-gradient(420px 180px at 90% -20%, hsl(var(--delight-cool) / 0.16), transparent 54%),
      linear-gradient(180deg, hsl(var(--delight-surface) / 0.6), hsl(var(--card) / 0.85));
    backdrop-filter: blur(8px);
    animation: delight-hero-drift 18s ease-in-out infinite;
  }

  .interactive-chip {
    transition:
      transform 180ms var(--motion-snap),
      box-shadow 180ms var(--motion-snap),
      background-color 180ms var(--motion-snap),
      border-color 180ms var(--motion-snap),
      color 180ms var(--motion-snap);
    box-shadow: 0 4px 14px -14px hsl(var(--foreground) / 0.65);
  }

  .interactive-chip:hover {
    transform: translateY(-1px);
    box-shadow: 0 9px 20px -16px hsl(var(--foreground) / 0.78);
  }

  .interactive-chip:active {
    transform: translateY(0) scale(0.98);
  }

  .interactive-card {
    transition:
      transform 220ms var(--motion-snap),
      box-shadow 220ms var(--motion-snap),
      border-color 220ms var(--motion-snap);
    box-shadow: 0 8px 22px -24px hsl(var(--foreground) / 0.86);
  }

  .interactive-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 40px -30px hsl(var(--foreground) / 0.8);
  }

  .interactive-card:active {
    transform: translateY(0) scale(0.995);
  }

  .enhance-output-frame {
    @apply border-border/90;
    transition:
      border-color 220ms var(--motion-snap),
      box-shadow 220ms var(--motion-snap),
      background-color 220ms var(--motion-snap);
  }

  .enhance-output-streaming {
    position: relative;
    isolation: isolate;
    box-shadow: 0 20px 34px -32px hsl(var(--delight-glow) / 0.62);
    border-color: hsl(var(--delight-glow) / 0.45);
  }

  .enhance-output-streaming::after {
    content: "";
    position: absolute;
    inset: -1px;
    z-index: -1;
    background: linear-gradient(
      110deg,
      transparent 34%,
      hsl(var(--delight-glow) / 0.12) 49%,
      transparent 64%
    );
    animation: delight-enhance-sheen 1700ms linear infinite;
    pointer-events: none;
  }

  .enhance-output-complete {
    animation: delight-settle 420ms var(--motion-snap) both;
    border-color: hsl(var(--delight-glow) / 0.55);
  }

  .signature-enhance-button {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    box-shadow: 0 14px 30px -20px hsl(var(--delight-glow) / 0.62);
  }

  .signature-enhance-button::after {
    content: "";
    position: absolute;
    inset: -12%;
    border-radius: inherit;
    background: radial-gradient(circle, hsl(var(--delight-glow) / 0.32) 0%, transparent 68%);
    opacity: 0;
    pointer-events: none;
    transform: scale(0.5);
  }

  .signature-enhance-button[data-phase="starting"] {
    animation: delight-enhance-ignite 520ms var(--motion-snap) both;
  }

  .signature-enhance-button[data-phase="streaming"] {
    animation:
      delight-enhance-stream 960ms ease-in-out infinite,
      delight-enhance-pulse 1200ms ease-in-out infinite;
  }

  .signature-enhance-button[data-phase="settling"] {
    animation: delight-enhance-settle-button 480ms var(--motion-snap) both;
  }

  .signature-enhance-button[data-phase="done"] {
    border-color: hsl(var(--delight-glow) / 0.62);
    box-shadow: 0 14px 34px -22px hsl(var(--delight-glow) / 0.72);
  }

  .signature-enhance-button[data-phase="done"]::after {
    opacity: 1;
    animation: delight-enhance-success-wave 620ms var(--motion-snap) 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .delight-hero,
  .enhance-output-streaming::after,
  .signature-enhance-button[data-phase="starting"],
  .signature-enhance-button[data-phase="streaming"],
  .signature-enhance-button[data-phase="settling"],
  .signature-enhance-button[data-phase="done"]::after,
  .enhance-output-complete {
    animation: none !important;
  }

  .signature-enhance-button::after {
    opacity: 0 !important;
  }

  .interactive-chip:hover,
  .interactive-chip:active,
  .interactive-card:hover,
  .interactive-card:active {
    transform: none !important;
  }
}
````

## File: src/components/Header.tsx
````typescript
import { useState } from "react";
import { Moon, Sun, Zap, BookOpen, History, LogIn, LogOut, Users, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenTemplates?: () => void;
  onOpenHistory?: () => void;
}

export function Header({ isDark, onToggleTheme, onOpenTemplates, onOpenHistory }: HeaderProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const isCommunityRoute = location.pathname.startsWith("/community");

  const initials = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string)
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : "?";

  return (
    <>
      <header className="border-b border-border/80 bg-card/75 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-12 sm:h-14 px-3 sm:px-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="interactive-chip flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-primary-foreground">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">PromptForge</span>
          </div>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            {onOpenTemplates && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenTemplates}
                aria-label="Open prompt library"
                className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Library</span>
              </Button>
            )}
            {onOpenHistory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenHistory}
                aria-label="Open version history"
                className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">History</span>
              </Button>
            )}
            <Button
              asChild
              variant={isCommunityRoute ? "outline" : "ghost"}
              size="sm"
              className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
            >
              <Link to={isCommunityRoute ? "/" : "/community"} aria-label={isCommunityRoute ? "Open builder" : "Open community"}>
                {isCommunityRoute ? <PenSquare className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                <span className="hidden sm:inline text-sm">{isCommunityRoute ? "Builder" : "Community"}</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="interactive-chip w-8 h-8 sm:w-9 sm:h-9"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="interactive-chip w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0">
                    <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                      <AvatarImage src={user.user_metadata?.avatar_url as string | undefined} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuthOpen(true)}
                className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Sign in</span>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
````

## File: src/hooks/usePromptBuilder.ts
````typescript
import { useState, useCallback, useEffect, useRef } from "react";
import { PromptConfig, defaultConfig, buildPrompt, scorePrompt } from "@/lib/prompt-builder";
import type {
  ContextSource,
  StructuredContext,
  InterviewAnswer,
  DatabaseConnection,
  RagParameters,
} from "@/lib/context-types";
import { defaultContextConfig } from "@/lib/context-types";
import {
  listTemplateSummaries as listLocalTemplateSummaries,
  type SaveTemplateResult,
  type TemplateLoadResult,
  type TemplateSummary,
} from "@/lib/template-store";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import * as persistence from "@/lib/persistence";
import { computeRemixDiff } from "@/lib/community";

const STORAGE_KEY = "promptforge-draft";
const LOCAL_VERSIONS_KEY = "promptforge-local-versions";
const DRAFT_AUTOSAVE_DELAY_MS = 700;
const MAX_LOCAL_VERSIONS = 50;

interface RemixContext {
  postId: string;
  parentTitle: string;
  parentAuthor: string;
  parentConfig: PromptConfig;
  parentTags: string[];
  parentCategory: string;
}

function hydrateConfig(raw: unknown): PromptConfig {
  if (!raw || typeof raw !== "object") return defaultConfig;
  const candidate = raw as Partial<PromptConfig>;
  return {
    ...defaultConfig,
    ...candidate,
    format: Array.isArray(candidate.format) ? candidate.format : [],
    constraints: Array.isArray(candidate.constraints) ? candidate.constraints : [],
    contextConfig: {
      ...defaultContextConfig,
      ...(candidate.contextConfig || {}),
      sources: Array.isArray(candidate.contextConfig?.sources) ? candidate.contextConfig.sources : [],
      databaseConnections: Array.isArray(candidate.contextConfig?.databaseConnections)
        ? candidate.contextConfig.databaseConnections
        : [],
      rag: {
        ...defaultContextConfig.rag,
        ...(candidate.contextConfig?.rag || {}),
        documentRefs: Array.isArray(candidate.contextConfig?.rag?.documentRefs)
          ? candidate.contextConfig.rag.documentRefs
          : [],
      },
      structured: {
        ...defaultContextConfig.structured,
        ...(candidate.contextConfig?.structured || {}),
      },
      interviewAnswers: Array.isArray(candidate.contextConfig?.interviewAnswers)
        ? candidate.contextConfig.interviewAnswers
        : [],
    },
  };
}

function loadLocalDraft(): PromptConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? hydrateConfig(JSON.parse(saved)) : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

function isPromptVersion(value: unknown): value is persistence.PromptVersion {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.timestamp === "number"
  );
}

function loadLocalVersions(): persistence.PromptVersion[] {
  try {
    const saved = localStorage.getItem(LOCAL_VERSIONS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPromptVersion).sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_LOCAL_VERSIONS);
  } catch {
    return [];
  }
}

function saveLocalVersions(versions: persistence.PromptVersion[]): void {
  try {
    localStorage.setItem(LOCAL_VERSIONS_KEY, JSON.stringify(versions.slice(0, MAX_LOCAL_VERSIONS)));
  } catch {
    // quota errors are intentionally ignored to keep the UI responsive
  }
}

function clearLocalVersions(): void {
  try {
    localStorage.removeItem(LOCAL_VERSIONS_KEY);
  } catch {
    // ignore
  }
}

function toPromptSummary(template: TemplateSummary): persistence.PromptSummary {
  return {
    ...template,
    category: "general",
    isShared: false,
    targetModel: "",
    useCase: "",
    remixedFrom: null,
    builtPrompt: "",
    enhancedPrompt: "",
    upvoteCount: 0,
    verifiedCount: 0,
    remixCount: 0,
    commentCount: 0,
  };
}

export function usePromptBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id ?? null;
  const [config, setConfig] = useState<PromptConfig>(loadLocalDraft);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [versions, setVersions] = useState<persistence.PromptVersion[]>(loadLocalVersions);
  const [templateSummaries, setTemplateSummaries] = useState<persistence.PromptSummary[]>(() =>
    listLocalTemplateSummaries().map(toPromptSummary),
  );
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isCloudHydrated, setIsCloudHydrated] = useState(false);
  const [remixContext, setRemixContext] = useState<RemixContext | null>(null);

  const prevUserId = useRef<string | null>(null);
  const draftSaveError = useRef<string | null>(null);
  const authLoadToken = useRef(0);
  const autosaveToken = useRef(0);
  const editsSinceAuthChange = useRef(false);

  const showPersistenceError = useCallback(
    (title: string, error: unknown, fallback: string) => {
      toast({
        title,
        description: persistence.getPersistenceErrorMessage(error, fallback),
        variant: "destructive",
      });
    },
    [toast],
  );

  const markDraftDirty = useCallback(() => {
    editsSinceAuthChange.current = true;
    setIsDraftDirty(true);
  }, []);

  useEffect(() => {
    if (userId) return;
    saveLocalVersions(versions);
  }, [userId, versions]);

  // Load draft/prompts/versions when the auth identity changes.
  useEffect(() => {
    const previousUserId = prevUserId.current;
    if (userId === previousUserId) return;
    prevUserId.current = userId;
    draftSaveError.current = null;
    editsSinceAuthChange.current = false;
    setIsDraftDirty(false);
    setEnhancedPrompt("");
    setConfig(defaultConfig);
    setTemplateSummaries([]);
    setVersions([]);
    setRemixContext(null);

    const token = ++authLoadToken.current;

    if (!userId) {
      setIsCloudHydrated(true);
      setConfig(loadLocalDraft());
      setTemplateSummaries(listLocalTemplateSummaries().map(toPromptSummary));
      setVersions(loadLocalVersions());
      return;
    }

    const migrateVersionsFromGuestToCloud = !previousUserId
      ? async () => {
          const localVersions = loadLocalVersions();
          if (localVersions.length === 0) return;

          const migration = await Promise.allSettled(
            localVersions.map((version) => persistence.saveVersion(userId, version.name, version.prompt)),
          );
          const failedVersions = localVersions.filter((_, index) => migration[index]?.status === "rejected");
          const failedCount = failedVersions.length;
          if (failedCount > 0) {
            saveLocalVersions(failedVersions);
            toast({
              title: "Some local versions were not migrated",
              description:
                failedCount === 1
                  ? "1 local version could not be copied to cloud history."
                  : `${failedCount} local versions could not be copied to cloud history.`,
              variant: "destructive",
            });
            return;
          }
          clearLocalVersions();
        }
      : async () => {};

    setIsCloudHydrated(false);

    void Promise.allSettled([
      persistence.loadDraft(userId),
      persistence.loadPrompts(userId),
      (async () => {
        await migrateVersionsFromGuestToCloud();
        return persistence.loadVersions(userId);
      })(),
    ]).then(([draftResult, promptsResult, versionsResult]) => {
      if (token !== authLoadToken.current) return;

      if (draftResult.status === "fulfilled") {
        if (draftResult.value && !editsSinceAuthChange.current) {
          setConfig(hydrateConfig(draftResult.value));
        } else if (draftResult.value && editsSinceAuthChange.current) {
          toast({
            title: "Cloud draft was not applied",
            description: "You started editing before cloud draft finished loading, so your current edits were kept.",
          });
        }
      } else {
        showPersistenceError("Failed to load draft", draftResult.reason, "Failed to load draft.");
      }

      if (promptsResult.status === "fulfilled") {
        setTemplateSummaries(promptsResult.value);
      } else {
        setTemplateSummaries([]);
        showPersistenceError("Failed to load prompts", promptsResult.reason, "Failed to load prompts.");
      }

      if (versionsResult.status === "fulfilled") {
        setVersions(versionsResult.value);
      } else {
        setVersions([]);
        showPersistenceError(
          "Failed to load version history",
          versionsResult.reason,
          "Failed to load version history.",
        );
      }

      setIsCloudHydrated(true);
      if (!editsSinceAuthChange.current) {
        setIsDraftDirty(false);
      }
    });
  }, [userId, showPersistenceError, toast]);

  const refreshTemplateSummaries = useCallback(async () => {
    if (userId) {
      try {
        const summaries = await persistence.loadPrompts(userId);
        setTemplateSummaries(summaries);
      } catch (error) {
        showPersistenceError("Failed to refresh prompts", error, "Failed to refresh prompts.");
      }
    } else {
      setTemplateSummaries(listLocalTemplateSummaries().map(toPromptSummary));
    }
  }, [userId, showPersistenceError]);

  const saveDraftSafely = useCallback(
    async (nextConfig: PromptConfig, saveToken: number) => {
      try {
        await persistence.saveDraft(userId, nextConfig);
        draftSaveError.current = null;
        if (saveToken === autosaveToken.current) {
          setIsDraftDirty(false);
        }
      } catch (error) {
        const message = persistence.getPersistenceErrorMessage(error, "Failed to save draft.");
        if (draftSaveError.current !== message) {
          draftSaveError.current = message;
          toast({
            title: "Draft auto-save failed",
            description: message,
            variant: "destructive",
          });
        }
      }
    },
    [userId, toast],
  );

  // Auto-save draft (debounced)
  useEffect(() => {
    if (!isDraftDirty) return;
    if (userId && !isCloudHydrated) return;

    const saveToken = ++autosaveToken.current;
    const timeout = setTimeout(() => {
      void saveDraftSafely(config, saveToken);
    }, DRAFT_AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [config, isDraftDirty, userId, isCloudHydrated, saveDraftSafely]);

  const updateConfig = useCallback(
    (updates: Partial<PromptConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
    setEnhancedPrompt("");
    setRemixContext(null);
    if (!userId) {
      persistence.clearLocalDraft();
      setIsDraftDirty(false);
      editsSinceAuthChange.current = false;
      return;
    }
    markDraftDirty();
  }, [userId, markDraftDirty]);

  const clearOriginalPrompt = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      originalPrompt: "",
    }));
    setEnhancedPrompt("");
    markDraftDirty();
  }, [markDraftDirty]);

  // Context-specific updaters
  const updateContextSources = useCallback(
    (sources: ContextSource[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, sources },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateDatabaseConnections = useCallback(
    (databaseConnections: DatabaseConnection[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, databaseConnections },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateRagParameters = useCallback(
    (ragUpdates: Partial<RagParameters>) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: {
          ...prev.contextConfig,
          rag: { ...prev.contextConfig.rag, ...ragUpdates },
        },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateContextStructured = useCallback(
    (updates: Partial<StructuredContext>) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: {
          ...prev.contextConfig,
          structured: { ...prev.contextConfig.structured, ...updates },
        },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateContextInterview = useCallback(
    (answers: InterviewAnswer[]) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, interviewAnswers: answers },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const updateProjectNotes = useCallback(
    (notes: string) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, projectNotes: notes },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const toggleDelimiters = useCallback(
    (value: boolean) => {
      setConfig((prev) => ({
        ...prev,
        contextConfig: { ...prev.contextConfig, useDelimiters: value },
      }));
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const builtPrompt = buildPrompt(config);
  const score = scorePrompt(config);

  const saveVersion = useCallback(
    (name?: string) => {
      const promptToSave = enhancedPrompt || builtPrompt;
      if (!promptToSave) return;
      const versionName = name || `Version ${versions.length + 1}`;

      if (userId) {
        void persistence
          .saveVersion(userId, versionName, promptToSave)
          .then((saved) => {
            if (saved) setVersions((prev) => [saved, ...prev]);
          })
          .catch((error) => {
            showPersistenceError("Failed to save version", error, "Failed to save version.");
          });
      } else {
        const version: persistence.PromptVersion = {
          id: Date.now().toString(),
          name: versionName,
          prompt: promptToSave,
          timestamp: Date.now(),
        };
        setVersions((prev) => [version, ...prev].slice(0, MAX_LOCAL_VERSIONS));
      }
    },
    [enhancedPrompt, builtPrompt, versions.length, userId, showPersistenceError],
  );

  const loadTemplate = useCallback(
    (template: {
      role: string;
      task: string;
      context: string;
      format: string[];
      lengthPreference: string;
      tone: string;
      complexity: string;
      constraints: string[];
      examples: string;
    }) => {
      setConfig({
        ...defaultConfig,
        role: template.role,
        task: template.task,
        context: template.context,
        format: template.format,
        lengthPreference: template.lengthPreference,
        tone: template.tone,
        complexity: template.complexity,
        constraints: template.constraints,
        examples: template.examples,
      });
      setEnhancedPrompt("");
      setRemixContext(null);
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const startRemix = useCallback(
    (input: {
      postId: string;
      title: string;
      authorName?: string;
      publicConfig: PromptConfig;
      parentTags?: string[];
      parentCategory?: string;
    }) => {
      setConfig(hydrateConfig(input.publicConfig));
      setEnhancedPrompt("");
      setRemixContext({
        postId: input.postId,
        parentTitle: input.title,
        parentAuthor: input.authorName || "Community member",
        parentConfig: hydrateConfig(input.publicConfig),
        parentTags: input.parentTags ?? [],
        parentCategory: input.parentCategory ?? "general",
      });
      markDraftDirty();
    },
    [markDraftDirty],
  );

  const clearRemix = useCallback(() => {
    setRemixContext(null);
  }, []);

  const savePrompt = useCallback(
    async (input: {
      title: string;
      description?: string;
      tags?: string[];
      category?: string;
      targetModel?: string;
      useCase?: string;
      remixNote?: string;
    }): Promise<SaveTemplateResult> => {
      const remixPayload = remixContext
        ? {
            remixedFrom: remixContext.postId,
            remixNote: input.remixNote,
            remixDiff: computeRemixDiff(remixContext.parentConfig, config, {
              parentTags: remixContext.parentTags,
              childTags: input.tags,
              parentCategory: remixContext.parentCategory,
              childCategory: input.category,
            }),
          }
        : {};
      const result = await persistence.savePrompt(userId, {
        name: input.title,
        description: input.description,
        tags: input.tags,
        category: input.category,
        targetModel: input.targetModel,
        useCase: input.useCase,
        config,
        builtPrompt: builtPrompt || "",
        enhancedPrompt: enhancedPrompt || "",
        ...remixPayload,
      });
      await refreshTemplateSummaries();
      if (remixContext) setRemixContext(null);
      return result;
    },
    [config, builtPrompt, enhancedPrompt, userId, refreshTemplateSummaries, remixContext],
  );

  const saveAndSharePrompt = useCallback(
    async (input: {
      title: string;
      description?: string;
      tags?: string[];
      category?: string;
      targetModel?: string;
      useCase: string;
      remixNote?: string;
    }): Promise<SaveTemplateResult> => {
      if (!userId) {
        throw new Error("Sign in to share prompts.");
      }

      const remixPayload = remixContext
        ? {
            remixedFrom: remixContext.postId,
            remixNote: input.remixNote,
            remixDiff: computeRemixDiff(remixContext.parentConfig, config, {
              parentTags: remixContext.parentTags,
              childTags: input.tags,
              parentCategory: remixContext.parentCategory,
              childCategory: input.category,
            }),
          }
        : {};
      const result = await persistence.savePrompt(userId, {
        name: input.title,
        description: input.description,
        tags: input.tags,
        category: input.category,
        targetModel: input.targetModel,
        useCase: input.useCase,
        config,
        builtPrompt: builtPrompt || "",
        enhancedPrompt: enhancedPrompt || "",
        ...remixPayload,
      });

      const shared = await persistence.sharePrompt(userId, result.record.metadata.id, {
        title: input.title,
        description: input.description,
        category: input.category,
        tags: input.tags,
        targetModel: input.targetModel,
        useCase: input.useCase,
      });
      if (!shared) {
        throw new Error("Prompt was saved but could not be shared.");
      }

      await refreshTemplateSummaries();
      if (remixContext) setRemixContext(null);
      return result;
    },
    [config, builtPrompt, enhancedPrompt, userId, refreshTemplateSummaries, remixContext],
  );

  const shareSavedPrompt = useCallback(
    async (id: string, input?: persistence.PromptShareInput): Promise<boolean> => {
      const shared = await persistence.sharePrompt(userId, id, input);
      if (shared) await refreshTemplateSummaries();
      return shared;
    },
    [userId, refreshTemplateSummaries],
  );

  const unshareSavedPrompt = useCallback(
    async (id: string): Promise<boolean> => {
      const unshared = await persistence.unsharePrompt(userId, id);
      if (unshared) await refreshTemplateSummaries();
      return unshared;
    },
    [userId, refreshTemplateSummaries],
  );

  const saveAsTemplate = useCallback(
    async (input: {
      name: string;
      description?: string;
      tags?: string[];
    }): Promise<SaveTemplateResult> => {
      return savePrompt({
        title: input.name,
        description: input.description,
        tags: input.tags,
      });
    },
    [savePrompt],
  );

  const loadSavedTemplate = useCallback(
    async (id: string): Promise<TemplateLoadResult | null> => {
      const loaded = await persistence.loadPromptById(userId, id);
      if (!loaded) return null;
      setConfig(hydrateConfig(loaded.record.state.promptConfig));
      setEnhancedPrompt("");
      setRemixContext(null);
      markDraftDirty();
      return loaded;
    },
    [userId, markDraftDirty],
  );

  const deleteSavedTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      const deleted = await persistence.deletePrompt(userId, id);
      if (deleted) await refreshTemplateSummaries();
      return deleted;
    },
    [userId, refreshTemplateSummaries],
  );

  return {
    config,
    updateConfig,
    resetConfig,
    clearOriginalPrompt,
    builtPrompt,
    score,
    enhancedPrompt,
    setEnhancedPrompt,
    isEnhancing,
    setIsEnhancing,
    isSignedIn: Boolean(userId),
    versions,
    saveVersion,
    loadTemplate,
    savePrompt,
    saveAndSharePrompt,
    shareSavedPrompt,
    unshareSavedPrompt,
    saveAsTemplate,
    loadSavedTemplate,
    deleteSavedTemplate,
    templateSummaries,
    remixContext,
    startRemix,
    clearRemix,
    // Context-specific
    updateContextSources,
    updateDatabaseConnections,
    updateRagParameters,
    updateContextStructured,
    updateContextInterview,
    updateProjectNotes,
    toggleDelimiters,
  };
}
````

## File: src/components/OutputPanel.tsx
````typescript
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Sparkles, Save, Loader2, GitCompare, Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
import { buildLineDiff, type DiffLine } from "@/lib/text-diff";
import { cn } from "@/lib/utils";

export type EnhancePhase = "idle" | "starting" | "streaming" | "settling" | "done";

interface SavePromptInput {
  name: string;
  description?: string;
  tags?: string[];
  category?: string;
  remixNote?: string;
}

interface SaveAndSharePromptInput extends SavePromptInput {
  useCase: string;
  targetModel?: string;
}

interface OutputPanelProps {
  builtPrompt: string;
  enhancedPrompt: string;
  isEnhancing: boolean;
  onEnhance: () => void;
  onSaveVersion: () => void;
  onSavePrompt: (input: SavePromptInput) => void;
  onSaveAndSharePrompt: (input: SaveAndSharePromptInput) => void;
  canSavePrompt: boolean;
  canSharePrompt: boolean;
  hideEnhanceButton?: boolean;
  enhancePhase?: EnhancePhase;
  remixContext?: { title: string; authorName: string };
}

function parseTags(value: string): string[] | undefined {
  const tags = Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 8);

  return tags.length > 0 ? tags : undefined;
}

export function OutputPanel({
  builtPrompt,
  enhancedPrompt,
  isEnhancing,
  onEnhance,
  onSaveVersion,
  onSavePrompt,
  onSaveAndSharePrompt,
  canSavePrompt,
  canSharePrompt,
  hideEnhanceButton = false,
  enhancePhase = "idle",
  remixContext,
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  const [promptName, setPromptName] = useState("");
  const [promptDescription, setPromptDescription] = useState("");
  const [promptTags, setPromptTags] = useState("");
  const [promptCategory, setPromptCategory] = useState("general");
  const [promptRemixNote, setPromptRemixNote] = useState("");

  const [shareName, setShareName] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareTags, setShareTags] = useState("");
  const [shareCategory, setShareCategory] = useState("general");
  const [shareUseCase, setShareUseCase] = useState("");
  const [shareTargetModel, setShareTargetModel] = useState("");
  const [shareConfirmedSafe, setShareConfirmedSafe] = useState(false);
  const [shareRemixNote, setShareRemixNote] = useState("");

  const { toast } = useToast();
  const displayPrompt = enhancedPrompt || builtPrompt;
  const isStreamingVisual = enhancePhase === "starting" || enhancePhase === "streaming";
  const isSettledVisual = enhancePhase === "settling" || enhancePhase === "done";
  const statusLabel =
    enhancePhase === "starting"
      ? "Starting"
      : enhancePhase === "streaming"
        ? "Streaming"
        : enhancePhase === "settling"
          ? "Finalizing"
          : enhancePhase === "done"
            ? "Ready"
            : null;
  const enhanceLabel = isEnhancing
    ? enhancePhase === "starting"
      ? "Priming..."
      : enhancePhase === "settling"
        ? "Finalizing..."
        : "Enhancing..."
    : enhancePhase === "done"
      ? "Enhanced"
      : "Enhance with AI";
  const hasCompare = Boolean(
    builtPrompt.trim() && enhancedPrompt.trim() && builtPrompt.trim() !== enhancedPrompt.trim()
  );

  const diff = useMemo(() => {
    if (!hasCompare) return null;
    return buildLineDiff(builtPrompt, enhancedPrompt);
  }, [hasCompare, builtPrompt, enhancedPrompt]);

  useEffect(() => {
    if (remixContext) {
      if (!promptName.trim()) {
        setPromptName(`Remix of ${remixContext.title}`);
      }
      if (!shareName.trim()) {
        setShareName(`Remix of ${remixContext.title}`);
      }
    } else {
      setPromptRemixNote("");
      setShareRemixNote("");
    }
  }, [remixContext, promptName, shareName]);

  const handleCopy = async () => {
    if (!displayPrompt) return;
    try {
      await navigator.clipboard.writeText(displayPrompt);
      setCopied(true);
      toast({ title: "Copied to clipboard!", description: "Paste it into your favorite AI tool." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access is blocked. Copy manually from the preview.",
        variant: "destructive",
      });
    }
  };

  const handleSavePrompt = () => {
    if (!promptName.trim()) return;

    onSavePrompt({
      name: promptName.trim(),
      description: promptDescription.trim() || undefined,
      tags: parseTags(promptTags),
      category: promptCategory,
      remixNote: remixContext ? promptRemixNote.trim() || undefined : undefined,
    });

    setPromptDialogOpen(false);
    setPromptName("");
    setPromptDescription("");
    setPromptTags("");
    setPromptCategory("general");
    setPromptRemixNote("");
  };

  const handleSaveAndSharePrompt = () => {
    if (!canSharePrompt) return;
    if (!shareName.trim() || !shareUseCase.trim() || !shareConfirmedSafe) return;

    onSaveAndSharePrompt({
      name: shareName.trim(),
      description: shareDescription.trim() || undefined,
      tags: parseTags(shareTags),
      category: shareCategory,
      useCase: shareUseCase.trim(),
      targetModel: shareTargetModel.trim() || undefined,
      remixNote: remixContext ? shareRemixNote.trim() || undefined : undefined,
    });

    setShareDialogOpen(false);
    setShareName("");
    setShareDescription("");
    setShareTags("");
    setShareCategory("general");
    setShareUseCase("");
    setShareTargetModel("");
    setShareConfirmedSafe(false);
    setShareRemixNote("");
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">
            {enhancedPrompt ? "✨ Enhanced Prompt" : "📝 Preview"}
          </h2>
          {statusLabel && (
            <span className="interactive-chip inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {statusLabel}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!hasCompare} className="gap-1 text-xs">
                <GitCompare className="w-3 h-3" />
                Compare
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Before vs After</DialogTitle>
                <DialogDescription>
                  {diff
                    ? `${diff.added} added, ${diff.removed} removed`
                    : "Generate an enhanced prompt to compare changes."}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border border-border bg-card overflow-auto flex-1 min-h-[280px]">
                <div className="font-mono text-xs leading-relaxed">
                  <div className="px-3 py-1.5 border-b border-border text-muted-foreground">
                    --- before
                  </div>
                  <div className="px-3 py-1.5 border-b border-border text-muted-foreground">
                    +++ after
                  </div>
                  {diff?.lines.map((line, index) => (
                    <DiffRow key={`${line.type}-${index}`} line={line} />
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!canSavePrompt} className="gap-1 text-xs">
                <Save className="w-3 h-3" />
                Save Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Save Prompt</DialogTitle>
                <DialogDescription>
                  Save a private prompt snapshot to your library.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {remixContext && (
                  <div className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
                    Remixing {remixContext.authorName}’s “{remixContext.title}”
                  </div>
                )}
                <Input
                  value={promptName}
                  onChange={(event) => setPromptName(event.target.value)}
                  placeholder="Prompt title"
                  className="bg-background"
                />
                <Select value={promptCategory} onValueChange={setPromptCategory}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMPT_CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={promptDescription}
                  onChange={(event) => setPromptDescription(event.target.value)}
                  placeholder="Description (optional)"
                  className="min-h-[90px] bg-background"
                />
                <Input
                  value={promptTags}
                  onChange={(event) => setPromptTags(event.target.value)}
                  placeholder="Tags (comma-separated, optional)"
                  className="bg-background"
                />
                {remixContext && (
                  <Textarea
                    value={promptRemixNote}
                    onChange={(event) => setPromptRemixNote(event.target.value)}
                    placeholder="Remix note (optional)"
                    className="min-h-[80px] bg-background"
                  />
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPromptDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSavePrompt} disabled={!promptName.trim()}>
                  Save Prompt
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={!canSharePrompt} className="gap-1 text-xs">
                <Share2 className="w-3 h-3" />
                Save & Share
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Save & Share Prompt</DialogTitle>
                <DialogDescription>
                  Publish this prompt recipe to the community feed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {remixContext && (
                  <div className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">
                    Remixing {remixContext.authorName}’s “{remixContext.title}”
                  </div>
                )}
                <Input
                  value={shareName}
                  onChange={(event) => setShareName(event.target.value)}
                  placeholder="Prompt title"
                  className="bg-background"
                />
                <Select value={shareCategory} onValueChange={setShareCategory}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMPT_CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={shareDescription}
                  onChange={(event) => setShareDescription(event.target.value)}
                  placeholder="Description (optional)"
                  className="min-h-[80px] bg-background"
                />
                <Input
                  value={shareTags}
                  onChange={(event) => setShareTags(event.target.value)}
                  placeholder="Tags (comma-separated, optional)"
                  className="bg-background"
                />
                <Textarea
                  value={shareUseCase}
                  onChange={(event) => setShareUseCase(event.target.value)}
                  placeholder="Use case (required)"
                  className="min-h-[90px] bg-background"
                />
                <Input
                  value={shareTargetModel}
                  onChange={(event) => setShareTargetModel(event.target.value)}
                  placeholder="Target model (optional)"
                  className="bg-background"
                />
                {remixContext && (
                  <Textarea
                    value={shareRemixNote}
                    onChange={(event) => setShareRemixNote(event.target.value)}
                    placeholder="Remix note (optional)"
                    className="min-h-[80px] bg-background"
                  />
                )}
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={shareConfirmedSafe}
                    onChange={(event) => setShareConfirmedSafe(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>I confirm this prompt contains no secrets or private data.</span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAndSharePrompt}
                  disabled={!shareName.trim() || !shareUseCase.trim() || !shareConfirmedSafe}
                >
                  Save & Share
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="ghost" size="sm" onClick={onSaveVersion} disabled={!displayPrompt} className="gap-1 text-xs">
            <Save className="w-3 h-3" />
            Save Version
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!displayPrompt} className="gap-1 text-xs">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <Card
        className={cn(
          "enhance-output-frame flex-1 p-4 bg-card overflow-auto",
          isStreamingVisual && "enhance-output-streaming",
          isSettledVisual && "enhance-output-complete"
        )}
      >
        {displayPrompt ? (
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
            {displayPrompt}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[120px] sm:min-h-[200px]">
            <p className="text-sm text-muted-foreground text-center">
              Your enhanced prompt will appear here.
              <br />
              Start by entering a prompt or choosing a template.
            </p>
          </div>
        )}
      </Card>

      {!hideEnhanceButton && (
        <Button
          variant="glow"
          size="lg"
          onClick={onEnhance}
          disabled={isEnhancing || !builtPrompt}
          className="signature-enhance-button w-full gap-2"
          data-phase={enhancePhase}
        >
          {isEnhancing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {enhanceLabel}
            </>
          ) : (
            <>
              {enhancePhase === "done" ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {enhanceLabel}
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const marker = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
  const rowClass =
    line.type === "add"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : line.type === "remove"
        ? "bg-red-500/10 text-red-700 dark:text-red-300"
        : "text-foreground";

  return (
    <div className={`px-3 whitespace-pre-wrap break-words ${rowClass}`}>
      <span className="inline-block w-4 select-none">{marker}</span>
      {line.value}
    </div>
  );
}
````

## File: src/pages/Index.tsx
````typescript
import { lazy, Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { PromptInput } from "@/components/PromptInput";
import { BuilderTabs } from "@/components/BuilderTabs";
import { ContextPanel } from "@/components/ContextPanel";
import { ToneControls } from "@/components/ToneControls";
import { QualityScore } from "@/components/QualityScore";
import { OutputPanel, type EnhancePhase } from "@/components/OutputPanel";
import { usePromptBuilder } from "@/hooks/usePromptBuilder";
import { streamEnhance } from "@/lib/ai-client";
import { getSectionHealth, type SectionHealthState } from "@/lib/section-health";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PromptTemplate } from "@/lib/templates";
import type { PromptShareInput } from "@/lib/persistence";
import { loadPost, loadProfilesByIds } from "@/lib/community";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Loader2,
  Eye,
  Target,
  Layout as LayoutIcon,
  MessageSquare,
  BarChart3,
  Check,
  CircleDashed,
  Gauge,
  CheckCircle2,
  X,
} from "lucide-react";

const PromptLibrary = lazy(async () => {
  const module = await import("@/components/PromptLibrary");
  return { default: module.PromptLibrary };
});

const VersionHistory = lazy(async () => {
  const module = await import("@/components/VersionHistory");
  return { default: module.VersionHistory };
});

const healthBadgeStyles: Record<
  SectionHealthState,
  { label: string; className: string; icon: LucideIcon }
> = {
  empty: {
    label: "Empty",
    className: "border-border/80 bg-muted/50 text-muted-foreground",
    icon: CircleDashed,
  },
  in_progress: {
    label: "In progress",
    className: "border-primary/30 bg-primary/10 text-primary",
    icon: Gauge,
  },
  complete: {
    label: "Complete",
    className: "border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
  },
};

function SectionHealthBadge({ state }: { state: SectionHealthState }) {
  const meta = healthBadgeStyles[state];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.className}`}
      title={meta.label}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
}

const Index = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const remixId = searchParams.get("remix");
  const remixLoadToken = useRef(0);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [enhancePhase, setEnhancePhase] = useState<EnhancePhase>("idle");
  const enhancePhaseTimers = useRef<number[]>([]);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const {
    config,
    updateConfig,
    clearOriginalPrompt,
    builtPrompt,
    score,
    enhancedPrompt,
    setEnhancedPrompt,
    isEnhancing,
    setIsEnhancing,
    isSignedIn,
    versions,
    saveVersion,
    loadTemplate,
    savePrompt,
    saveAndSharePrompt,
    shareSavedPrompt,
    unshareSavedPrompt,
    loadSavedTemplate,
    deleteSavedTemplate,
    templateSummaries,
    remixContext,
    startRemix,
    clearRemix,
    updateContextSources,
    updateDatabaseConnections,
    updateRagParameters,
    updateContextStructured,
    updateContextInterview,
    updateProjectNotes,
    toggleDelimiters,
  } = usePromptBuilder();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (!remixId) return;
    if (remixContext?.postId === remixId) return;
    const token = ++remixLoadToken.current;

    void (async () => {
      try {
        const post = await loadPost(remixId);
        if (token !== remixLoadToken.current) return;
        if (!post) {
          toast({ title: "Remix unavailable", description: "That community prompt could not be loaded." });
          return;
        }
        const [author] = await loadProfilesByIds([post.authorId]);
        if (token !== remixLoadToken.current) return;

        startRemix({
          postId: post.id,
          title: post.title,
          authorName: author?.displayName,
          publicConfig: post.publicConfig,
          parentTags: post.tags,
          parentCategory: post.category,
        });
        toast({ title: "Remix ready", description: `Loaded “${post.title}” into the builder.` });
      } catch (error) {
        if (token !== remixLoadToken.current) return;
        toast({
          title: "Failed to load remix",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    })();
  }, [remixId, remixContext?.postId, startRemix, toast]);

  const handleClearRemix = useCallback(() => {
    clearRemix();
    if (!remixId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("remix");
    setSearchParams(next, { replace: true });
  }, [clearRemix, remixId, searchParams, setSearchParams]);

  const clearEnhanceTimers = useCallback(() => {
    enhancePhaseTimers.current.forEach((timer) => window.clearTimeout(timer));
    enhancePhaseTimers.current = [];
  }, []);

  useEffect(() => {
    return () => clearEnhanceTimers();
  }, [clearEnhanceTimers]);

  const handleEnhance = useCallback(() => {
    if (!builtPrompt || isEnhancing) return;
    clearEnhanceTimers();
    setEnhancePhase("starting");
    setIsEnhancing(true);
    setEnhancedPrompt("");

    if (isMobile) setDrawerOpen(true);

    let accumulated = "";
    let hasReceivedDelta = false;
    streamEnhance({
      prompt: builtPrompt,
      onDelta: (text) => {
        if (!hasReceivedDelta) {
          hasReceivedDelta = true;
          setEnhancePhase("streaming");
        }
        accumulated += text;
        setEnhancedPrompt(accumulated);
      },
      onDone: () => {
        setIsEnhancing(false);
        setEnhancePhase("settling");
        const doneTimer = window.setTimeout(() => {
          setEnhancePhase("done");
        }, 260);
        const idleTimer = window.setTimeout(() => {
          setEnhancePhase("idle");
        }, 1800);
        enhancePhaseTimers.current.push(doneTimer, idleTimer);
        toast({ title: "Prompt enhanced!", description: "Your prompt has been optimized by AI." });
      },
      onError: (error) => {
        clearEnhanceTimers();
        setIsEnhancing(false);
        setEnhancePhase("idle");
        toast({ title: "Enhancement failed", description: error, variant: "destructive" });
      },
    });
  }, [builtPrompt, clearEnhanceTimers, isEnhancing, setIsEnhancing, setEnhancedPrompt, toast, isMobile]);

  useEffect(() => {
    if (isEnhancing) return;
    clearEnhanceTimers();
    setEnhancePhase("idle");
  }, [builtPrompt, clearEnhanceTimers, isEnhancing]);

  const handleSelectTemplate = useCallback(
    (template: PromptTemplate) => {
      loadTemplate(template);
      toast({ title: `Template loaded: ${template.name}` });
    },
    [loadTemplate, toast]
  );

  const handleSelectSavedTemplate = useCallback(
    async (id: string) => {
      try {
        const loaded = await loadSavedTemplate(id);
        if (!loaded) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({
          title: `Prompt loaded: ${loaded.record.metadata.name}`,
          description:
            loaded.warnings.length > 0
              ? `${loaded.warnings.length} context warning(s). Review integrations before running.`
              : "Prompt restored successfully.",
        });
      } catch (error) {
        toast({
          title: "Failed to load prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [loadSavedTemplate, toast]
  );

  const handleDeleteSavedTemplate = useCallback(
    async (id: string) => {
      try {
        const deleted = await deleteSavedTemplate(id);
        if (!deleted) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({ title: "Saved prompt deleted" });
      } catch (error) {
        toast({
          title: "Failed to delete prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [deleteSavedTemplate, toast]
  );

  const handleShareSavedPrompt = useCallback(
    async (id: string, input?: PromptShareInput) => {
      if (!isSignedIn) {
        toast({ title: "Sign in required", description: "Sign in to share prompts.", variant: "destructive" });
        return;
      }

      try {
        const shared = await shareSavedPrompt(id, input);
        if (!shared) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({ title: "Prompt shared to community" });
      } catch (error) {
        toast({
          title: "Failed to share prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [isSignedIn, shareSavedPrompt, toast],
  );

  const handleUnshareSavedPrompt = useCallback(
    async (id: string) => {
      try {
        const unshared = await unshareSavedPrompt(id);
        if (!unshared) {
          toast({ title: "Prompt not found", variant: "destructive" });
          return;
        }
        toast({ title: "Prompt removed from community" });
      } catch (error) {
        toast({
          title: "Failed to unshare prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [unshareSavedPrompt, toast],
  );

  const handleSavePrompt = useCallback(
    async (input: { name: string; description?: string; tags?: string[]; category?: string; remixNote?: string }) => {
      try {
        const result = await savePrompt({
          title: input.name,
          description: input.description,
          tags: input.tags,
          category: input.category,
          remixNote: input.remixNote,
        });
        const warningText =
          result.warnings.length > 0
            ? ` ${result.warnings.length} validation warning(s) were recorded.`
            : "";
        const verb =
          result.outcome === "created"
            ? "saved"
            : result.outcome === "updated"
              ? "updated"
              : "unchanged";
        toast({
          title: `Prompt ${verb}: ${result.record.metadata.name}`,
          description: `Revision r${result.record.metadata.revision}.${warningText}`,
        });
        if (remixContext) {
          handleClearRemix();
        }
      } catch (error) {
        toast({
          title: "Failed to save prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [savePrompt, toast, remixContext, handleClearRemix]
  );

  const handleSaveAndSharePrompt = useCallback(
    async (input: {
      name: string;
      description?: string;
      tags?: string[];
      category?: string;
      useCase: string;
      targetModel?: string;
      remixNote?: string;
    }) => {
      if (!isSignedIn) {
        toast({ title: "Sign in required", description: "Sign in to share prompts.", variant: "destructive" });
        return;
      }

      try {
        const result = await saveAndSharePrompt({
          title: input.name,
          description: input.description,
          tags: input.tags,
          category: input.category,
          useCase: input.useCase,
          targetModel: input.targetModel,
          remixNote: input.remixNote,
        });
        toast({
          title: `Prompt shared: ${result.record.metadata.name}`,
          description: `Revision r${result.record.metadata.revision}.`,
        });
        if (remixContext) {
          handleClearRemix();
        }
      } catch (error) {
        toast({
          title: "Failed to save & share prompt",
          description: error instanceof Error ? error.message : "Unexpected error",
          variant: "destructive",
        });
      }
    },
    [isSignedIn, saveAndSharePrompt, toast, remixContext, handleClearRemix]
  );

  // Keyboard shortcut: Ctrl+Enter to enhance
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleEnhance();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleEnhance]);

  // Status indicators for accordion triggers
  const sourceCount = config.contextConfig.sources.length;
  const sectionHealth = getSectionHealth(config, score.total);
  const selectedRole = config.customRole || config.role;
  const displayPrompt = enhancedPrompt || builtPrompt;
  const canSavePrompt =
    !!config.task.trim() ||
    !!config.originalPrompt.trim() ||
    config.contextConfig.sources.length > 0 ||
    config.contextConfig.databaseConnections.length > 0 ||
    !!config.contextConfig.rag.vectorStoreRef.trim();
  const canSharePrompt = canSavePrompt && isSignedIn;
  const mobileEnhanceLabel = isEnhancing
    ? enhancePhase === "starting"
      ? "Starting…"
      : enhancePhase === "settling"
        ? "Finalizing…"
        : "Enhancing…"
    : enhancePhase === "done"
      ? "Enhanced"
      : "Enhance";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <main className="flex-1 container mx-auto px-4 py-3 sm:py-6">
        {/* Hero — compact on mobile */}
        <div className="delight-hero text-center mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-foreground mb-1 sm:mb-2 tracking-tight">
            Transform Basic Prompts into
            <span className="text-primary"> Pro-Level Instructions</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm md:text-base max-w-xl mx-auto hidden sm:block">
            Build structured, effective prompts that get better AI results—every time.
            No prompt engineering expertise required.
          </p>
        </div>

        {remixContext && (
          <Card className="mb-4 border-primary/30 bg-primary/5 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-primary">Remix mode</p>
                <p className="text-sm font-medium text-foreground">
                  Remixing {remixContext.parentAuthor}’s “{remixContext.parentTitle}”
                </p>
                <p className="text-xs text-muted-foreground">
                  Your changes will be attributed when you save or share.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearRemix} className="gap-1 text-xs">
                <X className="h-3 w-3" />
                Clear remix
              </Button>
            </div>
          </Card>
        )}

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left: Input & Builder — accordion on all sizes for consistency */}
          <div className="space-y-3 sm:space-y-4">
            {/* Prompt input always visible */}
            <PromptInput
              value={config.originalPrompt}
              onChange={(v) => updateConfig({ originalPrompt: v })}
              onClear={clearOriginalPrompt}
            />

            {/* Accordion sections */}
            <Accordion
              type="multiple"
              defaultValue={["builder"]}
              className="space-y-1"
            >
              <AccordionItem value="builder" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    Builder
                  </span>
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    {selectedRole && (
                      <Badge variant="secondary" className="max-w-[120px] truncate text-[10px]">
                        {selectedRole}
                      </Badge>
                    )}
                    <SectionHealthBadge state={sectionHealth.builder} />
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <BuilderTabs config={config} onUpdate={updateConfig} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="context" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <LayoutIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    Context & Sources
                  </span>
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    {sourceCount > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {sourceCount} src
                      </Badge>
                    )}
                    <SectionHealthBadge state={sectionHealth.context} />
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ContextPanel
                    contextConfig={config.contextConfig}
                    onUpdateSources={updateContextSources}
                    onUpdateDatabaseConnections={updateDatabaseConnections}
                    onUpdateRag={updateRagParameters}
                    onUpdateStructured={updateContextStructured}
                    onUpdateInterview={updateContextInterview}
                    onUpdateProjectNotes={updateProjectNotes}
                    onToggleDelimiters={toggleDelimiters}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="tone" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    Tone & Style
                  </span>
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    {config.tone && (
                      <Badge variant="secondary" className="text-[10px]">
                        {config.tone}
                      </Badge>
                    )}
                    <SectionHealthBadge state={sectionHealth.tone} />
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ToneControls
                    tone={config.tone}
                    complexity={config.complexity}
                    onUpdate={updateConfig}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="quality" className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 text-sm hover:no-underline gap-2">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                    Quality Score
                  </span>
                  <span className="ml-auto mr-2 flex items-center gap-1.5">
                    <Badge
                      variant={score.total >= 75 ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {score.total}/100
                    </Badge>
                    <SectionHealthBadge state={sectionHealth.quality} />
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <QualityScore score={score} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Right: Output — inline on desktop, drawer on mobile */}
          {!isMobile && (
            <div className="lg:sticky lg:top-20 lg:self-start">
              <OutputPanel
                builtPrompt={builtPrompt}
                enhancedPrompt={enhancedPrompt}
                isEnhancing={isEnhancing}
                enhancePhase={enhancePhase}
                onEnhance={handleEnhance}
                onSaveVersion={saveVersion}
                onSavePrompt={handleSavePrompt}
                onSaveAndSharePrompt={handleSaveAndSharePrompt}
                canSavePrompt={canSavePrompt}
                canSharePrompt={canSharePrompt}
                remixContext={
                  remixContext
                    ? { title: remixContext.parentTitle, authorName: remixContext.parentAuthor }
                    : undefined
                }
              />
              <p className="text-xs text-muted-foreground text-center mt-3">
                Press <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded border border-border font-mono">Ctrl+Enter</kbd> to enhance
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile: sticky bottom bar */}
      {isMobile && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border px-4 py-3 flex gap-2">
          <Button
            variant="glow"
            size="default"
            onClick={handleEnhance}
            disabled={isEnhancing || !builtPrompt}
            className="signature-enhance-button flex-1 gap-2"
            data-phase={enhancePhase}
          >
            {isEnhancing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mobileEnhanceLabel}
              </>
            ) : (
              <>
                {enhancePhase === "done" ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {mobileEnhanceLabel}
              </>
            )}
          </Button>
          {displayPrompt && (
            <Button
              variant="outline"
              size="default"
              onClick={() => setDrawerOpen(true)}
              className="gap-1.5"
            >
              <Eye className="w-4 h-4" />
              Output
            </Button>
          )}
        </div>
      )}

      {/* Mobile: output drawer */}
      {isMobile && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>
                {enhancedPrompt ? "✨ Enhanced Prompt" : "📝 Preview"}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-auto flex-1">
              <OutputPanel
                builtPrompt={builtPrompt}
                enhancedPrompt={enhancedPrompt}
                isEnhancing={isEnhancing}
                enhancePhase={enhancePhase}
                onEnhance={handleEnhance}
                onSaveVersion={saveVersion}
                onSavePrompt={handleSavePrompt}
                onSaveAndSharePrompt={handleSaveAndSharePrompt}
                canSavePrompt={canSavePrompt}
                canSharePrompt={canSharePrompt}
                hideEnhanceButton
                remixContext={
                  remixContext
                    ? { title: remixContext.parentTitle, authorName: remixContext.parentAuthor }
                    : undefined
                }
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Add bottom padding on mobile for sticky bar */}
      {isMobile && <div className="h-20" />}

      <Suspense fallback={null}>
        {templatesOpen && (
          <PromptLibrary
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            savedPrompts={templateSummaries}
            onSelectTemplate={handleSelectTemplate}
            onSelectSaved={handleSelectSavedTemplate}
            onDeleteSaved={handleDeleteSavedTemplate}
            onShareSaved={handleShareSavedPrompt}
            onUnshareSaved={handleUnshareSavedPrompt}
            canShareSavedPrompts={isSignedIn}
          />
        )}

        {historyOpen && (
          <VersionHistory
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            versions={versions}
            onRestore={(prompt) => {
              setEnhancedPrompt(prompt);
              toast({ title: "Version restored" });
            }}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Index;
````
