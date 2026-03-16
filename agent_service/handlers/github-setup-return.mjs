import { createGitHubError } from "../github-errors.mjs";

function appendResultToRedirect(baseUrl, result, message) {
  const redirectUrl = new URL(baseUrl);
  redirectUrl.searchParams.set("github_setup", result);
  if (message) {
    redirectUrl.searchParams.set("github_message", message);
  }
  return redirectUrl.toString();
}

function isAllowedRedirectUrl(candidateUrl, defaultUrl) {
  const protocol = candidateUrl.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return false;
  }
  return candidateUrl.origin === defaultUrl.origin;
}

function resolveRedirectUrl(defaultRedirectUrl, returnTo) {
  const normalizedReturnTo = typeof returnTo === "string" ? returnTo.trim() : "";
  if (!normalizedReturnTo) {
    return defaultRedirectUrl;
  }

  try {
    const defaultUrl = new URL(defaultRedirectUrl);
    const candidateUrl = new URL(normalizedReturnTo);
    if (!isAllowedRedirectUrl(candidateUrl, defaultUrl)) {
      return defaultRedirectUrl;
    }
    return candidateUrl.toString();
  } catch {
    return defaultRedirectUrl;
  }
}

function parseInstallationId(rawInstallationId) {
  const normalizedInstallationId = typeof rawInstallationId === "string"
    ? rawInstallationId.trim()
    : "";
  if (!/^\d+$/.test(normalizedInstallationId)) {
    return null;
  }

  const installationId = Number(normalizedInstallationId);
  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    return null;
  }

  return installationId;
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

      const installationId = parseInstallationId(installationIdRaw);
      if (installationId === null) {
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
