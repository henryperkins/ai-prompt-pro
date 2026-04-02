/* @vitest-environment node */
import { request as httpRequest, Agent as HttpAgent } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import {
  killAgentService,
  spawnAgentService,
  waitForAgentServiceExit,
} from "@/test/helpers/agent-service-harness";

const TEST_PORT = 18921;

async function requestJson(baseUrl: string, path: string, agent: HttpAgent) {
  const target = new URL(path, baseUrl);

  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const req = httpRequest(target, {
      method: "GET",
      agent,
      headers: {
        Connection: "keep-alive",
      },
    }, (res) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on("end", () => {
        const text = chunks.length === 0 ? "" : Buffer.concat(chunks).toString("utf8");
        resolve({
          status: res.statusCode || 0,
          body: text ? JSON.parse(text) : null,
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

describe("agent service E2E graceful shutdown", () => {
  it("serves health before SIGTERM, rejects follow-up requests, and exits before timeout", async () => {
    const service = await spawnAgentService({
      port: TEST_PORT,
      env: {
        SHUTDOWN_DRAIN_TIMEOUT_MS: "2000",
      },
    });
    const agent = new HttpAgent({
      keepAlive: true,
      maxSockets: 1,
    });

    try {
      const before = await requestJson(service.baseUrl, "/health", agent);
      expect(before.status).toBe(200);
      expect(before.body).toEqual({
        ok: true,
        status: "alive",
        ready: "/ready",
        provider: "codex-sdk",
      });

      service.child.kill("SIGTERM");
      await delay(50);

      let sawRejectedFollowUp = false;
      try {
        const duringShutdown = await requestJson(service.baseUrl, "/health", agent);
        expect(duringShutdown.status).toBe(503);
        expect(duringShutdown.body).toEqual({
          error: "Server is shutting down.",
          code: "service_unavailable",
        });
        sawRejectedFollowUp = true;
      } catch (error) {
        const networkError = error as NodeJS.ErrnoException;
        expect(networkError.code).toBe("ECONNREFUSED");
        sawRejectedFollowUp = true;
      }

      expect(sawRejectedFollowUp).toBe(true);

      agent.destroy();

      const exit = await waitForAgentServiceExit(service.child, 4_000);
      expect(exit).toEqual({
        code: 0,
        signal: null,
      });
    } finally {
      agent.destroy();
      await killAgentService(service.child);
    }
  });
});
