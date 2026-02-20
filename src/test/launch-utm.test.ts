import { describe, expect, it } from "vitest";
import { buildLaunchTrackedUrl } from "@/lib/launch-utm";

describe("buildLaunchTrackedUrl", () => {
  it("builds a tracked URL with channel defaults", () => {
    const url = buildLaunchTrackedUrl("https://prompt.lakefrontdigital.io", {
      campaign: "Launch Sprint Week 1",
      channel: "organic_social",
      content: "hero-copy-a",
    });

    expect(url).toContain("utm_source=social");
    expect(url).toContain("utm_medium=organic");
    expect(url).toContain("utm_campaign=launch-sprint-week-1");
    expect(url).toContain("utm_content=hero-copy-a");
  });

  it("returns null when URL or campaign is invalid", () => {
    expect(
      buildLaunchTrackedUrl("javascript:alert(1)", {
        campaign: "Launch",
        channel: "email",
      }),
    ).toBeNull();

    expect(
      buildLaunchTrackedUrl("https://prompt.lakefrontdigital.io", {
        campaign: "@@@",
        channel: "email",
      }),
    ).toBeNull();
  });
});
