import { createGitHubError } from "./github-errors.mjs";

const MAX_FILE_SIZE_BYTES = 200 * 1024;
const DEFAULT_MANIFEST_LIMIT = 100;
const DEFAULT_REF_NAME = "default";
const TREE_TRAVERSAL_MAX_TREES = 500;
const TREE_TRAVERSAL_MAX_ENTRIES = 25_000;

const GENERATED_DIR_PREFIXES = [
  "dist/",
  "build/",
  "coverage/",
  ".next/",
  "out/",
  "target/",
];
const VENDORED_DIR_PREFIXES = [
  "node_modules/",
  "vendor/",
  "Pods/",
];
const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  "Gemfile.lock",
  "poetry.lock",
  "composer.lock",
  "Podfile.lock",
]);
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svgz",
  ".pdf",
  ".zip",
  ".gz",
  ".tgz",
  ".7z",
  ".dmg",
  ".exe",
  ".dll",
  ".so",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".wasm",
  ".jar",
  ".pyc",
  ".class",
]);

const LANGUAGE_BY_EXTENSION = {
  ".cjs": "JavaScript",
  ".conf": "Config",
  ".css": "CSS",
  ".csv": "CSV",
  ".env": "Environment",
  ".go": "Go",
  ".graphql": "GraphQL",
  ".h": "C",
  ".html": "HTML",
  ".java": "Java",
  ".js": "JavaScript",
  ".json": "JSON",
  ".jsx": "JSX",
  ".md": "Markdown",
  ".mjs": "JavaScript",
  ".py": "Python",
  ".rb": "Ruby",
  ".rs": "Rust",
  ".scss": "SCSS",
  ".sh": "Shell",
  ".sql": "SQL",
  ".toml": "TOML",
  ".ts": "TypeScript",
  ".tsx": "TSX",
  ".txt": "Text",
  ".yaml": "YAML",
  ".yml": "YAML",
};

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function lower(value) {
  return normalizeString(value).toLowerCase();
}

