import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("chart primitive styling contract", () => {
  it("does not rely on hardcoded Recharts stroke color selectors", () => {
    const source = readFileSync("src/components/base/primitives/chart.tsx", "utf8");

    expect(source).not.toContain("[stroke='#ccc']");
    expect(source).not.toContain("[stroke='#fff']");
    expect(source).toContain("[&_.recharts-cartesian-grid_line]:stroke-border/50");
    expect(source).toContain("[&_.recharts-reference-line_line]:stroke-border");
  });
});
