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
