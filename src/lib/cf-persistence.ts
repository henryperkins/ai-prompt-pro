/**
 * Cloudflare Workers Persistence Layer
 * Replaces PostgREST calls with Worker REST API
 */

import {
  loadDraft as loadDraftApi,
  saveDraft as saveDraftApi,
  loadPrompts as loadPromptsApi,
  loadPromptById as loadPromptByIdApi,
  createPrompt as createPromptApi,
  updatePrompt as updatePromptApi,
  deletePrompt as deletePromptApi,
  sharePrompt as sharePromptApi,
  unsharePrompt as unsharePromptApi,
  loadVersions as loadVersionsApi,
  saveVersion as saveVersionApi,
  getCommunityPosts as getCommunityPostsApi,
  getCommunityPostById as getCommunityPostByIdApi,
  createVote as createVoteApi,
  deleteVote as deleteVoteApi,
  createComment as createCommentApi,
  updateComment as updateCommentApi,
  deleteComment as deleteCommentApi,
  getCommentsByPostId as getCommentsByPostIdApi,
  type SavedPrompt,
  type CommunityPost,
  type RemixDiff,
} from "@/lib/cf-api-client";
import {
  hydrateConfigV1ToWorkingState,
  serializeWorkingStateToV1,
} from "@/lib/prompt-config-adapters";
import {
  collectTemplateWarnings,
  deriveExternalReferencesFromConfig,
  inferTemplateStarterPrompt,
  listTemplateSummaries,
  loadTemplateById,
  saveTemplateSnapshot,
  deleteTemplateById,
  type TemplateSummary,
  type TemplateLoadResult,
  type SaveTemplateResult,
  type TemplateSaveInput,
} from "@/lib/template-store";
import type { PromptConfig } from "@/lib/prompt-builder";
import {
  GITHUB_SHARE_BLOCKED_REASON,
  hasGithubSources,
} from "@/lib/context-types";
import { normalizePromptCategory } from "@/lib/prompt-categories";
import {
  normalizePromptTagsOptional,
  sanitizePostgresJson,
  sanitizePostgresText,
} from "@/lib/saved-prompt-shared";

const DRAFT_KEY = "promptforge-draft";

// ============================================================
// Error handling
// ============================================================

type PersistenceErrorCode = "unauthorized" | "conflict" | "network" | "unknown";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "PersistenceError";
    this.code = code;
    if (options?.cause !== undefined) {
      (this as unknown as Record<string, unknown>).cause = options.cause;
    }
  }
}

function toPersistenceError(error: unknown, fallback: string): PersistenceError {
  if (error instanceof PersistenceError) return error;
  if (error instanceof Error) {
    if (error.message.includes("Unauthorized")) {
      return new PersistenceError("unauthorized", "Sign in required.", { cause: error });
    }
    if (error.message.includes("Conflict")) {
      return new PersistenceError("conflict", "Resource conflict.", { cause: error });
    }
    if (/network|failed to fetch|fetch failed|connection|load failed/i.test(error.message)) {
      return new PersistenceError("network", "Network error. Please check your connection.", { cause: error });
    }
    return new PersistenceError("unknown", error.message || fallback, { cause: error });
  }
  return new PersistenceError("unknown", fallback, { cause: error });
}

type SanitizableJson = Parameters<typeof sanitizePostgresJson>[0];

function toFrontendTimestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Date.now();
  }
  return value >= 1_000_000_000_000 ? value : value * 1000;
}

function normalizeOptionalText(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  return sanitizePostgresText(value).trim().slice(0, maxLength);
}

function normalizeRequiredText(value: string | undefined, fallback: string, maxLength: number): string {
  const normalized = sanitizePostgresText(value || "").trim().slice(0, maxLength);
  return normalized || fallback;
}

function normalizeRemixDiff(
  value: RemixDiff | null | undefined,
): RemixDiff | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return sanitizePostgresJson(value as SanitizableJson) as RemixDiff;
}