function extname(path) {
  const fileName = normalizeString(path).split("/").pop() || "";
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function dirname(path) {
  const segments = normalizeString(path).split("/");
  segments.pop();
  return segments.join("/");
}

function basename(path) {
  const segments = normalizeString(path).split("/");
  return segments[segments.length - 1] || "";
}

function isGeneratedPath(path) {
  const normalized = normalizeString(path);
  return GENERATED_DIR_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isVendoredPath(path) {
  const normalized = normalizeString(path);
  return VENDORED_DIR_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isLockfile(path) {
  return LOCKFILE_NAMES.has(basename(path));
}

function isMinifiedAsset(path) {
  return /\.min\.(js|css)$/i.test(path);
}

function isBinaryPath(path) {
  return BINARY_EXTENSIONS.has(extname(path));
}

function inferLanguage(path) {
  return LANGUAGE_BY_EXTENSION[extname(path)] || "";
}

function buildRecommendedRank(path) {
  const normalized = lower(path);
  let rank = 0;
  if (normalized === "readme.md" || normalized.endsWith("/readme.md")) rank += 500;
  if (normalized === "package.json") rank += 250;
  if (normalized.startsWith("src/")) rank += 120;
  if (normalized.startsWith("docs/")) rank += 100;
  if (normalized.includes("config")) rank += 40;
  rank -= normalized.length;
  return rank;
}

function shouldIncludeEntry(entry) {
  if (entry.type !== "blob") return false;
  if (!entry.path || entry.size > MAX_FILE_SIZE_BYTES) return false;
  if (isGeneratedPath(entry.path) || isVendoredPath(entry.path)) return false;
  if (isLockfile(entry.path) || isMinifiedAsset(entry.path) || isBinaryPath(entry.path)) return false;
  return true;
}

function normalizeManifestEntry(entry) {
  return {
    path: entry.path,
    name: basename(entry.path),
    extension: extname(entry.path),
    directory: dirname(entry.path),
    size: Number.isFinite(entry.size) ? entry.size : 0,
    sha: entry.sha,
    language: inferLanguage(entry.path),
    binary: isBinaryPath(entry.path),
    generated: isGeneratedPath(entry.path),
    vendored: isVendoredPath(entry.path),
    recommendedRank: buildRecommendedRank(entry.path),
  };
}

function upsertLru(map, key, value, maxEntries) {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  while (map.size > maxEntries) {
    const firstKey = map.keys().next().value;
    if (!firstKey) break;
    map.delete(firstKey);
  }
}

function findManifestEntry(manifest, path) {
  return manifest.find((entry) => entry.path === path) || null;
}

function scoreSearchEntry(entry, query) {
  const normalizedQuery = lower(query);
  if (!normalizedQuery) return entry.recommendedRank;

  const entryPath = lower(entry.path);
  const entryName = lower(entry.name);
  const directory = lower(entry.directory);

  if (entryName === normalizedQuery) return 5_000 + entry.recommendedRank;
  if (entryPath.endsWith(`/${normalizedQuery}`) || entryPath === normalizedQuery) {
    return 4_000 + entry.recommendedRank;
  }
  if (directory.includes(normalizedQuery) && entryName.includes(normalizedQuery)) {
    return 3_000 + entry.recommendedRank;
  }
  if (entryPath.includes(normalizedQuery) || entryName.includes(normalizedQuery)) {
    return 2_000 + entry.recommendedRank;
  }
  return Number.NEGATIVE_INFINITY;
}

export function searchManifestEntries(manifest, query, limit = DEFAULT_MANIFEST_LIMIT) {
  const normalizedLimit = Math.max(1, Math.min(DEFAULT_MANIFEST_LIMIT, Number(limit) || DEFAULT_MANIFEST_LIMIT));
  const normalizedQuery = normalizeString(query);
  const ranked = manifest
    .map((entry) => ({
      entry,
      score: scoreSearchEntry(entry, normalizedQuery),
    }))
    .filter((item) => normalizedQuery ? item.score > Number.NEGATIVE_INFINITY : true)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.entry.path.localeCompare(right.entry.path);
    })
    .slice(0, normalizedLimit)
    .map((item) => item.entry);

  return ranked;
}

export async function collectDefaultBranchTree(app, connection) {
  const owner = connection.owner_login || connection.ownerLogin;
  const repo = connection.repo_name || connection.repoName;
  const defaultBranch = connection.default_branch || connection.defaultBranch;
  const installationId = Number(connection.installation?.github_installation_id || connection.installation?.githubInstallationId);

  let branch;
  try {
    branch = await app.getBranch(owner, repo, defaultBranch, installationId);
  } catch (error) {
    // --- Diagnostic: detect stale repo metadata ---
    const message = typeof error?.message === "string" ? error.message : "";
    const status = Number(error?.status);
    if (status === 404 || message.toLowerCase().includes("not found")) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        event: "github_manifest_stale_repo_metadata",
        message:
          `GitHub returned 404 for ${owner}/${repo} branch ${defaultBranch}. `
          + "The repo may have been renamed, transferred, deleted, or had its default branch changed. "
          + "Connection metadata should be refreshed from the repository id before retrying.",
        owner,
        repo,
        default_branch: defaultBranch,
        installation_id: installationId,
        connection_id: connection.id,
        full_name: connection.full_name || connection.fullName,
      }));
    }
    // --- End diagnostic ---
    throw error;
  }
  const rootTreeSha = normalizeString(branch?.commit?.commit?.tree?.sha);
  const commitSha = normalizeString(branch?.commit?.sha);
  if (!rootTreeSha || !commitSha) {
    throw createGitHubError(
      "GitHub repository branch metadata is incomplete.",
      "github_request_failed",
      502,
    );
  }

  const recursiveTree = await app.getTree(owner, repo, rootTreeSha, installationId, {
    recursive: true,
  });
  if (recursiveTree?.truncated !== true) {
    return {
      commitSha,
      treeSha: rootTreeSha,
      entries: Array.isArray(recursiveTree?.tree) ? recursiveTree.tree : [],
    };
  }

  const queue = [{
    treeSha: rootTreeSha,
    prefix: "",
  }];
  const collectedEntries = [];
  let traversedTrees = 0;

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    traversedTrees += 1;
    if (traversedTrees > TREE_TRAVERSAL_MAX_TREES) {
      throw createGitHubError(
        "GitHub repository tree is too large to index safely.",
        "github_manifest_too_large",
        422,
      );
    }

    const treeResponse = await app.getTree(owner, repo, next.treeSha, installationId);
    const treeEntries = Array.isArray(treeResponse?.tree) ? treeResponse.tree : [];
    treeEntries.forEach((entry) => {
      const rawPath = normalizeString(entry.path);
      const resolvedPath = next.prefix ? `${next.prefix}/${rawPath}` : rawPath;
      if (entry.type === "tree") {
        queue.push({
          treeSha: entry.sha,
          prefix: resolvedPath,
        });
        return;
      }

      collectedEntries.push({
        ...entry,
        path: resolvedPath,
      });
    });

    if (collectedEntries.length > TREE_TRAVERSAL_MAX_ENTRIES) {
      throw createGitHubError(
        "GitHub repository file list exceeds the supported safety cap.",
        "github_manifest_too_large",
        422,
      );
    }
  }

  return {
    commitSha,
    treeSha: rootTreeSha,
    entries: collectedEntries,
  };
}

