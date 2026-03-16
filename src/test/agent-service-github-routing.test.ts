import { describe, expect, it } from "vitest";
import {
  collectGitHubRouteMethods,
  createGitHubRouteRegistry,
  listGitHubRoutesForPath,
  matchGitHubRoute,
} from "../../agent_service/github-routes.mjs";

function createRegistry() {
  return createGitHubRouteRegistry({
    runtime: {
      githubUserAuthPolicy: {
        allowPublicKey: false,
        allowServiceToken: false,
        allowUserJwt: true,
      },
      githubConfig: {
        repositoryPageSize: 50,
        postInstallRedirectUrl: "https://promptforge.test/builder",
      },
    },
    app: {},
    store: {},
    manifestService: {},
    sourceContextService: {},
  });
}

describe("agent service GitHub route registry", () => {
  it("matches parameterized routes and keeps strict user auth on repo endpoints", () => {
    const routes = createRegistry();
    const matched = matchGitHubRoute(
      routes,
      "GET",
      "/github/installations/123/repositories",
    );

    expect(matched).toMatchObject({
      pattern: "/github/installations/:installationId/repositories",
      params: { installationId: "123" },
      bodyMode: "none",
      rateLimitScope: "github-user",
      authPolicy: {
        allowPublicKey: false,
        allowServiceToken: false,
        allowUserJwt: true,
      },
    });
  });

  it("keeps setup and webhook routes on explicit custom auth paths", () => {
    const routes = createRegistry();

    expect(
      matchGitHubRoute(routes, "GET", "/github/app/setup"),
    ).toMatchObject({
      customAuth: "githubSetupState",
      bodyMode: "none",
    });
    expect(
      matchGitHubRoute(routes, "POST", "/github/webhooks"),
    ).toMatchObject({
      customAuth: "githubWebhookSignature",
      bodyMode: "text",
    });
  });

  it("collects all allowed methods for shared GitHub paths", () => {
    const routes = createRegistry();

    expect(listGitHubRoutesForPath(routes, "/github/connections")).toHaveLength(2);
    expect(collectGitHubRouteMethods(routes, "/github/connections")).toEqual([
      "POST",
      "GET",
    ]);
  });
});
