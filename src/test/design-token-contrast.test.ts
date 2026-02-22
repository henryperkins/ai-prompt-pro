/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function extractBlock(css: string, selector: string): string {
  const selectorIndex = css.indexOf(selector);
  if (selectorIndex < 0) return "";

  const blockStart = css.indexOf("{", selectorIndex);
  let depth = 0;

  for (let index = blockStart; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(blockStart + 1, index);
      }
    }
  }

  return "";
}

function extractVariables(block: string): Record<string, string> {
  const values: Record<string, string> = {};
  const varPattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;

  for (const match of block.matchAll(varPattern)) {
    values[match[1]] = match[2].trim();
  }

  return values;
}

function parseHslTriplet(value: string): [number, number, number] | null {
  const match = value.match(/([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%/);
  if (!match) return null;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function hslToRgb([hue, saturation, lightness]: [number, number, number]): [number, number, number] {
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const a = s * Math.min(l, 1 - l);
  const convert = (index: number): number => {
    const k = (index + h * 12) % 12;
    const channel = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(channel * 255);
  };

  return [convert(0), convert(8), convert(4)];
}

function luminance([red, green, blue]: [number, number, number]): number {
  const srgb = [red, green, blue].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(first: [number, number, number], second: [number, number, number]): number {
  const l1 = luminance(first);
  const l2 = luminance(second);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("design token contrast", () => {
  const css = readFileSync("src/index.css", "utf8");
  const lightThemeVars = extractVariables(extractBlock(css, ":root"));
  const darkThemeVars = extractVariables(extractBlock(css, ".dark"));
  const requiredPairs: Array<[string, string]> = [
    ["foreground", "background"],
    ["card-foreground", "card"],
    ["popover-foreground", "popover"],
    ["primary-foreground", "primary"],
    ["secondary-foreground", "secondary"],
    ["muted-foreground", "muted"],
    ["accent-foreground", "accent"],
    ["destructive-foreground", "destructive"],
  ];

  it.each([
    ["light", lightThemeVars],
    ["dark", darkThemeVars],
  ])("keeps required foreground/background pairs WCAG AA compliant in %s theme", (_themeName, vars) => {
    for (const [foregroundVar, backgroundVar] of requiredPairs) {
      const foreground = parseHslTriplet(vars[foregroundVar] ?? "");
      const background = parseHslTriplet(vars[backgroundVar] ?? "");

      expect(foreground, `Missing --${foregroundVar}`).not.toBeNull();
      expect(background, `Missing --${backgroundVar}`).not.toBeNull();

      const ratio = contrastRatio(hslToRgb(foreground!), hslToRgb(background!));
      expect(ratio, `${foregroundVar} on ${backgroundVar} must be >= 4.5:1`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
