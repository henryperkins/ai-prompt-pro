import { createGitHubError } from "../github-errors.mjs";

function appendResultToRedirect(baseUrl, result, message) {
  const redirectUrl = new URL(baseUrl);
  redirectUrl.searchParams.set("github_setup", result);
  if (message) {
    redirectUrl.searchParams.set("github_message", message);
  }
  return redirectUrl.toString();
}

function resolveRedirectBaseUrl(primaryUrl, fallbackUrl = undefined) {
  for (const candidate of [primaryUrl, fallbackUrl]) {
    if (!candidate) continue;
    try {
      return new URL(candidate).toString();
    } catch {
      // Ignore invalid candidate URLs and fall back to the next option.
    }
  }

  throw createGitHubError(
    "GitHub setup redirect is not configured.",
    "github_redirect_unavailable",
    500,
  );
}

export function createGitHubSetupReturnHandler({ app, store, runtime }) {
  return async function handleGitHubSetupReturn({ url }) {
    const defaultRedirectUrl = resolveRedirectBaseUrl(
      runtime.githubConfig.postInstallRedirectUrl,
    );
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

      const redirectBaseUrl = resolveRedirectBaseUrl(
        state.returnTo,
        defaultRedirectUrl,
      );

      // --- Diagnostic: log successful redirect ---
      const successRedirect = appendResultToRedirect(redirectBaseUrl, "success");
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "github_setup_return_success",
        redirect_url: successRedirect,
        state_return_to: state.returnTo || "(empty)",
        note: redirectBaseUrl === defaultRedirectUrl
          ? "redirect used configured fallback target"
          : "redirect used state-embedded return target",
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
