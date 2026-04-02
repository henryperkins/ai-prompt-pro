/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  killAgentService,
  spawnAgentService,
  type SpawnedAgentService,
} from "@/test/helpers/agent-service-harness";

const TEST_PORT = 18916;

async function getJson(service: SpawnedAgentService, path: string, headers: HeadersInit = {}) {
  const response = await fetch(`${service.baseUrl}${path}`, {
    headers,
  });
  const body = await response.json();
  return { response, body };
}

describe("agent service E2E health endpoints", () => {
  let service: SpawnedAgentService;

  beforeAll(async () => {
    service = await spawnAgentService({ port: TEST_PORT });
  });

  afterAll(async () => {
    await killAgentService(service?.child);
  });

  it("returns service metadata from GET /", async () => {
    const { response, body } = await getJson(service, "/");

    expect(response.status).toBe(200);
    expect(body).toEqual({
      service: "ai-prompt-pro-codex-service",
      provider: "codex-sdk",
      status: "running",
      health: "/health",
      ready: "/ready",
    });
  });

  it("returns liveness from GET /health", async () => {
    const { response, body } = await getJson(service, "/health");

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      status: "alive",
      ready: "/ready",
      provider: "codex-sdk",
    });
  });

  it("returns readiness details from GET /ready", async () => {
    const { response, body } = await getJson(service, "/ready");

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      ok: true,
      issues: expect.any(Array),
      warnings: expect.any(Array),
      provider: "codex-sdk",
    }));
  });

  it("returns detailed health from GET /health/details", async () => {
    const { response, body } = await getJson(service, "/health/details");

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({
      ok: true,
      provider: "codex-sdk",
      provider_name: expect.any(String),
      strict_public_api_key: expect.any(Boolean),
    }));
  });

  it("returns 404 from unknown paths", async () => {
    const { response, body } = await getJson(service, "/does-not-exist");

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: "Not found.",
      code: "not_found",
    });
  });

  it("echoes x-request-id on all health responses", async () => {
    const paths = ["/", "/health", "/ready", "/health/details", "/does-not-exist"];

    for (const [index, path] of paths.entries()) {
      const requestId = `health-e2e-${index + 1}`;
      const response = await fetch(`${service.baseUrl}${path}`, {
        headers: {
          "x-request-id": requestId,
        },
      });

      expect(response.headers.get("x-request-id")).toBe(requestId);
    }
  });
});
