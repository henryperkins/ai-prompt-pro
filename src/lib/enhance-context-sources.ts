import type { ContextSource } from "@/lib/context-types";

export interface EnhanceContextSourceReference {
  kind?: string;
  refId?: string;
  locator?: string;
  permissionScope?: string;
}

export interface EnhanceContextSource {
  id: string;
  type: ContextSource["type"];
  title: string;
  summary: string;
  rawContent: string;
  rawContentTruncated: boolean;
  originalCharCount: number;
  expandable: boolean;
  reference?: EnhanceContextSourceReference;
}

export const MAX_ENHANCE_CONTEXT_SOURCE_COUNT = 8;
export const MAX_ENHANCE_CONTEXT_SOURCE_SUMMARY_CHARS = 2500;
export const MAX_ENHANCE_CONTEXT_SOURCE_RAW_CHARS = 12000;
export const MAX_ENHANCE_CONTEXT_SOURCE_TOTAL_RAW_CHARS = 32000;

function truncateText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

export function buildEnhanceContextSources(
  sources: ContextSource[],
): EnhanceContextSource[] {
  let remainingRawChars = MAX_ENHANCE_CONTEXT_SOURCE_TOTAL_RAW_CHARS;

  return sources
    .slice(0, MAX_ENHANCE_CONTEXT_SOURCE_COUNT)
    .map((source, index) => {
      const summary = truncateText(
        source.summary || source.rawContent || "",
        MAX_ENHANCE_CONTEXT_SOURCE_SUMMARY_CHARS,
      );
      const originalRawContent = source.rawContent.trim();
      const allowedRawChars = Math.min(
        remainingRawChars,
        MAX_ENHANCE_CONTEXT_SOURCE_RAW_CHARS,
      );
      const rawContent =
        allowedRawChars > 0
          ? truncateText(originalRawContent, allowedRawChars)
          : "";
      const rawContentTruncated =
        Boolean(originalRawContent)
        && rawContent.length < originalRawContent.length;

      if (rawContent.length > 0) {
        remainingRawChars = Math.max(0, remainingRawChars - rawContent.length);
      }

      return {
        id: source.id || `source-${index + 1}`,
        type: source.type,
        title: truncateText(source.title || `Source ${index + 1}`, 160),
        summary,
        rawContent,
        rawContentTruncated,
        originalCharCount: originalRawContent.length,
        expandable: rawContent.length > 0,
        reference: source.reference
          ? {
            kind: source.reference.kind,
            refId: source.reference.refId,
            locator: source.reference.locator,
            permissionScope: source.reference.permissionScope,
          }
          : undefined,
      };
    })
    .filter((source) => source.summary.length > 0);
}
