import { headerValue } from "../http-helpers.mjs";

function resolveRequestOrigin(req) {
  const originHeader = (headerValue(req, "origin") || "").trim();
  if (originHeader) {
    try {
      return new URL(originHeader).origin;
    } catch {
      return null;
    }
  }

  const refererHeader = (headerValue(req, "referer") || "").trim();
  if (!refererHeader) return null;

  try {
    return new URL(refererHeader).origin;
  } catch {
    return null;
  }
}

function resolvePostInstallReturnTo(req, runtime) {
  const configuredRedirectUrl = runtime.githubConfig.postInstallRedirectUrl;
  if (!configuredRedirectUrl) return configuredRedirectUrl;

  let configuredUrl;
  try {
    configuredUrl = new URL(configuredRedirectUrl);
  } catch {
    return configuredRedirectUrl;
  }

  const requestOrigin = resolveRequestOrigin(req);
  if (!requestOrigin) {
    return configuredUrl.toString();
  }

  return new URL(
    `${configuredUrl.pathname}${configuredUrl.search}${configuredUrl.hash}`,
    `${requestOrigin}/`,
  ).toString();
}

export function createGitHubInstallUrlHandler({ app, store, runtime }) {
  return async function handleGitHubInstallUrl({ auth, req }) {
    const nonce = app.createNonce();
    const returnTo = resolvePostInstallReturnTo(req, runtime);
    const stateToken = app.createSetupState({
      userId: auth.userId,
      nonce,
      returnTo,
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
