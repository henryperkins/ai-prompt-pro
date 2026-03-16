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

describe("inferBuilderFields request payload", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_AGENT_SERVICE_URL", "https://agent.test");
    vi.stubEnv("VITE_NEON_PUBLISHABLE_KEY", "\"sb_publishable_test\"");

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
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("serializes request_context when signals are present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ inferredUpdates: {}, inferredFields: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { inferBuilderFields } = await import("@/lib/ai-client");

    await inferBuilderFields({
      prompt: "Analyze the attached brief",
      currentFields: { tone: "Technical" },
      requestContext: {
        hasAttachedSources: true,
        attachedSourceCount: 2,
        hasSessionContext: true,
        selectedOutputFormats: ["Markdown", "Table"],
        hasPastedSourceMaterial: false,
      },
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body.request_context).toEqual({
      hasAttachedSources: true,
      attachedSourceCount: 2,
      hasSessionContext: true,
      selectedOutputFormats: ["Markdown", "Table"],
      hasPastedSourceMaterial: false,
    });
  });

  it("serializes source_summaries when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ inferredUpdates: {}, inferredFields: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { inferBuilderFields } = await import("@/lib/ai-client");

    await inferBuilderFields({
      prompt: "Analyze the attached brief",
      sourceSummaries: [
        "API authentication uses PAT tokens.",
        "Rate limits reset every 60 seconds.",
      ],
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body.source_summaries).toEqual([
      "API authentication uses PAT tokens.",
      "Rate limits reset every 60 seconds.",
    ]);
  });

  it("omits request_context when none is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ inferredUpdates: {}, inferredFields: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { inferBuilderFields } = await import("@/lib/ai-client");

    await inferBuilderFields({
      prompt: "Write a launch update",
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body.request_context).toBeUndefined();
  });

  it("surfaces payload_too_large when infer input exceeds service limits", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: "Builder-field inference input is too large.",
        code: "payload_too_large",
      }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { inferBuilderFields } = await import("@/lib/ai-client");

    await expect(
      inferBuilderFields({
        prompt: "Analyze the attached brief",
      }),
    ).rejects.toMatchObject({
      code: "payload_too_large",
      status: 413,
    });
  });
});
