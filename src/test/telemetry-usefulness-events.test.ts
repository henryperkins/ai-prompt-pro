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

  it("records builder_enhance_accepted with prompt chars", () => {
    trackBuilderEvent("builder_enhance_accepted", {
      promptChars: 450,
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_accepted");
    expect(log[0].payload.promptChars).toBe(450);
  });

  it("records builder_enhance_rerun with previous prompt chars", () => {
    trackBuilderEvent("builder_enhance_rerun", {
      previousPromptChars: 300,
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_rerun");
    expect(log[0].payload.previousPromptChars).toBe(300);
  });

  it("records builder_enhance_intent_overridden with intent change", () => {
    trackBuilderEvent("builder_enhance_intent_overridden", {
      fromIntent: "brainstorm",
      toIntent: "analysis",
    });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_enhance_intent_overridden");
    expect(log[0].payload.fromIntent).toBe("brainstorm");
    expect(log[0].payload.toIntent).toBe("analysis");
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