function toPromptSummaryRecord(prompt: SavedPrompt): PromptSummary {
  const cfg = hydrateConfigV1ToWorkingState(prompt.config as PromptConfig);
  return {
    id: prompt.id,
    name: prompt.title,
    description: prompt.description,
    tags: Array.isArray(prompt.tags) ? prompt.tags : [],
    starterPrompt: inferTemplateStarterPrompt(cfg),
    updatedAt: toFrontendTimestamp(prompt.updated_at),
    createdAt: toFrontendTimestamp(prompt.created_at),
    revision: prompt.revision,
    schemaVersion: 2,
    sourceCount: cfg.contextConfig.sources.length,
    databaseCount: cfg.contextConfig.databaseConnections.length,
    ragEnabled: cfg.contextConfig.rag.enabled,
    containsGithubSources: hasGithubSources(cfg.contextConfig.sources),
    category: normalizePromptCategory(prompt.category) || "general",
    isShared: prompt.is_shared,
    communityPostId: prompt.community_post_id ?? null,
    targetModel: prompt.target_model || "",
    useCase: prompt.use_case || "",
    remixedFrom: prompt.remixed_from ?? null,
    builtPrompt: prompt.built_prompt || "",
    enhancedPrompt: prompt.enhanced_prompt || "",
    upvoteCount: prompt.upvote_count ?? 0,
    verifiedCount: prompt.verified_count ?? 0,
    remixCount: prompt.remix_count ?? 0,
    commentCount: prompt.comment_count ?? 0,
  };
}

function toTemplateLoadResultRecord(prompt: SavedPrompt): TemplateLoadResult {
  const cfg = hydrateConfigV1ToWorkingState(prompt.config as PromptConfig);
  return {
    record: {
      metadata: {
        id: prompt.id,
        name: prompt.title,
        description: prompt.description,
        tags: Array.isArray(prompt.tags) ? prompt.tags : [],
        schemaVersion: 2,
        revision: prompt.revision,
        fingerprint: prompt.fingerprint || "",
        createdAt: toFrontendTimestamp(prompt.created_at),
        updatedAt: toFrontendTimestamp(prompt.updated_at),
        category: normalizePromptCategory(prompt.category) || "general",
        isShared: prompt.is_shared,
        targetModel: prompt.target_model || "",
        useCase: prompt.use_case || "",
        remixedFrom: prompt.remixed_from ?? null,
        builtPrompt: prompt.built_prompt || "",
        enhancedPrompt: prompt.enhanced_prompt || "",
      },
      state: {
        promptConfig: cfg,
        externalReferences: deriveExternalReferencesFromConfig(cfg),
      },
    },
    warnings: collectTemplateWarnings(cfg),
  };
}

// ============================================================
// Draft persistence
// ============================================================

export async function loadDraft(accessToken: string | null): Promise<PromptConfig | null> {
  if (!accessToken) {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? hydrateConfigV1ToWorkingState(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  try {
    const result = await loadDraftApi(accessToken);
    if (!result) return null;
    return hydrateConfigV1ToWorkingState(result.config as PromptConfig);
  } catch (error) {
    throw toPersistenceError(error, "Failed to load draft.");
  }
}

export async function saveDraft(accessToken: string | null, config: PromptConfig): Promise<void> {
  const normalizedConfig = serializeWorkingStateToV1(config, {
    includeV2Compat: true,
    preserveSourceRawContent: true,
  });

  if (!accessToken) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(normalizedConfig));
    } catch {
      // quota errors are intentionally ignored
    }
    return;
  }

  try {
    await saveDraftApi(accessToken, normalizedConfig);
  } catch (error) {
    throw toPersistenceError(error, "Failed to save draft.");
  }
}

export function clearLocalDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// ============================================================
// Prompt persistence
// ============================================================

