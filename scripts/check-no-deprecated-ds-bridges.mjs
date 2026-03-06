import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  collectForbiddenBridgeImportUsages,
  collectLegacyThemeClassCompatibilityUsages,
  collectLegacyThemeSelectorUsages,
  collectRestrictedStyleImportUsages,
} from "./check-no-deprecated-ds-bridges-lib.mjs";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx", ".css"]);
const legacyThemeClassAllowlist = new Set(["src/hooks/useTheme.tsx"]);
const legacyThemeSelectorAllowlist = new Set([
  "src/styles/components.css",
  "src/styles/globals.css",
  "src/styles/tokens.css",
]);

function isTestOrStoryFile(relativePath) {
  return relativePath.startsWith("src/test/") || relativePath.includes(".stories.");
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(absolutePath);
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) {
      yield absolutePath;
    }
  }
}

const violations = [];

for await (const filePath of walk(srcRoot)) {
  const source = await readFile(filePath, "utf8");
  const relativePath = path.relative(projectRoot, filePath).replaceAll("\\", "/");
  const extension = path.extname(filePath);

  if (extension === ".ts" || extension === ".tsx") {
    const bridgeImportViolations = collectForbiddenBridgeImportUsages(source, relativePath);
    for (const violation of bridgeImportViolations) {
      violations.push(`${violation.filePath}:${violation.line} [${violation.kind}] -> ${violation.specifier}`);
    }

    if (!isTestOrStoryFile(relativePath) && !legacyThemeClassAllowlist.has(relativePath)) {
      const themeClassViolations = collectLegacyThemeClassCompatibilityUsages(source, relativePath);
      for (const violation of themeClassViolations) {
        violations.push(`${violation.filePath}:${violation.line} [${violation.kind}] -> "${violation.value}"`);
      }
    }
  }

  if (extension === ".css") {
    const styleImportViolations = collectRestrictedStyleImportUsages(source, relativePath);
    for (const violation of styleImportViolations) {
      violations.push(
        `${violation.filePath}:${violation.line} [${violation.kind}:${violation.rule}] -> ${violation.specifier}`,
      );
    }

    if (!legacyThemeSelectorAllowlist.has(relativePath)) {
      const themeSelectorViolations = collectLegacyThemeSelectorUsages(source, relativePath);
      for (const violation of themeSelectorViolations) {
        violations.push(`${violation.filePath}:${violation.line} [${violation.kind}] -> ${violation.value}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Found deprecated design-system bridge or compatibility alias usage:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("No deprecated design-system bridge or compatibility alias usage found.");
