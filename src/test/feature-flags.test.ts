import { afterEach, describe, expect, it, vi } from "vitest";

describe("builderRedesignFlags", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("defaults all phases to false", async () => {
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE2", "");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE3", "");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE4", "");
    vi.stubEnv("VITE_COMMUNITY_MOBILE_ENHANCEMENTS", "");

    const { builderRedesignFlags, communityFeatureFlags } = await import("@/lib/feature-flags");

    expect(builderRedesignFlags.builderRedesignPhase1).toBe(false);
    expect(builderRedesignFlags.builderRedesignPhase2).toBe(false);
    expect(builderRedesignFlags.builderRedesignPhase3).toBe(false);
    expect(builderRedesignFlags.builderRedesignPhase4).toBe(false);
    expect(communityFeatureFlags.communityMobileEnhancements).toBe(false);
  });

  it("parses truthy env values", async () => {
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "true");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE2", "1");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE3", "yes");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE4", "on");
    vi.stubEnv("VITE_COMMUNITY_MOBILE_ENHANCEMENTS", "true");

    const { builderRedesignFlags, communityFeatureFlags } = await import("@/lib/feature-flags");

    expect(builderRedesignFlags.builderRedesignPhase1).toBe(true);
    expect(builderRedesignFlags.builderRedesignPhase2).toBe(true);
    expect(builderRedesignFlags.builderRedesignPhase3).toBe(true);
    expect(builderRedesignFlags.builderRedesignPhase4).toBe(true);
    expect(communityFeatureFlags.communityMobileEnhancements).toBe(true);
  });
});
