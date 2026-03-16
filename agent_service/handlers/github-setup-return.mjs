import { createGitHubError } from "../github-errors.mjs";

function appendResultToRedirect(baseUrl, result, message) {
  const redirectUrl = new URL(baseUrl);
  redirectUrl.searchParams.set("github_setup", result);
  if (message) {
    redirectUrl.searchParams.set("github_message", message);
  }
  return redirectUrl.toString();
}

export function createGitHubSetupReturnHandler({ app, store, runtime }) {
  return async function handleGitHubSetupReturn({ url }) {
    const defaultRedirectUrl = runtime.githubConfig.postInstallRedirectUrl;
    const rawState = url.searchParams.get("state") || "";
    const installationIdRaw = url.searchParams.get("installation_id") || "";

    try {
      const state = app.verifySetupState(rawState);
      await store.consumeSetupState({
        userId: state.userId,
        nonce: state.nonce,
      });

      const installationId = Number(installationIdRaw);
      if (!Number.isFinite(installationId)) {
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
        redirectTo: appendResultToRedirect(defaultRedirectUrl, "success"),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub setup failed.";
      return {
        status: 302,
        redirectTo: appendResultToRedirect(defaultRedirectUrl, "error", message),
      };
    }
  };
}

