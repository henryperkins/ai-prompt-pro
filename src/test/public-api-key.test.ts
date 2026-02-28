import { describe, expect, it } from "vitest";
import {
  isConfiguredPublicApiKey,
  isPublishableKeyLike,
} from "../../agent_service/public-api-key.mjs";

describe("isPublishableKeyLike", () => {
  it("accepts known publishable key prefixes", () => {
    expect(isPublishableKeyLike("sb_publishable_abc")).toBe(true);
    expect(isPublishableKeyLike("pk_live_abc")).toBe(true);
    expect(isPublishableKeyLike("pk_test_abc")).toBe(true);
  });

  it("rejects non-publishable values", () => {
    expect(isPublishableKeyLike("sb_secret_abc")).toBe(false);
    expect(isPublishableKeyLike("")).toBe(false);
    expect(isPublishableKeyLike(null)).toBe(false);
  });
});

describe("isConfiguredPublicApiKey", () => {
  it("accepts exact configured key matches", () => {
    expect(
      isConfiguredPublicApiKey("anon-key", {
        configuredKeys: new Set(["anon-key"]),
        strict: true,
      }),
    ).toBe(true);
  });

  it("rejects publishable-format keys when strict mode is enabled", () => {
    expect(
      isConfiguredPublicApiKey("sb_publishable_test_key", {
        configuredKeys: new Set(),
        strict: true,
      }),
    ).toBe(false);
  });

  it("allows publishable-format keys only when strict mode is disabled and no key is configured", () => {
    expect(
      isConfiguredPublicApiKey("sb_publishable_test_key", {
        configuredKeys: new Set(),
        strict: false,
      }),
    ).toBe(true);
  });

  it("does not allow non-matching keys when explicit keys are configured", () => {
    expect(
      isConfiguredPublicApiKey("sb_publishable_test_key", {
        configuredKeys: new Set(["anon-key"]),
        strict: false,
      }),
    ).toBe(false);
  });
});
