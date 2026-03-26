import type { Json } from "@/integrations/neon/types";
import { apiFetch, apiFetchOptional, getAccessToken } from "@/lib/api-client";
import { assertBackendConfigured } from "@/lib/backend-config";
import type { PromptSummary as PersistencePromptSummary } from "@/lib/persistence";
import {
  deletePrompt as deleteSavedPromptForUser,
  loadPromptById as loadPromptTemplateById,
  loadPrompts as loadPersistedPrompts,
  savePrompt as savePersistedPrompt,
  sharePrompt as shareSavedPromptForUser,
  unsharePrompt as unshareSavedPromptForUser,
} from "@/lib/persistence";
import type { PromptConfig } from "@/lib/prompt-builder";
import { defaultConfig } from "@/lib/prompt-builder";
import { requireUserId } from "@/lib/require-user-id";
import { normalizePromptTags, sanitizePostgresText } from "@/lib/saved-prompt-shared";
import { assertCommunityTextAllowed } from "@/lib/content-moderation";
import {
  inferTemplateStarterPrompt,
  normalizeTemplateConfig,
  type TemplateLoadResult,
} from "@/lib/template-store";

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
  containsGithubSources: boolean;
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
  tag?: string;
  search?: string;
  cursor?: string;
  page?: number;
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
  ratingCount?: number;
  ratingAverage?: number;
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
  createdAt?: number | null;
}

export interface FollowStats {
  followersCount: number;
  followingCount: number;
}

export interface ProfileActivityStats {
  totalPosts: number;
  totalUpvotes: number;
  totalVerified: number;
  averageRating: number;
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

interface ApiCommunityPost {
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
  public_config: unknown;
  starter_prompt: string;
  remixed_from: string | null;
  remix_note: string;
  remix_diff: Json | null;
  upvote_count: number;
  verified_count: number;
  remix_count: number;
  comment_count: number;
  rating_count?: number | null;
  rating_avg?: number | null;
  created_at: number;
  updated_at: number;
}

interface ApiCommunityComment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: number;
  updated_at: number;
}

interface ApiCommunityProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at?: number | null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallback);
}

function ensureCommunityBackend(featureLabel = "Community features"): void {
  assertBackendConfigured(featureLabel);
}

function mapPersistedPromptSummary(row: PersistencePromptSummary): SavedPromptSummary {
  return {
    id: row.id,
    title: row.name,
    description: row.description,
    category: row.category,
    tags: row.tags,
    starterPrompt: row.starterPrompt,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    revision: row.revision,
    schemaVersion: row.schemaVersion,
    sourceCount: row.sourceCount,
    databaseCount: row.databaseCount,
    ragEnabled: row.ragEnabled,
    containsGithubSources: row.containsGithubSources,
    isShared: row.isShared,
    targetModel: row.targetModel,
    useCase: row.useCase,
    remixedFrom: row.remixedFrom,
  };
}

function mapTemplateRecordToSavedPrompt(record: TemplateLoadResult): SavedPromptRecord {
  const metadata = record.record.metadata as typeof record.record.metadata & {
    category?: string;
    isShared?: boolean;
    targetModel?: string;
    useCase?: string;
    remixedFrom?: string | null;
    builtPrompt?: string;
    enhancedPrompt?: string;
  };

  return {
    id: metadata.id,
    userId: "",
    title: metadata.name,
    description: metadata.description,
    category: metadata.category || "general",
    tags: metadata.tags,
    config: normalizeTemplateConfig(record.record.state.promptConfig),
    builtPrompt: metadata.builtPrompt || "",
    enhancedPrompt: metadata.enhancedPrompt || "",
    fingerprint: metadata.fingerprint,
    revision: metadata.revision,
    isShared: Boolean(metadata.isShared),
    targetModel: metadata.targetModel || "",
    useCase: metadata.useCase || "",
    remixedFrom: metadata.remixedFrom || null,
    remixNote: "",
    remixDiff: null,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
}

function mapCommunityPost(row: ApiCommunityPost): CommunityPost {
  return {
    id: row.id,
    savedPromptId: row.saved_prompt_id,
    authorId: row.author_id,
    title: row.title,
    enhancedPrompt: row.enhanced_prompt,
    description: row.description,
    useCase: row.use_case,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    targetModel: row.target_model,
    isPublic: Boolean(row.is_public),
    publicConfig: normalizeTemplateConfig((row.public_config ?? defaultConfig) as PromptConfig),
    starterPrompt: row.starter_prompt,
    remixedFrom: row.remixed_from,
    remixNote: row.remix_note,
    remixDiff: row.remix_diff,
    upvoteCount: row.upvote_count,
    verifiedCount: row.verified_count,
    remixCount: row.remix_count,
    commentCount: row.comment_count,
    ratingCount: typeof row.rating_count === "number" ? row.rating_count : 0,
    ratingAverage: typeof row.rating_avg === "number" ? row.rating_avg : 0,
    createdAt: row.created_at * 1000,
    updatedAt: row.updated_at * 1000,
  };
}

function mapCommunityComment(row: ApiCommunityComment): CommunityComment {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at * 1000,
    updatedAt: row.updated_at * 1000,
  };
}

