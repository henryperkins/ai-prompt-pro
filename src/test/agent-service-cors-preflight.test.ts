/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  killAgentService,
  spawnAgentService,
  type SpawnedAgentService,
} from "@/test/helpers/agent-service-harness";

const TEST_PORT = 18915;
const TEST_ORIGIN = "https://prompt.lakefrontdigital.io";

describe("agent service CORS preflight", () => {
  let service: SpawnedAgentService;

  beforeAll(async () => {
    service = await spawnAgentService({
      port: TEST_PORT,
      env: {
        PORT: String(TEST_PORT),
        ALLOWED_ORIGINS: `${TEST_ORIGIN},http://localhost:8080`,
        GITHUB_CONTEXT_ENABLED: "true",
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY:
          "-----BEGIN PRIVATE KEY-----\\nMIIBVwIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAoQ==\\n-----END PRIVATE KEY-----",
        GITHUB_APP_SLUG: "promptforge-app",
        GITHUB_APP_STATE_SECRET: "state-secret",
        GITHUB_WEBHOOK_SECRET: "webhook-secret",
        GITHUB_POST_INSTALL_REDIRECT_URL: `${TEST_ORIGIN}/builder`,
        NEON_DATABASE_URL: "postgres://promptforge:test@db.example.neon.tech/neondb",
      },
    });
  });

  afterAll(async () => {
    await killAgentService(service?.child);
  });

  it("responds to infer preflight with CORS headers", async () => {
    const response = await fetch(`${service.baseUrl}/infer-builder-fields`, {
      method: "OPTIONS",
      headers: {
        Origin: TEST_ORIGIN,
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("responds to GitHub preflight with route-specific CORS headers", async () => {
    const response = await fetch(`${service.baseUrl}/github/install-url`, {
      method: "OPTIONS",
      headers: {
        Origin: TEST_ORIGIN,
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
