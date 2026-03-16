export function createGitHubWebhooksHandler({ app, store, manifestService }) {
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

    if (eventName === "push") {
      const repoId = Number(payload?.repository?.id);
      if (Number.isFinite(repoId)) {
        const connections = await store.listConnectionsByGithubRepoIds([repoId]);
        for (const connection of connections) {
          await manifestService.invalidateConnection(connection.id);
        }
      }
    }

    if (eventName === "installation") {
      const action = String(payload?.action || "").trim();
      if (Number.isFinite(installationId)) {
        if (action === "deleted") {
          await store.markInstallationsDeleted(installationId);
        } else if (action === "suspend") {
          await store.markInstallationsSuspended(installationId);
        } else if (action === "unsuspend" || action === "created" || action === "new_permissions_accepted") {
          await store.reactivateInstallations(installationId);
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
        for (const connection of connections) {
          await manifestService.invalidateConnection(connection.id);
        }
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

