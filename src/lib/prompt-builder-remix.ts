import { computeRemixDiff } from "@/lib/community";
import type { PromptConfig } from "@/lib/prompt-builder";

export interface PromptBuilderRemixContext {
  postId: string;
  parentTitle: string;
  parentAuthor: string;
  parentConfig: PromptConfig;
  parentTags: string[];
  parentCategory: string;
}

interface RemixInput {
  tags?: string[];
  category?: string;
  remixNote?: string;
}

export function buildRemixPayload(
  remixContext: PromptBuilderRemixContext | null,
  childConfig: PromptConfig,
  input: RemixInput,
) {
  if (!remixContext) return {};

  return {
    remixedFrom: remixContext.postId,
    remixNote: input.remixNote,
    remixDiff: computeRemixDiff(remixContext.parentConfig, childConfig, {
      parentTags: remixContext.parentTags,
      childTags: input.tags,
      parentCategory: remixContext.parentCategory,
      childCategory: input.category,
    }),
  };
}
