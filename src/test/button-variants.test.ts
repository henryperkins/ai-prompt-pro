import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/base/buttons/button";

describe("buttonVariants", () => {
  it("does not force global min-height classes", () => {
    const classes = buttonVariants({ size: "icon", className: "h-8 w-8" });

    expect(classes).toContain("h-8");
    expect(classes).toContain("w-8");
    expect(classes).not.toContain("min-h-11");
    expect(classes).not.toContain("sm:min-h-9");
  });
});
