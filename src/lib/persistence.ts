import type { Json } from "@/integrations/neon/types";
import { ApiClientError, apiFetch, apiFetchOptional } from "@/lib/api-client";
import { assertBackendConfigured } from "@/lib/backend-config";
import {
  GITHUB_SHARE_BLOCKED_REASON,
  hasGithubSources,
} from "@/lib/context-types";
import type { RemixDiff } from "@/lib/community";
import { assertCommunityTextAllowed } from "@/lib/content-moderation";
import {
  hydrateConfigV1ToWorkingState,
  serializeWorkingStateToV1,
} from "@/lib/prompt-config-adapters";
import { normalizePromptCategory } from "@/lib/prompt-categories";
import type { PromptConfig } from "@/lib/prompt-builder";
import { defaultConfig } from "@/lib/prompt-builder";
import {
  normalizePromptTagsOptional,
  sanitizePostgresJson,
  sanitizePostgresText,
} from "@/lib/saved-prompt-shared";
import {
  collectTemplateWarnings,
  computeTemplateFingerprint,
  deriveExternalReferencesFromConfig,
  inferTemplateStarterPrompt,
  listTemplateSummaries as listLocalTemplates,
  loadTemplateById as loadLocalTemplate,
  saveTemplateSnapshot as saveLocalTemplate,
  deleteTemplateById as deleteLocalTemplate,
  type TemplateSummary,
  type TemplateLoadResult,
  type SaveTemplateResult,
  type TemplateSaveInput,
} from "@/lib/template-store";

const DRAFT_KEY = "promptforge-draft";

