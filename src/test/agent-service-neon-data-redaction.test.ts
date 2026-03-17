/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({
    query: (...args: unknown[]) => queryMock(...args),
  })),
}));

import { createNeonDatabaseClient } from "../../agent_service/neon-data.mjs";

function parseLoggedEvent(logSpy: ReturnType<typeof vi.spyOn>) {
  return JSON.parse(String(logSpy.mock.calls[0]?.[0] || "{}")) as Record<string, unknown>;
}

describe("agent service Neon query log redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits query_preview from unexpected-return logs when debug is disabled", async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = createNeonDatabaseClient({
      databaseUrl: "postgres://promptforge:test@db.example.neon.tech/neondb",
      debug: false,
    });

    await expect(client.queryRows("select * from test where id = $1", ["row-1"])).resolves.toEqual([]);

    expect(parseLoggedEvent(logSpy)).toMatchObject({
      event: "neon_query_unexpected_return",
      return_type: "object",
    });
    expect(parseLoggedEvent(logSpy)).not.toHaveProperty("query_preview");
  });

  it("includes query_preview in unexpected-return logs when debug is enabled", async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = createNeonDatabaseClient({
      databaseUrl: "postgres://promptforge:test@db.example.neon.tech/neondb",
      debug: true,
    });

    await expect(client.queryRows("select * from test where id = $1", ["row-1"])).resolves.toEqual([]);

    expect(parseLoggedEvent(logSpy)).toMatchObject({
      event: "neon_query_unexpected_return",
      query_preview: "select * from test where id = $1",
    });
  });

  it("omits query_preview from query error logs when debug is disabled", async () => {
    queryMock.mockRejectedValue(Object.assign(new Error("permission denied for table github_installations"), {
      code: "42501",
    }));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = createNeonDatabaseClient({
      databaseUrl: "postgres://promptforge:test@db.example.neon.tech/neondb",
      debug: false,
    });

    await expect(client.queryRows("select * from test where id = $1", ["row-1"])).rejects.toThrow(
      "permission denied for table github_installations",
    );

    expect(parseLoggedEvent(logSpy)).toMatchObject({
      event: "neon_query_error",
      error_code: "42501",
    });
    expect(parseLoggedEvent(logSpy)).not.toHaveProperty("query_preview");
  });

  it("includes query_preview in query error logs when debug is enabled", async () => {
    queryMock.mockRejectedValue(Object.assign(new Error("permission denied for table github_installations"), {
      code: "42501",
    }));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const client = createNeonDatabaseClient({
      databaseUrl: "postgres://promptforge:test@db.example.neon.tech/neondb",
      debug: true,
    });

    await expect(client.queryRows("select * from test where id = $1", ["row-1"])).rejects.toThrow(
      "permission denied for table github_installations",
    );

    expect(parseLoggedEvent(logSpy)).toMatchObject({
      event: "neon_query_error",
      query_preview: "select * from test where id = $1",
    });
  });
});
