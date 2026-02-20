import { afterEach, describe, expect, it } from "vitest";
import {
  getHeroCopyVariant,
  getLaunchExperimentAssignments,
  getPrimaryCtaVariantLabel,
} from "@/lib/launch-experiments";

describe("launch experiments", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("respects query overrides for hero and CTA variants", () => {
    const assignment = getLaunchExperimentAssignments({ search: "?exp_hero=b&exp_cta=b" });

    expect(assignment.heroCopy).toBe("speed");
    expect(assignment.primaryCta).toBe("quality_pass");
  });

  it("persists random assignments in session storage", () => {
    const first = getLaunchExperimentAssignments({ random: () => 0.9 });
    expect(first.heroCopy).toBe("speed");
    expect(first.primaryCta).toBe("quality_pass");

    const second = getLaunchExperimentAssignments({ random: () => 0.1 });
    expect(second).toEqual(first);
  });

  it("returns copy text for each variant", () => {
    expect(getHeroCopyVariant("control").headline).toMatch(/rough ideas/i);
    expect(getHeroCopyVariant("speed").headline).toMatch(/faster/i);
    expect(getPrimaryCtaVariantLabel("control")).toMatch(/enhance/i);
    expect(getPrimaryCtaVariantLabel("quality_pass")).toBe("Run quality pass");
  });
});
