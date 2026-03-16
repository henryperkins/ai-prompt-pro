export function createGitHubInstallationsHandler({ store }) {
  return async function handleGitHubInstallations({ auth }) {
    const installations = await store.listInstallations(auth.userId);
    return {
      status: 200,
      body: {
        installations: installations.map((installation) => ({
          id: installation.id,
          githubInstallationId: installation.github_installation_id,
          githubAccountId: installation.github_account_id,
          githubAccountLogin: installation.github_account_login,
          githubAccountType: installation.github_account_type,
          repositoriesMode: installation.repositories_mode,
          permissions: installation.permissions || {},
          installedAt: installation.installed_at,
          lastSeenAt: installation.last_seen_at,
        })),
      },
    };
  };
}

