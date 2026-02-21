import { forwardRef } from "react";
import { describe, expect, it } from "vitest";
import { isReactComponent } from "@/utils/is-react-component";

describe("isReactComponent", () => {
  it("returns false for plain objects without throwing", () => {
    expect(() => isReactComponent({})).not.toThrow();
    expect(isReactComponent({})).toBe(false);
  });

  it("recognizes forwardRef components", () => {
    const ForwardRefExample = forwardRef<HTMLDivElement>(function ForwardRefExample(_props, ref) {
      return <div ref={ref} />;
    });

    expect(isReactComponent(ForwardRefExample)).toBe(true);
  });
});
