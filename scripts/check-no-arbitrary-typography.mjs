import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { collectArbitraryTypographyUsages } from "./check-no-arbitrary-typography-lib.mjs";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);

function shouldSkipFile(relativePath) {
  if (relativePath.startsWith("src/test/")) {
    return true;
  }
  if (relativePath.includes(".stories.")) {
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

  const refs = collectArbitraryTypographyUsages(source, relativePath);
  for (const ref of refs) {
    violations.push(`${ref.filePath}:${ref.line} -> ${ref.value}`);
  }
}

if (violations.length > 0) {
  console.error("Found arbitrary typography utilities in source (use tokenized text sizes and shared label utilities instead):");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("No arbitrary typography utilities found in scanned source files.");
