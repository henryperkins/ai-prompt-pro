import { afterEach, describe, expect, it, vi } from "vitest";

describe("builderRedesignFlags", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("defaults builder phases to true and leaves optional experiments disabled", async () => {
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE2", "");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE3", "");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE4", "");
    vi.stubEnv("VITE_COMMUNITY_MOBILE_ENHANCEMENTS", "");
    vi.stubEnv("VITE_LAUNCH_EXPERIMENT_HERO_COPY", "");
    vi.stubEnv("VITE_LAUNCH_EXPERIMENT_PRIMARY_CTA", "");

    const { builderRedesignFlags, communityFeatureFlags, launchExperimentFlags } = await import("@/lib/feature-flags");

    expect(builderRedesignFlags.builderRedesignPhase1).toBe(true);
    expect(builderRedesignFlags.builderRedesignPhase2).toBe(true);
    expect(builderRedesignFlags.builderRedesignPhase3).toBe(true);
    expect(builderRedesignFlags.builderRedesignPhase4).toBe(true);
    expect(communityFeatureFlags.communityMobileEnhancements).toBe(false);
    expect(launchExperimentFlags.launchHeroCopyExperiment).toBe(false);
    expect(launchExperimentFlags.launchPrimaryCtaExperiment).toBe(false);
  });

  it("respects explicit false values for builder phases", async () => {
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "false");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE2", "0");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE3", "no");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE4", "off");

    const { builderRedesignFlags } = await import("@/lib/feature-flags");

    expect(builderRedesignFlags.builderRedesignPhase1).toBe(false);
    expect(builderRedesignFlags.builderRedesignPhase2).toBe(false);
    expect(builderRedesignFlags.builderRedesignPhase3).toBe(false);
    expect(builderRedesignFlags.builderRedesignPhase4).toBe(false);
  });

  it("parses truthy env values", async () => {
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE1", "true");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE2", "1");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE3", "yes");
    vi.stubEnv("VITE_BUILDER_REDESIGN_PHASE4", "on");
    vi.stubEnv("VITE_COMMUNITY_MOBILE_ENHANCEMENTS", "true");
    vi.stubEnv("VITE_LAUNCH_EXPERIMENT_HERO_COPY", "true");
    vi.stubEnv("VITE_LAUNCH_EXPERIMENT_PRIMARY_CTA", "1");

    const { builderRedesignFlags, communityFeatureFlags, launchExperimentFlags } = await import("@/lib/feature-flags");

    expect(builderRedesignFlags.builderRedesignPhase1).toBe(true);
    expect(builderRedesignFlags.builderRedesignPhase2).toBe(true);
    expect(builderRedesignFlags.builderRedesignPhase3).toBe(true);
    expect(builderRedesignFlags.builderRedesignPhase4).toBe(true);
    expect(communityFeatureFlags.communityMobileEnhancements).toBe(true);
    expect(launchExperimentFlags.launchHeroCopyExperiment).toBe(true);
    expect(launchExperimentFlags.launchPrimaryCtaExperiment).toBe(true);
  });
});
