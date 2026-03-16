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

    // --- Diagnostic: log redirect target ---
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "github_setup_return_redirect_target",
      redirect_url: defaultRedirectUrl,
      installation_id_raw: installationIdRaw,
      has_state: Boolean(rawState),
    }));
    // --- End diagnostic ---

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

      // --- Diagnostic: log successful redirect ---
      const successRedirect = appendResultToRedirect(defaultRedirectUrl, "success");
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "github_setup_return_success",
        redirect_url: successRedirect,
        state_return_to: state.returnTo || "(empty)",
        note: state.returnTo && state.returnTo !== defaultRedirectUrl
          ? "state.returnTo differs from configured redirect — the state-embedded returnTo is being ignored"
          : "redirect matches state",
      }));
      // --- End diagnostic ---

      return {
        status: 302,
        redirectTo: successRedirect,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub setup failed.";
      // --- Diagnostic: log error redirect ---
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        event: "github_setup_return_error",
        redirect_url: defaultRedirectUrl,
        error_message: message,
      }));
      // --- End diagnostic ---
      return {
        status: 302,
        redirectTo: appendResultToRedirect(defaultRedirectUrl, "error", message),
      };
    }
  };
}

