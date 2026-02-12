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

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

export function sanitizePostgresText(value: string): string {
  let sanitized = "";
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0) {
      continue;
    }

    if (isHighSurrogate(codeUnit)) {
      const nextCodeUnit = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
      if (isLowSurrogate(nextCodeUnit)) {
        sanitized += value[index] + value[index + 1];
        index += 1;
      } else {
        sanitized += "\ufffd";
      }
      continue;
    }

    if (isLowSurrogate(codeUnit)) {
      sanitized += "\ufffd";
      continue;
    }

    sanitized += value[index];
  }
  return sanitized;
}

export function sanitizePostgresJson(value: Json): Json {
  if (typeof value === "string") {
    return sanitizePostgresText(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePostgresJson(entry as Json));
  }
  if (value && typeof value === "object") {
    const sanitizedObject: Record<string, Json> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      sanitizedObject[key] = sanitizePostgresJson(entry as Json);
    }
    return sanitizedObject;
  }
  return value;
}

function normalizeTagsCore(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => sanitizePostgresText(tag).trim().toLowerCase())
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
