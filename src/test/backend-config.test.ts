import { describe, expect, it } from "vitest";
import { resolveBackendConfig } from "@/lib/backend-config";

describe("backend config resolution", () => {
  it("fails open when Neon env is missing in non-test runtime", () => {
    const result = resolveBackendConfig({
      dataApiUrl: undefined,
      authUrl: undefined,
      mode: "production",
      vitest: false,
    });

    expect(result.hasBackendEnvConfig).toBe(false);
    expect(result.isBackendConfigured).toBe(false);
  });

  it("treats quoted env values as configured", () => {
    const result = resolveBackendConfig({
      dataApiUrl: "\"https://example.test/rest/v1\"",
      authUrl: "'https://example.test/auth'",
      mode: "production",
      vitest: false,
    });

    expect(result.hasBackendEnvConfig).toBe(true);
    expect(result.isBackendConfigured).toBe(true);
    expect(result.dataApiUrl).toBe("https://example.test/rest/v1");
    expect(result.authUrl).toBe("https://example.test/auth");
  });
});
