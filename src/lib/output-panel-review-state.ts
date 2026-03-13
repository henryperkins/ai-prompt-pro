import type {
  EnhancePhase,
  OutputPreviewSource,
} from "@/components/output-panel-types";

export type OutputPanelReviewStateTone = "info" | "success" | "warning";

export interface OutputPanelReviewState {
  stateKey: "stale" | "enhancing" | "ready" | "draft" | "empty";
  tone: OutputPanelReviewStateTone;
  title: string;
  description: string;
  nextAction: string;
  assistiveStatus: string;
}

interface GetOutputPanelReviewStateOptions {
  enhancePhase?: EnhancePhase;
  isEnhancing?: boolean;
  previewSource: OutputPreviewSource;
  hasPreviewContent: boolean;
  staleEnhancementNotice?: string | null;
}

export function getOutputPanelReviewState({
  enhancePhase = "idle",
  isEnhancing = false,
  previewSource,
  hasPreviewContent,
  staleEnhancementNotice,
}: GetOutputPanelReviewStateOptions): OutputPanelReviewState {
  const isRunInFlight =
    isEnhancing ||
    enhancePhase === "starting" ||
    enhancePhase === "streaming" ||
    enhancePhase === "settling";
  const isStalePreview = Boolean(staleEnhancementNotice?.trim());
  const isVisibleEnhancedOutput =
    previewSource === "enhanced" &&
    hasPreviewContent &&
    !isStalePreview;
  const isSettledEnhancedOutput =
    isVisibleEnhancedOutput &&
    !isRunInFlight;

  const reviewState = isStalePreview
      ? {
          stateKey: "stale" as const,
          tone: "warning" as const,
          title: "Builder changed after enhancement",
          description:
            staleEnhancementNotice?.trim() ||
          "The preview has returned to the current draft prompt. Re-run Enhance prompt to refresh the AI result.",
        nextAction:
          "Re-run Enhance prompt to refresh the AI result for the current draft prompt.",
      }
    : isRunInFlight
      ? {
          stateKey: "enhancing" as const,
          tone: "info" as const,
          title: "Enhancing",
          description:
            "The AI is actively rewriting the prompt. The visible prompt may still change.",
          nextAction: "Wait for the run to settle before comparing or saving the result.",
        }
      : isSettledEnhancedOutput
        ? {
            stateKey: "ready" as const,
            tone: "success" as const,
            title: "Enhanced prompt ready",
            description:
              "The run is complete and the visible text is the settled AI-generated prompt.",
            nextAction:
              "Review the prompt, compare it against the draft, or save the version you want to keep.",
          }
        : hasPreviewContent
        ? {
            stateKey: "draft" as const,
            tone: "info" as const,
            title: "Draft prompt",
            description:
                "This preview reflects the current builder draft.",
              nextAction:
                "Copy it as-is, or run Enhance prompt when you want an AI rewrite.",
            }
          : {
              stateKey: "empty" as const,
              tone: "info" as const,
              title: "No preview yet",
              description:
                "Start writing in the builder to generate a reviewable draft prompt.",
              nextAction: "Add a task or context first.",
            };

  return {
    ...reviewState,
    assistiveStatus: `${reviewState.title}. ${reviewState.description}`,
  };
}
