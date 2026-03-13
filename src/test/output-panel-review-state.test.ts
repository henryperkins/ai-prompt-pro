import { describe, expect, it } from "vitest";
import { getOutputPanelReviewState } from "@/lib/output-panel-review-state";

describe("getOutputPanelReviewState", () => {
  it("returns empty when preview has no content", () => {
    const state = getOutputPanelReviewState({
      previewSource: "empty",
      hasPreviewContent: false,
    });
    expect(state.stateKey).toBe("empty");
    expect(state.tone).toBe("info");
    expect(state.title).toBe("No preview yet");
    expect(state.assistiveStatus).toContain("No preview yet");
  });

  it("returns draft when preview has builder content", () => {
    const state = getOutputPanelReviewState({
      previewSource: "builder_fields",
      hasPreviewContent: true,
    });
    expect(state.stateKey).toBe("draft");
    expect(state.tone).toBe("info");
    expect(state.title).toBe("Draft preview");
    expect(state.nextAction).toContain("Copy the draft");
  });

  it("returns enhancing when the run is in flight (starting)", () => {
    const state = getOutputPanelReviewState({
      enhancePhase: "starting",
      isEnhancing: true,
      previewSource: "enhanced",
      hasPreviewContent: true,
    });
    expect(state.stateKey).toBe("enhancing");
    expect(state.tone).toBe("info");
    expect(state.title).toBe("Enhancing");
  });

  it("returns enhancing when the run is in flight (streaming)", () => {
    const state = getOutputPanelReviewState({
      enhancePhase: "streaming",
      isEnhancing: true,
      previewSource: "enhanced",
      hasPreviewContent: true,
    });
    expect(state.stateKey).toBe("enhancing");
  });

  it("returns enhancing when the run is in flight (settling)", () => {
    const state = getOutputPanelReviewState({
      enhancePhase: "settling",
      isEnhancing: false,
      previewSource: "enhanced",
      hasPreviewContent: true,
    });
    expect(state.stateKey).toBe("enhancing");
  });

  it("returns ready when enhanced output is visible and phase is done", () => {
    const state = getOutputPanelReviewState({
      enhancePhase: "done",
      isEnhancing: false,
      previewSource: "enhanced",
      hasPreviewContent: true,
    });
    expect(state.stateKey).toBe("ready");
    expect(state.tone).toBe("success");
    expect(state.title).toBe("Enhanced output ready");
    expect(state.nextAction).toContain("Review the output");
    expect(state.assistiveStatus).toContain("Enhanced output ready");
  });

  it("returns ready when enhanced output is visible and phase has returned to idle", () => {
    const state = getOutputPanelReviewState({
      enhancePhase: "idle",
      isEnhancing: false,
      previewSource: "enhanced",
      hasPreviewContent: true,
    });
    expect(state.stateKey).toBe("ready");
    expect(state.tone).toBe("success");
    expect(state.title).toBe("Enhanced output ready");
    expect(state.nextAction).toContain("Review the output");
  });

  it("returns stale when staleEnhancementNotice is present regardless of other state", () => {
    const state = getOutputPanelReviewState({
      enhancePhase: "done",
      isEnhancing: false,
      previewSource: "builder_fields",
      hasPreviewContent: true,
      staleEnhancementNotice: "Builder changed since the last enhancement.",
    });
    expect(state.stateKey).toBe("stale");
    expect(state.tone).toBe("warning");
    expect(state.title).toBe("Builder changed after enhancement");
    expect(state.description).toBe("Builder changed since the last enhancement.");
    expect(state.nextAction).toContain("Re-run Enhance");
  });

  it("returns stale even with idle phase and enhanced source when notice is set", () => {
    const state = getOutputPanelReviewState({
      enhancePhase: "idle",
      isEnhancing: false,
      previewSource: "enhanced",
      hasPreviewContent: true,
      staleEnhancementNotice: "Builder diverged.",
    });
    expect(state.stateKey).toBe("stale");
    expect(state.tone).toBe("warning");
  });

  it("returns draft when phase is idle and source is not enhanced", () => {
    const state = getOutputPanelReviewState({
      enhancePhase: "idle",
      isEnhancing: false,
      previewSource: "prompt_text",
      hasPreviewContent: true,
    });
    expect(state.stateKey).toBe("draft");
    expect(state.tone).toBe("info");
  });

  it("treats isEnhancing as in-flight even when phase is idle", () => {
    const state = getOutputPanelReviewState({
      enhancePhase: "idle",
      isEnhancing: true,
      previewSource: "enhanced",
      hasPreviewContent: true,
    });
    expect(state.stateKey).toBe("enhancing");
  });
});
