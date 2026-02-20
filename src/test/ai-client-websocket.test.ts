import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    auth: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
      refreshSession: (...args: unknown[]) => mocks.refreshSession(...args),
      signOut: (...args: unknown[]) => mocks.signOut(...args),
    },
  },
}));

function streamingResponse(text = "enhanced") {
  const body = `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\ndata: [DONE]\n\n`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

type FakeWebSocketBehavior = "stream" | "fallback" | "hang" | "connect-hang" | "auth-required";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static behavior: FakeWebSocketBehavior = "stream";

  readonly url: string;
  readonly protocols: string[];
  readonly sentMessages: string[] = [];
  readyState = 0;

  private readonly listeners: Record<string, Set<(event: unknown) => void>> = {
    open: new Set(),
    message: new Set(),
    close: new Set(),
    error: new Set(),
  };

  constructor(url: string | URL, protocols?: string | string[]) {
    this.url = String(url);
    this.protocols = Array.isArray(protocols)
      ? protocols
      : typeof protocols === "string"
        ? [protocols]
        : [];
    FakeWebSocket.instances.push(this);

    if (FakeWebSocket.behavior === "connect-hang") {
      return;
    }

    queueMicrotask(() => {
      if (FakeWebSocket.behavior === "fallback") {
        this.readyState = 3;
        this.emit("error", {});
        this.emit("close", { code: 1006, reason: "upgrade_failed" });
        return;
      }

      this.readyState = 1;
      this.emit("open", {});
    });
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners[type]?.add(listener);
  }

  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners[type]?.delete(listener);
  }

  send(data: string) {
    this.sentMessages.push(data);

    if (FakeWebSocket.behavior === "auth-required") {
      queueMicrotask(() => {
        this.emit("message", {
          data: JSON.stringify({
            event: "turn/error",
            type: "turn/error",
            error: {
              message: "Sign in required.",
              code: "auth_required",
              status: 401,
            },
          }),
        });
      });
      return;
    }

    if (FakeWebSocket.behavior !== "stream") return;
    JSON.parse(data);

    queueMicrotask(() => {
      this.emit("message", {
        data: JSON.stringify({ type: "response.output_text.delta", delta: "ws-output" }),
      });
      this.emit("message", {
        data: JSON.stringify({ event: "stream.done", type: "stream.done" }),
      });
      this.readyState = 3;
      this.emit("close", { code: 1000, reason: "done" });
    });
  }

  close() {
    if (this.readyState >= 2) return;
    this.readyState = 3;
    this.emit("close", { code: 1000, reason: "client_close" });
  }

  private emit(type: string, event: unknown) {
    this.listeners[type]?.forEach((listener) => {
      listener(event);
    });
  }
}

describe("ai-client websocket enhance transport", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    FakeWebSocket.behavior = "stream";

    vi.stubEnv("VITE_AGENT_SERVICE_URL", "https://agent.test");
    vi.stubEnv("VITE_NEON_PUBLISHABLE_KEY", "\"sb_publishable_test\"");
    vi.stubEnv("VITE_ENHANCE_REQUEST_TIMEOUT_MS", "90000");

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "header.payload.signature",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("streams enhance output over websocket when transport is ws", async () => {
    vi.stubEnv("VITE_ENHANCE_TRANSPORT", "ws");
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamEnhance({
      prompt: "Improve this",
      onDelta,
      onDone,
      onError,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("ws-output");
    expect(onDone).toHaveBeenCalledTimes(1);

    const wsInstance = FakeWebSocket.instances[0];
    expect(wsInstance).toBeDefined();
    expect(wsInstance.url).toBe("wss://agent.test/enhance/ws");
    expect(wsInstance.protocols[0]).toBe("promptforge.enhance.v1");
    expect(wsInstance.protocols).toHaveLength(1);

    const startMessage = JSON.parse(wsInstance.sentMessages[0]);
    expect(startMessage).toMatchObject({
      type: "enhance.start",
      auth: {
        bearer_token: "header.payload.signature",
        apikey: "sb_publishable_test",
      },
      payload: {
        prompt: "Improve this",
      },
    });
  });

  it("falls back to SSE when websocket transport is unavailable in auto mode", async () => {
    vi.stubEnv("VITE_ENHANCE_TRANSPORT", "auto");
    FakeWebSocket.behavior = "fallback";
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("sse-output"));
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamEnhance({
      prompt: "Improve this",
      onDelta,
      onDone,
      onError,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("sse-output");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("surfaces request_timeout when websocket stream hangs", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("VITE_ENHANCE_TRANSPORT", "ws");
      FakeWebSocket.behavior = "hang";
      vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const { streamEnhance } = await import("@/lib/ai-client");

      const onDone = vi.fn();
      const onError = vi.fn();

      const streamPromise = streamEnhance({
        prompt: "Improve this",
        onDelta: vi.fn(),
        onDone,
        onError,
        timeoutMs: 25,
      });

      await vi.advanceTimersByTimeAsync(300);
      await streamPromise;

      expect(fetchMock).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "request_timeout",
          message: "Enhancement timed out. Please try again.",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to SSE when websocket connect does not open in auto mode", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("VITE_ENHANCE_TRANSPORT", "auto");
      vi.stubEnv("VITE_ENHANCE_WS_CONNECT_TIMEOUT_MS", "20");
      FakeWebSocket.behavior = "connect-hang";
      vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

      const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("sse-output"));
      vi.stubGlobal("fetch", fetchMock);

      const { streamEnhance } = await import("@/lib/ai-client");

      const onDone = vi.fn();
      const onError = vi.fn();

      const streamPromise = streamEnhance({
        prompt: "Improve this",
        onDelta: vi.fn(),
        onDone,
        onError,
      });

      await vi.advanceTimersByTimeAsync(300);
      await streamPromise;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports network_unavailable when websocket connect does not open in ws mode", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("VITE_ENHANCE_TRANSPORT", "ws");
      vi.stubEnv("VITE_ENHANCE_WS_CONNECT_TIMEOUT_MS", "20");
      FakeWebSocket.behavior = "connect-hang";
      vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const { streamEnhance } = await import("@/lib/ai-client");

      const onDone = vi.fn();
      const onError = vi.fn();

      const streamPromise = streamEnhance({
        prompt: "Improve this",
        onDelta: vi.fn(),
        onDone,
        onError,
      });

      await vi.advanceTimersByTimeAsync(300);
      await streamPromise;

      expect(fetchMock).not.toHaveBeenCalled();
      expect(onDone).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "network_unavailable",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces auth_required from websocket turn errors with explicit auth code", async () => {
    vi.stubEnv("VITE_ENHANCE_TRANSPORT", "ws");
    FakeWebSocket.behavior = "auth-required";
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    const onDone = vi.fn();
    const onError = vi.fn();

    await streamEnhance({
      prompt: "Improve this",
      onDelta: vi.fn(),
      onDone,
      onError,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "auth_required",
        message: "Sign in required.",
      }),
    );
  });
});
