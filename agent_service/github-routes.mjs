import { createGitHubInstallUrlHandler } from "./handlers/github-install-url.mjs";
import { createGitHubSetupReturnHandler } from "./handlers/github-setup-return.mjs";
import { createGitHubInstallationsHandler } from "./handlers/github-installations.mjs";
import { createGitHubInstallationRepositoriesHandler } from "./handlers/github-installation-repositories.mjs";
import { createGitHubCreateConnectionHandler } from "./handlers/github-create-connection.mjs";
import { createGitHubConnectionsHandler } from "./handlers/github-connections.mjs";
import { createGitHubDeleteConnectionHandler } from "./handlers/github-delete-connection.mjs";
import { createGitHubRefreshManifestHandler } from "./handlers/github-refresh-manifest.mjs";
import { createGitHubManifestSearchHandler } from "./handlers/github-manifest-search.mjs";
import { createGitHubPreviewFileHandler } from "./handlers/github-preview-file.mjs";
import { createGitHubBuildContextSourcesHandler } from "./handlers/github-build-context-sources.mjs";
import { createGitHubWebhooksHandler } from "./handlers/github-webhooks.mjs";

function normalizePathSegment(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function splitPath(pathname) {
  return pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function matchPattern(pattern, pathname) {
  const patternSegments = splitPath(pattern);
  const pathSegments = splitPath(pathname);
  if (patternSegments.length !== pathSegments.length) return null;

  const params = {};
  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];
    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = pathSegment;
      continue;
    }
    if (normalizePathSegment(patternSegment) !== normalizePathSegment(pathSegment)) {
      return null;
    }
  }

  return params;
}

export function createGitHubRouteRegistry(deps) {
  const {
    runtime,
    app,
    store,
    manifestService,
    sourceContextService,
  } = deps;

  return [
    {
      method: "GET",
      pattern: "/github/install-url",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["GET"],
      bodyMode: "none",
      rateLimitScope: "github-user",
      handler: createGitHubInstallUrlHandler({ app, store, runtime }),
    },
    {
      method: "GET",
      pattern: "/github/app/setup",
      customAuth: "githubSetupState",
      corsMethods: ["GET"],
      bodyMode: "none",
      handler: createGitHubSetupReturnHandler({ app, store, runtime }),
    },
    {
      method: "GET",
      pattern: "/github/installations",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["GET"],
      bodyMode: "none",
      rateLimitScope: "github-user",
      handler: createGitHubInstallationsHandler({ store }),
    },
    {
      method: "GET",
      pattern: "/github/installations/:installationId/repositories",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["GET"],
      bodyMode: "none",
      rateLimitScope: "github-user",
      handler: createGitHubInstallationRepositoriesHandler({ app, store, runtime }),
    },
    {
      method: "POST",
      pattern: "/github/connections",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["POST"],
      bodyMode: "json",
      rateLimitScope: "github-user",
      handler: createGitHubCreateConnectionHandler({ app, store }),
    },
    {
      method: "GET",
      pattern: "/github/connections",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["GET"],
      bodyMode: "none",
      rateLimitScope: "github-user",
      handler: createGitHubConnectionsHandler({ store }),
    },
    {
      method: "DELETE",
      pattern: "/github/connections/:connectionId",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["DELETE"],
      bodyMode: "none",
      rateLimitScope: "github-user",
      handler: createGitHubDeleteConnectionHandler({ store, manifestService }),
    },
    {
      method: "POST",
      pattern: "/github/connections/:connectionId/manifest/refresh",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["POST"],
      bodyMode: "none",
      rateLimitScope: "github-user",
      handler: createGitHubRefreshManifestHandler({ store, manifestService }),
    },
    {
      method: "GET",
      pattern: "/github/connections/:connectionId/search",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["GET"],
      bodyMode: "none",
      rateLimitScope: "github-user",
      handler: createGitHubManifestSearchHandler({ store, manifestService }),
    },
    {
      method: "GET",
      pattern: "/github/connections/:connectionId/file",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["GET"],
      bodyMode: "none",
      rateLimitScope: "github-user",
      handler: createGitHubPreviewFileHandler({ store, sourceContextService }),
    },
    {
      method: "POST",
      pattern: "/github/connections/:connectionId/context-sources",
      authPolicy: runtime.githubUserAuthPolicy,
      corsMethods: ["POST"],
      bodyMode: "json",
      rateLimitScope: "github-user",
      handler: createGitHubBuildContextSourcesHandler({ store, sourceContextService }),
    },
    {
      method: "POST",
      pattern: "/github/webhooks",
      customAuth: "githubWebhookSignature",
      corsMethods: ["POST"],
      bodyMode: "text",
      handler: createGitHubWebhooksHandler({ app, store, manifestService }),
    },
  ];
}

export function matchGitHubRoute(routes, method, pathname, { ignoreMethod = false } = {}) {
  for (const route of routes) {
    if (!ignoreMethod && route.method !== method) continue;
    const params = matchPattern(route.pattern, pathname);
    if (!params) continue;
    return {
      ...route,
      params,
    };
  }
  return null;
}

export function listGitHubRoutesForPath(routes, pathname) {
  return routes
    .map((route) => {
      const params = matchPattern(route.pattern, pathname);
      if (!params) return null;
      return {
        ...route,
        params,
      };
    })
    .filter(Boolean);
}

export function collectGitHubRouteMethods(routes, pathname) {
  const methods = listGitHubRoutesForPath(routes, pathname)
    .flatMap((route) => {
      if (Array.isArray(route.corsMethods) && route.corsMethods.length > 0) {
        return route.corsMethods;
      }
      return [route.method];
    })
    .map((method) => String(method || "").trim().toUpperCase())
    .filter(Boolean);

  return Array.from(new Set(methods));
}
