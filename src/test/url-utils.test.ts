import { describe, expect, it } from "vitest";
import { normalizeHttpUrl } from "@/lib/url-utils";

describe("normalizeHttpUrl", () => {
  it("normalizes bare hosts to https", () => {
    expect(normalizeHttpUrl("example.com/docs")).toBe("https://example.com/docs");
  });

  it("accepts explicit http(s) URLs", () => {
    expect(normalizeHttpUrl("http://example.com")).toBe("http://example.com/");
    expect(normalizeHttpUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("rejects non-http schemes", () => {
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpUrl("javascript://evil.com/path")).toBeNull();
    expect(normalizeHttpUrl("data:text/plain;base64,Zm9v")).toBeNull();
    expect(normalizeHttpUrl("mailto:test@example.com")).toBeNull();
  });
});
