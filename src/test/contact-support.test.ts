import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, getUserMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    from: fromMock,
    auth: {
      getUser: getUserMock,
    },
  },
}));

describe("contact support", () => {
  beforeEach(() => {
    fromMock.mockReset();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "reviewer_1" } },
      error: null,
    });
  });

  it("normalizes and inserts contact messages", async () => {
    let insertedPayload: Record<string, unknown> | null = null;

    fromMock.mockReturnValueOnce({
      insert: (payload: Record<string, unknown>) => {
        insertedPayload = payload;
        return {
          select: () => ({
            single: async () => ({
              data: { id: "msg_1" },
              error: null,
            }),
          }),
        };
      },
    });

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
    expect(insertedPayload).toEqual(
      expect.objectContaining({
        first_name: "Alice",
        last_name: "Doe\ufffd",
        email: "alice@example.com",
        phone_country: "US",
        phone_number: "+1 (555) 123-4567",
        message: "Please help with billing.\ufffd",
        privacy_consent: true,
      }),
    );
  });

  it("rejects invalid email addresses", async () => {
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

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("requires privacy policy consent", async () => {
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

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("checks reviewer membership for support inbox access", async () => {
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { user_id: "reviewer_1" },
            error: null,
          }),
        }),
      }),
    });

    const { isSupportReviewer } = await import("@/lib/contact-support");
    const allowed = await isSupportReviewer();
    expect(allowed).toBe(true);
  });

  it("lists contact messages for reviewers", async () => {
    fromMock
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { user_id: "reviewer_1" },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          order: () => ({
            limit: async () => ({
              data: [
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
                  created_at: "2026-02-21T00:00:00.000Z",
                  updated_at: "2026-02-21T01:00:00.000Z",
                },
              ],
              error: null,
            }),
          }),
        }),
      });

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
  });

  it("updates contact message status for reviewers", async () => {
    let updatePayload: Record<string, unknown> | null = null;
    let updateId = "";

    fromMock
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { user_id: "reviewer_1" },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        update: (payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: async (_column: string, id: string) => {
              updateId = id;
              return { error: null };
            },
          };
        },
      });

    const { updateContactMessageStatus } = await import("@/lib/contact-support");
    await updateContactMessageStatus("msg_123", "resolved");

    expect(updatePayload).toEqual({ status: "resolved" });
    expect(updateId).toBe("msg_123");
  });
});
