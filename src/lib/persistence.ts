import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { PromptConfig } from "@/lib/prompt-builder";
import { defaultConfig } from "@/lib/prompt-builder";
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
const TEMPLATE_SELECT_COLUMNS =
  "id, name, description, tags, config, fingerprint, revision, created_at, updated_at";

type PersistenceErrorCode = "unauthorized" | "conflict" | "network" | "unknown";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PersistenceError";
    this.code = code;
  }
}

export function getPersistenceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function isPostgrestError(value: unknown): value is PostgrestError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.message === "string" && typeof candidate.code === "string";
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

function normalizeTags(tags?: string[]): string[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.map((tag) => tag.trim()).filter(Boolean);
}

function normalizeDescription(description?: string): string | undefined {
  if (description === undefined) return undefined;
  return description.trim();
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

type TemplateRow = {
  id: string;
  name: string;
  description: string;
  tags: string[] | null;
  config: Json | null;
  fingerprint: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

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
// Template / Preset persistence
// ---------------------------------------------------------------------------

export async function loadTemplates(userId: string | null): Promise<TemplateSummary[]> {
  if (!userId) return listLocalTemplates();

  try {
    const { data, error } = await supabase
      .from("templates")
      .select(TEMPLATE_SELECT_COLUMNS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw mapPostgrestError(error, "Failed to load presets.");
    if (!data) return [];

    return data.map((row) => {
      const cfg = normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        tags: row.tags ?? [],
        starterPrompt: inferTemplateStarterPrompt(cfg),
        updatedAt: new Date(row.updated_at).getTime(),
        createdAt: new Date(row.created_at).getTime(),
        revision: row.revision,
        schemaVersion: 2,
        sourceCount: cfg.contextConfig.sources.length,
        databaseCount: cfg.contextConfig.databaseConnections.length,
        ragEnabled: cfg.contextConfig.rag.enabled,
      };
    });
  } catch (error) {
    throw toPersistenceError(error, "Failed to load presets.");
  }
}

export async function loadTemplateById(
  userId: string | null,
  id: string,
): Promise<TemplateLoadResult | null> {
  if (!userId) return loadLocalTemplate(id);

  try {
    const { data, error } = await supabase
      .from("templates")
      .select(TEMPLATE_SELECT_COLUMNS)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to load preset.");
    if (!data) return null;

    const cfg = normalizeTemplateConfig((data.config ?? defaultConfig) as unknown as PromptConfig);
    return {
      record: rowToRecord(data, cfg),
      warnings: collectTemplateWarnings(cfg),
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to load preset.");
  }
}

export async function saveTemplate(
  userId: string | null,
  input: TemplateSaveInput,
): Promise<SaveTemplateResult> {
  if (!userId) return saveLocalTemplate(input);

  const name = input.name.trim();
  if (!name) throw new PersistenceError("unknown", "Preset name is required.");

  const normalizedConfig = normalizeTemplateConfig(input.config);
  const normalizedDescription = normalizeDescription(input.description);
  const fingerprint = computeTemplateFingerprint(normalizedConfig);
  const warnings = collectTemplateWarnings(normalizedConfig);
  const tags = normalizeTags(input.tags);

  try {
    const { data: existingRows, error: lookupError } = await supabase
      .from("templates")
      .select(TEMPLATE_SELECT_COLUMNS)
      .eq("user_id", userId)
      .ilike("name", escapeLikePattern(name))
      .order("updated_at", { ascending: false })
      .limit(1);

    if (lookupError) throw mapPostgrestError(lookupError, "Failed to save preset.");
    const existing = existingRows?.[0] ?? null;

    if (existing?.fingerprint === fingerprint) {
      return {
        outcome: "unchanged",
        record: rowToRecord(existing, normalizedConfig),
        warnings,
      };
    }

    if (existing) {
      const updatePayload: Record<string, unknown> = {
        tags: tags ?? existing.tags ?? [],
        config: normalizedConfig as unknown as Json,
        fingerprint,
        revision: existing.revision + 1,
      };
      if (normalizedDescription !== undefined) {
        updatePayload.description = normalizedDescription;
      }

      const { data: updated, error } = await supabase
        .from("templates")
        .update(updatePayload)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .eq("revision", existing.revision)
        .select(TEMPLATE_SELECT_COLUMNS)
        .maybeSingle();

      if (error) throw mapPostgrestError(error, "Failed to update preset.");
      if (!updated) {
        throw new PersistenceError("conflict", "Preset was modified elsewhere. Please refresh and try again.");
      }
      return {
        outcome: "updated",
        record: rowToRecord(updated, normalizedConfig),
        warnings,
      };
    }

    const { data: created, error: insertError } = await supabase
      .from("templates")
      .insert({
        user_id: userId,
        name,
        description: normalizedDescription ?? "",
        tags: tags ?? [],
        config: normalizedConfig as unknown as Json,
        fingerprint,
      })
      .select(TEMPLATE_SELECT_COLUMNS)
      .single();

    if (insertError) {
      throw mapPostgrestError(insertError, "Failed to save preset.");
    }
    if (!created) throw new PersistenceError("unknown", "Preset save returned no data.");

    return {
      outcome: "created",
      record: rowToRecord(created, normalizedConfig),
      warnings,
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to save preset.");
  }
}

export async function deleteTemplate(userId: string | null, id: string): Promise<boolean> {
  if (!userId) return deleteLocalTemplate(id);

  try {
    const { data, error } = await supabase
      .from("templates")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to delete preset.");
    return !!data;
  } catch (error) {
    throw toPersistenceError(error, "Failed to delete preset.");
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

function rowToRecord(row: TemplateRow, normalizedConfig?: PromptConfig) {
  const cfg = normalizedConfig || normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
  return {
    metadata: {
      id: row.id,
      name: row.name,
      description: row.description,
      tags: row.tags ?? [],
      schemaVersion: 2,
      revision: row.revision,
      fingerprint: row.fingerprint ?? "",
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    },
    state: {
      promptConfig: cfg,
      externalReferences: deriveExternalReferencesFromConfig(cfg),
    },
  };
}
