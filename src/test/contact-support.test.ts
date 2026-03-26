import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

function setAccessToken(sub?: string): string | null {
  if (!sub) {
    window.localStorage.removeItem("pf_tokens");
    return null;
  }

  const token = buildUnsignedJwt({ sub });
  window.localStorage.setItem("pf_tokens", JSON.stringify({ accessToken: token }));
  return token;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function getRequestDetails(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url: new URL(String(url), window.location.origin),
    init,
    headers: (init.headers ?? {}) as Record<string, string>,
    body: init.body ? JSON.parse(String(init.body)) : null,
  };
}

describe("contact support", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes and inserts contact messages", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: "msg_1" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const { submitContactMessage } = await import("@/lib/contact-support");
    const id = await submitContactMessage({
      firstName: "  Alice\u0000  ",
      lastName: "  Doe\ud83d  ",
      email: "  ALICE@EXAMPLE.COM ",
      phoneCountry: " us ",
      phoneNumber: " +1 (555) 123-4567 ",
      message: "  Please help with billing.\udc00  ",
      privacyConsent: true,
    });

    expect(id).toBe("msg_1");

    const { url, init, headers, body } = getRequestDetails(fetchMock);
    expect(url.pathname).toBe("/api/support/contact");
    expect(init.method).toBe("POST");
    expect(headers.Authorization).toBeUndefined();
    expect(body).toEqual({
      firstName: "Alice",
      lastName: "Doe\ufffd",
      email: "alice@example.com",
      phoneCountry: "US",
      phoneNumber: "+1 (555) 123-4567",
      message: "Please help with billing.\ufffd",
      privacyConsent: true,
    });
  });

  it("rejects invalid email addresses", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { submitContactMessage } = await import("@/lib/contact-support");

    await expect(
      submitContactMessage({
        firstName: "Alice",
        lastName: "Doe",
        email: "invalid-email",
        message: "Please help.",
        privacyConsent: true,
      }),
    ).rejects.toThrow("Enter a valid email address.");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires privacy policy consent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { submitContactMessage } = await import("@/lib/contact-support");

    await expect(
      submitContactMessage({
        firstName: "Alice",
        lastName: "Doe",
        email: "alice@example.com",
        message: "Please help.",
        privacyConsent: false,
      }),
    ).rejects.toThrow("Please accept the privacy policy before sending.");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks reviewer membership for support inbox access", async () => {
    const token = setAccessToken("reviewer_1");
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ allowed: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { isSupportReviewer } = await import("@/lib/contact-support");
    const allowed = await isSupportReviewer();

    expect(allowed).toBe(true);

    const { url, headers } = getRequestDetails(fetchMock);
    expect(url.pathname).toBe("/api/support/reviewer");
    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("lists contact messages for reviewers", async () => {
    const token = setAccessToken("reviewer_1");
    const createdAt = Math.floor(new Date("2026-02-21T00:00:00.000Z").getTime() / 1000);
    const updatedAt = Math.floor(new Date("2026-02-21T01:00:00.000Z").getTime() / 1000);
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([
        {
          id: "msg_1",
          first_name: "Alice",
          last_name: "Doe",
          email: "alice@example.com",
          phone_country: "US",
          phone_number: "+1 555 0100",
          message: "Need help.",
          status: "reviewing",
          requester_user_id: "user_1",
          created_at: createdAt,
          updated_at: updatedAt,
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { listContactMessagesForReviewer } = await import("@/lib/contact-support");
    const rows = await listContactMessagesForReviewer();

    expect(rows).toEqual([
      {
        id: "msg_1",
        firstName: "Alice",
        lastName: "Doe",
        email: "alice@example.com",
        phoneCountry: "US",
        phoneNumber: "+1 555 0100",
        message: "Need help.",
        status: "reviewing",
        requesterUserId: "user_1",
        createdAt: "2026-02-21T00:00:00.000Z",
        updatedAt: "2026-02-21T01:00:00.000Z",
      },
    ]);

    const { url, headers } = getRequestDetails(fetchMock);
    expect(url.pathname).toBe("/api/support/messages");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("updates contact message status for reviewers", async () => {
    const token = setAccessToken("reviewer_1");
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ updated: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { updateContactMessageStatus } = await import("@/lib/contact-support");
    await updateContactMessageStatus("msg_123", "resolved");

    const { url, init, headers, body } = getRequestDetails(fetchMock);
    expect(url.pathname).toBe("/api/support/messages/msg_123/status");
    expect(init.method).toBe("PUT");
    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(body).toEqual({ status: "resolved" });
  });
});
