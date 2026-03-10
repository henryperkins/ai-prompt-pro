import type { EnhanceMetadata } from "@/lib/enhance-metadata";
import type { AmbiguityMode } from "@/lib/user-preferences";

function normalizeQuestions(openQuestions: string[] | undefined): string[] {
  if (!Array.isArray(openQuestions)) return [];
  return openQuestions
    .map((question) => question.trim())
    .filter((question) => question.length > 0);
}

function formatNumberedItems(items: string[] | undefined): string {
  return normalizeQuestions(items)
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
}

export function shouldShowClarificationCard(
  metadata: EnhanceMetadata | null | undefined,
  ambiguityMode: AmbiguityMode | undefined,
): boolean {
  const questions = normalizeQuestions(metadata?.openQuestions);
  if (questions.length === 0) return false;

  return (
    ambiguityMode === "ask_me" ||
    ambiguityMode === "placeholders" ||
    metadata?.ambiguityLevel === "high"
  );
}

export function formatClarificationQuestions(
  openQuestions: string[] | undefined,
): string {
  return formatNumberedItems(openQuestions);
}

export function buildClarificationBlock(
  openQuestions: string[] | undefined,
): string {
  const questions = formatClarificationQuestions(openQuestions);
  if (!questions) return "";

  return [
    "Clarification questions to answer before finalizing:",
    questions,
  ].join("\n");
}

export function buildAssumptionsCorrectionBlock(
  assumptions: string[] | undefined,
): string {
  const lines = formatNumberedItems(assumptions);
  if (!lines) return "";

  return ["Assumptions / corrections:", lines].join("\n");
}

export function appendTextBlock(currentText: string, block: string): string {
  const trimmedCurrent = currentText.trim();
  const trimmedBlock = block.trim();

  if (!trimmedBlock) return trimmedCurrent;
  if (!trimmedCurrent) return trimmedBlock;
  if (trimmedCurrent.includes(trimmedBlock)) return trimmedCurrent;

  return `${trimmedCurrent}\n\n${trimmedBlock}`;
}
