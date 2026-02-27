import type { PromptConfig } from "@/lib/prompt-builder";
import { getContextCoreSignals } from "@/lib/context-types";

export type SectionHealthState = "empty" | "in_progress" | "complete";

export interface SectionHealth {
  builder: SectionHealthState;
  context: SectionHealthState;
  tone: SectionHealthState;
  quality: SectionHealthState;
}

function resolveState(
  signalCount: number,
  thresholds: { inProgress: number; complete: number },
): SectionHealthState {
  if (signalCount >= thresholds.complete) return "complete";
  if (signalCount >= thresholds.inProgress) return "in_progress";
  return "empty";
}

export function getSectionHealth(config: PromptConfig, qualityTotal: number): SectionHealth {
  const hasValue = (value: string, minLength = 1) => value.trim().length >= minLength;
  const hasCoreIntent = hasValue(config.originalPrompt, 8) || hasValue(config.task, 8);

  const contextStructuredCount = Object.values(config.contextConfig.structured).filter(
    (value) => typeof value === "string" && hasValue(value, 2),
  ).length;
  const contextInterviewCount = config.contextConfig.interviewAnswers.filter(
    (answer) => hasValue(answer.answer, 2),
  ).length;
  const hasRag =
    config.contextConfig.rag.enabled && hasValue(config.contextConfig.rag.vectorStoreRef, 2);
  const hasIntegrations = config.contextConfig.databaseConnections.length > 0 || hasRag;
  const contextCoreSignals = getContextCoreSignals(config.contextConfig);

  const builderSignalCount =
    (config.role || hasValue(config.customRole, 2) ? 1 : 0) +
    (hasValue(config.task, 8) ? 1 : 0) +
    (config.format.length > 0 || hasValue(config.customFormat, 2) || config.lengthPreference !== "standard"
      ? 1
      : 0) +
    (hasValue(config.examples, 12) ? 1 : 0) +
    (config.constraints.length > 0 || hasValue(config.customConstraint, 2) ? 1 : 0);

  const contextSignalCount =
    (config.contextConfig.sources.length > 0 ? 1 : 0) +
    (contextStructuredCount >= 4 ? 2 : contextStructuredCount >= 1 ? 1 : 0) +
    (contextInterviewCount >= 2 ? 1 : contextInterviewCount === 1 ? 0.5 : 0) +
    (hasIntegrations ? 1 : 0) +
    (hasValue(config.contextConfig.projectNotes, 30) ? 1 : 0);

  const toneSignalCount = [
    config.tone !== "Professional",
    config.complexity !== "Moderate",
  ].filter(Boolean).length;

  const rawBuilderState = resolveState(builderSignalCount, { inProgress: 1, complete: 4 });
  const builderState =
    rawBuilderState === "complete" && !hasCoreIntent ? "in_progress" : rawBuilderState;

  const rawContextState = resolveState(contextSignalCount, { inProgress: 1, complete: 3 });
  const contextHasMinimumCoreSignals = contextCoreSignals.hasObjective && contextCoreSignals.hasBackground;
  const contextState =
    rawContextState === "complete" && !contextHasMinimumCoreSignals
      ? "in_progress"
      : rawContextState;

  return {
    builder: builderState,
    context: contextState,
    tone: resolveState(toneSignalCount, { inProgress: 1, complete: 2 }),
    quality:
      qualityTotal >= 75 ? "complete" : qualityTotal >= 50 ? "in_progress" : "empty",
  };
}
