/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("style layer ownership", () => {
  const globalsCss = readFileSync("src/styles/globals.css", "utf8");
  const tokensCss = readFileSync("src/styles/tokens.css", "utf8");
  const themeCss = readFileSync("src/styles/theme.css", "utf8");
  const compatCss = readFileSync("src/styles/untitled-compat.css", "utf8");
  const legacyCss = readFileSync("src/styles/legacy-utility-tokens.css", "utf8");

  it("routes runtime compatibility tokens through theme.css", () => {
    expect(globalsCss).toContain('@import "./tokens.css";');
    expect(globalsCss).toContain('@import "./theme.css";');
    expect(globalsCss).not.toContain('@import "./legacy-utility-tokens.css";');
    expect(themeCss).toContain('@import "./untitled-compat.css";');
  });

  it("keeps semantic utility token ownership in tokens.css", () => {
    expect(tokensCss).toContain("@theme inline");
    expect(tokensCss).toContain("--color-bg-brand-solid");
    expect(tokensCss).toContain("--text-color-primary");
    expect(tokensCss).toContain("--border-color-primary");
  });

  it("keeps compat files narrow and alias-focused", () => {
    expect(compatCss).toContain("--color-utility-brand-50");
    expect(compatCss).not.toContain("--background-color-brand-solid");
    expect(legacyCss).toContain('@import "./untitled-compat.css";');
    expect(legacyCss).not.toContain("--color-brand-25");
  });
});
