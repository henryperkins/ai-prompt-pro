import { createGitHubError } from "../github-errors.mjs";

export function createGitHubRefreshManifestHandler({ store, manifestService }) {
  return async function handleGitHubRefreshManifest({ auth, params }) {
    const connection = await store.findConnectionById(auth.userId, params.connectionId);
    if (!connection) {
      throw createGitHubError(
        "GitHub connection not found.",
        "github_not_found",
        404,
      );
    }
    const result = await manifestService.refreshManifest({
      userId: auth.userId,
      connection,
    });
    return {
      status: 200,
      body: {
        manifest: {
          entryCount: result.manifestRow.entry_count,
          generatedAt: result.manifestRow.generated_at,
          expiresAt: result.manifestRow.expires_at,
          staleFallback: result.staleFallback,
        },
      },
    };
  };
}

