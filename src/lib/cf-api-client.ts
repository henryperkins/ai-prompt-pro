/**
 * Cloudflare Workers API Client
 * RESTful API client for drafts, prompts, community, and profiles
 */

export type { RemixDiff } from "@/lib/community";
import { resolveApiUrl, resolveAuthUrl } from "@/lib/worker-endpoints";

// ============================================================
// Types
// ============================================================

export interface AuthSession {
  user: {
    id: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface Draft {
  id: string;
  config: unknown;
  updated_at: number;
}

export interface SavedPrompt {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  config: unknown;
  built_prompt?: string;
  enhanced_prompt?: string;
  fingerprint: string;
  revision: number;
  is_shared: boolean;
  target_model: string;
  use_case: string;
  remixed_from: string | null;
  remix_note?: string;
  remix_diff?: unknown | null;
  community_post_id?: string | null;
  upvote_count?: number;
  verified_count?: number;
  remix_count?: number;
  comment_count?: number;
  created_at: number;
  updated_at: number;
}

export interface PromptVersionRecord {
  id: string;
  name: string;
  prompt: string;
  created_at: number;
}

export interface CommunityPost {
  id: string;
  saved_prompt_id: string;
  author_id: string;
  title: string;
  enhanced_prompt: string;
  description: string;
  use_case: string;
  category: string;
  tags: string[];
  target_model: string;
  is_public: boolean;
  public_config: unknown;
  starter_prompt: string;
  remixed_from: string | null;
  remix_note: string;
  remix_diff: unknown | null;
  upvote_count: number;
  verified_count: number;
  remix_count: number;
  comment_count: number;
  created_at: number;
  updated_at: number;
}

export interface Vote {
  id: string;
  post_id: string;
  user_id: string;
  vote_type: "upvote" | "verified";
  created_at: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: number;
  updated_at: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

// ============================================================
// HTTP utilities
// ============================================================

async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  return fetch(url, { ...options, headers });
}

function handleResponse<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})).then((payload) => {
    if (!response.ok) {
      const errorMessage = typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : null;
      const message = response.status === 401
        ? `Unauthorized${errorMessage ? `: ${errorMessage}` : ""}`
        : response.status === 403
          ? `Forbidden${errorMessage ? `: ${errorMessage}` : ""}`
          : response.status === 404
            ? `Not found${errorMessage ? `: ${errorMessage}` : ""}`
            : response.status === 409
              ? `Conflict${errorMessage ? `: ${errorMessage}` : ""}`
              : errorMessage || `Request failed: ${response.status}`;
      throw new Error(message);
    }
    return payload as T;
  });
}

// ============================================================
// Auth API
// ============================================================

export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  const response = await fetch(resolveAuthUrl("/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });

  return handleResponse(response);
}

export async function login(
  email: string,
  password: string
): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  const response = await fetch(resolveAuthUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return handleResponse(response);
}

export async function refreshToken(
  refreshToken: string
): Promise<{ accessToken: string }> {
  const response = await fetch(resolveAuthUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  return handleResponse(response);
}

export async function logout(refreshToken?: string): Promise<void> {
  await fetch(resolveAuthUrl("/auth/logout"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function getSession(
  accessToken?: string
): Promise<{ authenticated: boolean; user?: AuthUser }> {
  if (!accessToken) {
    return { authenticated: false };
  }

  const response = await fetchWithAuth(
    resolveAuthUrl("/auth/session"),
    {},
    accessToken
  );

  return handleResponse(response);
}

export async function deleteAccount(accessToken: string): Promise<void> {
  await fetchWithAuth(resolveAuthUrl("/auth/account"), {
    method: "DELETE",
  }, accessToken);
}

// ============================================================
// Drafts API
// ============================================================

export async function loadDraft(accessToken: string): Promise<{ config: unknown } | null> {
  const response = await fetchWithAuth(resolveApiUrl("/api/drafts"), {}, accessToken);

  if (response.status === 404) {
    return null;
  }

  return handleResponse(response);
}

export async function saveDraft(
  accessToken: string,
  config: unknown
): Promise<{ id: string; updated_at: number }> {
  const response = await fetchWithAuth(resolveApiUrl("/api/drafts"), {
    method: "POST",
    body: JSON.stringify({ config }),
  }, accessToken);

  return handleResponse(response);
}

export async function deleteDraft(accessToken: string): Promise<{ deleted: boolean }> {
  const response = await fetchWithAuth(resolveApiUrl("/api/drafts"), {
    method: "DELETE",
  }, accessToken);

  return handleResponse(response);
}

// ============================================================
// Prompts API
// ============================================================

export async function loadPrompts(accessToken: string): Promise<SavedPrompt[]> {
  const response = await fetchWithAuth(resolveApiUrl("/api/prompts"), {}, accessToken);
  return handleResponse(response);
}

export async function loadPromptById(
  accessToken: string,
  promptId: string
): Promise<SavedPrompt | null> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/prompts/${promptId}`),
    {},
    accessToken
  );

  if (response.status === 404) {
    return null;
  }

  return handleResponse(response);
}

export async function createPrompt(
  accessToken: string,
  input: {
    title: string;
    description?: string;
    category?: string;
    tags?: string[];
    config: unknown;
    built_prompt?: string;
    enhanced_prompt?: string;
    target_model?: string;
    use_case?: string;
    remixed_from?: string | null;
    remix_note?: string;
    remix_diff?: RemixDiff | null;
  }
): Promise<{ id: string; revision: number }> {
  const response = await fetchWithAuth(resolveApiUrl("/api/prompts"), {
    method: "POST",
    body: JSON.stringify(input),
  }, accessToken);

  return handleResponse(response);
}

export async function updatePrompt(
  accessToken: string,
  promptId: string,
  input: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    config?: unknown;
    built_prompt?: string;
    enhanced_prompt?: string;
    target_model?: string;
    use_case?: string;
    is_shared?: boolean;
    remixed_from?: string | null;
    remix_note?: string;
    remix_diff?: RemixDiff | null;
    expected_revision?: number;
  }
): Promise<{ revision: number }> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/prompts/${promptId}`),
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    accessToken
  );

  return handleResponse(response);
}

export async function deletePrompt(
  accessToken: string,
  promptId: string
): Promise<{ deleted: boolean }> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/prompts/${promptId}`),
    {
      method: "DELETE",
    },
    accessToken
  );

  return handleResponse(response);
}

export async function sharePrompt(
  accessToken: string,
  promptId: string,
  input: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
    targetModel?: string;
    target_model?: string;
    useCase?: string;
    use_case?: string;
  }
): Promise<{ shared: boolean; postId?: string; post_id?: string }> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/prompts/${promptId}/share`),
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    accessToken
  );

  return handleResponse(response);
}

