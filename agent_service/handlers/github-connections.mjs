export function createGitHubConnectionsHandler({ store }) {
  return async function handleGitHubConnections({ auth }) {
    const connections = await store.listConnections(auth.userId);
    return {
      status: 200,
      body: {
        connections: connections.map((connection) => ({
          id: connection.id,
          githubRepoId: connection.github_repo_id,
          ownerLogin: connection.owner_login,
          repoName: connection.repo_name,
          fullName: connection.full_name,
          defaultBranch: connection.default_branch,
          visibility: connection.visibility,
          isPrivate: connection.is_private,
          installationRecordId: connection.installation_record_id,
          lastSelectedAt: connection.last_selected_at,
        })),
      },
    };
  };
}

