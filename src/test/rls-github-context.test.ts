/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createRlsClient,
  hasRlsEnv,
  registerAndSignIn,
  rlsEnvErrorMessage,
} from "./rls-client";

const DATA_API_URL = process.env.NEON_DATA_API_URL;
const SERVICE_ROLE_KEY = process.env.NEON_SERVICE_ROLE_KEY;
const hasGithubRlsEnv = hasRlsEnv && Boolean(SERVICE_ROLE_KEY);
const githubRlsEnvErrorMessage =
  `${rlsEnvErrorMessage} Set NEON_SERVICE_ROLE_KEY to seed GitHub context rows.`;

const describeIfEnv = hasGithubRlsEnv ? describe : describe.skip;

if (!hasGithubRlsEnv && process.env.CI) {
  describe("github context RLS (env)", () => {
    it("requires GitHub RLS env vars", () => {
      throw new Error(githubRlsEnvErrorMessage);
    });
  });
}

function buildDataApiUrl(path: string, query?: Record<string, string>): string {
  if (!DATA_API_URL) {
    throw new Error("Missing NEON_DATA_API_URL for GitHub RLS test client.");
  }

  const normalizedBaseUrl = DATA_API_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${normalizedBaseUrl}${normalizedPath}`);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value.trim()) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function requestAsServiceRole(
  method: "POST" | "DELETE",
  path: string,
  {
    body,
    query,
    prefer,
  }: {
    body?: unknown;
    query?: Record<string, string>;
    prefer?: string;
  } = {},
) {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("Missing NEON_SERVICE_ROLE_KEY for GitHub RLS test client.");
  }

  const response = await fetch(buildDataApiUrl(path, query), {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "x-api-key": SERVICE_ROLE_KEY,
      Prefer: prefer || "return=minimal",
      "Content-Type": body === undefined ? "" : "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text
    ? (() => {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    })()
    : null;

  if (!response.ok) {
    throw new Error(
      typeof payload === "string"
        ? payload
        : `GitHub RLS seed request failed with status ${response.status}.`,
    );
  }

  return payload;
}

async function insertServiceRow(
  path: string,
  row: Record<string, unknown>,
): Promise<{ id: string }> {
  const payload = await requestAsServiceRole("POST", path, {
    body: [row],
    query: {
      select: "id",
    },
    prefer: "return=representation",
  });

  if (!Array.isArray(payload) || !payload[0] || typeof payload[0].id !== "string") {
    throw new Error(`Failed to create ${path} seed row.`);
  }

  return payload[0] as { id: string };
}

async function deleteServiceRows(path: string, ids: string[]) {
  const filteredIds = ids.filter(Boolean);
  if (filteredIds.length === 0) return;

  await requestAsServiceRole("DELETE", path, {
    query: {
      id: `in.(${filteredIds.join(",")})`,
    },
  });
}

describeIfEnv("github context RLS", () => {
  let anonClient: ReturnType<typeof createRlsClient>;
  let ownerClient: ReturnType<typeof createRlsClient>;
  let otherClient: ReturnType<typeof createRlsClient>;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const ownerEmail = `rls-github-owner-${suffix}@gmail.com`;
  const otherEmail = `rls-github-other-${suffix}@gmail.com`;
  const ownerPassword = `Passw0rd!${suffix}`;
  const otherPassword = `Passw0rd!${suffix}`;

  let ownerId = "";
  let otherId = "";
  let ownerInstallationId = "";
  let otherInstallationId = "";
  let ownerConnectionId = "";
  let ownerManifestId = "";
  let ownerSetupStateId = "";

  beforeAll(async () => {
    anonClient = createRlsClient("rls-github-anon");
    ownerClient = createRlsClient("rls-github-owner");
    otherClient = createRlsClient("rls-github-other");

    ownerId = await registerAndSignIn(ownerClient, ownerEmail, ownerPassword);
    otherId = await registerAndSignIn(otherClient, otherEmail, otherPassword);

    ownerInstallationId = (
      await insertServiceRow("/github_installations", {
        user_id: ownerId,
        github_installation_id: 700001,
        github_account_id: 800001,
        github_account_login: "owner-org",
        github_account_type: "Organization",
        repositories_mode: "selected",
        permissions: { contents: "read" },
      })
    ).id;

    otherInstallationId = (
      await insertServiceRow("/github_installations", {
        user_id: otherId,
        github_installation_id: 700002,
        github_account_id: 800002,
        github_account_login: "other-org",
        github_account_type: "Organization",
        repositories_mode: "selected",
        permissions: { contents: "read" },
      })
    ).id;

    ownerConnectionId = (
      await insertServiceRow("/github_repo_connections", {
        user_id: ownerId,
        installation_record_id: ownerInstallationId,
        github_repo_id: 900001,
        owner_login: "owner-org",
        repo_name: "private-repo",
        full_name: "owner-org/private-repo",
        default_branch: "main",
        visibility: "private",
        is_private: true,
      })
    ).id;

    ownerManifestId = (
      await insertServiceRow("/github_repo_manifest_cache", {
        user_id: ownerId,
        repo_connection_id: ownerConnectionId,
        ref_name: "default",
        tree_sha: "tree-sha-owner",
        entry_count: 1,
        manifest: [
          {
            path: "README.md",
            name: "README.md",
          },
        ],
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
    ).id;

    ownerSetupStateId = (
      await insertServiceRow("/github_setup_states", {
        user_id: ownerId,
        nonce_hash: `nonce-${suffix}`,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
    ).id;
  });

  afterAll(async () => {
    await deleteServiceRows("/github_setup_states", [ownerSetupStateId]);
    await deleteServiceRows("/github_installations", [
      ownerInstallationId,
      otherInstallationId,
    ]);
    await ownerClient.auth.signOut();
    await otherClient.auth.signOut();
  });

  it("only exposes GitHub installation, connection, and manifest rows to their owner", async () => {
    const { data: ownerInstallations, error: ownerInstallationsError } = await ownerClient
      .from("github_installations")
      .select("id")
      .eq("id", ownerInstallationId);
    expect(ownerInstallationsError).toBeNull();
    expect(ownerInstallations).toEqual([{ id: ownerInstallationId }]);

    const { data: anonInstallations, error: anonInstallationsError } = await anonClient
      .from("github_installations")
      .select("id")
      .eq("id", ownerInstallationId);
    expect(anonInstallationsError).toBeNull();
    expect(anonInstallations).toEqual([]);

    const { data: otherInstallations, error: otherInstallationsError } = await otherClient
      .from("github_installations")
      .select("id")
      .eq("id", ownerInstallationId);
    expect(otherInstallationsError).toBeNull();
    expect(otherInstallations).toEqual([]);

    const { data: ownerReadingOtherInstallation, error: ownerReadingOtherInstallationError } = await ownerClient
      .from("github_installations")
      .select("id")
      .eq("id", otherInstallationId);
    expect(ownerReadingOtherInstallationError).toBeNull();
    expect(ownerReadingOtherInstallation).toEqual([]);

    const { data: ownerConnections, error: ownerConnectionsError } = await ownerClient
      .from("github_repo_connections")
      .select("id")
      .eq("id", ownerConnectionId);
    expect(ownerConnectionsError).toBeNull();
    expect(ownerConnections).toEqual([{ id: ownerConnectionId }]);

    const { data: otherConnections, error: otherConnectionsError } = await otherClient
      .from("github_repo_connections")
      .select("id")
      .eq("id", ownerConnectionId);
    expect(otherConnectionsError).toBeNull();
    expect(otherConnections).toEqual([]);

    const { data: ownerManifests, error: ownerManifestsError } = await ownerClient
      .from("github_repo_manifest_cache")
      .select("id")
      .eq("id", ownerManifestId);
    expect(ownerManifestsError).toBeNull();
    expect(ownerManifests).toEqual([{ id: ownerManifestId }]);

    const { data: otherManifests, error: otherManifestsError } = await otherClient
      .from("github_repo_manifest_cache")
      .select("id")
      .eq("id", ownerManifestId);
    expect(otherManifestsError).toBeNull();
    expect(otherManifests).toEqual([]);
  });

  it("keeps GitHub setup states hidden from end-user clients", async () => {
    const { data: ownerSetupStates, error: ownerSetupStatesError } = await ownerClient
      .from("github_setup_states")
      .select("id")
      .eq("id", ownerSetupStateId);
    expect(ownerSetupStatesError).toBeNull();
    expect(ownerSetupStates).toEqual([]);

    const { data: otherSetupStates, error: otherSetupStatesError } = await otherClient
      .from("github_setup_states")
      .select("id")
      .eq("id", ownerSetupStateId);
    expect(otherSetupStatesError).toBeNull();
    expect(otherSetupStates).toEqual([]);
  });
});
