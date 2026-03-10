import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getMostUsedPreference,
  loadEnhancementProfile,
  recordEnhancementAction,
  resetEnhancementProfile,
} from "@/lib/prompt-enhancement-profile";

beforeEach(() => resetEnhancementProfile());
afterEach(() => resetEnhancementProfile());

describe("prompt enhancement profile", () => {
  it("returns empty profile when nothing stored", () => {
    const profile = loadEnhancementProfile();
    expect(profile.totalEnhancements).toBe(0);
    expect(profile.acceptCount).toBe(0);
    expect(profile.rerunCount).toBe(0);
  });

  it("records enhancement_completed actions", () => {
    recordEnhancementAction({
      type: "enhancement_completed",
      depth: "guided",
      strictness: "balanced",
      ambiguityMode: "infer_conservatively",
    });
    recordEnhancementAction({
      type: "enhancement_completed",
      depth: "advanced",
      strictness: "balanced",
      ambiguityMode: "infer_conservatively",
    });

    const profile = loadEnhancementProfile();
    expect(profile.totalEnhancements).toBe(2);
    expect(profile.depthCounts.guided).toBe(1);
    expect(profile.depthCounts.advanced).toBe(1);
    expect(profile.strictnessCounts.balanced).toBe(2);
  });

  it("records variant_applied actions", () => {
    recordEnhancementAction({ type: "variant_applied", variant: "shorter" });
    recordEnhancementAction({ type: "variant_applied", variant: "shorter" });
    recordEnhancementAction({ type: "variant_applied", variant: "more_detailed" });

    const profile = loadEnhancementProfile();
    expect(profile.variantCounts.shorter).toBe(2);
    expect(profile.variantCounts.more_detailed).toBe(1);
  });

  it("records accepted and rerun actions", () => {
    recordEnhancementAction({ type: "accepted" });
    recordEnhancementAction({ type: "accepted" });
    recordEnhancementAction({ type: "rerun" });

    const profile = loadEnhancementProfile();
    expect(profile.acceptCount).toBe(2);
    expect(profile.rerunCount).toBe(1);
  });

  it("records richer override/apply actions", () => {
    recordEnhancementAction({ type: "intent_overridden", intent: "analysis" });
    recordEnhancementAction({ type: "intent_overridden", intent: "analysis" });
    recordEnhancementAction({ type: "assumption_edited", key: "constraints" });
    recordEnhancementAction({
      type: "format_accepted",
      format: "Markdown report with tables",
    });
    recordEnhancementAction({ type: "structured_apply_all" });

    const profile = loadEnhancementProfile();
    expect(profile.intentOverrideCounts.analysis).toBe(2);
    expect(profile.assumptionEditCounts.constraints).toBe(1);
    expect(profile.formatCounts["Markdown report with tables"]).toBe(1);
    expect(profile.structuredApplyCounts.all).toBe(1);
  });

  it("loads older stored profiles without new keys", () => {
    localStorage.setItem(
      "promptforge-enhancement-profile",
      JSON.stringify({
        depthCounts: { guided: 2 },
        strictnessCounts: { balanced: 2 },
        ambiguityModeCounts: { infer_conservatively: 2 },
        variantCounts: { shorter: 1 },
        acceptCount: 1,
        rerunCount: 1,
        totalEnhancements: 2,
      }),
    );

    const profile = loadEnhancementProfile();
    expect(profile.depthCounts.guided).toBe(2);
    expect(profile.intentOverrideCounts).toEqual({});
    expect(profile.assumptionEditCounts).toEqual({});
    expect(profile.formatCounts).toEqual({});
    expect(profile.structuredApplyCounts).toEqual({});
  });

  it("resets profile cleanly", () => {
    recordEnhancementAction({
      type: "enhancement_completed",
      depth: "guided",
      strictness: "balanced",
      ambiguityMode: "infer_conservatively",
    });
    recordEnhancementAction({ type: "variant_applied", variant: "shorter" });
    recordEnhancementAction({ type: "accepted" });
    recordEnhancementAction({ type: "intent_overridden", intent: "rewrite" });
    resetEnhancementProfile();

    const profile = loadEnhancementProfile();
    expect(profile.acceptCount).toBe(0);
    expect(profile.rerunCount).toBe(0);
    expect(profile.totalEnhancements).toBe(0);
    expect(Object.keys(profile.depthCounts)).toHaveLength(0);
    expect(Object.keys(profile.variantCounts)).toHaveLength(0);
    expect(Object.keys(profile.strictnessCounts)).toHaveLength(0);
    expect(Object.keys(profile.ambiguityModeCounts)).toHaveLength(0);
    expect(Object.keys(profile.intentOverrideCounts)).toHaveLength(0);
    expect(Object.keys(profile.assumptionEditCounts)).toHaveLength(0);
    expect(Object.keys(profile.formatCounts)).toHaveLength(0);
    expect(Object.keys(profile.structuredApplyCounts)).toHaveLength(0);
  });

  it("does not mutate when no explicit action", () => {
    const before = loadEnhancementProfile();
    const after = loadEnhancementProfile();
    expect(before).toEqual(after);
  });

  it("getMostUsedPreference returns the top key", () => {
    expect(getMostUsedPreference({ guided: 5, advanced: 3, quick: 1 })).toBe("guided");
    expect(getMostUsedPreference({})).toBeNull();
  });
});