function mapCommunityProfile(row: ApiCommunityProfile): CommunityProfile {
  return {
    id: row.id,
    displayName: row.display_name?.trim() || "Community member",
    avatarUrl: row.avatar_url?.trim() || null,
    createdAt: typeof row.created_at === "number" ? row.created_at * 1000 : null,
  };
}

export async function listMyPrompts(input: ListMyPromptsInput = {}): Promise<SavedPromptSummary[]> {
  const { query, category, tag, sort = "recent", limit = 100 } = input;
  const userId = await requireUserId("Community prompts");

  try {
    const prompts = await loadPersistedPrompts(userId);
    const normalizedQuery = query?.trim().toLowerCase() || "";
    const normalizedTag = tag?.trim().toLowerCase();
    let filtered = prompts.map(mapPersistedPromptSummary);

    if (category && category !== "all") {
      filtered = filtered.filter((prompt) => prompt.category === category);
    }
    if (normalizedTag) {
      filtered = filtered.filter((prompt) => prompt.tags.includes(normalizedTag));
    }
    if (normalizedQuery) {
      filtered = filtered.filter((prompt) =>
        [prompt.title, prompt.description, prompt.useCase].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      );
    }

    if (sort === "name") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "revision") {
      filtered.sort((a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt);
    } else {
      filtered.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return filtered.slice(0, Math.min(Math.max(limit, 1), 200));
  } catch (error) {
    throw toError(error, "Failed to load your prompts.");
  }
}

export async function loadMyPromptById(id: string): Promise<SavedPromptRecord | null> {
  const userId = await requireUserId("Community prompts");

  try {
    const loaded = await loadPromptTemplateById(userId, id);
    if (!loaded) return null;
    const record = mapTemplateRecordToSavedPrompt(loaded);
    return { ...record, userId };
  } catch (error) {
    throw toError(error, "Failed to load prompt.");
  }
}

export async function savePrompt(input: SavePromptInput): Promise<SavePromptResult> {
  const userId = await requireUserId("Community prompts");

  try {
    const result = await savePersistedPrompt(userId, {
      id: input.id,
      name: input.title,
      description: input.description,
      tags: input.tags,
      category: input.category,
      config: input.config,
      builtPrompt: input.builtPrompt,
      enhancedPrompt: input.enhancedPrompt,
      targetModel: input.targetModel,
      useCase: input.useCase,
      isShared: input.isShared,
      remixedFrom: input.remixedFrom,
      remixNote: input.remixNote,
      remixDiff: input.remixDiff,
    });

    const prompt = await loadMyPromptById(result.record.metadata.id);
    if (!prompt) {
      throw new Error("Prompt save returned no data.");
    }

    return {
      outcome: result.outcome,
      prompt,
      warnings: result.warnings,
    };
  } catch (error) {
    throw toError(error, "Failed to save prompt.");
  }
}

export async function deletePrompt(id: string): Promise<boolean> {
  const userId = await requireUserId("Community prompts");

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
  const userId = await requireUserId("Community sharing");

  try {
    const result = await shareSavedPromptForUser(userId, savedPromptId, {
      useCase: shareMeta?.useCase,
      targetModel: shareMeta?.targetModel,
      category: shareMeta?.category,
      tags: shareMeta?.tags,
      title: shareMeta?.title,
      description: shareMeta?.description,
    });
    return result.shared;
  } catch (error) {
    throw toError(error, "Failed to share prompt.");
  }
}

export async function unsharePrompt(savedPromptId: string): Promise<boolean> {
  const userId = await requireUserId("Community sharing");

  try {
    return await unshareSavedPromptForUser(userId, savedPromptId);
  } catch (error) {
    throw toError(error, "Failed to unshare prompt.");
  }
}

export async function loadFeed(input: LoadFeedInput = {}): Promise<CommunityPost[]> {
  ensureCommunityBackend("Community feed");
  const search = new URLSearchParams();
  search.set("sort", input.sort || "new");
  search.set("limit", String(Math.min(Math.max(input.limit || 25, 1), 100)));
  search.set("page", String(Math.max(input.page || 0, 0)));
  if (input.category && input.category !== "all") search.set("category", input.category);
  if (input.tag) search.set("tag", input.tag.trim().toLowerCase());
  if (input.search?.trim()) search.set("search", input.search.trim());
  if (input.cursor) search.set("cursor", input.cursor);

  try {
    const result = await apiFetch<{ posts: ApiCommunityPost[]; next_cursor: string | null }>(
      `/api/community?${search.toString()}`,
    );
    return (result.posts || []).map(mapCommunityPost);
  } catch (error) {
    throw toError(error, "Failed to load community feed.");
  }
}

export async function loadPostsByAuthor(
  authorId: string,
  options: { page?: number; limit?: number } = {},
): Promise<CommunityPost[]> {
  ensureCommunityBackend("Community profiles");
  if (!isUuid(authorId)) {
    throw new Error("This profile link is invalid or expired.");
  }

  const search = new URLSearchParams({
    page: String(Math.max(options.page || 0, 0)),
    limit: String(Math.min(Math.max(options.limit || 25, 1), 100)),
  });

  try {
    const rows = await apiFetch<ApiCommunityPost[]>(`/api/profiles/${authorId}/posts?${search.toString()}`);
    return rows.map(mapCommunityPost);
  } catch (error) {
    throw toError(error, "Failed to load profile posts.");
  }
}

export async function loadFollowingUserIds(): Promise<string[]> {
  await requireUserId("Community follows");

  try {
    return await apiFetch<string[]>("/api/follows");
  } catch (error) {
    throw toError(error, "Failed to load follow list.");
  }
}

export async function loadPersonalFeed(options: { page?: number; limit?: number } = {}): Promise<CommunityPost[]> {
  await requireUserId("Personal feed");
  const search = new URLSearchParams({
    page: String(Math.max(options.page || 0, 0)),
    limit: String(Math.min(Math.max(options.limit || 25, 1), 100)),
  });

  try {
    const rows = await apiFetch<ApiCommunityPost[]>(`/api/community/personal?${search.toString()}`);
    return rows.map(mapCommunityPost);
  } catch (error) {
    throw toError(error, "Failed to load personal feed.");
  }
}

export async function loadPost(postId: string): Promise<CommunityPost | null> {
  ensureCommunityBackend("Community posts");
  if (!isUuid(postId)) {
    throw new Error("This link is invalid or expired.");
  }

  try {
    const row = await apiFetchOptional<ApiCommunityPost>(`/api/community/${postId}`);
    return row ? mapCommunityPost(row) : null;
  } catch (error) {
    throw toError(error, "Failed to load community post.");
  }
}

export async function loadPostsByIds(postIds: string[]): Promise<CommunityPost[]> {
  ensureCommunityBackend("Community posts");
  const uniqueIds = Array.from(new Set(postIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  try {
    const rows = await apiFetch<ApiCommunityPost[]>("/api/community/by-ids", {
      method: "POST",
      body: JSON.stringify({ ids: uniqueIds }),
    });
    return rows.map(mapCommunityPost);
  } catch (error) {
    throw toError(error, "Failed to load related community posts.");
  }
}

export async function loadProfilesByIds(userIds: string[]): Promise<CommunityProfile[]> {
  ensureCommunityBackend("Community profiles");
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];
  if (uniqueIds.some((id) => !isUuid(id))) {
    throw new Error("This profile link is invalid or expired.");
  }

  try {
    const rows = await apiFetch<ApiCommunityProfile[]>("/api/profiles/by-ids", {
      method: "POST",
      body: JSON.stringify({ ids: uniqueIds }),
    });
    return rows.map(mapCommunityProfile);
  } catch (error) {
    throw toError(error, "Failed to load community profiles.");
  }
}

export async function loadFollowStats(userId: string): Promise<FollowStats> {
  ensureCommunityBackend("Community follows");
  if (!userId) {
    return { followersCount: 0, followingCount: 0 };
  }
  if (!isUuid(userId)) {
    throw new Error("This profile link is invalid or expired.");
  }

  try {
    const result = await apiFetch<{ followers_count: number; following_count: number }>(
      `/api/profiles/${userId}/follow-stats`,
    );
    return {
      followersCount: result.followers_count ?? 0,
      followingCount: result.following_count ?? 0,
    };
  } catch (error) {
    throw toError(error, "Failed to load follow stats.");
  }
}

export async function loadProfileActivityStats(userId: string): Promise<ProfileActivityStats> {
  ensureCommunityBackend("Profile activity stats");
  if (!userId) {
    return { totalPosts: 0, totalUpvotes: 0, totalVerified: 0, averageRating: 0 };
  }
  if (!isUuid(userId)) {
    throw new Error("This profile link is invalid or expired.");
  }

  try {
    const result = await apiFetch<{
      total_posts: number;
      total_upvotes: number;
      total_verified: number;
      average_rating: number;
    }>(`/api/profiles/${userId}/activity`);
    return {
      totalPosts: result.total_posts ?? 0,
      totalUpvotes: result.total_upvotes ?? 0,
      totalVerified: result.total_verified ?? 0,
      averageRating: result.average_rating ?? 0,
    };
  } catch (error) {
    throw toError(error, "Failed to load profile activity stats.");
  }
}

export async function isFollowingCommunityUser(targetUserId: string): Promise<boolean> {
  ensureCommunityBackend("Community follows");
  if (!targetUserId || !getAccessToken()) return false;

  try {
    const result = await apiFetch<{ following: boolean }>(`/api/follows/${targetUserId}`);
    return result.following;
  } catch {
    return false;
  }
}

export async function followCommunityUser(targetUserId: string): Promise<boolean> {
  const userId = await requireUserId("Community follows");
  if (!targetUserId || targetUserId === userId) {
    throw new Error("You cannot follow your own account.");
  }

  try {
    const result = await apiFetch<{ following: boolean }>(`/api/follows/${targetUserId}`, {
      method: "PUT",
    });
    return result.following;
  } catch (error) {
    throw toError(error, "Failed to follow user.");
  }
}

export async function unfollowCommunityUser(targetUserId: string): Promise<boolean> {
  await requireUserId("Community follows");

  try {
    const result = await apiFetch<{ following: boolean }>(`/api/follows/${targetUserId}`, {
      method: "DELETE",
    });
    return !result.following;
  } catch (error) {
    throw toError(error, "Failed to unfollow user.");
  }
}

export async function loadRemixes(postId: string): Promise<CommunityPost[]> {
  ensureCommunityBackend("Community remixes");

  try {
    const rows = await apiFetch<ApiCommunityPost[]>(`/api/community/${postId}/remixes`);
    return rows.map(mapCommunityPost);
  } catch (error) {
    throw toError(error, "Failed to load remixes.");
  }
}

export async function loadMyVotes(postIds: string[]): Promise<Record<string, VoteState>> {
  ensureCommunityBackend("Community reactions");
  const uniqueIds = Array.from(new Set(postIds.filter(Boolean)));
  if (uniqueIds.length === 0 || !getAccessToken()) return {};

  try {
    const rows = await apiFetch<Array<{ post_id: string; vote_type: VoteType }>>("/api/community/votes/state", {
      method: "POST",
      body: JSON.stringify({ ids: uniqueIds }),
    });
    const voteState: Record<string, VoteState> = {};
    uniqueIds.forEach((id) => {
      voteState[id] = { upvote: false, verified: false };
    });
    rows.forEach((row) => {
      const entry = voteState[row.post_id] ?? { upvote: false, verified: false };
      if (row.vote_type === "upvote") entry.upvote = true;
      if (row.vote_type === "verified") entry.verified = true;
      voteState[row.post_id] = entry;
    });
    return voteState;
  } catch {
    return {};
  }
}

export async function loadMyRatings(postIds: string[]): Promise<Record<string, number>> {
  ensureCommunityBackend("Community ratings");
  const uniqueIds = Array.from(new Set(postIds.filter(Boolean)));
  if (uniqueIds.length === 0 || !getAccessToken()) return {};

  try {
    const rows = await apiFetch<Array<{ post_id: string; rating: number }>>("/api/community/ratings/state", {
      method: "POST",
      body: JSON.stringify({ ids: uniqueIds }),
    });
    return rows.reduce<Record<string, number>>((map, row) => {
      if (typeof row.post_id === "string" && typeof row.rating === "number") {
        map[row.post_id] = row.rating;
      }
      return map;
    }, {});
  } catch {
    return {};
  }
}

export async function setPromptRating(
  postId: string,
  rating: number | null,
): Promise<{ rating: number | null }> {
  await requireUserId("Community ratings");

  if (!postId) {
    throw new Error("Prompt ID is required.");
  }

  try {
    if (rating === null) {
      return await apiFetch<{ rating: null }>(`/api/community/${postId}/rating`, {
        method: "DELETE",
      });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5.");
    }

    return await apiFetch<{ rating: number }>(`/api/community/${postId}/rating`, {
      method: "PUT",
      body: JSON.stringify({ rating }),
    });
  } catch (error) {
    throw toError(error, "Failed to save rating.");
  }
}

export function computeNextPromptRatingSummary(input: {
  currentCount: number;
  currentAverage: number;
  previousRating: number | null;
  nextRating: number | null;
}): { ratingCount: number; ratingAverage: number } {
  const normalizedCurrentCount = Math.max(0, Math.floor(input.currentCount));
  const normalizedCurrentAverage = Number.isFinite(input.currentAverage)
    ? Math.max(0, input.currentAverage)
    : 0;
  const currentSum = normalizedCurrentAverage * normalizedCurrentCount;

  let nextCount = normalizedCurrentCount;
  let nextSum = currentSum;

  if (typeof input.previousRating === "number" && input.previousRating >= 1 && input.previousRating <= 5) {
    nextCount = Math.max(0, nextCount - 1);
    nextSum -= input.previousRating;
  }

  if (typeof input.nextRating === "number" && input.nextRating >= 1 && input.nextRating <= 5) {
    nextCount += 1;
    nextSum += input.nextRating;
  }

  if (nextCount === 0) {
    return { ratingCount: 0, ratingAverage: 0 };
  }

  return {
    ratingCount: nextCount,
    ratingAverage: Number((nextSum / nextCount).toFixed(2)),
  };
}

export async function toggleVote(
  postId: string,
  voteType: VoteType,
): Promise<{ active: boolean; rowId: string | null }> {
  await requireUserId("Community reactions");

  try {
    const currentState = await loadMyVotes([postId]);
    const isActive = currentState[postId]?.[voteType] ?? false;

    if (isActive) {
      const result = await apiFetch<{ active: boolean; row_id: string | null }>(
        `/api/community/${postId}/vote?voteType=${voteType}`,
        { method: "DELETE" },
      );
      return { active: result.active, rowId: result.row_id };
    }

    const result = await apiFetch<{ active: boolean; row_id: string | null }>(`/api/community/${postId}/vote`, {
      method: "POST",
      body: JSON.stringify({ voteType }),
    });
    return { active: result.active, rowId: result.row_id };
  } catch (error) {
    throw toError(error, "Failed to submit vote.");
  }
}

export async function addComment(postId: string, body: string): Promise<CommunityComment> {
  await requireUserId("Community comments");
  const content = sanitizePostgresText(body).trim();
  if (!content) throw new Error("Comment is required.");
  assertCommunityTextAllowed(content, "This comment violates community safety rules.");

  try {
    const row = await apiFetch<ApiCommunityComment>(`/api/community/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: content }),
    });
    return mapCommunityComment(row);
  } catch (error) {
    throw toError(error, "Failed to add comment.");
  }
}

export async function loadComments(postId: string, options: LoadCommentsInput = {}): Promise<CommunityComment[]> {
  ensureCommunityBackend("Community comments");
  const search = new URLSearchParams({
    limit: String(Math.min(Math.max(options.limit || 25, 1), 200)),
  });
  if (options.cursor) search.set("cursor", options.cursor);

  try {
    const rows = await apiFetch<ApiCommunityComment[]>(`/api/community/${postId}/comments?${search.toString()}`);
    return rows.map(mapCommunityComment);
  } catch (error) {
    throw toError(error, "Failed to load comments.");
  }
}

export async function remixToLibrary(
  postId: string,
  options?: { title?: string; remixNote?: string },
): Promise<SavedPromptRecord> {
  const userId = await requireUserId("Community remixes");
  const post = await loadPost(postId);
  if (!post) {
    throw new Error("Failed to remix prompt to your library.");
  }

  const result = await savePersistedPrompt(userId, {
    name: sanitizePostgresText(options?.title || `Remix of ${post.title}`).trim().slice(0, 200) || `Remix of ${post.title}`,
    description: sanitizePostgresText(post.description || "").trim().slice(0, 500),
    tags: normalizePromptTags(post.tags),
    category: post.category,
    config: normalizeTemplateConfig(post.publicConfig),
    builtPrompt: sanitizePostgresText(post.starterPrompt),
    enhancedPrompt: sanitizePostgresText(post.enhancedPrompt),
    targetModel: sanitizePostgresText(post.targetModel).trim().slice(0, 80),
    useCase: sanitizePostgresText(post.useCase).trim().slice(0, 1000),
    remixedFrom: post.id,
    remixNote: sanitizePostgresText(options?.remixNote || "").trim().slice(0, 500),
  });

  const saved = await loadMyPromptById(result.record.metadata.id);
  if (!saved) {
    throw new Error("Failed to remix prompt to your library.");
  }

  return { ...saved, userId };
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
    "originalPrompt",
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
