/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNeonDatabaseClient } from "../../agent_service/neon-data.mjs";

const neonClientMocks = vi.hoisted(() => ({
  hashStateNonce: vi.fn((value: string) => `hash:${value}`),
  queryRow: vi.fn(),
  queryRows: vi.fn(),
}));

vi.mock("../../agent_service/neon-data.mjs", () => ({
  createNeonDatabaseClient: vi.fn(() => neonClientMocks),
}));

import { createGitHubStore } from "../../agent_service/github-store.mjs";

describe("agent service GitHub store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    neonClientMocks.hashStateNonce.mockImplementation((value: string) => `hash:${value}`);
    neonClientMocks.queryRow.mockResolvedValue(null);
    neonClientMocks.queryRows.mockResolvedValue([]);
  });

  it("filters listed connections to active installations only", async () => {
    const store = createGitHubStore({
      databaseUrl: "postgres://promptforge:test@db.example.neon.tech/neondb",
    });

    expect(createNeonDatabaseClient).toHaveBeenCalledWith({
      databaseUrl: "postgres://promptforge:test@db.example.neon.tech/neondb",
      debug: false,
    });

    await store.listConnections("user-123");

    expect(neonClientMocks.queryRows).toHaveBeenCalledWith(
      expect.stringContaining("join public.github_installations installations"),
      ["user-123"],
    );
    const query = String(neonClientMocks.queryRows.mock.calls[0]?.[0] || "");
    expect(query).toContain("installations.deleted_at is null");
    expect(query).toContain("installations.suspended_at is null");
  });

  it("rebinds repo connections to the current active installation by repo and installation id", async () => {
    const store = createGitHubStore({
      databaseUrl: "postgres://promptforge:test@db.example.neon.tech/neondb",
      debug: true,
    });

    expect(createNeonDatabaseClient).toHaveBeenCalledWith({
      databaseUrl: "postgres://promptforge:test@db.example.neon.tech/neondb",
      debug: true,
    });

    await store.rebindConnectionsToInstallationForRepo(4242, 9001);

    expect(neonClientMocks.queryRows).toHaveBeenCalledWith(
      expect.stringContaining("set installation_record_id = installations.id"),
      [4242, 9001, expect.any(String)],
    );
    const query = String(neonClientMocks.queryRows.mock.calls[0]?.[0] || "");
    expect(query).toContain("installations.github_installation_id = $2");
    expect(query).toContain("installations.user_id = connections.user_id");
    expect(query).toContain("installations.deleted_at is null");
    expect(query).toContain("installations.suspended_at is null");
  });
});
