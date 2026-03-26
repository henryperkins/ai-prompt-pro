/**
 * Cloudflare Workers Persistence Layer
 * Replaces PostgREST calls with Worker REST API
 */

import {
  loadDraft as loadDraftApi,
  saveDraft as saveDraftApi,
  deleteDraft as deleteDraftApi,
  loadPrompts as loadPromptsApi,
  loadPromptById as loadPromptByIdApi,
  createPrompt as createPromptApi,
  updatePrompt as updatePromptApi,
  deletePrompt as deletePromptApi,
  sharePrompt as sharePromptApi,
  unsharePrompt as unsharePromptApi,
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
  computeTemplateFingerprint,
  deriveExternalReferencesFromConfig,
  inferTemplateStarterPrompt,
  listLocalTemplates,
  loadTemplateById,
  saveTemplateSnapshot,
  deleteTemplateById,
  type TemplateSummary,
  type TemplateLoadResult,
  type SaveTemplateResult,
  type TemplateSaveInput,
} from "@/lib/template-store";
import { defaultConfig } from "@/lib/prompt-builder";
import type { PromptConfig } from "@/lib/prompt-builder";

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

export async function loadPrompts(accessToken: string | null): Promise<PromptSummary[]> {
  if (!accessToken) {
    return listLocalTemplates().map((template) => ({
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

    return savedPrompts.map((prompt) => {
      const cfg = hydrateConfigV1ToWorkingState(prompt.config as PromptConfig);
      return {
        id: prompt.id,
        name: prompt.title,
        description: prompt.description,
        tags: prompt.tags,
        starterPrompt: inferTemplateStarterPrompt(cfg),
        updatedAt: prompt.updated_at,
        createdAt: prompt.created_at,
        revision: prompt.revision,
        schemaVersion: 2,
        sourceCount: cfg.contextConfig.sources.length,
        databaseCount: cfg.contextConfig.databaseConnections.length,
        ragEnabled: cfg.contextConfig.rag.enabled,
        containsGithubSources: false, // GitHub sources not applicable to CF migration
        category: prompt.category,
        isShared: prompt.is_shared,
        communityPostId: prompt.is_shared ? prompt.id : null,
        targetModel: prompt.target_model,
        useCase: prompt.use_case,
        remixedFrom: prompt.remixed_from,
        builtPrompt: prompt.built_prompt,
        enhancedPrompt: prompt.enhanced_prompt,
        upvoteCount: 0,
        verifiedCount: 0,
        remixCount: 0,
        commentCount: 0,
      } satisfies PromptSummary;
    });
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

    const cfg = hydrateConfigV1ToWorkingState(prompt.config as PromptConfig);
    return {
      record: {
        metadata: {
          id: prompt.id,
          name: prompt.title,
          description: prompt.description,
          tags: prompt.tags,
          schemaVersion: 2,
          revision: prompt.revision,
          fingerprint: prompt.fingerprint || "",
          createdAt: prompt.created_at,
          updatedAt: prompt.updated_at,
          category: prompt.category,
          isShared: prompt.is_shared,
          targetModel: prompt.target_model,
          useCase: prompt.use_case,
          remixedFrom: prompt.remixed_from,
          builtPrompt: prompt.built_prompt,
          enhancedPrompt: prompt.enhanced_prompt,
        },
        state: {
          promptConfig: cfg,
          externalReferences: deriveExternalReferencesFromConfig(cfg),
        },
      },
      warnings: collectTemplateWarnings(cfg),
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to load prompt.");
  }
}

export async function savePrompt(
  accessToken: string | null,
  input: PromptSaveInput
): Promise<SaveTemplateResult> {
  if (!accessToken) {
    return saveTemplateSnapshot({
      name: input.name || "Untitled Prompt",
      description: input.description,
      tags: input.tags,
      config: input.config,
    });
  }

  try {
    const normalizedConfig = serializeWorkingStateToV1(input.config as PromptConfig, {
      includeV2Compat: false,
    });

    // Check if prompt exists
    const existing = await loadPromptByIdApi(accessToken, input.id || "");

    if (existing && existing.id === input.id) {
      // Update
      const updatePayload: Record<string, unknown> = {
        title: input.name,
        description: input.description,
        category: input.category,
        tags: input.tags,
        config: normalizedConfig,
        built_prompt: input.builtPrompt,
        enhanced_prompt: input.enhancedPrompt,
        target_model: input.targetModel,
        use_case: input.useCase,
        is_shared: input.isShared,
        remixed_from: input.remixedFrom,
        remix_note: input.remixNote,
        remix_diff: input.remixDiff,
      };

      const { revision } = await updatePromptApi(accessToken, existing.id, updatePayload);

      const cfg = hydrateConfigV1ToWorkingState(normalizedConfig as PromptConfig);
      const warnings = collectTemplateWarnings(cfg);

      return {
        outcome: "updated",
        record: {
          metadata: {
            id: existing.id,
            name: input.name || "Untitled Prompt",
            description: input.description || "",
            tags: input.tags || [],
            schemaVersion: 2,
            revision,
            fingerprint: computeTemplateFingerprint(normalizedConfig),
            createdAt: existing.created_at,
            updatedAt: Date.now(),
            category: input.category || "general",
            isShared: input.isShared || false,
            targetModel: input.targetModel || "",
            useCase: input.useCase || "",
            remixedFrom: input.remixedFrom || null,
            builtPrompt: input.builtPrompt || "",
            enhancedPrompt: input.enhancedPrompt || "",
          },
          state: {
            promptConfig: cfg,
            externalReferences: deriveExternalReferencesFromConfig(cfg),
          },
        },
        warnings,
      };
    } else {
      // Create
      const createPayload = {
        title: input.name || "Untitled Prompt",
        description: input.description,
        category: input.category,
        tags: input.tags,
        config: normalizedConfig,
        built_prompt: input.builtPrompt,
        enhanced_prompt: input.enhancedPrompt,
        target_model: input.targetModel,
        use_case: input.useCase,
        is_shared: input.isShared,
        remixed_from: input.remixedFrom,
        remix_note: input.remixNote,
        remix_diff: input.remixDiff,
      };

      const { id, revision } = await createPromptApi(accessToken, createPayload);

      const cfg = hydrateConfigV1ToWorkingState(normalizedConfig as PromptConfig);
      const warnings = collectTemplateWarnings(cfg);

      return {
        outcome: "created",
        record: {
          metadata: {
            id,
            name: input.name || "Untitled Prompt",
            description: input.description || "",
            tags: input.tags || [],
            schemaVersion: 2,
            revision,
            fingerprint: computeTemplateFingerprint(normalizedConfig),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            category: input.category || "general",
            isShared: input.isShared || false,
            targetModel: input.targetModel || "",
            useCase: input.useCase || "",
            remixedFrom: input.remixedFrom || null,
            builtPrompt: input.builtPrompt || "",
            enhancedPrompt: input.enhancedPrompt || "",
          },
          state: {
            promptConfig: cfg,
            externalReferences: deriveExternalReferencesFromConfig(cfg),
          },
        },
        warnings,
      };
    }
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
    return await sharePromptApi(accessToken, id, input);
  } catch (error) {
    throw toPersistenceError(error, "Failed to share prompt.");
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