export interface PromptSummary extends TemplateSummary {
  category: string;
  isShared: boolean;
  communityPostId: string | null;
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
  expectedRevision?: number;
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

export interface ShareResult {
  shared: boolean;
  postId?: string;
}

export interface PromptVersion {
  id: string;
  name: string;
  prompt: string;
  timestamp: number;
}

export async function loadPrompts(accessToken: string | null): Promise<PromptSummary[]> {
  if (!accessToken) {
    return listTemplateSummaries().map((template) => ({
      ...template,
      category: "general",
      isShared: false,
      communityPostId: null,
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
    const savedPrompts = await loadPromptsApi(accessToken);
    return savedPrompts.map(toPromptSummaryRecord);
  } catch (error) {
    throw toPersistenceError(error, "Failed to load prompts.");
  }
}

export async function loadPromptById(
  accessToken: string | null,
  id: string
): Promise<TemplateLoadResult | null> {
  if (!accessToken) {
    return loadTemplateById(id);
  }

  try {
    const prompt = await loadPromptByIdApi(accessToken, id);
    if (!prompt) return null;
    return toTemplateLoadResultRecord(prompt);
  } catch (error) {
    throw toPersistenceError(error, "Failed to load prompt.");
  }
}

export async function savePrompt(
  accessToken: string | null,
  input: PromptSaveInput
): Promise<SaveTemplateResult> {
  const sanitizedConfig = sanitizePostgresJson(input.config as SanitizableJson) as PromptConfig;

  if (input.isShared && hasGithubSources(sanitizedConfig.contextConfig.sources)) {
    throw new PersistenceError("unknown", GITHUB_SHARE_BLOCKED_REASON);
  }

  if (!accessToken) {
    return saveTemplateSnapshot({
      name: input.name || "Untitled Prompt",
      description: input.description,
      tags: input.tags,
      config: sanitizedConfig,
    });
  }

  try {
    const normalizedConfig = serializeWorkingStateToV1(sanitizedConfig, {
      includeV2Compat: true,
    });
    const existing = input.id ? await loadPromptByIdApi(accessToken, input.id) : null;
    const title = normalizeRequiredText(input.name, "Untitled Prompt", 200);
    const description = normalizeOptionalText(input.description, 500);
    const category = normalizePromptCategory(input.category) || "general";
    const tags = normalizePromptTagsOptional(input.tags);
    const builtPrompt = normalizeOptionalText(input.builtPrompt, 50_000);
    const enhancedPrompt = normalizeOptionalText(input.enhancedPrompt, 50_000);
    const targetModel = normalizeOptionalText(input.targetModel, 80);
    const useCase = normalizeOptionalText(input.useCase, 500);
    const remixNote = normalizeOptionalText(input.remixNote, 500);
    const remixedFrom = normalizeOptionalText(input.remixedFrom ?? undefined, 200) ?? null;
    const remixDiff = normalizeRemixDiff(input.remixDiff);

    const basePayload = {
      title,
      description,
      category,
      tags,
      config: normalizedConfig,
      built_prompt: builtPrompt,
      enhanced_prompt: enhancedPrompt,
      target_model: targetModel,
      use_case: useCase,
      is_shared: input.isShared,
      remixed_from: remixedFrom,
      remix_note: remixNote,
      remix_diff: remixDiff,
    };

    let savedPromptId = input.id ?? "";
    let outcome: SaveTemplateResult["outcome"] = "created";

    if (existing) {
      await updatePromptApi(accessToken, existing.id, {
        ...basePayload,
        expected_revision: input.expectedRevision,
      });
      savedPromptId = existing.id;
      outcome = "updated";
    } else {
      const created = await createPromptApi(accessToken, basePayload);
      savedPromptId = created.id;
      outcome = "created";
    }

    const savedPrompt = await loadPromptByIdApi(accessToken, savedPromptId);
    if (!savedPrompt) {
      throw new PersistenceError("unknown", "Saved prompt could not be reloaded.");
    }

    return {
      outcome,
      ...toTemplateLoadResultRecord(savedPrompt),
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to save prompt.");
  }
}

export async function sharePrompt(
  accessToken: string | null,
  id: string,
  input: PromptShareInput = {}
): Promise<ShareResult> {
  if (!accessToken) {
    throw new PersistenceError("unauthorized", "Sign in to share prompts.");
  }

  try {
    const prompt = await loadPromptByIdApi(accessToken, id);
    if (!prompt) {
      throw new PersistenceError("unknown", "Prompt not found.");
    }

    const cfg = hydrateConfigV1ToWorkingState(prompt.config as PromptConfig);
    if (hasGithubSources(cfg.contextConfig.sources)) {
      throw new PersistenceError("unknown", GITHUB_SHARE_BLOCKED_REASON);
    }

    const useCase = normalizeOptionalText(input.useCase ?? prompt.use_case, 500);
    if (!useCase) {
      throw new PersistenceError("unknown", "Use case is required before sharing.");
    }

    const result = await sharePromptApi(accessToken, id, {
      title: normalizeOptionalText(input.title ?? prompt.title, 200),
      description: normalizeOptionalText(input.description ?? prompt.description, 500),
      category: normalizePromptCategory(input.category ?? prompt.category) || "general",
      tags: normalizePromptTagsOptional(input.tags ?? prompt.tags) ?? [],
      target_model: normalizeOptionalText(input.targetModel ?? prompt.target_model, 80),
      use_case: useCase,
    });

    return {
      shared: result.shared === true,
      postId: result.postId ?? result.post_id,
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to share prompt.");
  }
}

export async function loadVersions(accessToken: string | null): Promise<PromptVersion[]> {
  if (!accessToken) {
    return [];
  }

  try {
    const versions = await loadVersionsApi(accessToken);
    return versions.map((version) => ({
      id: version.id,
      name: version.name,
      prompt: version.prompt,
      timestamp: toFrontendTimestamp(version.created_at),
    }));
  } catch (error) {
    throw toPersistenceError(error, "Failed to load version history.");
  }
}

export async function saveVersion(
  accessToken: string | null,
  name: string,
  prompt: string,
): Promise<PromptVersion | null> {
  if (!accessToken) {
    return null;
  }

  try {
    const saved = await saveVersionApi(
      accessToken,
      normalizeRequiredText(name, "Version", 200),
      normalizeRequiredText(prompt, "", 50_000),
    );
    return {
      id: saved.id,
      name: saved.name,
      prompt: saved.prompt,
      timestamp: toFrontendTimestamp(saved.created_at),
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to save version.");
  }
}

export async function unsharePrompt(
  accessToken: string | null,
  id: string
): Promise<boolean> {
  if (!accessToken) {
    throw new PersistenceError("unauthorized", "Sign in to unshare prompts.");
  }

  try {
    const result = await unsharePromptApi(accessToken, id);
    return result.unshared;
  } catch (error) {
    throw toPersistenceError(error, "Failed to unshare prompt.");
  }
}

export async function deletePrompt(
  accessToken: string | null,
  id: string
): Promise<boolean> {
  if (!accessToken) {
    const deleted = deleteTemplateById(id);
    return !!deleted;
  }

  try {
    const result = await deletePromptApi(accessToken, id);
    return result.deleted;
  } catch (error) {
    throw toPersistenceError(error, "Failed to delete prompt.");
  }
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
  try {
    return await getCommunityPostsApi(filters);
  } catch (error) {
    throw toPersistenceError(error, "Failed to load community posts.");
  }
}

export async function getCommunityPostById(postId: string): Promise<CommunityPost | null> {
  try {
    return await getCommunityPostByIdApi(postId);
  } catch (error) {
    throw toPersistenceError(error, "Failed to load community post.");
  }
}

export async function createVote(
  accessToken: string,
  postId: string,
  voteType: "upvote" | "verified"
): Promise<void> {
  try {
    await createVoteApi(accessToken, postId, voteType);
  } catch (error) {
    throw toPersistenceError(error, "Failed to vote.");
  }
}

export async function deleteVote(accessToken: string, postId: string): Promise<void> {
  try {
    await deleteVoteApi(accessToken, postId);
  } catch (error) {
    throw toPersistenceError(error, "Failed to remove vote.");
  }
}

export async function getCommentsByPostId(postId: string) {
  try {
    return await getCommentsByPostIdApi(postId);
  } catch (error) {
    throw toPersistenceError(error, "Failed to load comments.");
  }
}

export async function createComment(
  accessToken: string,
  postId: string,
  body: string
): Promise<string> {
  try {
    const { id } = await createCommentApi(accessToken, postId, body);
    return id;
  } catch (error) {
    throw toPersistenceError(error, "Failed to add comment.");
  }
}

export async function updateComment(
  accessToken: string,
  commentId: string,
  body: string
): Promise<void> {
  try {
    await updateCommentApi(accessToken, commentId, body);
  } catch (error) {
    throw toPersistenceError(error, "Failed to update comment.");
  }
}

export async function deleteComment(accessToken: string, commentId: string): Promise<void> {
  try {
    await deleteCommentApi(accessToken, commentId);
  } catch (error) {
    throw toPersistenceError(error, "Failed to delete comment.");
  }
}
