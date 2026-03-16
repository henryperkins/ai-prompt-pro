import { createGitHubError } from "../github-errors.mjs";

function appendResultToRedirect(baseUrl, result, message) {
  const redirectUrl = new URL(baseUrl);
  redirectUrl.searchParams.set("github_setup", result);
  if (message) {
    redirectUrl.searchParams.set("github_message", message);
  }
  return redirectUrl.toString();
}

function resolveRedirectUrl(defaultRedirectUrl, returnTo) {
  const normalizedReturnTo = typeof returnTo === "string" ? returnTo.trim() : "";
  if (!normalizedReturnTo) {
    return defaultRedirectUrl;
  }

  try {
    return new URL(normalizedReturnTo).toString();
  } catch {
    return defaultRedirectUrl;
  }
}

function getSetupFailureMessage(error) {
  const errorCode = typeof error?.code === "string" ? error.code : "";
  if (errorCode === "github_invalid_state") {
    return "GitHub setup could not be verified. Please try again.";
  }
  if (errorCode === "github_installation_incomplete") {
    return "GitHub installation was not completed.";
  }
  return error instanceof Error ? error.message : "GitHub setup failed.";
}

export function createGitHubSetupReturnHandler({ app, store, runtime }) {
  return async function handleGitHubSetupReturn({ url }) {
    const defaultRedirectUrl = runtime.githubConfig.postInstallRedirectUrl;
    const rawState = url.searchParams.get("state") || "";
    const installationIdRaw = url.searchParams.get("installation_id") || "";
    let redirectUrl = defaultRedirectUrl;

    try {
      const state = app.verifySetupState(rawState);
      redirectUrl = resolveRedirectUrl(defaultRedirectUrl, state.returnTo);
      await store.consumeSetupState({
        userId: state.userId,
        nonce: state.nonce,
      });

      const normalizedInstallationId = installationIdRaw.trim();
      const installationId = Number.parseInt(normalizedInstallationId, 10);
      if (!normalizedInstallationId || !Number.isSafeInteger(installationId) || installationId <= 0) {
        throw createGitHubError(
          "GitHub installation was not completed.",
          "github_installation_incomplete",
          400,
        );
      }

      const installation = await app.getInstallationDetails(installationId);
      await store.upsertInstallation(state.userId, installation);

      return {
        status: 302,
        redirectTo: appendResultToRedirect(redirectUrl, "success"),
      };
    } catch (error) {
      const message = getSetupFailureMessage(error);
      return {
        status: 302,
        redirectTo: appendResultToRedirect(redirectUrl, "error", message),
      };
    }
  };
}
