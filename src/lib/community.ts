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

function isInvalidUuidInputError(error: unknown): boolean {
  if (!isPostgrestError(error)) return false;
  if (error.code === "22P02") return true;
  return error.message.toLowerCase().includes("invalid input syntax for type uuid");
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
  const normalizedUseCase = clampText(input.useCase, 1000);
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
  const { sort = "new", category, search, cursor, page = 0, limit = 25 } = input;
  const normalizedLimit = Math.min(Math.max(limit, 1), 100);
  const normalizedPage = Math.max(page, 0);

  try {
    let builder = supabase
      .from("community_posts")
      .select(COMMUNITY_POST_SELECT_COLUMNS)
      .eq("is_public", true)
      .limit(normalizedLimit);

    if (category && category !== "all") {
      builder = builder.eq("category", category);
    }

    if (search?.trim()) {
      const escaped = escapePostgrestLikePattern(search.trim());
      builder = builder.or(`title.ilike.%${escaped}%,use_case.ilike.%${escaped}%`);
    }

    if (cursor) {
      builder = builder.lt("created_at", cursor);
    } else if (normalizedPage > 0) {
      const start = normalizedPage * normalizedLimit;
      builder = builder.range(start, start + normalizedLimit - 1);
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
    if (isInvalidUuidInputError(error)) {
      throw new Error("This link is invalid or expired.");
    }
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
    return {};
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
  } catch {
    return {};
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
        use_case: clampText(post.useCase, 1000),
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
