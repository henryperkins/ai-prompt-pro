import { createNeonDatabaseClient } from "./neon-data.mjs";
import { createGitHubError } from "./github-errors.mjs";

const DEFAULT_MANIFEST_REF = "default";

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

export function createGitHubStore(config = {}) {
  const client = createNeonDatabaseClient({
    databaseUrl: config.databaseUrl,
  });

  async function createSetupState({ userId, nonce, expiresAt }) {
    const hashedNonce = client.hashStateNonce(nonce);
    await client.queryRows(
      `
        insert into public.github_setup_states (
          user_id,
          nonce_hash,
          expires_at
        )
        values ($1, $2, $3)
      `,
      [userId, hashedNonce, toIsoString(expiresAt)],
    );
  }

  async function consumeSetupState({ userId, nonce }) {
    const hashedNonce = client.hashStateNonce(nonce);
    const consumedAt = new Date().toISOString();
    const row = await client.queryRow(
      `
        update public.github_setup_states
        set consumed_at = $3
        where user_id = $1
          and nonce_hash = $2
          and consumed_at is null
          and expires_at > $4
        returning id, user_id
      `,
      [userId, hashedNonce, consumedAt, consumedAt],
    );
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
    return client.queryRows(
      `
        select *
        from public.github_installations
        where user_id = $1
          and deleted_at is null
          and suspended_at is null
        order by updated_at desc
      `,
      [userId],
    );
  }

  async function findInstallationRecord(userId, githubInstallationId, { includeInactive = false } = {}) {
    return client.queryRow(
      `
        select *
        from public.github_installations
        where user_id = $1
          and github_installation_id = $2
          ${includeInactive ? "" : "and deleted_at is null and suspended_at is null"}
        limit 1
      `,
      [userId, githubInstallationId],
    );
  }

  async function findInstallationRecordById(userId, installationRecordId, { includeInactive = false } = {}) {
    return client.queryRow(
      `
        select *
        from public.github_installations
        where user_id = $1
          and id = $2
          ${includeInactive ? "" : "and deleted_at is null and suspended_at is null"}
        limit 1
      `,
      [userId, installationRecordId],
    );
  }

  async function upsertInstallation(userId, installation) {
    const now = new Date().toISOString();
    return client.queryRow(
      `
        insert into public.github_installations (
          user_id,
          github_installation_id,
          github_account_id,
          github_account_login,
          github_account_type,
          repositories_mode,
          permissions,
          installed_at,
          last_seen_at,
          suspended_at,
          deleted_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8,
          $9,
          $10,
          $11,
          $12
        )
        on conflict (user_id, github_installation_id)
        do update set
          github_account_id = excluded.github_account_id,
          github_account_login = excluded.github_account_login,
          github_account_type = excluded.github_account_type,
          repositories_mode = excluded.repositories_mode,
          permissions = excluded.permissions,
          installed_at = excluded.installed_at,
          last_seen_at = excluded.last_seen_at,
          suspended_at = excluded.suspended_at,
          deleted_at = excluded.deleted_at,
          updated_at = excluded.updated_at
        returning *
      `,
      [
        userId,
        installation.id,
        installation.account?.id,
        installation.account?.login || "unknown",
        installation.account?.type || "User",
        installation.repository_selection || "selected",
        installation.permissions || {},
        now,
        now,
        null,
        null,
        now,
      ],
    );
  }

  async function markInstallationsDeleted(githubInstallationId, deletedAt = new Date()) {
    return client.queryRows(
      `
        update public.github_installations
        set deleted_at = $2,
            updated_at = $3
        where github_installation_id = $1
        returning id, user_id
      `,
      [githubInstallationId, toIsoString(deletedAt), new Date().toISOString()],
    );
  }

  async function markInstallationsSuspended(githubInstallationId, suspendedAt = new Date()) {
    return client.queryRows(
      `
        update public.github_installations
        set suspended_at = $2,
            updated_at = $3
        where github_installation_id = $1
        returning id, user_id
      `,
      [githubInstallationId, toIsoString(suspendedAt), new Date().toISOString()],
    );
  }

  async function reactivateInstallations(githubInstallationId) {
    const now = new Date().toISOString();
    return client.queryRows(
      `
        update public.github_installations
        set suspended_at = null,
            deleted_at = null,
            last_seen_at = $2,
            updated_at = $3
        where github_installation_id = $1
        returning id, user_id
      `,
      [githubInstallationId, now, now],
    );
  }

  async function listConnections(userId) {
    return client.queryRows(
      `
        select *
        from public.github_repo_connections
        where user_id = $1
          and access_revoked_at is null
        order by updated_at desc
      `,
      [userId],
    );
  }

  async function listConnectionRepoIdsByInstallation(userId, installationRecordId) {
    return client.queryRows(
      `
        select id, github_repo_id, full_name
        from public.github_repo_connections
        where user_id = $1
          and installation_record_id = $2
          and access_revoked_at is null
      `,
      [userId, installationRecordId],
    );
  }

  async function upsertConnection({ userId, installationRecordId, repo }) {
    const row = buildConnectionRowPayload({ userId, installationRecordId, repo });
    return client.queryRow(
      `
        insert into public.github_repo_connections (
          user_id,
          installation_record_id,
          github_repo_id,
          owner_login,
          repo_name,
          full_name,
          default_branch,
          visibility,
          is_private,
          last_selected_at,
          access_revoked_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12
        )
        on conflict (user_id, github_repo_id)
        do update set
          installation_record_id = excluded.installation_record_id,
          owner_login = excluded.owner_login,
          repo_name = excluded.repo_name,
          full_name = excluded.full_name,
          default_branch = excluded.default_branch,
          visibility = excluded.visibility,
          is_private = excluded.is_private,
          last_selected_at = excluded.last_selected_at,
          access_revoked_at = excluded.access_revoked_at,
          updated_at = excluded.updated_at
        returning *
      `,
      [
        row.user_id,
        row.installation_record_id,
        row.github_repo_id,
        row.owner_login,
        row.repo_name,
        row.full_name,
        row.default_branch,
        row.visibility,
        row.is_private,
        row.last_selected_at,
        row.access_revoked_at,
        row.updated_at,
      ],
    );
  }

  async function findConnectionById(userId, connectionId, { includeInactive = false } = {}) {
    const row = await client.queryRow(
      `
        select *
        from public.github_repo_connections
        where user_id = $1
          and id = $2
          ${includeInactive ? "" : "and access_revoked_at is null"}
        limit 1
      `,
      [userId, connectionId],
    );
    if (!row) return null;

    const installation = await findInstallationRecordById(
      userId,
      row.installation_record_id,
      { includeInactive },
    );

    // --- Diagnostic: log stale connection (connection exists but installation is missing/inactive) ---
    if (!installation) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        event: "github_stale_connection_detected",
        message:
          "Connection record exists but its backing installation is missing or inactive (suspended/deleted). "
          + "The user will see this repo as connected but all operations will fail with 404. "
          + "listConnections() does not filter by installation state.",
        connection_id: connectionId,
        installation_record_id: row.installation_record_id,
        full_name: row.full_name,
        include_inactive: includeInactive,
      }));
    }
    // --- End diagnostic ---

    return installation ? { ...row, installation } : null;
  }

  async function deleteConnection(userId, connectionId) {
    const connection = await findConnectionById(userId, connectionId, { includeInactive: true });
    if (!connection) return null;

    await client.queryRows(
      `
        delete from public.github_repo_connections
        where user_id = $1
          and id = $2
      `,
      [userId, connectionId],
    );
    return connection;
  }

  async function revokeConnectionsForInstallationRepos(installationRecordId, githubRepoIds = []) {
    if (!Array.isArray(githubRepoIds) || githubRepoIds.length === 0) return [];
    const numericIds = githubRepoIds.map((value) => Number(value)).filter(Number.isFinite);
    if (numericIds.length === 0) return [];
    const now = new Date().toISOString();
    return client.queryRows(
      `
        update public.github_repo_connections
        set access_revoked_at = $3,
            updated_at = $4
        where installation_record_id = $1
          and github_repo_id = any($2::bigint[])
        returning id, github_repo_id
      `,
      [installationRecordId, numericIds, now, now],
    );
  }

  async function reactivateConnectionsForRepoIds(installationRecordId, githubRepoIds = []) {
    if (!Array.isArray(githubRepoIds) || githubRepoIds.length === 0) return [];
    const numericIds = githubRepoIds.map((value) => Number(value)).filter(Number.isFinite);
    if (numericIds.length === 0) return [];
    return client.queryRows(
      `
        update public.github_repo_connections
        set access_revoked_at = null,
            updated_at = $3
        where installation_record_id = $1
          and github_repo_id = any($2::bigint[])
        returning id, github_repo_id
      `,
      [installationRecordId, numericIds, new Date().toISOString()],
    );
  }

  async function getManifest(userId, repoConnectionId, refName = DEFAULT_MANIFEST_REF) {
    return client.queryRow(
      `
        select *
        from public.github_repo_manifest_cache
        where user_id = $1
          and repo_connection_id = $2
          and ref_name = $3
          and is_complete = true
        limit 1
      `,
      [userId, repoConnectionId, refName],
    );
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
    return client.queryRow(
      `
        insert into public.github_repo_manifest_cache (
          user_id,
          repo_connection_id,
          ref_name,
          tree_sha,
          entry_count,
          manifest,
          is_complete,
          last_error,
          generated_at,
          expires_at,
          invalidated_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::jsonb,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12
        )
        on conflict (repo_connection_id, ref_name)
        do update set
          user_id = excluded.user_id,
          tree_sha = excluded.tree_sha,
          entry_count = excluded.entry_count,
          manifest = excluded.manifest,
          is_complete = excluded.is_complete,
          last_error = excluded.last_error,
          generated_at = excluded.generated_at,
          expires_at = excluded.expires_at,
          invalidated_at = excluded.invalidated_at,
          updated_at = excluded.updated_at
        returning *
      `,
      [
        userId,
        repoConnectionId,
        refName,
        treeSha,
        entryCount,
        manifest,
        isComplete,
        lastError,
        toIsoString(generatedAt),
        toIsoString(expiresAt),
        invalidatedAt ? toIsoString(invalidatedAt) : null,
        new Date().toISOString(),
      ],
    );
  }

  async function invalidateManifestByConnection(repoConnectionId) {
    const now = new Date().toISOString();
    return client.queryRows(
      `
        update public.github_repo_manifest_cache
        set invalidated_at = $2,
            updated_at = $3
        where repo_connection_id = $1
        returning id, repo_connection_id
      `,
      [repoConnectionId, now, now],
    );
  }

  async function listConnectionsByGithubRepoIds(githubRepoIds = []) {
    if (!Array.isArray(githubRepoIds) || githubRepoIds.length === 0) return [];
    const numericIds = githubRepoIds.map((value) => parseNumber(value)).filter(Number.isFinite);
    if (numericIds.length === 0) return [];
    return client.queryRows(
      `
        select *
        from public.github_repo_connections
        where github_repo_id = any($1::bigint[])
      `,
      [numericIds],
    );
  }

  async function listInstallationsByGithubInstallationId(githubInstallationId) {
    return client.queryRows(
      `
        select *
        from public.github_installations
        where github_installation_id = $1
      `,
      [githubInstallationId],
    );
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
