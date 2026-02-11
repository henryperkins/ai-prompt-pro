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
  return useCase.trim().slice(0, 1000);
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
        community_post_id: string;
        upvote_count: number;
        verified_count: number;
        remix_count: number;
        comment_count: number;
      }
    >();

    if (promptIds.length > 0) {
      const { data: postMetrics, error: postMetricsError } = await supabase
        .from("community_posts")
        .select("id, saved_prompt_id, upvote_count, verified_count, remix_count, comment_count")
        .in("saved_prompt_id", promptIds)
        .eq("is_public", true);

      if (!postMetricsError && postMetrics) {
        postMetrics.forEach((post) => {
          metricsByPromptId.set(post.saved_prompt_id, {
            community_post_id: post.id,
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
        communityPostId: metrics?.community_post_id ?? null,
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
): Promise<ShareResult> {
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
    if (!existing) return { shared: false };

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
    if (!data) return { shared: false };

    // Look up the community post created by the DB trigger
    const { data: post } = await supabase
      .from("community_posts")
      .select("id")
      .eq("saved_prompt_id", id)
      .maybeSingle();

    return { shared: true, postId: post?.id };
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
