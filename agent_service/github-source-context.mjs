const MAX_SUMMARY_CHARS = 1_200;
const MAX_RAW_CHARS = 8_000;

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

function clip(value, maxChars) {
  const normalized = normalizeString(value);
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function extractLeadingCommentSummary(content) {
  const normalized = normalizeString(content);
  if (!normalized) return "";

  const blockComment = normalized.match(/^\/\*\*?([\s\S]*?)\*\//);
  if (blockComment?.[1]) {
    return blockComment[1]
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(" ");
  }

  const hashCommentLines = normalized
    .split("\n")
    .filter((line) => /^\s*#/.test(line))
    .map((line) => line.replace(/^\s*#\s?/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
  if (hashCommentLines.length > 0) {
    return hashCommentLines.join(" ");
  }

  return "";
}

function collectNamedSymbols(content) {
  const normalized = normalizeString(content);
  if (!normalized) return [];

  const patterns = [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
    /\bexport\s+class\s+([A-Za-z0-9_$]+)/g,
    /\bexport\s+(?:interface|type|enum)\s+([A-Za-z0-9_$]+)/g,
    /\b(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
    /\bclass\s+([A-Za-z0-9_$]+)/g,
    /\binterface\s+([A-Za-z0-9_$]+)/g,
    /\btype\s+([A-Za-z0-9_$]+)/g,
    /^\s*def\s+([A-Za-z0-9_]+)/gm,
    /^\s*class\s+([A-Za-z0-9_]+)/gm,
    /^\s*func\s+(?:\([^)]+\)\s*)?([A-Za-z0-9_]+)/gm,
  ];

  const names = new Set();
  patterns.forEach((pattern) => {
    let match = pattern.exec(normalized);
    while (match) {
      if (match[1]) {
        names.add(match[1]);
      }
      match = pattern.exec(normalized);
    }
  });

  return Array.from(names).slice(0, 12);
}

function summarizeTextFile(path, content) {
  const lines = normalizeString(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const interestingLines = [];
  lines.forEach((line) => {
    if (interestingLines.length >= 8) return;
    if (/^#{1,6}\s+/.test(line) || /^[A-Za-z0-9_.-]+\s*:\s+/.test(line) || line.length > 20) {
      interestingLines.push(line);
    }
  });

  return clip([
    `Path: ${path}`,
    ...interestingLines,
  ].join("\n"), MAX_SUMMARY_CHARS);
}

export function summarizeGithubFile({ path, language, content }) {
  const normalizedPath = normalizeString(path);
  const normalizedLanguage = normalizeString(language);
  const normalizedContent = normalizeString(content);
  if (!normalizedContent) return clip(`Path: ${normalizedPath}`, MAX_SUMMARY_CHARS);

  const commentSummary = extractLeadingCommentSummary(normalizedContent);
  const symbolNames = collectNamedSymbols(normalizedContent);
  if (symbolNames.length === 0 && !normalizedLanguage) {
    return summarizeTextFile(normalizedPath, normalizedContent);
  }

  const lines = [
    `Path: ${normalizedPath}`,
    normalizedLanguage ? `Language: ${normalizedLanguage}` : "",
    symbolNames.length > 0 ? `Top-level symbols: ${symbolNames.join(", ")}` : "",
    commentSummary ? `Leading comment: ${commentSummary}` : "",
  ].filter(Boolean);

  return clip(lines.join("\n"), MAX_SUMMARY_CHARS);
}

export function sliceGithubFileForContext(content, maxChars = MAX_RAW_CHARS) {
  const normalized = normalizeString(content);
  if (!normalized) {
    return {
      rawContent: "",
      rawContentTruncated: false,
      originalCharCount: 0,
    };
  }
  if (normalized.length <= maxChars) {
    return {
      rawContent: normalized,
      rawContentTruncated: false,
      originalCharCount: normalized.length,
    };
  }
  return {
    rawContent: clip(normalized, maxChars),
    rawContentTruncated: true,
    originalCharCount: normalized.length,
  };
}

function decodeGitHubBlob(blob) {
  const encoding = normalizeString(blob?.encoding).toLowerCase();
  const content = normalizeString(blob?.content);
  if (encoding !== "base64" || !content) return "";
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

export function createGitHubSourceContextService({
  app,
  manifestService,
} = {}) {
  async function buildFilePreview({ userId, connection, path }) {
    const snapshot = await manifestService.findEntry({ userId, connection, path });
    const installationId = Number(
      connection.installation?.github_installation_id || connection.installation?.githubInstallationId,
    );
    const owner = connection.owner_login || connection.ownerLogin;
    const repo = connection.repo_name || connection.repoName;
    const blob = await app.getBlob(owner, repo, snapshot.entry.sha, installationId);
    const content = decodeGitHubBlob(blob);
    const sliced = sliceGithubFileForContext(content, MAX_RAW_CHARS);
    return {
      path: snapshot.entry.path,
      language: snapshot.entry.language,
      size: snapshot.entry.size,
      sha: snapshot.entry.sha,
      truncated: sliced.rawContentTruncated,
      locator: `${connection.full_name || connection.fullName}:${snapshot.entry.path}`,
      content: sliced.rawContent,
      originalCharCount: sliced.originalCharCount,
    };
  }

  async function buildContextSources({ userId, connection, paths, selection }) {
    const manifestSnapshot = await manifestService.getManifestSnapshot({ userId, connection });
    const installationId = Number(
      connection.installation?.github_installation_id || connection.installation?.githubInstallationId,
    );
    const owner = connection.owner_login || connection.ownerLogin;
    const repo = connection.repo_name || connection.repoName;
    const repoFullName = connection.full_name || connection.fullName;
    const commitSha = normalizeString(
      manifestSnapshot.manifestRow.tree_sha || manifestSnapshot.manifestRow.treeSha,
    );

    const selectedPaths = Array.from(new Set(Array.isArray(paths) ? paths : [])).filter(Boolean);
    const sources = [];

    for (const path of selectedPaths) {
      const entry = manifestSnapshot.manifestRow.manifest.find((item) => item.path === path);
      if (!entry) continue;
      const blob = await app.getBlob(owner, repo, entry.sha, installationId);
      const content = decodeGitHubBlob(blob);
      const sliced = sliceGithubFileForContext(content, MAX_RAW_CHARS);
      const range = selection?.[path];
      sources.push({
        id: `github:${connection.github_repo_id || connection.githubRepoId}:${commitSha}:${entry.path}`,
        type: "github",
        title: `${repoFullName}:${entry.path}`,
        rawContent: sliced.rawContent,
        rawContentTruncated: sliced.rawContentTruncated,
        originalCharCount: sliced.originalCharCount,
        expandable: true,
        summary: summarizeGithubFile({
          path: entry.path,
          language: entry.language,
          content,
        }),
        addedAt: Date.now(),
        reference: {
          kind: "github",
          refId: `github:${connection.github_repo_id || connection.githubRepoId}:${commitSha}:${entry.path}`,
          locator: `${repoFullName}@${commitSha}:${entry.path}`,
          permissionScope: `github-installation:${installationId}`,
        },
        validation: {
          status: "valid",
          checkedAt: Date.now(),
          message: range?.startLine || range?.endLine
            ? `Prepared from ${entry.path} (line range support pending full extraction).`
            : undefined,
        },
      });
    }

    return sources;
  }

  return {
    buildContextSources,
    buildFilePreview,
  };
}