export function normalizeManifestEntries(entries) {
  return entries
    .filter(shouldIncludeEntry)
    .map(normalizeManifestEntry)
    .sort((left, right) => left.path.localeCompare(right.path));
}

function getConnectionRepoId(connection) {
  return Number(connection?.github_repo_id || connection?.githubRepoId);
}

function getConnectionInstallationId(connection) {
  return Number(
    connection?.installation?.github_installation_id || connection?.installation?.githubInstallationId,
  );
}

function getConnectionInstallationRecordId(connection) {
  return normalizeString(connection?.installation_record_id || connection?.installationRecordId);
}

function getInstallationRecordId(installation) {
  return normalizeString(installation?.id);
}

function getInstallationGithubInstallationId(installation) {
  return Number(installation?.github_installation_id || installation?.githubInstallationId);
}

function getConnectionOwner(connection) {
  return normalizeString(connection?.owner_login || connection?.ownerLogin);
}

function getConnectionRepoName(connection) {
  return normalizeString(connection?.repo_name || connection?.repoName);
}

function getConnectionFullName(connection) {
  return normalizeString(connection?.full_name || connection?.fullName);
}

function getConnectionDefaultBranch(connection) {
  return normalizeString(connection?.default_branch || connection?.defaultBranch);
}

function getConnectionVisibility(connection) {
  return normalizeString(connection?.visibility);
}

function getConnectionIsPrivate(connection) {
  return connection?.is_private === true || connection?.isPrivate === true;
}

function mergeConnectionInstallation(connection, installation) {
  const installationRecordId = getInstallationRecordId(installation) || getConnectionInstallationRecordId(connection);
  const githubInstallationId = getInstallationGithubInstallationId(installation) || getConnectionInstallationId(connection);

  return {
    ...connection,
    installation_record_id: installationRecordId,
    installationRecordId: installationRecordId,
    installation: {
      ...(connection.installation || {}),
      ...(installation || {}),
      id: installationRecordId,
      github_installation_id: githubInstallationId,
      githubInstallationId,
    },
  };
}

function mergeConnectionRepositoryMetadata(connection, repo) {
  const ownerLogin = repo.owner?.login || getConnectionOwner(connection);
  const repoName = repo.name || getConnectionRepoName(connection);
  const fullName = repo.full_name || [ownerLogin, repoName].filter(Boolean).join("/");
  const defaultBranch = repo.default_branch || getConnectionDefaultBranch(connection);
  const visibility = repo.visibility || (repo.private ? "private" : "public");
  const isPrivate = repo.private === true;

  return {
    ...connection,
    github_repo_id: Number(repo.id) || getConnectionRepoId(connection),
    githubRepoId: Number(repo.id) || getConnectionRepoId(connection),
    owner_login: ownerLogin,
    ownerLogin,
    repo_name: repoName,
    repoName,
    full_name: fullName,
    fullName,
    default_branch: defaultBranch,
    defaultBranch,
    visibility,
    is_private: isPrivate,
    isPrivate,
  };
}

