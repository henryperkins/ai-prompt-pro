/* @vitest-environment node */
import { describe, expect, it } from "vitest";
import { isAllowedRedirectOrigin } from "../../agent_service/redirect-validation.mjs";

describe("agent service redirect origin validation", () => {
  it("accepts an explicitly allowed origin", () => {
    expect(
      isAllowedRedirectOrigin("http://localhost:8080", {
        mode: "set",
        origins: new Set(["http://localhost:8080"]),
      }),
    ).toBe(true);
  });

  it("rejects unknown origins", () => {
    expect(
      isAllowedRedirectOrigin("https://spoofed.example", {
        mode: "set",
        origins: new Set(["http://localhost:8080"]),
      }),
    ).toBe(false);
  });

  it("rejects invalid URL input", () => {
    expect(
      isAllowedRedirectOrigin("not-a-url", {
        mode: "set",
        origins: new Set(["http://localhost:8080"]),
      }),
    ).toBe(false);
  });

  it("rejects empty input", () => {
    expect(
      isAllowedRedirectOrigin("", {
        mode: "set",
        origins: new Set(["http://localhost:8080"]),
      }),
    ).toBe(false);
  });

  it("fails closed when CORS is wildcard mode", () => {
    expect(
      isAllowedRedirectOrigin("http://localhost:8080", {
        mode: "any",
        origins: new Set(),
      }),
    ).toBe(false);
  });
});
