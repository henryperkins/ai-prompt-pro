import { createNeonDataApiClient } from "./neon-data.mjs";
import { createGitHubError } from "./github-errors.mjs";

const DEFAULT_MANIFEST_REF = "default";

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function maybeSingle(rows) {
  return ensureArray(rows)[0] || null;
}

function toIsoString(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildConnectionRowPayload({ userId, installationRecordId, repo }) {
  return {
    user_id: userId,
    installation_record_id: installationRecordId,
    github_repo_id: repo.id,
    owner_login: repo.owner.login,
    repo_name: repo.name,
    full_name: repo.full_name,
    default_branch: repo.default_branch,
    visibility: repo.visibility || (repo.private ? "private" : "public"),
    is_private: repo.private === true,
    last_selected_at: new Date().toISOString(),
    access_revoked_at: null,
    updated_at: new Date().toISOString(),
  };
}

export function createGitHubStore(config = {}, deps = {}) {
  const client = createNeonDataApiClient({
    dataApiUrl: config.dataApiUrl,
    serviceRoleKey: config.serviceRoleKey,
    fetchImpl: deps.fetchImpl,
  });

  async function createSetupState({ userId, nonce, expiresAt }) {
    const hashedNonce = client.hashStateNonce(nonce);
    await client.requestJson("POST", "/github_setup_states", {
      body: [{
        user_id: userId,
        nonce_hash: hashedNonce,
        expires_at: toIsoString(expiresAt),
      }],
      prefer: "return=minimal",
    });
  }

  async function consumeSetupState({ userId, nonce }) {
    const hashedNonce = client.hashStateNonce(nonce);
    const { data } = await client.requestJson("PATCH", "/github_setup_states", {
      query: {
        user_id: `eq.${userId}`,
        nonce_hash: `eq.${hashedNonce}`,
        consumed_at: "is.null",
        expires_at: `gt.${new Date().toISOString()}`,
        select: "id,user_id",
      },
      body: {
        consumed_at: new Date().toISOString(),
      },
      prefer: "return=representation",
    });
    const row = maybeSingle(data);
    if (!row) {
      throw createGitHubError(
        "GitHub setup state is invalid or has already been used.",
        "github_invalid_state",
        400,
      );
    }
    return row;
  }

  async function listInstallations(userId) {
    const { data } = await client.requestJson("GET", "/github_installations", {
      query: {
        user_id: `eq.${userId}`,
        deleted_at: "is.null",
        suspended_at: "is.null",
        select: "*",
        order: "updated_at.desc",
      },
    });
    return ensureArray(data);
  }

  async function findInstallationRecord(userId, githubInstallationId, { includeInactive = false } = {}) {
    const query = {
      user_id: `eq.${userId}`,
      github_installation_id: `eq.${githubInstallationId}`,
      select: "*",
      limit: "1",
    };
    if (!includeInactive) {
      query.deleted_at = "is.null";
      query.suspended_at = "is.null";
    }
    const { data } = await client.requestJson("GET", "/github_installations", {
      query,
    });
    return maybeSingle(data);
  }

  async function findInstallationRecordById(userId, installationRecordId, { includeInactive = false } = {}) {
    const query = {
      user_id: `eq.${userId}`,
      id: `eq.${installationRecordId}`,
      select: "*",
      limit: "1",
    };
    if (!includeInactive) {
      query.deleted_at = "is.null";
      query.suspended_at = "is.null";
    }
    const { data } = await client.requestJson("GET", "/github_installations", {
      query,
    });
    return maybeSingle(data);
  }

  async function upsertInstallation(userId, installation) {
    const row = {
      user_id: userId,
      github_installation_id: installation.id,
      github_account_id: installation.account?.id,
      github_account_login: installation.account?.login || "unknown",
      github_account_type: installation.account?.type || "User",
      repositories_mode: installation.repository_selection || "selected",
      permissions: installation.permissions || {},
      installed_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      suspended_at: null,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    };

    const { data } = await client.requestJson("POST", "/github_installations", {
      query: {
        on_conflict: "user_id,github_installation_id",
        select: "*",
      },
      body: [row],
      prefer: "resolution=merge-duplicates,return=representation",
    });
    return maybeSingle(data);
  }

  async function markInstallationsDeleted(githubInstallationId, deletedAt = new Date()) {
    const { data } = await client.requestJson("PATCH", "/github_installations", {
      query: {
        github_installation_id: `eq.${githubInstallationId}`,
        select: "id,user_id",
      },
      body: {
        deleted_at: toIsoString(deletedAt),
        updated_at: new Date().toISOString(),
      },
      prefer: "return=representation",
    });
    return ensureArray(data);
  }

  async function markInstallationsSuspended(githubInstallationId, suspendedAt = new Date()) {
    const { data } = await client.requestJson("PATCH", "/github_installations", {
      query: {
        github_installation_id: `eq.${githubInstallationId}`,
        select: "id,user_id",
      },
      body: {
        suspended_at: toIsoString(suspendedAt),
        updated_at: new Date().toISOString(),
      },
      prefer: "return=representation",
    });
    return ensureArray(data);
  }

  async function reactivateInstallations(githubInstallationId) {
    const { data } = await client.requestJson("PATCH", "/github_installations", {
      query: {
        github_installation_id: `eq.${githubInstallationId}`,
        select: "id,user_id",
      },
      body: {
        suspended_at: null,
        deleted_at: null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      prefer: "return=representation",
    });
    return ensureArray(data);
  }

  async function listConnections(userId) {
    const { data } = await client.requestJson("GET", "/github_repo_connections", {
      query: {
        user_id: `eq.${userId}`,
        access_revoked_at: "is.null",
        select: "*",
        order: "updated_at.desc",
      },
    });
    return ensureArray(data);
  }

  async function listConnectionRepoIdsByInstallation(userId, installationRecordId) {
    const { data } = await client.requestJson("GET", "/github_repo_connections", {
      query: {
        user_id: `eq.${userId}`,
        installation_record_id: `eq.${installationRecordId}`,
        access_revoked_at: "is.null",
        select: "id,github_repo_id,full_name",
      },
    });
    return ensureArray(data);
  }

  async function upsertConnection({ userId, installationRecordId, repo }) {
    const { data } = await client.requestJson("POST", "/github_repo_connections", {
      query: {
        on_conflict: "user_id,github_repo_id",
        select: "*",
      },
      body: [buildConnectionRowPayload({ userId, installationRecordId, repo })],
      prefer: "resolution=merge-duplicates,return=representation",
    });
    return maybeSingle(data);
  }

  async function findConnectionById(userId, connectionId, { includeInactive = false } = {}) {
    const query = {
      user_id: `eq.${userId}`,
      id: `eq.${connectionId}`,
      select: "*",
      limit: "1",
    };
    if (!includeInactive) {
      query.access_revoked_at = "is.null";
    }
    const { data } = await client.requestJson("GET", "/github_repo_connections", {
      query,
    });
    const row = maybeSingle(data);
    if (!row) return null;

    const installation = await findInstallationRecordById(
      userId,
      row.installation_record_id,
      { includeInactive },
    );
    return installation ? { ...row, installation } : null;
  }

  async function deleteConnection(userId, connectionId) {
    const connection = await findConnectionById(userId, connectionId, { includeInactive: true });
    if (!connection) return null;

    await client.requestJson("DELETE", "/github_repo_connections", {
      query: {
        user_id: `eq.${userId}`,
        id: `eq.${connectionId}`,
      },
      prefer: "return=minimal",
    });
    return connection;
  }

  async function revokeConnectionsForInstallationRepos(installationRecordId, githubRepoIds = []) {
    if (!Array.isArray(githubRepoIds) || githubRepoIds.length === 0) return [];
    const inValue = `in.(${githubRepoIds.map((value) => Number(value)).filter(Number.isFinite).join(",")})`;
    const { data } = await client.requestJson("PATCH", "/github_repo_connections", {
      query: {
        installation_record_id: `eq.${installationRecordId}`,
        github_repo_id: inValue,
        select: "id,github_repo_id",
      },
      body: {
        access_revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      prefer: "return=representation",
    });
    return ensureArray(data);
  }

  async function reactivateConnectionsForRepoIds(installationRecordId, githubRepoIds = []) {
    if (!Array.isArray(githubRepoIds) || githubRepoIds.length === 0) return [];
    const inValue = `in.(${githubRepoIds.map((value) => Number(value)).filter(Number.isFinite).join(",")})`;
    const { data } = await client.requestJson("PATCH", "/github_repo_connections", {
      query: {
        installation_record_id: `eq.${installationRecordId}`,
        github_repo_id: inValue,
        select: "id,github_repo_id",
      },
      body: {
        access_revoked_at: null,
        updated_at: new Date().toISOString(),
      },
      prefer: "return=representation",
    });
    return ensureArray(data);
  }

  async function getManifest(userId, repoConnectionId, refName = DEFAULT_MANIFEST_REF) {
    const { data } = await client.requestJson("GET", "/github_repo_manifest_cache", {
      query: {
        user_id: `eq.${userId}`,
        repo_connection_id: `eq.${repoConnectionId}`,
        ref_name: `eq.${refName}`,
        is_complete: "eq.true",
        select: "*",
        limit: "1",
      },
    });
    return maybeSingle(data);
  }

  async function upsertManifest({
    userId,
    repoConnectionId,
    refName = DEFAULT_MANIFEST_REF,
    treeSha,
    entryCount,
    manifest,
    isComplete = true,
    lastError = null,
    generatedAt = new Date(),
    expiresAt,
    invalidatedAt = null,
  }) {
    const { data } = await client.requestJson("POST", "/github_repo_manifest_cache", {
      query: {
        on_conflict: "repo_connection_id,ref_name",
        select: "*",
      },
      body: [{
        user_id: userId,
        repo_connection_id: repoConnectionId,
        ref_name: refName,
        tree_sha: treeSha,
        entry_count: entryCount,
        manifest,
        is_complete: isComplete,
        last_error: lastError,
        generated_at: toIsoString(generatedAt),
        expires_at: toIsoString(expiresAt),
        invalidated_at: invalidatedAt ? toIsoString(invalidatedAt) : null,
        updated_at: new Date().toISOString(),
      }],
      prefer: "resolution=merge-duplicates,return=representation",
    });
    return maybeSingle(data);
  }

  async function invalidateManifestByConnection(repoConnectionId) {
    const { data } = await client.requestJson("PATCH", "/github_repo_manifest_cache", {
      query: {
        repo_connection_id: `eq.${repoConnectionId}`,
        select: "id,repo_connection_id",
      },
      body: {
        invalidated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      prefer: "return=representation",
    });
    return ensureArray(data);
  }

  async function listConnectionsByGithubRepoIds(githubRepoIds = []) {
    if (!Array.isArray(githubRepoIds) || githubRepoIds.length === 0) return [];
    const numericIds = githubRepoIds.map((value) => parseNumber(value)).filter(Number.isFinite);
    if (numericIds.length === 0) return [];
    const { data } = await client.requestJson("GET", "/github_repo_connections", {
      query: {
        github_repo_id: `in.(${numericIds.join(",")})`,
        select: "*",
      },
    });
    return ensureArray(data);
  }

  async function listInstallationsByGithubInstallationId(githubInstallationId) {
    const { data } = await client.requestJson("GET", "/github_installations", {
      query: {
        github_installation_id: `eq.${githubInstallationId}`,
        select: "*",
      },
    });
    return ensureArray(data);
  }

  return {
    consumeSetupState,
    createSetupState,
    deleteConnection,
    findConnectionById,
    findInstallationRecord,
    findInstallationRecordById,
    getManifest,
    invalidateManifestByConnection,
    listConnectionRepoIdsByInstallation,
    listConnections,
    listConnectionsByGithubRepoIds,
    listInstallations,
    listInstallationsByGithubInstallationId,
    markInstallationsDeleted,
    markInstallationsSuspended,
    reactivateConnectionsForRepoIds,
    reactivateInstallations,
    revokeConnectionsForInstallationRepos,
    upsertConnection,
    upsertInstallation,
    upsertManifest,
  };
}