function repositoryMetadataChanged(connection, repo) {
  return (
    getConnectionOwner(connection) !== normalizeString(repo.owner?.login)
    || getConnectionRepoName(connection) !== normalizeString(repo.name)
    || getConnectionFullName(connection) !== normalizeString(repo.full_name)
    || getConnectionDefaultBranch(connection) !== normalizeString(repo.default_branch)
    || getConnectionVisibility(connection) !== normalizeString(
      repo.visibility || (repo.private ? "private" : "public"),
    )
    || getConnectionIsPrivate(connection) !== (repo.private === true)
  );
}

function isUsableManifestRow(row) {
  return Boolean(
    row
    && !row.invalidated_at
    && Date.parse(row.expires_at) > Date.now()
    && Array.isArray(row.manifest),
  );
}

function getCachedManifestRow(cache, cacheKey) {
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(cacheKey);
    return null;
  }
  return cached.row;
}

function isRepositoryLookupNotFound(error) {
  const status = Number(error?.status);
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  return status === 404 || message.includes("not found");
}

export function createGitHubManifestService({
  app,
  store,
  ttlMs = 15 * 60_000,
  maxEntries = 25,
} = {}) {
  const cache = new Map();

  function buildCacheKey(connectionId, refName = DEFAULT_REF_NAME) {
    return `${connectionId}:${refName}`;
  }

  async function loadUsableManifestRow({ userId, connectionId }) {
    const cacheKey = buildCacheKey(connectionId, DEFAULT_REF_NAME);
    const cachedRow = getCachedManifestRow(cache, cacheKey);
    if (cachedRow) {
      return {
        manifestRow: cachedRow,
        fromCache: true,
      };
    }

    const stored = await store.getManifest(userId, connectionId, DEFAULT_REF_NAME);
    if (!isUsableManifestRow(stored)) {
      return {
        manifestRow: null,
        fromCache: false,
      };
    }

    upsertLru(cache, cacheKey, {
      expiresAt: Date.parse(stored.expires_at),
      row: stored,
    }, maxEntries);

    return {
      manifestRow: stored,
      fromCache: false,
    };
  }

  async function findRepositoryByAnyActiveInstallation(userId, connection, currentInstallationId) {
    if (typeof store?.listInstallations !== "function") return null;
    const installations = await store.listInstallations(userId);
    for (const installation of installations) {
      const githubInstallationId = getInstallationGithubInstallationId(installation);
      if (!Number.isFinite(githubInstallationId) || githubInstallationId === currentInstallationId) continue;
      try {
        const repository = await app.getRepositoryById(getConnectionRepoId(connection), githubInstallationId);
        if (typeof store?.rebindConnectionToInstallationRecord === "function") {
          await store.rebindConnectionToInstallationRecord(connection.id, installation.id);
        }
        return {
          repository,
          connection: mergeConnectionInstallation(connection, installation),
        };
      } catch (error) {
        if (isRepositoryLookupNotFound(error)) continue;
        throw error;
      }
    }

    return null;
  }

  async function resolveConnectionRepositoryMetadata(userId, connection) {
    const installationId = getConnectionInstallationId(connection);
    const repoId = getConnectionRepoId(connection);
    if (!Number.isFinite(installationId) || !Number.isFinite(repoId) || typeof app?.getRepositoryById !== "function") {
      return {
        connection,
        manifestMustRefresh: false,
      };
    }

    let repository;
    let effectiveConnection = connection;
    try {
      repository = await app.getRepositoryById(repoId, installationId);
    } catch (error) {
      if (!isRepositoryLookupNotFound(error)) throw error;
      const rebound = await findRepositoryByAnyActiveInstallation(userId, connection, installationId);
      if (!rebound) throw error;
      repository = rebound.repository;
      effectiveConnection = rebound.connection;
    }

    if (!repositoryMetadataChanged(effectiveConnection, repository)) {
      return {
        connection: effectiveConnection,
        manifestMustRefresh: false,
      };
    }

    const nextConnection = mergeConnectionRepositoryMetadata(effectiveConnection, repository);
    if (typeof store?.syncConnectionRepositoryMetadata === "function") {
      await store.syncConnectionRepositoryMetadata(connection.id, repository);
    }

    return {
      connection: nextConnection,
      manifestMustRefresh: getConnectionDefaultBranch(connection) !== getConnectionDefaultBranch(nextConnection),
    };
  }

  async function getManifestSnapshot({
    userId,
    connection,
    forceRefresh = false,
  }) {
    const cacheKey = buildCacheKey(connection.id, DEFAULT_REF_NAME);
    const fallbackManifest = await loadUsableManifestRow({
      userId,
      connectionId: connection.id,
    });

    let resolved = {
      connection,
      manifestMustRefresh: false,
    };
    let metadataError = null;
    try {
      resolved = await resolveConnectionRepositoryMetadata(userId, connection);
    } catch (error) {
      metadataError = error;
      if (!fallbackManifest.manifestRow) throw error;
    }

    const effectiveConnection = resolved.connection;
    const forceManifestRefresh = forceRefresh || resolved.manifestMustRefresh;
    if (metadataError && fallbackManifest.manifestRow) {
      return {
        manifestRow: fallbackManifest.manifestRow,
        staleFallback: true,
        staleError: metadataError,
        connection: effectiveConnection,
      };
    }

    const connectionId = effectiveConnection.id;
    if (!forceManifestRefresh && fallbackManifest.manifestRow) {
      return {
        manifestRow: fallbackManifest.manifestRow,
        staleFallback: false,
        connection: effectiveConnection,
      };
    }

    try {
      const tree = await collectDefaultBranchTree(app, effectiveConnection);
      const manifest = normalizeManifestEntries(tree.entries);
      const expiresAt = new Date(Date.now() + ttlMs);
      const saved = await store.upsertManifest({
        userId,
        repoConnectionId: connectionId,
        refName: DEFAULT_REF_NAME,
        treeSha: tree.treeSha,
        entryCount: manifest.length,
        manifest,
        isComplete: true,
        lastError: null,
        generatedAt: new Date(),
        expiresAt,
        invalidatedAt: null,
      });
      upsertLru(cache, cacheKey, {
        expiresAt: Date.parse(saved.expires_at),
        row: saved,
      }, maxEntries);
      return {
        manifestRow: saved,
        staleFallback: false,
        connection: effectiveConnection,
      };
    } catch (error) {
      if (!resolved.manifestMustRefresh && fallbackManifest.manifestRow) {
        return {
          manifestRow: fallbackManifest.manifestRow,
          staleFallback: true,
          staleError: error,
          connection: effectiveConnection,
        };
      }
      throw error;
    }
  }

  async function refreshManifest({ userId, connection }) {
    return getManifestSnapshot({
      userId,
      connection,
      forceRefresh: true,
    });
  }

  async function searchManifest({ userId, connection, query, limit }) {
    const snapshot = await getManifestSnapshot({ userId, connection });
    return {
      ...snapshot,
      results: searchManifestEntries(snapshot.manifestRow.manifest, query, limit),
    };
  }

  async function findEntry({ userId, connection, path }) {
    const snapshot = await getManifestSnapshot({ userId, connection });
    const entry = findManifestEntry(snapshot.manifestRow.manifest, path);
    if (!entry) {
      throw createGitHubError(
        "The requested file was not found in the cached repository manifest.",
        "github_file_not_found",
        404,
      );
    }
    return {
      ...snapshot,
      entry,
    };
  }

  async function invalidateConnection(connectionId) {
    cache.delete(buildCacheKey(connectionId, DEFAULT_REF_NAME));
    await store.invalidateManifestByConnection(connectionId);
  }

  return {
    findEntry,
    getManifestSnapshot,
    invalidateConnection,
    refreshManifest,
    searchManifest,
  };
}
