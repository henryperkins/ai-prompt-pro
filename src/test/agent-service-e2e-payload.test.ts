/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BASE_ENV,
  killAgentService,
  spawnAgentService,
  type SpawnedAgentService,
} from "@/test/helpers/agent-service-harness";

const TEST_PORT = 18919;

async function postRaw(
  service: SpawnedAgentService,
  path: string,
  body: string,
  headers: HeadersInit = {},
) {
  return fetch(`${service.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}

async function postJson(
  service: SpawnedAgentService,
  path: string,
  body: unknown,
  headers: HeadersInit = {},
) {
  return postRaw(service, path, JSON.stringify(body), headers);
}

describe("agent service E2E payload validation", () => {
  let service: SpawnedAgentService;

  beforeAll(async () => {
    service = await spawnAgentService({
      port: TEST_PORT,
      env: {
        MAX_HTTP_BODY_BYTES: "1024",
        MAX_PROMPT_CHARS: "100",
      },
    });
  });

  afterAll(async () => {
    await killAgentService(service?.child);
  });

  it("rejects oversized HTTP bodies", async () => {
    const response = await postRaw(
      service,
      "/enhance",
      JSON.stringify({ prompt: "x".repeat(2_000) }),
      { "x-agent-token": BASE_ENV.AGENT_SERVICE_TOKEN },
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toContain("Request body too large.");
    expect(body.error).toContain("Maximum 1024 bytes");
    expect(body.code).toBe("payload_too_large");
  });

  it("rejects missing prompts", async () => {
    const response = await postJson(
      service,
      "/enhance",
      {},
      { "x-agent-token": BASE_ENV.AGENT_SERVICE_TOKEN },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual(expect.objectContaining({
      error: "Prompt is required.",
      detail: "Prompt is required.",
      code: "bad_request",
    }));
  });

  it("rejects invalid JSON request bodies", async () => {
    const response = await postRaw(
      service,
      "/enhance",
      "{not-json",
      { "x-agent-token": BASE_ENV.AGENT_SERVICE_TOKEN },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid JSON body.",
      code: "bad_request",
    });
  });

  it("rejects prompts that exceed MAX_PROMPT_CHARS", async () => {
    const response = await postJson(
      service,
      "/enhance",
      { prompt: "x".repeat(101) },
      { "x-agent-token": BASE_ENV.AGENT_SERVICE_TOKEN },
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body).toEqual(expect.objectContaining({
      error: "Prompt is too large. Maximum 100 characters.",
      detail: "Prompt is too large. Maximum 100 characters.",
      code: "payload_too_large",
    }));
  });

  it("rejects GET /enhance with method not allowed", async () => {
    const response = await fetch(`${service.baseUrl}/enhance`);
    const body = await response.json();

    expect(response.status).toBe(405);
    expect(body).toEqual({
      error: "Method not allowed.",
      code: "method_not_allowed",
    });
  });
});
