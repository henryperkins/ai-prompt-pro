import { createGitHubError } from "../github-errors.mjs";

function normalizeRepositoryPayload(repository, connectedRow) {
  return {
    id: repository.id,
    ownerLogin: repository.owner?.login || "",
    repoName: repository.name,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    visibility: repository.visibility || (repository.private ? "private" : "public"),
    isPrivate: repository.private === true,
    connected: Boolean(connectedRow),
    connectionId: connectedRow?.id || null,
  };
}

export function createGitHubInstallationRepositoriesHandler({ app, store, runtime }) {
  return async function handleGitHubInstallationRepositories({ auth, params, url }) {
    const githubInstallationId = Number(params.installationId);
    if (!Number.isFinite(githubInstallationId)) {
      throw createGitHubError(
        "GitHub installation ID is invalid.",
        "github_bad_request",
        400,
      );
    }

    const installation = await store.findInstallationRecord(auth.userId, githubInstallationId);
    if (!installation) {
      throw createGitHubError(
        "GitHub installation not found.",
        "github_not_found",
        404,
      );
    }

    const cursor = Number(url.searchParams.get("cursor") || "1");
    const page = Number.isFinite(cursor) && cursor > 0 ? cursor : 1;
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const limitParam = Number(url.searchParams.get("limit") || runtime.githubConfig.repositoryPageSize || 50);
    const limit = Math.max(1, Math.min(100, limitParam));
    const connectedRows = await store.listConnectionRepoIdsByInstallation(auth.userId, installation.id);
    const connectedByRepoId = new Map(
      connectedRows.map((row) => [Number(row.github_repo_id), row]),
    );

    const seenIds = new Set();
    const collected = [];
    let nextPage = page;
    let totalCount = 0;
    let exhausted = false;
    let scannedPages = 0;

    while (!exhausted && collected.length < limit && scannedPages < 5) {
      scannedPages += 1;
      const response = await app.listInstallationRepositories(
        githubInstallationId,
        {
          page: nextPage,
          perPage: Math.min(Math.max(limit, 20), 100),
        },
      );
      const repositories = Array.isArray(response?.repositories) ? response.repositories : [];
      totalCount = Number(response?.total_count) || totalCount;
      if (repositories.length === 0) {
        exhausted = true;
        break;
      }

      repositories.forEach((repository) => {
        if (seenIds.has(repository.id)) return;
        seenIds.add(repository.id);
        const haystack = `${repository.full_name} ${repository.name} ${repository.owner?.login || ""}`.toLowerCase();
        if (query && !haystack.includes(query)) return;
        collected.push(normalizeRepositoryPayload(
          repository,
          connectedByRepoId.get(Number(repository.id)) || null,
        ));
      });

      const fetchedCount = nextPage * Math.min(Math.max(limit, 20), 100);
      nextPage += 1;
      if (fetchedCount >= totalCount) {
        exhausted = true;
      }
    }

    return {
      status: 200,
      body: {
        installation: {
          id: installation.id,
          githubInstallationId: installation.github_installation_id,
          githubAccountLogin: installation.github_account_login,
          githubAccountType: installation.github_account_type,
        },
        repositories: collected.slice(0, limit),
        nextCursor: exhausted ? null : String(nextPage),
      },
    };
  };
}

