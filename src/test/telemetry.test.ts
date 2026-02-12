import { describe, expect, it } from "vitest";
import {
  BUILDER_TELEMETRY_EVENT_NAME,
  trackBuilderEvent,
  type BuilderTelemetryEnvelope,
} from "@/lib/telemetry";

describe("trackBuilderEvent", () => {
  it("dispatches a custom event envelope on window", () => {
    let captured: BuilderTelemetryEnvelope | null = null;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<BuilderTelemetryEnvelope>;
      captured = custom.detail;
    };

    window.addEventListener(BUILDER_TELEMETRY_EVENT_NAME, handler);
    trackBuilderEvent("builder_loaded", { redesignPhase1: true });
    window.removeEventListener(BUILDER_TELEMETRY_EVENT_NAME, handler);

    expect(captured).not.toBeNull();
    expect(captured?.event).toBe("builder_loaded");
    expect(captured?.payload).toEqual({ redesignPhase1: true });
    expect(typeof captured?.timestamp).toBe("number");
  });
});
