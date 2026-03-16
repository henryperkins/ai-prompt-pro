export function createGitHubInstallUrlHandler({ app, store, runtime }) {
  return async function handleGitHubInstallUrl({ auth }) {
    const nonce = app.createNonce();
    const stateToken = app.createSetupState({
      userId: auth.userId,
      nonce,
      returnTo: runtime.githubConfig.postInstallRedirectUrl,
    });
    await store.createSetupState({
      userId: auth.userId,
      nonce,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    return {
      status: 200,
      body: {
        installUrl: app.buildInstallUrl({ state: stateToken }),
      },
    };
  };
}

