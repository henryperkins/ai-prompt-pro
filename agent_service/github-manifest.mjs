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
          + "The repo may have been renamed, transferred, or the default branch changed since the connection was created. "
          + "The 'repository' webhook event is not handled, so connection metadata is never updated.",
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

  async function getManifestSnapshot({
    userId,
    connection,
    forceRefresh = false,
  }) {
    const connectionId = connection.id;
    const cacheKey = buildCacheKey(connectionId, DEFAULT_REF_NAME);
    const cached = cache.get(cacheKey);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return {
        manifestRow: cached.row,
        staleFallback: false,
      };
    }

    const stored = await store.getManifest(userId, connectionId, DEFAULT_REF_NAME);
    if (
      !forceRefresh &&
      stored &&
      !stored.invalidated_at
      && Date.parse(stored.expires_at) > Date.now()
      && Array.isArray(stored.manifest)
    ) {
      upsertLru(cache, cacheKey, {
        expiresAt: Date.parse(stored.expires_at),
        row: stored,
      }, maxEntries);
      return {
        manifestRow: stored,
        staleFallback: false,
      };
    }

    try {
      const tree = await collectDefaultBranchTree(app, connection);
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
      };
    } catch (error) {
      if (stored && Array.isArray(stored.manifest)) {
        return {
          manifestRow: stored,
          staleFallback: true,
          staleError: error,
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

