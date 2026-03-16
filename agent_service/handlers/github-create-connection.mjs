import { createGitHubError } from "../github-errors.mjs";

export function createGitHubCreateConnectionHandler({ app, store }) {
  return async function handleGitHubCreateConnection({ auth, body }) {
    const githubInstallationId = Number(body?.installationId);
    const owner = String(body?.ownerLogin || body?.owner || "").trim();
    const repoName = String(body?.repoName || "").trim();

    if (!Number.isFinite(githubInstallationId) || !owner || !repoName) {
      throw createGitHubError(
        "Installation ID, owner, and repository name are required.",
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

    const repository = await app.getRepository(owner, repoName, githubInstallationId);
    const connection = await store.upsertConnection({
      userId: auth.userId,
      installationRecordId: installation.id,
      repo: repository,
    });

    return {
      status: 200,
      body: {
        connection: {
          id: connection.id,
          githubRepoId: connection.github_repo_id,
          ownerLogin: connection.owner_login,
          repoName: connection.repo_name,
          fullName: connection.full_name,
          defaultBranch: connection.default_branch,
          visibility: connection.visibility,
          isPrivate: connection.is_private,
          installationRecordId: connection.installation_record_id,
          installationId: installation.github_installation_id,
        },
      },
    };
  };
}

