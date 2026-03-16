import { createGitHubError } from "../github-errors.mjs";

export function createGitHubDeleteConnectionHandler({ store, manifestService }) {
  return async function handleGitHubDeleteConnection({ auth, params }) {
    const deleted = await store.deleteConnection(auth.userId, params.connectionId);
    if (!deleted) {
      throw createGitHubError(
        "GitHub connection not found.",
        "github_not_found",
        404,
      );
    }
    await manifestService.invalidateConnection(params.connectionId);
    return {
      status: 200,
      body: {
        deleted: true,
        connectionId: params.connectionId,
      },
    };
  };
}