export async function unsharePrompt(
  accessToken: string,
  promptId: string
): Promise<{ unshared: boolean }> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/prompts/${promptId}/unshare`),
    {
      method: "POST",
    },
    accessToken
  );

  return handleResponse(response);
}

// ============================================================
// Community API
// ============================================================

export async function getCommunityPosts(
  filters?: {
    category?: string;
    tag?: string;
    sort?: "created_at" | "upvotes" | "verified" | "remixes";
    cursor?: string;
    limit?: number;
  }
): Promise<{ posts: CommunityPost[]; next_cursor: string | null }> {
  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  if (filters?.tag) params.set("tag", filters.tag);
  if (filters?.sort) params.set("sort", filters.sort);
  if (filters?.cursor) params.set("cursor", filters.cursor);
  if (filters?.limit) params.set("limit", String(filters.limit));

  const response = await fetch(resolveApiUrl(`/api/community?${params.toString()}`));
  return handleResponse(response);
}

export async function getCommunityPostById(postId: string): Promise<CommunityPost | null> {
  const response = await fetch(resolveApiUrl(`/api/community/${postId}`));

  if (response.status === 404) {
    return null;
  }

  return handleResponse(response);
}

export async function createVote(
  accessToken: string,
  postId: string,
  voteType: "upvote" | "verified"
): Promise<{ voted: boolean }> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/community/${postId}/vote`),
    {
      method: "POST",
      body: JSON.stringify({ voteType }),
    },
    accessToken
  );

  return handleResponse(response);
}

export async function deleteVote(
  accessToken: string,
  postId: string
): Promise<{ deleted: boolean }> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/community/${postId}/vote`),
    {
      method: "DELETE",
    },
    accessToken
  );

  return handleResponse(response);
}

export async function getCommentsByPostId(postId: string): Promise<Comment[]> {
  const response = await fetch(resolveApiUrl(`/api/community/${postId}/comments`));
  return handleResponse(response);
}

export async function createComment(
  accessToken: string,
  postId: string,
  body: string
): Promise<{ id: string }> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/community/${postId}/comments`),
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
    accessToken
  );

  return handleResponse(response);
}

export async function updateComment(
  accessToken: string,
  commentId: string,
  body: string
): Promise<{ updated: boolean }> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/community/comments/${commentId}`),
    {
      method: "PUT",
      body: JSON.stringify({ body }),
    },
    accessToken
  );

  return handleResponse(response);
}

export async function deleteComment(
  accessToken: string,
  commentId: string
): Promise<{ deleted: boolean }> {
  const response = await fetchWithAuth(
    resolveApiUrl(`/api/community/comments/${commentId}`),
    {
      method: "DELETE",
    },
    accessToken
  );

  return handleResponse(response);
}

// ============================================================
// Profiles API
// ============================================================

export async function getProfile(accessToken: string): Promise<Profile | null> {
  const response = await fetchWithAuth(resolveApiUrl("/api/profile/me"), {}, accessToken);

  if (response.status === 404) {
    return null;
  }

  return handleResponse(response);
}

export async function updateProfile(
  accessToken: string,
  input: {
    display_name?: string;
    avatar_url?: string;
  }
): Promise<{ updated: boolean }> {
  const response = await fetchWithAuth(
    resolveApiUrl("/api/profile/me"),
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
    accessToken
  );

  return handleResponse(response);
}

export async function loadVersions(accessToken: string): Promise<PromptVersionRecord[]> {
  const response = await fetchWithAuth(resolveApiUrl("/api/versions"), {}, accessToken);
  return handleResponse(response);
}

export async function saveVersion(
  accessToken: string,
  name: string,
  prompt: string
): Promise<PromptVersionRecord> {
  const response = await fetchWithAuth(resolveApiUrl("/api/versions"), {
    method: "POST",
    body: JSON.stringify({ name, prompt }),
  }, accessToken);

  return handleResponse(response);
}
