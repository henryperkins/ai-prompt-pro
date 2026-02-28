import { describe, expect, it } from "vitest";
import {
  assertPublicHttpTarget,
  isPrivateHost,
  isRedirectStatus,
  resolveClientIp,
} from "../../agent_service/network-security.mjs";

describe("isPrivateHost", () => {
  it("detects private/local hostnames", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("service.internal")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
  });

  it("allows public hostnames", () => {
    expect(isPrivateHost("example.com")).toBe(false);
  });
});

describe("resolveClientIp", () => {
  it("ignores forwarded headers when trust proxy is disabled", () => {
    const resolved = resolveClientIp({
      forwardedFor: "203.0.113.10",
      socketRemoteAddress: "198.51.100.20",
      trustProxy: false,
      trustedProxyIps: new Set(),
    });

    expect(resolved.ip).toBe("198.51.100.20");
    expect(resolved.ignoredForwarded).toBe(true);
  });

  it("uses forwarded IP when trust proxy is enabled and proxy is trusted", () => {
    const resolved = resolveClientIp({
      forwardedFor: "203.0.113.10, 198.51.100.20",
      socketRemoteAddress: "198.51.100.20",
      trustProxy: true,
      trustedProxyIps: new Set(["198.51.100.20"]),
    });

    expect(resolved.ip).toBe("203.0.113.10");
    expect(resolved.ignoredForwarded).toBe(false);
  });

  it("ignores forwarded IP when proxy source is not trusted", () => {
    const resolved = resolveClientIp({
      forwardedFor: "203.0.113.10",
      socketRemoteAddress: "198.51.100.20",
      trustProxy: true,
      trustedProxyIps: new Set(["198.51.100.21"]),
    });

    expect(resolved.ip).toBe("198.51.100.20");
    expect(resolved.ignoredForwarded).toBe(true);
  });
});

describe("assertPublicHttpTarget", () => {
  it("rejects localhost targets", async () => {
    await expect(assertPublicHttpTarget("http://localhost:8000")).rejects.toMatchObject({
      code: "url_not_allowed",
    });
  });

  it("rejects hostnames that resolve to private IPs", async () => {
    const lookupFn = async () => [{ address: "10.0.0.5" }];
    await expect(
      assertPublicHttpTarget("https://example.com/path", { lookupFn }),
    ).rejects.toMatchObject({
      code: "url_not_allowed",
    });
  });

  it("allows hostnames that resolve to public IPs", async () => {
    const lookupFn = async () => [{ address: "203.0.113.7" }];
    const result = await assertPublicHttpTarget("https://example.com/path", { lookupFn });
    expect(result.hostname).toBe("example.com");
  });
});

describe("isRedirectStatus", () => {
  it("matches http redirect status codes", () => {
    expect(isRedirectStatus(301)).toBe(true);
    expect(isRedirectStatus(307)).toBe(true);
    expect(isRedirectStatus(200)).toBe(false);
  });
});
