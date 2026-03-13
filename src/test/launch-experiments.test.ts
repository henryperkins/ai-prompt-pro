import { afterEach, describe, expect, it } from "vitest";
import {
  getHeroCopyVariant,
  getLaunchExperimentAssignments,
} from "@/lib/launch-experiments";

describe("launch experiments", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("respects query overrides for the hero experiment", () => {
    const assignment = getLaunchExperimentAssignments({ search: "?exp_hero=b" });

    expect(assignment.heroCopy).toBe("speed");
  });

  it("persists hero assignments in session storage", () => {
    const first = getLaunchExperimentAssignments({ random: () => 0.9 });
    expect(first.heroCopy).toBe("speed");

    const second = getLaunchExperimentAssignments({ random: () => 0.1 });
    expect(second).toEqual(first);
  });

  it("returns copy text for each variant", () => {
    expect(getHeroCopyVariant("control").headline).toMatch(/rough ideas/i);
    expect(getHeroCopyVariant("speed").headline).toMatch(/faster/i);
    expect(getHeroCopyVariant("speed").subhead).toMatch(/enhance the prompt/i);
  });
});
