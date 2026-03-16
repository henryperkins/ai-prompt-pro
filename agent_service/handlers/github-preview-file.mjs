import { createGitHubError } from "../github-errors.mjs";

export function createGitHubPreviewFileHandler({ store, sourceContextService }) {
  return async function handleGitHubPreviewFile({ auth, params, url }) {
    const connection = await store.findConnectionById(auth.userId, params.connectionId);
    if (!connection) {
      throw createGitHubError(
        "GitHub connection not found.",
        "github_not_found",
        404,
      );
    }
    const path = (url.searchParams.get("path") || "").trim();
    if (!path) {
      throw createGitHubError(
        "File path is required.",
        "github_bad_request",
        400,
      );
    }
    const preview = await sourceContextService.buildFilePreview({
      userId: auth.userId,
      connection,
      path,
    });
    return {
      status: 200,
      body: {
        file: preview,
      },
    };
  };
}

