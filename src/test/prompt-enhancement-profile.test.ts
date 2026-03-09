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

  it("resets profile cleanly", () => {
    recordEnhancementAction({ type: "accepted" });
    resetEnhancementProfile();

    const profile = loadEnhancementProfile();
    expect(profile.acceptCount).toBe(0);
    expect(profile.totalEnhancements).toBe(0);
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
