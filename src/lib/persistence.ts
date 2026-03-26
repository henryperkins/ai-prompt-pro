/**
 * Persistence layer — thin wrapper re-exporting from cf-persistence.ts
 *
 * The Cloudflare Workers persistence module provides draft, prompt, version,
 * and community operations. This file re-exports the core implementation and
 * keeps lightweight batch helpers that compose the single-item functions.
 */

export {
  PersistenceError,
  loadDraft,
  saveDraft,
  clearLocalDraft,
  type PromptSummary,
  type PromptSaveInput,
  type PromptShareInput,
  type ShareResult,
  type PromptVersion,
  loadPrompts,
  loadPromptById,
  savePrompt,
  sharePrompt,
  unsharePrompt,
  deletePrompt,
  loadVersions,
  saveVersion,
  getCommunityPosts,
  getCommunityPostById,
  createVote,
  deleteVote,
  getCommentsByPostId,
  createComment,
  updateComment,
  deleteComment,
} from "@/lib/cf-persistence";

export type {
  TemplateSummary,
  TemplateLoadResult,
  SaveTemplateResult,
  TemplateSaveInput,
} from "@/lib/template-store";

export function getPersistenceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export async function deleteVersions(_accessToken: string | null, _ids: string[]): Promise<string[]> {
  return [];
}

export async function unsharePrompts(accessToken: string | null, ids: string[]): Promise<string[]> {
  const { unsharePrompt: unshare } = await import("@/lib/cf-persistence");
  const results: string[] = [];
  for (const id of ids) {
    const ok = await unshare(accessToken, id);
    if (ok) results.push(id);
  }
  return results;
}

export async function deletePrompts(accessToken: string | null, ids: string[]): Promise<string[]> {
  const { deletePrompt: remove } = await import("@/lib/cf-persistence");
  const results: string[] = [];
  for (const id of ids) {
    const ok = await remove(accessToken, id);
    if (ok) results.push(id);
  }
  return results;
}
