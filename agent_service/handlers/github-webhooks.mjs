const HANDLED_EVENTS = new Set(["push", "installation", "installation_repositories", "repository"]);

export function createGitHubWebhooksHandler({ app, store, manifestService }) {
  async function invalidateConnections(connections = []) {
    for (const connection of connections) {
      await manifestService.invalidateConnection(connection.id);
    }
  }

  function uniqueConnections(...groups) {
    const unique = new Map();
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      for (const connection of group) {
        if (!connection?.id || unique.has(connection.id)) continue;
        unique.set(connection.id, connection);
      }
    }
    return Array.from(unique.values());
  }

  function logRepositoryInstallationDrift({
    action,
    repoId,
    installationId,
    reboundCount,
    connectionCount,
  }) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      event: "github_webhook_repository_installation_drift",
      message:
        `Received repository webhook action '${action}' for repo ${repoId}, but only ${reboundCount} `
        + `of ${connectionCount} stored connections could be rebound to installation ${installationId}. `
        + "Those connections remain attached to stale installation records until runtime self-heal or backfill repairs them.",
      action,
      repo_id: repoId,
      installation_id: installationId,
      rebound_connections: reboundCount,
      touched_connections: connectionCount,
    }));
  }

  return async function handleGitHubWebhooks({ body, req }) {
    app.verifyWebhookSignature({
      body,
      signature: req.headers["x-hub-signature-256"],
    });

    const eventName = String(req.headers["x-github-event"] || "").trim();
    const payload = typeof body === "string" && body.trim()
      ? JSON.parse(body)
      : {};
    const installationId = Number(payload?.installation?.id);
    const action = String(payload?.action || "").trim();

    if (!HANDLED_EVENTS.has(eventName)) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "github_webhook_ignored_event",
        webhook_event: eventName,
        action,
      }));
    }
    // --- End diagnostic ---

    if (eventName === "push") {
      const repoId = Number(payload?.repository?.id);
      if (Number.isFinite(repoId)) {
        const connections = await store.listConnectionsByGithubRepoIds([repoId]);
        await invalidateConnections(connections);
      }
    }

    if (eventName === "installation") {
      if (Number.isFinite(installationId)) {
        if (action === "deleted") {
          const installations = await store.markInstallationsDeleted(installationId);
          for (const installation of installations) {
            await store.revokeConnectionsForInstallation(installation.id);
          }
        } else if (action === "suspend") {
          const installations = await store.markInstallationsSuspended(installationId);
          for (const installation of installations) {
            await store.revokeConnectionsForInstallation(installation.id);
          }
        } else if (action === "unsuspend" || action === "created" || action === "new_permissions_accepted") {
          const installations = await store.reactivateInstallations(installationId);
          for (const installation of installations) {
            await store.reactivateConnectionsForInstallation(installation.id);
          }
        }
      }
    }

    if (eventName === "installation_repositories" && Number.isFinite(installationId)) {
      const installations = await store.listInstallationsByGithubInstallationId(installationId);
      const removedRepoIds = Array.isArray(payload?.repositories_removed)
        ? payload.repositories_removed.map((repo) => Number(repo?.id)).filter(Number.isFinite)
        : [];
      const addedRepoIds = Array.isArray(payload?.repositories_added)
        ? payload.repositories_added.map((repo) => Number(repo?.id)).filter(Number.isFinite)
        : [];

      for (const installation of installations) {
        if (removedRepoIds.length > 0) {
          await store.revokeConnectionsForInstallationRepos(installation.id, removedRepoIds);
        }
        if (addedRepoIds.length > 0) {
          await store.reactivateConnectionsForRepoIds(installation.id, addedRepoIds);
        }
      }

      const touchedRepoIds = Array.from(new Set([...removedRepoIds, ...addedRepoIds]));
      if (touchedRepoIds.length > 0) {
        const connections = await store.listConnectionsByGithubRepoIds(touchedRepoIds);
        await invalidateConnections(connections);
      }
    }

    if (eventName === "repository") {
      const repoId = Number(payload?.repository?.id);
      if (Number.isFinite(repoId)) {
        const reboundConnections = Number.isFinite(installationId)
          && typeof store.rebindConnectionsToInstallationForRepo === "function"
          ? await store.rebindConnectionsToInstallationForRepo(repoId, installationId)
          : [];
        const touchedConnections = typeof store.syncConnectionsRepositoryMetadata === "function"
          ? await store.syncConnectionsRepositoryMetadata(repoId, payload.repository || {})
          : [];

        if (action === "deleted" && Number.isFinite(installationId)) {
          const installations = await store.listInstallationsByGithubInstallationId(installationId);
          for (const installation of installations) {
            await store.revokeConnectionsForInstallationRepos(installation.id, [repoId]);
          }
        }

        let connections = uniqueConnections(reboundConnections, touchedConnections);
        if (connections.length === 0) {
          connections = await store.listConnectionsByGithubRepoIds([repoId]);
        }
        if (
          Number.isFinite(installationId)
          && connections.length > 0
          && reboundConnections.length < connections.length
        ) {
          logRepositoryInstallationDrift({
            action,
            repoId,
            installationId,
            reboundCount: reboundConnections.length,
            connectionCount: connections.length,
          });
        }
        await invalidateConnections(connections);
      }
    }

    return {
      status: 202,
      body: {
        ok: true,
      },
    };
  };
}
