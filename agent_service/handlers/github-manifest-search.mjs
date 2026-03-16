import { createGitHubError } from "../github-errors.mjs";

export function createGitHubManifestSearchHandler({ store, manifestService }) {
  return async function handleGitHubManifestSearch({ auth, params, url }) {
    const connection = await store.findConnectionById(auth.userId, params.connectionId);
    if (!connection) {
      throw createGitHubError(
        "GitHub connection not found.",
        "github_not_found",
        404,
      );
    }
    const query = url.searchParams.get("q") || "";
    const limit = Number(url.searchParams.get("limit") || "50");
    const result = await manifestService.searchManifest({
      userId: auth.userId,
      connection,
      query,
      limit,
    });
    return {
      status: 200,
      body: {
        results: result.results,
        staleFallback: result.staleFallback,
      },
    };
  };
}

