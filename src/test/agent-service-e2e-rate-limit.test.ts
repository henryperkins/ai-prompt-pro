/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BASE_ENV,
  killAgentService,
  spawnAgentService,
  type SpawnedAgentService,
} from "@/test/helpers/agent-service-harness";

const TEST_PORT = 18918;

async function postJson(
  service: SpawnedAgentService,
  path: string,
  body: unknown,
  ipAddress: string,
) {
  return fetch(`${service.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-token": BASE_ENV.AGENT_SERVICE_TOKEN,
      "x-forwarded-for": ipAddress,
    },
    body: JSON.stringify(body),
  });
}

describe("agent service E2E rate limiting", () => {
  let service: SpawnedAgentService;

  beforeAll(async () => {
    service = await spawnAgentService({
      port: TEST_PORT,
      env: {
        TRUST_PROXY: "true",
        ENHANCE_PER_MINUTE: "2",
        ENHANCE_PER_DAY: "1000",
        EXTRACT_PER_MINUTE: "2",
        EXTRACT_PER_DAY: "1000",
        INFER_PER_MINUTE: "2",
        INFER_PER_DAY: "1000",
      },
    });
  });

  afterAll(async () => {
    await killAgentService(service?.child);
  });

  it("rate limits enhance requests on the third request", async () => {
    const ipAddress = "198.51.100.11";

    expect((await postJson(service, "/enhance", {}, ipAddress)).status).toBe(400);
    expect((await postJson(service, "/enhance", {}, ipAddress)).status).toBe(400);

    const third = await postJson(service, "/enhance", {}, ipAddress);
    const body = await third.json();

    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
    expect(body).toEqual(expect.objectContaining({
      error: expect.any(String),
      code: "rate_limited",
    }));
  });

  it("rate limits extract-url requests on the third request", async () => {
    const ipAddress = "198.51.100.12";

    expect((await postJson(service, "/extract-url", {}, ipAddress)).status).toBe(400);
    expect((await postJson(service, "/extract-url", {}, ipAddress)).status).toBe(400);

    const third = await postJson(service, "/extract-url", {}, ipAddress);
    const body = await third.json();

    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
    expect(body).toEqual(expect.objectContaining({
      error: expect.any(String),
      code: "rate_limited",
    }));
  });

  it("rate limits infer-builder-fields requests on the third request", async () => {
    const ipAddress = "198.51.100.13";

    expect((await postJson(service, "/infer-builder-fields", {}, ipAddress)).status).toBe(400);
    expect((await postJson(service, "/infer-builder-fields", {}, ipAddress)).status).toBe(400);

    const third = await postJson(service, "/infer-builder-fields", {}, ipAddress);
    const body = await third.json();

    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
    expect(body).toEqual(expect.objectContaining({
      error: expect.any(String),
      code: "rate_limited",
    }));
  });

  it("keeps rate limits scoped per endpoint", async () => {
    const ipAddress = "198.51.100.14";

    await postJson(service, "/enhance", {}, ipAddress);
    await postJson(service, "/enhance", {}, ipAddress);

    const enhanceLimited = await postJson(service, "/enhance", {}, ipAddress);
    expect(enhanceLimited.status).toBe(429);

    const extractResponse = await postJson(service, "/extract-url", {}, ipAddress);
    const inferResponse = await postJson(service, "/infer-builder-fields", {}, ipAddress);

    expect(extractResponse.status).toBe(400);
    expect(inferResponse.status).toBe(400);
  });
});
