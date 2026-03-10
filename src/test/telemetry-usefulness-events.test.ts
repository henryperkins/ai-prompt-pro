import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearTelemetryLog,
  getTelemetryLog,
  startTelemetryListener,
  trackBuilderEvent,
} from "@/lib/telemetry";

describe("Telemetry usefulness events", () => {
  beforeEach(() => {
    clearTelemetryLog();
    startTelemetryListener();
  });

  afterEach(() => {
    clearTelemetryLog();
  });

  it("records builder_enhance_metadata_received with expected payload", () => {
    trackBuilderEvent("builder_enhance_metadata_received", {
      hasAlternatives: true,
      enhancementCount: 3,
      suggestionCount: 2,
      qualityOverall: 7.5,
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_metadata_received");
    expect(log[0].payload.hasAlternatives).toBe(true);
    expect(log[0].payload.enhancementCount).toBe(3);
    expect(log[0].payload.suggestionCount).toBe(2);
    expect(log[0].payload.qualityOverall).toBe(7.5);
  });

  it("records builder_enhance_variant_applied with variant details", () => {
    trackBuilderEvent("builder_enhance_variant_applied", {
      variant: "shorter",
      originalPromptChars: 500,
      variantPromptChars: 250,
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_variant_applied");
    expect(log[0].payload.variant).toBe("shorter");
    expect(log[0].payload.originalPromptChars).toBe(500);
    expect(log[0].payload.variantPromptChars).toBe(250);
  });

  it("records builder_enhance_accepted with usefulness payload", () => {
    trackBuilderEvent("builder_enhance_accepted", {
      source: "copy",
      promptChars: 450,
      variant: "shorter",
      inputPromptChars: 120,
      inputWordCount: 18,
      isVaguePrompt: true,
      ambiguityLevel: "high",
      editDistance: 92,
      editDistanceRatio: 0.42,
      editDistanceBaseline: "enhance_input",
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_accepted");
    expect(log[0].payload.source).toBe("copy");
    expect(log[0].payload.promptChars).toBe(450);
    expect(log[0].payload.variant).toBe("shorter");
    expect(log[0].payload.inputPromptChars).toBe(120);
    expect(log[0].payload.inputWordCount).toBe(18);
    expect(log[0].payload.isVaguePrompt).toBe(true);
    expect(log[0].payload.ambiguityLevel).toBe("high");
    expect(log[0].payload.editDistance).toBe(92);
    expect(log[0].payload.editDistanceRatio).toBe(0.42);
    expect(log[0].payload.editDistanceBaseline).toBe("enhance_input");
  });

  it("records builder_enhance_rerun with edit-distance payload", () => {
    trackBuilderEvent("builder_enhance_rerun", {
      previousPromptChars: 300,
      variant: "original",
      inputPromptChars: 160,
      inputWordCount: 26,
      isVaguePrompt: false,
      ambiguityLevel: "medium",
      editDistance: 44,
      editDistanceRatio: 0.19,
      editDistanceBaseline: "enhance_input",
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_rerun");
    expect(log[0].payload.previousPromptChars).toBe(300);
    expect(log[0].payload.editDistanceRatio).toBe(0.19);
    expect(log[0].payload.editDistanceBaseline).toBe("enhance_input");
  });

  it("records builder_enhance_completed with the input snapshot metrics", () => {
    trackBuilderEvent("builder_enhance_completed", {
      success: true,
      durationMs: 1800,
      outputChars: 520,
      inputPromptChars: 140,
      inputWordCount: 24,
      isVaguePrompt: false,
      ambiguityLevel: "medium",
      editDistance: 61,
      editDistanceRatio: 0.28,
      editDistanceBaseline: "enhance_input",
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_completed");
    expect(log[0].payload.success).toBe(true);
    expect(log[0].payload.inputPromptChars).toBe(140);
    expect(log[0].payload.inputWordCount).toBe(24);
    expect(log[0].payload.editDistanceRatio).toBe(0.28);
    expect(log[0].payload.editDistanceBaseline).toBe("enhance_input");
  });

  it("records builder_enhance_too_much_changed with compare-baseline metadata", () => {
    trackBuilderEvent("builder_enhance_too_much_changed", {
      variant: "original",
      promptChars: 480,
      originalPromptChars: 200,
      editDistance: 103,
      editDistanceRatio: 0.51,
      editDistanceBaseline: "builder_preview",
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_too_much_changed");
    expect(log[0].payload.editDistance).toBe(103);
    expect(log[0].payload.editDistanceBaseline).toBe("builder_preview");
  });

  it("records builder_enhance_intent_overridden with intent change", () => {
    trackBuilderEvent("builder_enhance_intent_overridden", {
      fromIntent: "rewrite",
      toIntent: "auto",
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_intent_overridden");
    expect(log[0].payload.fromIntent).toBe("rewrite");
    expect(log[0].payload.toIntent).toBe("auto");
  });

  it("records builder_enhance_assumption_edited with edit details", () => {
    trackBuilderEvent("builder_enhance_assumption_edited", {
      field: "open_questions",
      index: 1,
      beforeChars: 18,
      afterChars: 34,
      source: "structured_inspector",
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_assumption_edited");
    expect(log[0].payload.field).toBe("open_questions");
    expect(log[0].payload.index).toBe(1);
    expect(log[0].payload.beforeChars).toBe(18);
    expect(log[0].payload.afterChars).toBe(34);
    expect(log[0].payload.source).toBe("structured_inspector");
  });

  it("records all new event types without type errors", () => {
    const newEvents = [
      "builder_enhance_metadata_received",
      "builder_enhance_variant_applied",
      "builder_enhance_accepted",
      "builder_enhance_rerun",
      "builder_enhance_too_much_changed",
      "builder_enhance_assumption_edited",
      "builder_enhance_intent_overridden",
      "builder_enhance_structured_applied",
    ] as const;

    for (const event of newEvents) {
      trackBuilderEvent(event);
    }

    const log = getTelemetryLog();
    expect(log).toHaveLength(newEvents.length);
    expect(log.map((e) => e.event)).toEqual([...newEvents]);
  });

  it("simulates an accept-then-rerun flow", () => {
    // User enhances, copies (accept), then re-enhances
    trackBuilderEvent("builder_enhance_clicked", { promptChars: 100 });
    trackBuilderEvent("builder_enhance_completed", { success: true, durationMs: 2000 });
    trackBuilderEvent("builder_enhance_accepted", { promptChars: 350 });
    trackBuilderEvent("builder_enhance_rerun", { previousPromptChars: 350 });
    trackBuilderEvent("builder_enhance_clicked", { promptChars: 120 });

    const log = getTelemetryLog();
    expect(log).toHaveLength(5);

    const accepted = log.filter((e) => e.event === "builder_enhance_accepted");
    const reruns = log.filter((e) => e.event === "builder_enhance_rerun");
    const completed = log.filter(
      (e) => e.event === "builder_enhance_completed" && e.payload.success,
    );
    expect(accepted).toHaveLength(1);
    expect(reruns).toHaveLength(1);
    expect(completed).toHaveLength(1);
  });
});
