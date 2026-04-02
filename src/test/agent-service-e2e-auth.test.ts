/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BASE_ENV,
  killAgentService,
  readResponseStreamChunk,
  spawnAgentService,
  type SpawnedAgentService,
} from "@/test/helpers/agent-service-harness";

const TEST_PORT = 18917;

async function postJson(
  service: SpawnedAgentService,
  path: string,
  body: unknown,
  headers: HeadersInit = {},
) {
  return fetch(`${service.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function expectErrorResponse(
  response: Response,
  status: number,
  code?: string,
) {
  const body = await response.json();

  expect(response.status).toBe(status);
  expect(body).toEqual(expect.objectContaining({
    error: expect.any(String),
    code: expect.any(String),
  }));

  if (code) {
    expect(body.code).toBe(code);
  }
}

describe("agent service E2E auth enforcement", () => {
  let service: SpawnedAgentService;

  beforeAll(async () => {
    service = await spawnAgentService({ port: TEST_PORT });
  });

  afterAll(async () => {
    await killAgentService(service?.child);
  });

  it("rejects enhance requests without auth", async () => {
    const response = await postJson(service, "/enhance", { prompt: "hello" });

    await expectErrorResponse(response, 401, "auth_required");
  });

  it("accepts a valid x-agent-token and starts SSE", async () => {
    const response = await postJson(
      service,
      "/enhance",
      { prompt: "hello" },
      { "x-agent-token": BASE_ENV.AGENT_SERVICE_TOKEN },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await readResponseStreamChunk(response)).toContain("data:");
  });

  it("rejects an invalid x-agent-token", async () => {
    const response = await postJson(
      service,
      "/enhance",
      { prompt: "hello" },
      { "x-agent-token": "wrong-token" },
    );

    await expectErrorResponse(response, 401, "auth_session_invalid");
  });

  it("accepts a valid public API key and starts SSE", async () => {
    const response = await postJson(
      service,
      "/enhance",
      { prompt: "hello" },
      { apikey: BASE_ENV.FUNCTION_PUBLIC_API_KEY },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await readResponseStreamChunk(response)).toContain("data:");
  });

  it("rejects an invalid public API key", async () => {
    const response = await postJson(
      service,
      "/enhance",
      { prompt: "hello" },
      { apikey: "wrong-apikey" },
    );

    await expectErrorResponse(response, 401, "auth_required");
  });

  it("rejects extract-url and infer-builder-fields without auth", async () => {
    for (const path of ["/extract-url", "/infer-builder-fields"]) {
      const response = await postJson(service, path, {});
      await expectErrorResponse(response, 401, "auth_required");
    }
  });
});
