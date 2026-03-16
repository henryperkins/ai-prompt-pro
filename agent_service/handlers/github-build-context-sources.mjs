import { createGitHubError } from "../github-errors.mjs";

export function createGitHubBuildContextSourcesHandler({ store, sourceContextService }) {
  return async function handleGitHubBuildContextSources({ auth, params, body }) {
    const connection = await store.findConnectionById(auth.userId, params.connectionId);
    if (!connection) {
      throw createGitHubError(
        "GitHub connection not found.",
        "github_not_found",
        404,
      );
    }
    const paths = Array.isArray(body?.paths) ? body.paths.map((value) => String(value || "").trim()).filter(Boolean) : [];
    if (paths.length === 0) {
      throw createGitHubError(
        "At least one file path is required.",
        "github_bad_request",
        400,
      );
    }
    const sources = await sourceContextService.buildContextSources({
      userId: auth.userId,
      connection,
      paths,
      selection: body?.selection,
    });
    return {
      status: 200,
      body: {
        sources,
      },
    };
  };
}

