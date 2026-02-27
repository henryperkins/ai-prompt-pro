#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsDir = path.join(repoRoot, "docs");

const isMarkdown = (filePath) => filePath.endsWith(".md");

function walkFiles(dirPath, predicate) {
  const out = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const relFromDocs = path.relative(docsDir, fullPath);
      const isDocsArchiveDir =
        !relFromDocs.startsWith("..") &&
        (relFromDocs === "archive" || relFromDocs.startsWith(`archive${path.sep}`));
      if (isDocsArchiveDir) {
        continue;
      }
      out.push(...walkFiles(fullPath, predicate));
      continue;
    }
    if (predicate(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function toRelative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function parseLocalLinkTarget(rawTarget, sourceFile) {
  const trimmed = rawTarget.trim().replace(/^<|>$/g, "");
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("javascript:")
  ) {
    return null;
  }

  const [cleanTarget] = trimmed.split(/[?#]/);
  if (!cleanTarget) {
    return null;
  }

  if (!/\.(md|mdx|html)$/i.test(cleanTarget)) {
    return null;
  }

  if (cleanTarget.startsWith("/")) {
    return path.join(repoRoot, cleanTarget.replace(/^\/+/, ""));
  }

  return path.resolve(path.dirname(sourceFile), cleanTarget);
}

function extractReferences(filePath, content) {
  const refs = [];

  const markdownLinkRegex = /\[[^\]]*]\(([^)]+)\)/g;
  let linkMatch;
  while ((linkMatch = markdownLinkRegex.exec(content)) !== null) {
    refs.push({ raw: linkMatch[1], kind: "markdown-link" });
  }

  const bareDocsPathRegex = /\bdocs\/[A-Za-z0-9._/-]+\.(?:md|mdx|html)\b/g;
  let bareMatch;
  while ((bareMatch = bareDocsPathRegex.exec(content)) !== null) {
    refs.push({ raw: bareMatch[0], kind: "bare-docs-path" });
  }

  return refs;
}

function checkMissingRefs(markdownFiles) {
  const missing = [];

  for (const filePath of markdownFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const refs = extractReferences(filePath, content);

    for (const ref of refs) {
      let resolvedPath = null;

      if (ref.kind === "bare-docs-path") {
        resolvedPath = path.join(repoRoot, ref.raw);
      } else {
        resolvedPath = parseLocalLinkTarget(ref.raw, filePath);
      }

      if (!resolvedPath) {
        continue;
      }

      if (!fs.existsSync(resolvedPath)) {
        missing.push({
          file: toRelative(filePath),
          reference: ref.raw,
          resolved: toRelative(resolvedPath),
        });
      }
    }
  }

  return missing;
}

function extractDocsIndexTargets(indexPath) {
  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const content = fs.readFileSync(indexPath, "utf8");
  const targets = new Set();
  const lines = content.split("\n");
  let inActiveSection = false;

  for (const line of lines) {
    if (/^##\s+Active operational docs/i.test(line)) {
      inActiveSection = true;
      continue;
    }

    if (inActiveSection && /^##\s+/.test(line)) {
      break;
    }

    if (!inActiveSection) {
      continue;
    }

    const pathRegex = /`(docs\/[^`]+\.(?:md|mdx|html))`/g;
    let match;
    while ((match = pathRegex.exec(line)) !== null) {
      const ref = match[1];
      if (!ref.includes("/archive/")) {
        targets.add(ref);
      }
    }
  }

  return [...targets];
}

function checkLastUpdated(targets) {
  const warnings = [];
  const dateLineRegex = /^Last updated:\s+\d{4}-\d{2}-\d{2}\s*$/im;

  for (const relPath of targets) {
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) {
      continue;
    }

    const content = fs.readFileSync(absPath, "utf8");
    const topChunk = content.split("\n").slice(0, 25).join("\n");
    if (!dateLineRegex.test(topChunk)) {
      warnings.push(relPath);
    }
  }

  return warnings;
}

function checkReviewSnapshotWarnings() {
  const reviewsDir = path.join(docsDir, "reviews");
  if (!fs.existsSync(reviewsDir)) {
    return [];
  }

  const reviewFiles = walkFiles(reviewsDir, isMarkdown).filter(
    (filePath) => path.basename(filePath).toLowerCase() !== "readme.md",
  );

  const missing = [];
  for (const filePath of reviewFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const topChunk = content.split("\n").slice(0, 30).join("\n");
    const hasSnapshotLine = topChunk.includes("> Historical snapshot.");
    const hasOperationalGuidanceLine = topChunk.includes(
      "> Do not treat this file as current operational guidance; use `docs/README.md` to find active docs.",
    );

    if (!hasSnapshotLine || !hasOperationalGuidanceLine) {
      missing.push(toRelative(filePath));
    }
  }

  return missing;
}

const markdownFiles = [
  path.join(repoRoot, "README.md"),
  ...walkFiles(docsDir, isMarkdown),
].filter((filePath) => fs.existsSync(filePath));

const missingRefs = checkMissingRefs(markdownFiles);

const freshnessTargets = extractDocsIndexTargets(path.join(docsDir, "README.md"));
const staleDateWarnings = checkLastUpdated(freshnessTargets);
const reviewWarningIssues = checkReviewSnapshotWarnings();

if (missingRefs.length > 0) {
  console.error("Documentation link check failed: missing local doc references found.");
  for (const item of missingRefs) {
    console.error(`- ${item.file}: "${item.reference}" -> ${item.resolved} (missing)`);
  }
  process.exit(1);
}

if (reviewWarningIssues.length > 0) {
  console.error("Documentation review snapshot check failed: missing standard historical warning block.");
  for (const relPath of reviewWarningIssues) {
    console.error(`- ${relPath}`);
  }
  process.exit(1);
}

console.log(`Documentation link check passed (${markdownFiles.length} markdown files scanned).`);

if (staleDateWarnings.length > 0) {
  console.warn("Documentation freshness warning: missing 'Last updated: YYYY-MM-DD' in top section.");
  for (const relPath of staleDateWarnings) {
    console.warn(`- ${relPath}`);
  }
  if (process.env.STRICT_DOC_DATES === "1") {
    process.exit(1);
  }
}
