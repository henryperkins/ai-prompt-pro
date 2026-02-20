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

function streamingRaw(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

describe("ai-client auth recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_AGENT_SERVICE_URL", "https://agent.test");
    vi.stubEnv("VITE_NEON_PUBLISHABLE_KEY", "\"sb_publishable_test\"");

    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("retries enhance once after forced session refresh on invalid-session 401", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "stale-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    mocks.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "fresh-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid or expired auth session." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(streamingResponse("recovered"));

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

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>;

    expect(firstHeaders.Authorization).toBe("Bearer stale-token");
    expect(secondHeaders.Authorization).toBe("Bearer fresh-token");
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("recovered");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("retries with publishable key when service reports Neon auth is not configured", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "session-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    mocks.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "No active refresh token" },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "Authentication service is unavailable because Neon auth is not configured.",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(streamingResponse("public-key-recovery"));

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

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>;

    expect(firstHeaders.Authorization).toBe("Bearer session-token");
    expect(secondHeaders.Authorization).toBe("Bearer sb_publishable_test");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("public-key-recovery");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("refreshes near-expiry sessions before the first enhance request", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "expiring-token",
          expires_at: nowSeconds - 5,
        },
      },
      error: null,
    });

    mocks.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "refreshed-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("fresh"));
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

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer refreshed-token");
    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("falls back to publishable key when getSession fails with a retryable fetch error", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: "Failed to fetch",
        name: "AuthRetryableFetchError",
        status: 0,
      },
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("network-fallback"));
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
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sb_publishable_test");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("network-fallback");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("falls back to publishable key when getSession throws a retryable fetch error", async () => {
    mocks.getSession.mockRejectedValue({
      message: "Failed to fetch",
      name: "AuthRetryableFetchError",
      status: 0,
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("network-fallback-throw"));
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
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sb_publishable_test");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("network-fallback-throw");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("retries once when enhance request fails with a transient network load error", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "valid-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValueOnce(streamingResponse("retry-success"));
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("retry-success");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("returns a clearer error when enhance request repeatedly fails with a network load error", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "valid-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockRejectedValueOnce(new TypeError("Load failed"));
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      "Could not reach the enhancement service at https://agent.test. Check your connection and try again.",
    );
  });

  it("surfaces non-retryable getSession errors", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: {
        message: "Invalid refresh token",
        name: "AuthApiError",
        status: 400,
      },
    });

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
    expect(onError).toHaveBeenCalledWith("Could not read auth session: Invalid refresh token");
  });

  it("ignores non-output completed items while streaming agent text", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "valid-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    const body = [
      `data: ${JSON.stringify({
        event: "item/completed",
        type: "response.output_item.done",
        item_id: "item_user_1",
        item_type: "user_prompt",
        payload: { text: "Original prompt content should not render." },
      })}`,
      "",
      `data: ${JSON.stringify({
        event: "item/agent_message/delta",
        type: "response.output_text.delta",
        item_id: "item_agent_1",
        item_type: "agent_message",
        delta: "Enhanced output",
      })}`,
      "",
      `data: ${JSON.stringify({
        event: "item/completed",
        type: "response.output_text.done",
        item_id: "item_agent_1",
        item_type: "agent_message",
        payload: { text: "Enhanced output" },
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingRaw(body));
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

    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledWith("Enhanced output");
  });

  it("does not reuse stale session token after a 401 invalid-session response", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "stale-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    mocks.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Refresh token expired" },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid or expired auth session." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(streamingResponse("fallback"));

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

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>;

    expect(firstHeaders.Authorization).toBe("Bearer stale-token");
    expect(secondHeaders.Authorization).toBe("Bearer sb_publishable_test");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("fallback");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("falls back to publishable key when refreshed token also fails with invalid-session 401", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "stale-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    mocks.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "still-invalid-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid or expired auth session." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid or expired auth session." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(streamingResponse("third-try-success"));

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

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>;
    const thirdHeaders = (fetchMock.mock.calls[2]?.[1] as RequestInit).headers as Record<string, string>;

    expect(firstHeaders.Authorization).toBe("Bearer stale-token");
    expect(secondHeaders.Authorization).toBe("Bearer still-invalid-token");
    expect(thirdHeaders.Authorization).toBe("Bearer sb_publishable_test");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("third-try-success");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("falls back to publishable key when refreshSession throws during forced refresh", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "stale-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    mocks.refreshSession.mockRejectedValue({
      message: "Failed to fetch",
      name: "AuthRetryableFetchError",
      status: 0,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid or expired auth session." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(streamingResponse("refresh-throw-fallback"));

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

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>;

    expect(firstHeaders.Authorization).toBe("Bearer stale-token");
    expect(secondHeaders.Authorization).toBe("Bearer sb_publishable_test");
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("refresh-throw-fallback");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("sends optional thread_id and supported thread_options when provided", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "valid-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("configured"));
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamEnhance({
      prompt: "Improve this",
      threadId: "thread_abc123",
      threadOptions: {
        modelReasoningEffort: "minimal",
        webSearchEnabled: true,
      },
      onDelta,
      onDone,
      onError,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse((request.body as string) || "{}") as {
      prompt?: string;
      thread_id?: string;
      thread_options?: { modelReasoningEffort?: string; webSearchEnabled?: boolean };
    };

    expect(body.prompt).toBe("Improve this");
    expect(body.thread_id).toBe("thread_abc123");
    expect(body.thread_options).toEqual({
      modelReasoningEffort: "minimal",
      webSearchEnabled: true,
    });
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("configured");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("omits empty thread_id and missing thread_options from enhance payload", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "valid-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("default"));
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    await streamEnhance({
      prompt: "Improve this",
      threadId: "   ",
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse((request.body as string) || "{}") as Record<string, unknown>;

    expect(body).toEqual({ prompt: "Improve this" });
  });

  it("sends builder mode and all six builder fields when provided", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "valid-token",
          expires_at: nowSeconds + 3600,
        },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("enhanced"));
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    await streamEnhance({
      prompt: "Improve this",
      builderMode: "guided",
      builderFields: {
        role: "",
        context: "",
        task: "Generate a refined prompt",
        outputFormat: "",
        examples: "",
        guardrails: "",
      },
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse((request.body as string) || "{}") as Record<string, unknown>;

    expect(body.builder_mode).toBe("guided");
    expect(body.builder_fields).toEqual({
      role: "",
      context: "",
      task: "Generate a refined prompt",
      output_format: "",
      examples: "",
      guardrails: "",
    });
  });
});
