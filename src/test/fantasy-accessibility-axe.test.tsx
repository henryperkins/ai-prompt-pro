import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { PFQualityGauge } from "@/components/fantasy/PFQualityGauge";
import { PFTemplateCard } from "@/components/fantasy/PFTemplateCard";

describe("fantasy design-system accessibility", () => {
  it("has no axe violations for the template card surface", async () => {
    render(
      <main>
        <PFTemplateCard
          title="Launch Readiness Forge"
          description="Turn a loose launch brief into a structured rollout checklist."
          rarity="legendary"
          author="Community Artifact"
          tags={["launch", "ops", "checklist"]}
          footerLeft="Recently forged"
          footerRight="Ready"
          onClick={() => undefined}
        />
      </main>,
    );

    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });

  it("has no axe violations for the quality gauge surface", async () => {
    render(
      <main>
        <PFQualityGauge value={82} size={128} showLabel />
      </main>,
    );

    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });
});
