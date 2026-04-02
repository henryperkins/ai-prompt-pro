/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import {
  BASE_ENV,
  killAgentService,
  readResponseStreamChunk,
  spawnAgentService,
  type SpawnedAgentService,
} from "@/test/helpers/agent-service-harness";

const TEST_PORT = 18920;
const WS_PROTOCOL = "promptforge.enhance.v1";

async function postEnhanceSse(service: SpawnedAgentService, headers: HeadersInit = {}) {
  return fetch(`${service.baseUrl}/enhance`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ prompt: "hello from sse" }),
  });
}

function createWebSocket(url: string, protocols?: string | string[]) {
  return new WebSocket(url, protocols);
}

async function waitForOpen(ws: WebSocket): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      ws.off("open", onOpen);
      ws.off("error", onError);
    };

    ws.once("open", onOpen);
    ws.once("error", onError);
  });
}

async function waitForMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: WebSocket.RawData) => {
      cleanup();
      resolve(JSON.parse(data.toString()));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      ws.off("message", onMessage);
      ws.off("error", onError);
    };

    ws.once("message", onMessage);
    ws.once("error", onError);
  });
}

async function closeWebSocket(ws: WebSocket): Promise<void> {
  if (ws.readyState >= WebSocket.CLOSING) {
    return;
  }

  await new Promise<void>((resolve) => {
    ws.once("close", () => resolve());
    ws.close();
  });
}

describe("agent service E2E SSE and websocket streaming", () => {
  let service: SpawnedAgentService;

  beforeAll(async () => {
    service = await spawnAgentService({ port: TEST_PORT });
  });

  afterAll(async () => {
    await killAgentService(service?.child);
  });

  it("returns SSE headers and data frames from /enhance", async () => {
    const requestId = "sse-e2e-request";
    const response = await postEnhanceSse(service, {
      "x-agent-token": BASE_ENV.AGENT_SERVICE_TOKEN,
      "x-request-id": requestId,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("x-request-id")).toBe(requestId);
    expect(await readResponseStreamChunk(response)).toContain("data:");
  });

  it("rejects websocket upgrades without the enhance protocol", async () => {
    const ws = createWebSocket(`${service.baseUrl.replace("http", "ws")}/enhance/ws`);

    const statusCode = await new Promise<number>((resolve, reject) => {
      ws.once("unexpected-response", (_request, response) => {
        resolve(response.statusCode || 0);
      });
      ws.once("open", () => reject(new Error("Expected websocket upgrade to be rejected.")));
      ws.once("error", () => undefined);
    });

    expect(statusCode).toBe(400);
  });

  it("accepts websocket upgrades with the enhance protocol", async () => {
    const ws = createWebSocket(`${service.baseUrl.replace("http", "ws")}/enhance/ws`, WS_PROTOCOL);

    await waitForOpen(ws);
    await closeWebSocket(ws);
  });

  it("destroys websocket upgrades on the wrong path", async () => {
    const ws = createWebSocket(`${service.baseUrl.replace("http", "ws")}/wrong/ws`, WS_PROTOCOL);

    await expect(new Promise<void>((resolve, reject) => {
      ws.once("open", () => reject(new Error("Expected wrong-path websocket upgrade to fail.")));
      ws.once("error", () => resolve());
      ws.once("close", () => resolve());
    })).resolves.toBeUndefined();
  });

  it("returns an auth error frame for invalid websocket auth", async () => {
    const ws = createWebSocket(`${service.baseUrl.replace("http", "ws")}/enhance/ws`, WS_PROTOCOL);

    try {
      await waitForOpen(ws);
      ws.send(JSON.stringify({
        type: "enhance.start",
        auth: {
          service_token: "wrong-token",
        },
        payload: {
          prompt: "hello",
        },
      }));

      const message = await waitForMessage(ws);
      expect(message).toEqual(expect.objectContaining({
        event: "turn/error",
        status: 401,
        code: "auth_session_invalid",
      }));
    } finally {
      await closeWebSocket(ws).catch(() => undefined);
    }
  });

  it("streams websocket frames with valid service-token auth", async () => {
    const ws = createWebSocket(`${service.baseUrl.replace("http", "ws")}/enhance/ws`, WS_PROTOCOL);

    try {
      await waitForOpen(ws);
      ws.send(JSON.stringify({
        type: "enhance.start",
        auth: {
          service_token: BASE_ENV.AGENT_SERVICE_TOKEN,
        },
        payload: {
          prompt: "hello",
        },
      }));

      const message = await waitForMessage(ws);
      expect(message).toEqual(expect.objectContaining({
        event: "enhance/workflow",
        type: "enhance.workflow",
        payload: expect.objectContaining({
          step_id: "analyze_request",
        }),
      }));
    } finally {
      await closeWebSocket(ws).catch(() => undefined);
    }
  });
});
