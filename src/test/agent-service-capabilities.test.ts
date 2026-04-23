import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("agent-service-capabilities", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads GitHub capability booleans from the public health details endpoint", async () => {
    vi.stubEnv("VITE_AGENT_SERVICE_URL", "https://agent.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        ok: true,
        github_context_configured: true,
        github_context_available: true,
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchAgentServiceCapabilities } = await import("@/lib/agent-service-capabilities");
    await expect(fetchAgentServiceCapabilities()).resolves.toEqual({
      githubContextConfigured: true,
      githubContextAvailable: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://agent.test/health/details",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("reports that the capability endpoint is unavailable when the agent service URL is missing", async () => {
    vi.stubEnv("VITE_AGENT_SERVICE_URL", "");

    const { hasAgentServiceCapabilitiesEndpoint } = await import("@/lib/agent-service-capabilities");
    expect(hasAgentServiceCapabilitiesEndpoint()).toBe(false);
  });
});
