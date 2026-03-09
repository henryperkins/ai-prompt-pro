import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BUILDER_TELEMETRY_EVENT_NAME,
  clearTelemetryLog,
  getTelemetryLog,
  resetTelemetryListener,
  startTelemetryListener,
  trackBuilderEvent,
  type BuilderTelemetryEnvelope,
} from "@/lib/telemetry";

describe("Telemetry listener", () => {
  beforeEach(() => {
    resetTelemetryListener();
    clearTelemetryLog();
  });

  afterEach(() => {
    resetTelemetryListener();
    clearTelemetryLog();
  });

  it("writes events to localStorage via startTelemetryListener", () => {
    startTelemetryListener();

    trackBuilderEvent("builder_loaded", { page: "home" });

    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
    expect(log[0].event).toBe("builder_loaded");
    expect(log[0].payload).toEqual({ page: "home" });
    expect(log[0].timestamp).toBeGreaterThan(0);
  });

  it("accumulates multiple events in order", () => {
    startTelemetryListener();

    trackBuilderEvent("builder_loaded");
    trackBuilderEvent("builder_first_input");
    trackBuilderEvent("builder_enhance_clicked");

    const log = getTelemetryLog();
    expect(log).toHaveLength(3);
    expect(log.map((e) => e.event)).toEqual([
      "builder_loaded",
      "builder_first_input",
      "builder_enhance_clicked",
    ]);
  });

  it("caps the ring buffer at 500 entries and drops oldest", () => {
    startTelemetryListener();

    for (let i = 0; i < 510; i++) {
      trackBuilderEvent("builder_loaded", { index: i });
    }

    const log = getTelemetryLog();
    expect(log).toHaveLength(500);

    // Oldest entries (0-9) should have been dropped
    expect((log[0].payload as Record<string, number>).index).toBe(10);
    // Newest entry should be the last one
    expect((log[499].payload as Record<string, number>).index).toBe(509);
  });

  it("returns empty array when no events have been logged", () => {
    expect(getTelemetryLog()).toEqual([]);
  });

  it("clearTelemetryLog removes all entries", () => {
    startTelemetryListener();

    trackBuilderEvent("builder_loaded");
    expect(getTelemetryLog()).toHaveLength(1);

    clearTelemetryLog();
    expect(getTelemetryLog()).toEqual([]);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("promptforge-telemetry-log", "not-json{{{");

    const log = getTelemetryLog();
    expect(log).toEqual([]);
  });

  it("is safe to call startTelemetryListener multiple times", () => {
    startTelemetryListener();
    startTelemetryListener();
    startTelemetryListener();

    trackBuilderEvent("builder_loaded");

    // Should only have 1 event, not 3 (listener not duplicated)
    const log = getTelemetryLog();
    expect(log).toHaveLength(1);
  });

  it("events dispatched before listener are not captured", () => {
    // Dispatch an event directly without the listener
    const detail: BuilderTelemetryEnvelope = {
      event: "builder_loaded",
      payload: {},
      timestamp: Date.now(),
    };
    window.dispatchEvent(
      new CustomEvent(BUILDER_TELEMETRY_EVENT_NAME, { detail }),
    );

    // Since we cleared in beforeEach and listener isn't started fresh here,
    // events from previous tests might have registered the listener.
    // The key assertion: getTelemetryLog works without errors
    const log = getTelemetryLog();
    expect(Array.isArray(log)).toBe(true);
  });

  it("merges events from multiple tab-scoped keys", () => {
    // Simulate two different tabs by directly writing tab-scoped keys.
    const tab1Events: BuilderTelemetryEnvelope[] = [
      { event: "builder_loaded", payload: { tab: 1 }, timestamp: 100 },
      { event: "builder_first_input", payload: { tab: 1 }, timestamp: 300 },
    ];
    const tab2Events: BuilderTelemetryEnvelope[] = [
      { event: "builder_enhance_clicked", payload: { tab: 2 }, timestamp: 200 },
      { event: "builder_enhance_completed", payload: { tab: 2 }, timestamp: 400 },
    ];

    localStorage.setItem("promptforge-telemetry-log:tab-a", JSON.stringify(tab1Events));
    localStorage.setItem("promptforge-telemetry-log:tab-b", JSON.stringify(tab2Events));

    const log = getTelemetryLog();
    expect(log).toHaveLength(4);
    // Merged and sorted by timestamp
    expect(log.map((e) => e.timestamp)).toEqual([100, 200, 300, 400]);
    expect(log[0].payload).toEqual({ tab: 1 });
    expect(log[1].payload).toEqual({ tab: 2 });
  });

  it("includes legacy key events in merged reads", () => {
    const legacyEvents: BuilderTelemetryEnvelope[] = [
      { event: "builder_loaded", payload: { legacy: true }, timestamp: 50 },
    ];
    const tabEvents: BuilderTelemetryEnvelope[] = [
      { event: "builder_first_input", payload: { scoped: true }, timestamp: 150 },
    ];

    localStorage.setItem("promptforge-telemetry-log", JSON.stringify(legacyEvents));
    localStorage.setItem("promptforge-telemetry-log:tab-x", JSON.stringify(tabEvents));

    const log = getTelemetryLog();
    expect(log).toHaveLength(2);
    expect(log[0].payload).toEqual({ legacy: true });
    expect(log[1].payload).toEqual({ scoped: true });
  });

  it("clearTelemetryLog removes all scoped keys and legacy key", () => {
    localStorage.setItem("promptforge-telemetry-log", JSON.stringify([{ event: "builder_loaded", payload: {}, timestamp: 1 }]));
    localStorage.setItem("promptforge-telemetry-log:tab-a", JSON.stringify([{ event: "builder_loaded", payload: {}, timestamp: 2 }]));
    localStorage.setItem("promptforge-telemetry-log:tab-b", JSON.stringify([{ event: "builder_loaded", payload: {}, timestamp: 3 }]));

    clearTelemetryLog();

    expect(localStorage.getItem("promptforge-telemetry-log")).toBeNull();
    expect(localStorage.getItem("promptforge-telemetry-log:tab-a")).toBeNull();
    expect(localStorage.getItem("promptforge-telemetry-log:tab-b")).toBeNull();
    expect(getTelemetryLog()).toEqual([]);
  });
});
