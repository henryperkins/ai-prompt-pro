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
    vi.stubEnv("VITE_ENHANCE_TRANSPORT", "sse");

    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not apply an implicit enhance timeout when the timeout env is unset", async () => {
    const { ENHANCE_REQUEST_TIMEOUT_MS } = await import("@/lib/ai-client");

    expect(ENHANCE_REQUEST_TIMEOUT_MS).toBeUndefined();
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
    expect(firstHeaders.apikey).toBeUndefined();
    expect(secondHeaders.apikey).toBeUndefined();
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
    expect(firstHeaders.apikey).toBeUndefined();
    expect(secondHeaders.Authorization).toBeUndefined();
    expect(secondHeaders.apikey).toBe("sb_publishable_test");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onDelta).toHaveBeenCalledWith("public-key-recovery");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("surfaces payload_too_large when enhance request input exceeds service limits", async () => {
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

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({
        detail: "Enhancement input is too large after composing the base enhancement prompt.",
      }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");
    const onError = vi.fn();

    await streamEnhance({
      prompt: "Improve this",
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "payload_too_large",
        status: 413,
        message: "Enhancement input is too large after composing the base enhancement prompt.",
      }),
    );
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
    expect(headers.apikey).toBeUndefined();
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
    expect(headers.Authorization).toBeUndefined();
    expect(headers.apikey).toBe("sb_publishable_test");
    expect(mocks.signOut).not.toHaveBeenCalled();
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
    expect(headers.Authorization).toBeUndefined();
    expect(headers.apikey).toBe("sb_publishable_test");
    expect(mocks.signOut).not.toHaveBeenCalled();
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

  it("does not emit failed session state or console errors when an SSE retry later succeeds", async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

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
        .mockRejectedValueOnce(new TypeError("Load failed"))
        .mockResolvedValueOnce(streamingResponse("retry-success-final"));
      vi.stubGlobal("fetch", fetchMock);

      const { streamEnhance } = await import("@/lib/ai-client");

      const onDelta = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();
      const onSession = vi.fn();

      const streamPromise = streamEnhance({
        prompt: "Improve this",
        onDelta,
        onDone,
        onError,
        onSession,
        timeoutMs: 60_000,
      });

      await vi.advanceTimersByTimeAsync(30_000);
      await streamPromise;

      const sessionSnapshots = onSession.mock.calls.map((call) => call[0] as {
        status?: string;
        lastErrorMessage?: string | null;
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(onError).not.toHaveBeenCalled();
      expect(onDelta).toHaveBeenCalledWith("retry-success-final");
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(sessionSnapshots.some((session) => session.status === "failed")).toBe(false);
      expect(sessionSnapshots.some((session) => Boolean(session.lastErrorMessage))).toBe(false);
      expect(sessionSnapshots.at(-1)).toMatchObject({
        status: "completed",
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("returns a clearer error when enhance request repeatedly fails with a network load error", async () => {
    vi.useFakeTimers();
    try {
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

      // streamEnhance retries network_unavailable errors up to 2 times.
      // Each attempt uses requestWithRetry which itself retries once,
      // so we need 2 rejections per attempt × 3 total attempts = 6.
      // Fake timers ensure the exponential backoff sleeps between enhance
      // attempts don't cause real-time test flakiness.
      const fetchMock = vi.fn().mockRejectedValue(new TypeError("Load failed"));
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

      await vi.advanceTimersByTimeAsync(30_000);
      await streamPromise;

      // 2 fetch calls per requestWithRetry × 3 streamEnhance attempts = 6
      expect(fetchMock).toHaveBeenCalledTimes(6);
      expect(onDone).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "network_unavailable",
          message: "Could not reach the enhancement service at https://agent.test. Check your connection and try again.",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves auth_required when stream error payload includes an auth code", async () => {
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
        event: "turn/error",
        type: "turn/error",
        error: {
          message: "Sign in required.",
          code: "auth.required",
          status: 401,
        },
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingRaw(body));
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

    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "auth_required",
        message: "Sign in required.",
      }),
    );
  });

  it("preserves structured turn.failed metadata from the stream", async () => {
    const body = [
      `data: ${JSON.stringify({
        event: "turn.failed",
        type: "turn.failed",
        error: {
          message: "429 Too Many Requests",
          code: "rate_limit_exceeded",
          status: 429,
        },
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingRaw(body));
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

    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "rate_limited",
        status: 429,
        message: "429 Too Many Requests",
      }),
    );
  });

  it("treats a late turn/error as terminal even after response.completed was emitted", async () => {
    const onSession = vi.fn();
    const body = [
      `data: ${JSON.stringify({
        event: "turn.completed",
        type: "response.completed",
        thread_id: "thread_completed_then_error",
        turn_id: "turn_completed_then_error",
        session: {
          thread_id: "thread_completed_then_error",
          turn_id: "turn_completed_then_error",
          status: "completed",
        },
      })}`,
      "",
      `data: ${JSON.stringify({
        event: "turn/error",
        type: "turn/error",
        thread_id: "thread_completed_then_error",
        turn_id: "turn_completed_then_error",
        error: {
          message: "Enhancement returned invalid structured output. Please retry.",
          code: "bad_response",
          status: 422,
        },
        session: {
          thread_id: "thread_completed_then_error",
          turn_id: "turn_completed_then_error",
          status: "failed",
        },
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingRaw(body));
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    const onDone = vi.fn();
    const onError = vi.fn();

    await streamEnhance({
      prompt: "Improve this",
      onDelta: vi.fn(),
      onDone,
      onError,
      onSession,
    });

    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "bad_response",
        status: 422,
      }),
    );
    expect(onSession.mock.calls.at(-1)?.[0]).toMatchObject({
      threadId: "thread_completed_then_error",
      turnId: "turn_completed_then_error",
      status: "failed",
      lastErrorCode: "bad_response",
    });
  });

  it("propagates HTTP Retry-After metadata on enhance rate limits", async () => {
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

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "7",
        },
      }),
    );
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "rate_limited",
        retryAfterMs: 7000,
      }),
    );
  });

  it("ignores invalid HTTP Retry-After metadata on enhance rate limits", async () => {
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

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "later",
        },
      }),
    );
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "rate_limited",
        retryAfterMs: undefined,
      }),
    );
  });

  it("updates session state from terminal stream events before surfacing the error", async () => {
    const onSession = vi.fn();
    const body = [
      `data: ${JSON.stringify({
        event: "thread.started",
        type: "thread.started",
        thread_id: "thread_terminal_1",
      })}`,
      "",
      `data: ${JSON.stringify({
        event: "turn.failed",
        type: "turn.failed",
        thread_id: "thread_terminal_1",
        turn_id: "turn_terminal_1",
        error: {
          message: "429 Too Many Requests",
          code: "rate_limit_exceeded",
          status: 429,
        },
        session: {
          thread_id: "thread_terminal_1",
          turn_id: "turn_terminal_1",
          status: "failed",
          context_summary: "Carry forward the product and audience context.",
          latest_enhanced_prompt: "Final streamed draft.",
        },
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingRaw(body));
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    await streamEnhance({
      prompt: "Improve this",
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      onSession,
    });

    const finalSession = onSession.mock.calls.at(-1)?.[0] as {
      threadId?: string;
      turnId?: string;
      status?: string;
      contextSummary?: string;
      latestEnhancedPrompt?: string;
      lastRunContextSummary?: string;
      lastRunEnhancedPrompt?: string;
      lastErrorCode?: string;
      lastErrorMessage?: string;
    };

    expect(finalSession).toMatchObject({
      threadId: "thread_terminal_1",
      turnId: "turn_terminal_1",
      status: "failed",
      contextSummary: "",
      latestEnhancedPrompt: "",
      lastRunContextSummary: "Carry forward the product and audience context.",
      lastRunEnhancedPrompt: "Final streamed draft.",
      lastErrorCode: "rate_limited",
      lastErrorMessage: "429 Too Many Requests",
    });
  });

  it("retains partial streamed prompt text in the failed session after a rate limit", async () => {
    const onSession = vi.fn();
    const onError = vi.fn();
    const body = [
      `data: ${JSON.stringify({
        event: "thread.started",
        type: "thread.started",
        thread_id: "thread_partial_1",
      })}`,
      "",
      `data: ${JSON.stringify({
        event: "item.updated",
        type: "item.updated",
        thread_id: "thread_partial_1",
        turn_id: "turn_partial_1",
        item_id: "item_partial_1",
        item_type: "agent_message",
        item: {
          id: "item_partial_1",
          type: "agent_message",
          text: "Partial prompt draft",
        },
      })}`,
      "",
      `data: ${JSON.stringify({
        event: "turn.failed",
        type: "turn.failed",
        thread_id: "thread_partial_1",
        turn_id: "turn_partial_1",
        error: {
          message: "429 Too Many Requests",
          code: "rate_limit_exceeded",
          status: 429,
        },
      })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingRaw(body));
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    await streamEnhance({
      prompt: "Improve this",
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError,
      onSession,
    });

    const finalSession = onSession.mock.calls.at(-1)?.[0] as {
      threadId?: string;
      turnId?: string;
      status?: string;
      latestEnhancedPrompt?: string;
      lastRunEnhancedPrompt?: string;
      lastErrorCode?: string;
      lastErrorMessage?: string;
    };

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "rate_limited",
        status: 429,
      }),
    );
    expect(finalSession).toMatchObject({
      threadId: "thread_partial_1",
      turnId: "turn_partial_1",
      status: "failed",
      latestEnhancedPrompt: "",
      lastRunEnhancedPrompt: "Partial prompt draft",
      lastErrorCode: "rate_limited",
      lastErrorMessage: "429 Too Many Requests",
    });
  });

  it("treats a stream without a done marker as an interrupted request", async () => {
    const body = [
      `data: ${JSON.stringify({
        event: "item/agent_message/delta",
        type: "response.output_text.delta",
        item_id: "item_1",
        item_type: "agent_message",
        delta: "partial output",
      })}`,
      "",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingRaw(body));
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

    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "network_unavailable",
        message: "Enhancement stream ended before completion. Please try again.",
      }),
    );
  });

  it("streams raw item.updated text without duplicating the completed item", async () => {
    const body = [
      `data: ${JSON.stringify({
        event: "item.updated",
        type: "item.updated",
        thread_id: "thread_raw_1",
        turn_id: "turn_raw_1",
        item_id: "item_raw_1",
        item_type: "agent_message",
        item: {
          id: "item_raw_1",
          type: "agent_message",
          text: "hel",
        },
      })}`,
      "",
      `data: ${JSON.stringify({
        event: "item.updated",
        type: "item.updated",
        thread_id: "thread_raw_1",
        turn_id: "turn_raw_1",
        item_id: "item_raw_1",
        item_type: "agent_message",
        item: {
          id: "item_raw_1",
          type: "agent_message",
          text: "hello",
        },
      })}`,
      "",
      `data: ${JSON.stringify({
        event: "item.completed",
        type: "item.completed",
        thread_id: "thread_raw_1",
        turn_id: "turn_raw_1",
        item_id: "item_raw_1",
        item_type: "agent_message",
        item: {
          id: "item_raw_1",
          type: "agent_message",
          text: "hello",
        },
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
    expect(onDelta.mock.calls).toEqual([["hel"], ["lo"]]);
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
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "auth_session_invalid",
        message: "Could not read auth session: Invalid refresh token",
      }),
    );
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
    expect(firstHeaders.apikey).toBeUndefined();
    expect(secondHeaders.Authorization).toBeUndefined();
    expect(secondHeaders.apikey).toBe("sb_publishable_test");
    expect(mocks.signOut).not.toHaveBeenCalled();
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
    expect(firstHeaders.apikey).toBeUndefined();
    expect(secondHeaders.apikey).toBeUndefined();
    expect(thirdHeaders.Authorization).toBeUndefined();
    expect(thirdHeaders.apikey).toBe("sb_publishable_test");
    expect(mocks.signOut).not.toHaveBeenCalled();
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
    expect(firstHeaders.apikey).toBeUndefined();
    expect(secondHeaders.Authorization).toBeUndefined();
    expect(secondHeaders.apikey).toBe("sb_publishable_test");
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

  it("sends structured context_sources when provided", async () => {
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

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("context-aware"));
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    await streamEnhance({
      prompt: "Improve this",
      contextSources: [
        {
          id: "readme",
          type: "file",
          title: "README.md",
          summary: "Repository setup summary",
          rawContent: "Full README contents",
          rawContentTruncated: false,
          originalCharCount: 1234,
          expandable: true,
          reference: {
            kind: "file",
            refId: "file:README.md",
            locator: "README.md",
            permissionScope: "workspace",
          },
        },
      ],
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse((request.body as string) || "{}") as {
      context_sources?: Array<Record<string, unknown>>;
    };

    expect(body.context_sources).toEqual([
      {
        id: "readme",
        type: "file",
        title: "README.md",
        summary: "Repository setup summary",
        raw_content: "Full README contents",
        raw_content_truncated: false,
        original_char_count: 1234,
        expandable: true,
        reference: {
          kind: "file",
          ref_id: "file:README.md",
          locator: "README.md",
          permission_scope: "workspace",
        },
      },
    ]);
  });

  it("sends carry-forward Codex session context when provided", async () => {
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

    const fetchMock = vi.fn().mockResolvedValueOnce(streamingResponse("session-aware"));
    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");
    const { createCodexSession } = await import("@/lib/codex-session");

    await streamEnhance({
      prompt: "Improve this",
      session: createCodexSession({
        threadId: "thread_session_1",
        contextSummary: "Keep the prior product, audience, and tone context.",
        latestEnhancedPrompt: "Previous enhanced prompt body.",
      }),
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse((request.body as string) || "{}") as {
      thread_id?: string;
      session?: {
        thread_id?: string;
        context_summary?: string;
        latest_enhanced_prompt?: string;
      };
    };

    expect(body.thread_id).toBe("thread_session_1");
    expect(body.session).toEqual({
      thread_id: "thread_session_1",
      context_summary: "Keep the prior product, audience, and tone context.",
      latest_enhanced_prompt: "Previous enhanced prompt body.",
    });
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

  it("reports request_timeout when enhancement exceeds configured timeout", async () => {
    vi.useFakeTimers();
    try {
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

      const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal | undefined;
        return new Promise<Response>((_resolve, reject) => {
          const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
          if (!signal) {
            reject(new Error("Missing abort signal"));
            return;
          }
          if (signal.aborted) {
            reject(abortError);
            return;
          }
          signal.addEventListener("abort", () => {
            reject(abortError);
          }, { once: true });
        });
      });

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

      await vi.advanceTimersByTimeAsync(30);
      await streamPromise;

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

  it("reports request_timeout when timeout expires during retry backoff", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

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

      // Every fetch rejects with a retryable network error.
      const fetchMock = vi.fn().mockRejectedValue(new TypeError("Load failed"));
      vi.stubGlobal("fetch", fetchMock);

      const { streamEnhance } = await import("@/lib/ai-client");

      const onDone = vi.fn();
      const onError = vi.fn();

      // Timeout (500 ms) is shorter than the enhance retry backoff
      // (~1125 ms with Math.random() stubbed to 0.5), so it fires while the
      // client is sleeping between attempts.  The inner requestWithRetry delay
      // is 250 ms, so the first attempt completes at ~250 ms.
      const streamPromise = streamEnhance({
        prompt: "Improve this",
        onDelta: vi.fn(),
        onDone,
        onError,
        timeoutMs: 500,
      });

      // Advance enough time for everything to settle — regardless of whether
      // the implementation correctly aborts the backoff or lets it complete.
      await vi.advanceTimersByTimeAsync(15_000);
      await streamPromise;

      expect(onDone).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "request_timeout",
          message: "Enhancement timed out. Please try again.",
        }),
      );
      // Only the first attempt's 2 fetch calls (requestWithRetry: original +
      // 1 inner retry).  The timeout must prevent a second enhance attempt.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry after the SSE stream emits backend activity events", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

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

      // The stream yields a backend activity event (item.started with
      // web_search_call) that carries thread_id/turn_id/item_id but no
      // renderable text, then ends without a [DONE] marker.
      const body = [
        `data: ${JSON.stringify({
          event: "item.started",
          type: "item.started",
          thread_id: "thread_sse_activity_1",
          turn_id: "turn_sse_activity_1",
          item_id: "item_web_search_1",
          item_type: "web_search_call",
          item: {
            id: "item_web_search_1",
            type: "web_search_call",
            arguments: "{\"query\":\"test\"}",
          },
        })}`,
        "",
      ].join("\n");

      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve(streamingRaw(body)),
      );
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

      await vi.advanceTimersByTimeAsync(30_000);
      await streamPromise;

      // One HTTP request — no retry after backend-emitted attempt activity.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(onDone).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "network_unavailable",
          message: "Enhancement stream ended before completion. Please try again.",
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("silently ignores caller-triggered stream aborts", async () => {
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

    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
        if (!signal) {
          reject(new Error("Missing abort signal"));
          return;
        }
        if (signal.aborted) {
          reject(abortError);
          return;
        }
        signal.addEventListener("abort", () => {
          reject(abortError);
        }, { once: true });
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const { streamEnhance } = await import("@/lib/ai-client");

    const onDone = vi.fn();
    const onError = vi.fn();
    const controller = new AbortController();

    const streamPromise = streamEnhance({
      prompt: "Improve this",
      onDelta: vi.fn(),
      onDone,
      onError,
      signal: controller.signal,
      timeoutMs: 60_000,
    });

    controller.abort();
    await streamPromise;

    expect(onDone).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
