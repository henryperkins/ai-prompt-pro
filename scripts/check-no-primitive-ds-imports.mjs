import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { collectForbiddenModulePathUsages, FORBIDDEN_PRIMITIVE_IMPORTS } from "./check-no-primitive-ds-imports-lib.mjs";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const strictMode = process.env.STRICT_PRIMITIVE_IMPORTS === "1";
const designSystemInternalPrefixes = [
  "src/components/base/",
  "src/components/application/",
  "src/components/foundations/",
  "src/components/marketing/",
  "src/components/fantasy/",
];

function shouldSkipFile(relativePath) {
  if (relativePath.startsWith("src/test/")) {
    return true;
  }
  if (designSystemInternalPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
    return true;
  }
  return false;
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
  const relativePath = path.relative(projectRoot, filePath);
  if (shouldSkipFile(relativePath)) {
    continue;
  }
  const references = collectForbiddenModulePathUsages(source, relativePath, FORBIDDEN_PRIMITIVE_IMPORTS);
  for (const reference of references) {
    violations.push(`${reference.filePath}:${reference.line} [${reference.kind}] -> ${reference.specifier}`);
  }
}

if (violations.length === 0) {
  console.log("No deprecated primitive design-system imports found.");
  process.exit(0);
}

const modeLabel = strictMode ? "ERROR" : "WARN";
console[strictMode ? "error" : "warn"](`[${modeLabel}] Found deprecated primitive design-system imports:`);
for (const violation of violations) {
  console[strictMode ? "error" : "warn"](`- ${violation}`);
}

if (strictMode) {
  process.exit(1);
}

console.warn("Set STRICT_PRIMITIVE_IMPORTS=1 to fail CI on these imports.");