type PersistenceErrorCode = "unauthorized" | "conflict" | "network" | "unknown";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "PersistenceError";
    this.code = code;
    if (options?.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
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
  id?: string;
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

interface ApiSavedPrompt {
  id: string;
  user_id?: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  config: unknown;
  built_prompt?: string;
  enhanced_prompt?: string;
  fingerprint: string | null;
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

export function getPersistenceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function ensureCloudPersistence(featureLabel = "Cloud persistence"): void {
  assertBackendConfigured(featureLabel);
}

function createGithubShareBlockedError(): PersistenceError {
  return new PersistenceError("unknown", GITHUB_SHARE_BLOCKED_REASON);
}

function assertPromptShareAllowed(config: PromptConfig): void {
  if (hasGithubSources(config.contextConfig.sources)) {
    throw createGithubShareBlockedError();
  }
}

function toPersistenceError(error: unknown, fallback: string): PersistenceError {
  if (error instanceof PersistenceError) return error;

  if (error instanceof ApiClientError) {
    if (error.status === 401) {
      return new PersistenceError("unauthorized", "Sign in required.", { cause: error });
    }
    if (error.status === 409) {
      return new PersistenceError("conflict", error.message || "Prompt was modified elsewhere. Please refresh and try again.", {
        cause: error,
      });
    }
    return new PersistenceError("unknown", error.message || fallback, { cause: error });
  }

  if (error instanceof Error) {
    if (/network|failed to fetch|fetch failed|connection|load failed/i.test(error.message)) {
      return new PersistenceError("network", error.message, { cause: error });
    }
    return new PersistenceError("unknown", error.message || fallback, { cause: error });
  }

  return new PersistenceError("unknown", fallback, { cause: error });
}

function normalizeDescription(description?: string): string | undefined {
  if (description === undefined) return undefined;
  return sanitizePostgresText(description).trim().slice(0, 500);
}

function normalizeUseCase(useCase?: string): string | undefined {
  if (useCase === undefined) return undefined;
  return sanitizePostgresText(useCase).trim().slice(0, 500);
}

function normalizeTargetModel(targetModel?: string): string | undefined {
  if (targetModel === undefined) return undefined;
  return sanitizePostgresText(targetModel).trim().slice(0, 80);
}

function normalizeRemixNote(remixNote?: string): string | undefined {
  if (remixNote === undefined) return undefined;
  return sanitizePostgresText(remixNote).trim().slice(0, 500);
}

function normalizePromptBody(prompt?: string): string | undefined {
  if (prompt === undefined) return undefined;
  return sanitizePostgresText(prompt);
}

function normalizeRemixDiff(remixDiff?: RemixDiff | null): Json | null | undefined {
  if (remixDiff === undefined) return undefined;
  if (remixDiff === null) return null;
  return sanitizePostgresJson(remixDiff as unknown as Json);
}

function toPresetName(value: string): string {
  const normalized = sanitizePostgresText(value).trim().slice(0, 200);
  return normalized || "Untitled Prompt";
}

function normalizePromptIds(ids: string[]): string[] {
  return Array.from(
    new Set(
      ids
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}

function apiPromptToSummary(prompt: ApiSavedPrompt): PromptSummary {
  const cfg = hydrateConfigV1ToWorkingState(prompt.config as PromptConfig);
  return {
    id: prompt.id,
    name: prompt.title,
    description: prompt.description,
    tags: prompt.tags || [],
    starterPrompt: inferTemplateStarterPrompt(cfg),
    updatedAt: prompt.updated_at * 1000,
    createdAt: prompt.created_at * 1000,
    revision: prompt.revision,
    schemaVersion: 2,
    sourceCount: cfg.contextConfig.sources.length,
    databaseCount: cfg.contextConfig.databaseConnections.length,
    ragEnabled: cfg.contextConfig.rag.enabled,
    containsGithubSources: hasGithubSources(cfg.contextConfig.sources),
    category: prompt.category,
    isShared: prompt.is_shared,
    communityPostId: prompt.community_post_id ?? null,
    targetModel: prompt.target_model,
    useCase: prompt.use_case,
    remixedFrom: prompt.remixed_from,
    builtPrompt: "",
    enhancedPrompt: "",
    upvoteCount: prompt.upvote_count ?? 0,
    verifiedCount: prompt.verified_count ?? 0,
    remixCount: prompt.remix_count ?? 0,
    commentCount: prompt.comment_count ?? 0,
  };
}

function rowToRecord(row: ApiSavedPrompt, normalizedConfig?: PromptConfig) {
  const cfg = normalizedConfig || hydrateConfigV1ToWorkingState(row.config as PromptConfig ?? defaultConfig);
  return {
    metadata: {
      id: row.id,
      name: row.title,
      description: row.description,
      tags: row.tags ?? [],
      schemaVersion: 2,
      revision: row.revision,
      fingerprint: row.fingerprint ?? "",
      createdAt: row.created_at * 1000,
      updatedAt: row.updated_at * 1000,
      category: row.category,
      isShared: row.is_shared,
      targetModel: row.target_model,
      useCase: row.use_case,
      remixedFrom: row.remixed_from,
      builtPrompt: row.built_prompt || "",
      enhancedPrompt: row.enhanced_prompt || "",
    },
    state: {
      promptConfig: cfg,
      externalReferences: deriveExternalReferencesFromConfig(cfg),
    },
  };
}

function hasMetadataChanges(existing: ApiSavedPrompt, input: PromptSaveInput): boolean {
  const normalizedDescription = normalizeDescription(input.description);
  const normalizedTags = normalizePromptTagsOptional(input.tags);
  const normalizedCategory = normalizePromptCategory(input.category);
  const normalizedUseCase = normalizeUseCase(input.useCase);
  const normalizedTargetModel = normalizeTargetModel(input.targetModel);
  const normalizedRemixNote = normalizeRemixNote(input.remixNote);
  const normalizedBuiltPrompt = normalizePromptBody(input.builtPrompt);
  const normalizedEnhancedPrompt = normalizePromptBody(input.enhancedPrompt);
  const normalizedRemixDiff = normalizeRemixDiff(input.remixDiff);

  if (normalizedDescription !== undefined && normalizedDescription !== existing.description) return true;
  if (normalizedCategory !== undefined && normalizedCategory !== existing.category) return true;
  if (normalizedUseCase !== undefined && normalizedUseCase !== existing.use_case) return true;
  if (normalizedTargetModel !== undefined && normalizedTargetModel !== existing.target_model) return true;
  if (normalizedRemixNote !== undefined && normalizedRemixNote !== (existing.remix_note ?? "")) return true;

  if (normalizedTags !== undefined) {
    const existingTags = existing.tags ?? [];
    if (
      normalizedTags.length !== existingTags.length
      || normalizedTags.some((tag, index) => tag !== existingTags[index])
    ) {
      return true;
    }
  }

  if (normalizedBuiltPrompt !== undefined && normalizedBuiltPrompt !== (existing.built_prompt ?? "")) return true;
  if (normalizedEnhancedPrompt !== undefined && normalizedEnhancedPrompt !== (existing.enhanced_prompt ?? "")) return true;
  if (input.isShared !== undefined && input.isShared !== existing.is_shared) return true;
  if (input.remixedFrom !== undefined && input.remixedFrom !== existing.remixed_from) return true;
  if (normalizedRemixDiff !== undefined && JSON.stringify(normalizedRemixDiff) !== JSON.stringify(existing.remix_diff ?? null)) {
    return true;
  }

  return false;
}

async function findExistingPrompt(userId: string, input: PromptSaveInput, name: string): Promise<ApiSavedPrompt | null> {
  if (input.id) {
    return apiFetchOptional<ApiSavedPrompt>(`/api/prompts/${input.id}`);
  }

  const prompts = await apiFetch<ApiSavedPrompt[]>("/api/prompts");
  const existingSummary = prompts.find((prompt) => prompt.title.toLowerCase() === name.toLowerCase());
  if (!existingSummary) return null;
  return apiFetchOptional<ApiSavedPrompt>(`/api/prompts/${existingSummary.id}`);
}

async function fetchPromptOrThrow(promptId: string): Promise<ApiSavedPrompt> {
  const prompt = await apiFetchOptional<ApiSavedPrompt>(`/api/prompts/${promptId}`);
  if (!prompt) {
    throw new PersistenceError("unknown", "Prompt save returned no data.");
  }
  return prompt;
}

export async function loadDraft(userId: string | null): Promise<PromptConfig | null> {
  if (!userId) {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? hydrateConfigV1ToWorkingState(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  ensureCloudPersistence("Cloud drafts");

  try {
    const data = await apiFetch<{ config: unknown } | null>("/api/drafts");
    if (!data) return null;
    return hydrateConfigV1ToWorkingState(data.config as PromptConfig);
  } catch (error) {
    throw toPersistenceError(error, "Failed to load draft.");
  }
}

export async function saveDraft(userId: string | null, config: PromptConfig): Promise<void> {
  const safeConfig = sanitizePostgresJson(config as unknown as Json) as unknown as PromptConfig;
  const normalizedConfig = serializeWorkingStateToV1(safeConfig, {
    includeV2Compat: true,
    preserveSourceRawContent: true,
  });

  if (!userId) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(normalizedConfig));
    } catch {
      // Ignore quota errors to keep the builder responsive.
    }
    return;
  }

  ensureCloudPersistence("Cloud drafts");

  try {
    await apiFetch("/api/drafts", {
      method: "POST",
      body: JSON.stringify({ config: sanitizePostgresJson(normalizedConfig as unknown as Json) }),
    });
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

  ensureCloudPersistence("Cloud prompts");

  try {
    const prompts = await apiFetch<ApiSavedPrompt[]>("/api/prompts");
    return prompts.map(apiPromptToSummary);
  } catch (error) {
    throw toPersistenceError(error, "Failed to load prompts.");
  }
}

export async function loadPromptById(userId: string | null, id: string): Promise<TemplateLoadResult | null> {
  if (!userId) return loadLocalTemplate(id);

  ensureCloudPersistence("Cloud prompts");

  try {
    const row = await apiFetchOptional<ApiSavedPrompt>(`/api/prompts/${id}`);
    if (!row) return null;

    const cfg = hydrateConfigV1ToWorkingState(row.config as PromptConfig ?? defaultConfig);
    return {
      record: rowToRecord(row, cfg),
      warnings: collectTemplateWarnings(cfg),
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to load prompt.");
  }
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

  ensureCloudPersistence("Cloud prompts");

  const name = toPresetName(input.name || "");
  const safeConfig = sanitizePostgresJson(input.config as unknown as Json) as unknown as PromptConfig;
  const normalizedConfig = serializeWorkingStateToV1(safeConfig, {
    includeV2Compat: false,
  });
  const persistedConfig = serializeWorkingStateToV1(normalizedConfig, {
    includeV2Compat: true,
  });
  const normalizedDescription = normalizeDescription(input.description);
  const normalizedCategory = normalizePromptCategory(input.category) ?? "general";
  const normalizedTargetModel = normalizeTargetModel(input.targetModel);
  const normalizedUseCase = normalizeUseCase(input.useCase);
  const normalizedRemixNote = normalizeRemixNote(input.remixNote);
  const normalizedBuiltPrompt = normalizePromptBody(input.builtPrompt);
  const normalizedEnhancedPrompt = normalizePromptBody(input.enhancedPrompt);
  const normalizedRemixDiff = normalizeRemixDiff(input.remixDiff);
  const fingerprint = computeTemplateFingerprint(normalizedConfig);
  const warnings = collectTemplateWarnings(normalizedConfig);
  const tags = normalizePromptTagsOptional(input.tags);
  const safePersistedConfig = sanitizePostgresJson(persistedConfig as unknown as Json);

  if (input.isShared) {
    assertPromptShareAllowed(normalizedConfig);
  }

  try {
    const existing = await findExistingPrompt(userId, input, name);

    if (existing && input.expectedRevision !== undefined && input.expectedRevision !== existing.revision) {
      throw new PersistenceError("conflict", "Prompt was modified elsewhere. Please refresh and try again.");
    }

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
        config: safePersistedConfig,
        fingerprint,
        expected_revision: input.expectedRevision ?? existing.revision,
      };

      if (normalizedDescription !== undefined) updatePayload.description = normalizedDescription;
      if (input.category !== undefined) updatePayload.category = normalizedCategory;
      if (normalizedBuiltPrompt !== undefined) updatePayload.built_prompt = normalizedBuiltPrompt;
      if (normalizedEnhancedPrompt !== undefined) updatePayload.enhanced_prompt = normalizedEnhancedPrompt;
      if (normalizedTargetModel !== undefined) updatePayload.target_model = normalizedTargetModel;
      if (normalizedUseCase !== undefined) updatePayload.use_case = normalizedUseCase;
      if (input.isShared !== undefined) updatePayload.is_shared = input.isShared;
      if (input.remixedFrom !== undefined) updatePayload.remixed_from = input.remixedFrom;
      if (normalizedRemixNote !== undefined) updatePayload.remix_note = normalizedRemixNote;
      if (normalizedRemixDiff !== undefined) updatePayload.remix_diff = normalizedRemixDiff;

      await apiFetch<{ revision: number }>(`/api/prompts/${existing.id}`, {
        method: "PUT",
        body: JSON.stringify(updatePayload),
      });

      const updated = await fetchPromptOrThrow(existing.id);
      return {
        outcome: "updated",
        record: rowToRecord(updated, normalizedConfig),
        warnings,
      };
    }

    const created = await apiFetch<{ id: string; revision: number }>("/api/prompts", {
      method: "POST",
      body: JSON.stringify({
        title: name,
        description: normalizedDescription ?? "",
        category: normalizedCategory,
        tags: tags ?? [],
        config: safePersistedConfig,
        built_prompt: normalizedBuiltPrompt ?? "",
        enhanced_prompt: normalizedEnhancedPrompt ?? "",
        target_model: normalizedTargetModel ?? "",
        use_case: normalizedUseCase ?? "",
        is_shared: input.isShared ?? false,
        remixed_from: input.remixedFrom ?? null,
        remix_note: normalizedRemixNote ?? "",
        remix_diff: normalizedRemixDiff ?? null,
      }),
    });

    const createdRow = await fetchPromptOrThrow(created.id);
    return {
      outcome: "created",
      record: rowToRecord(createdRow, normalizedConfig),
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

  ensureCloudPersistence("Community sharing");

  try {
    const existing = await apiFetchOptional<ApiSavedPrompt>(`/api/prompts/${id}`);
    if (!existing) return { shared: false };

    assertPromptShareAllowed(
      hydrateConfigV1ToWorkingState(existing.config as PromptConfig ?? defaultConfig),
    );

    const normalizedUseCaseInput = input.useCase !== undefined
      ? normalizeUseCase(input.useCase) ?? ""
      : undefined;
    const effectiveUseCase = (normalizedUseCaseInput ?? existing.use_case ?? "").trim();

    if (!effectiveUseCase) {
      throw new PersistenceError("unknown", "Use case is required before sharing.");
    }

    assertCommunityTextAllowed(effectiveUseCase, "Use case violates community safety rules.");
    if (input.title !== undefined) {
      assertCommunityTextAllowed(input.title, "Title violates community safety rules.");
    }
    if (input.description !== undefined) {
      assertCommunityTextAllowed(input.description, "Description violates community safety rules.");
    }

    const result = await apiFetch<{ shared: boolean; postId?: string; post_id?: string }>(`/api/prompts/${id}/share`, {
      method: "POST",
      body: JSON.stringify({
        title: input.title !== undefined ? toPresetName(input.title) : undefined,
        description: input.description !== undefined ? normalizeDescription(input.description) ?? "" : undefined,
        category: input.category !== undefined ? normalizePromptCategory(input.category) ?? "general" : undefined,
        tags: input.tags !== undefined ? normalizePromptTagsOptional(input.tags) ?? [] : undefined,
        target_model: input.targetModel !== undefined ? normalizeTargetModel(input.targetModel) ?? "" : undefined,
        use_case: effectiveUseCase,
      }),
    });

    return {
      shared: result.shared,
      postId: result.postId ?? result.post_id,
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to share prompt.");
  }
}

export async function unsharePrompt(userId: string | null, id: string): Promise<boolean> {
  const [updatedId] = await unsharePrompts(userId, [id]);
  return Boolean(updatedId);
}

export async function unsharePrompts(userId: string | null, ids: string[]): Promise<string[]> {
  const normalizedIds = normalizePromptIds(ids);
  if (normalizedIds.length === 0) return [];
  if (!userId) {
    throw new PersistenceError("unauthorized", "Sign in to unshare prompts.");
  }

  ensureCloudPersistence("Community sharing");

  try {
    if (normalizedIds.length === 1) {
      await apiFetch(`/api/prompts/${normalizedIds[0]}/unshare`, { method: "POST" });
      return normalizedIds;
    }

    const result = await apiFetch<{ unshared: string[] }>("/api/prompts/bulk-unshare", {
      method: "POST",
      body: JSON.stringify({ ids: normalizedIds }),
    });
    return result.unshared;
  } catch (error) {
    throw toPersistenceError(error, "Failed to unshare prompts.");
  }
}

export async function deletePrompt(userId: string | null, id: string): Promise<boolean> {
  const [deletedId] = await deletePrompts(userId, [id]);
  return Boolean(deletedId);
}

export async function deletePrompts(userId: string | null, ids: string[]): Promise<string[]> {
  const normalizedIds = normalizePromptIds(ids);
  if (normalizedIds.length === 0) return [];

  if (!userId) {
    const deletedIds: string[] = [];
    normalizedIds.forEach((id) => {
      if (deleteLocalTemplate(id)) deletedIds.push(id);
    });
    return deletedIds;
  }

  ensureCloudPersistence("Cloud prompts");

  try {
    if (normalizedIds.length === 1) {
      await apiFetch(`/api/prompts/${normalizedIds[0]}`, { method: "DELETE" });
      return normalizedIds;
    }

    const result = await apiFetch<{ deleted: string[] }>("/api/prompts/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids: normalizedIds }),
    });
    return result.deleted;
  } catch (error) {
    throw toPersistenceError(error, "Failed to delete prompts.");
  }
}

export async function loadVersions(userId: string | null): Promise<PromptVersion[]> {
  if (!userId) return [];

  ensureCloudPersistence("Version history");

  try {
    const rows = await apiFetch<{ id: string; name: string; prompt: string; created_at: number }[]>("/api/versions");
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      prompt: row.prompt,
      timestamp: row.created_at * 1000,
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

  ensureCloudPersistence("Version history");

  try {
    const result = await apiFetch<{ id: string; name: string; prompt: string; created_at: number }>("/api/versions", {
      method: "POST",
      body: JSON.stringify({
        name: sanitizePostgresText(name).trim().slice(0, 200) || "Version",
        prompt: sanitizePostgresText(prompt),
      }),
    });

    return {
      id: result.id,
      name: result.name,
      prompt: result.prompt,
      timestamp: result.created_at * 1000,
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to save version.");
  }
}
