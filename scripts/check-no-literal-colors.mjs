import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { collectLiteralColorUsages } from "./check-no-literal-colors-lib.mjs";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);

const ignoredPathPrefixes = [
  "src/test/",
  "src/components/icons/",
  "src/components/foundations/logo/",
  "src/components/foundations/payment-icons/",
  "src/components/fantasy/",
];

function shouldSkipFile(relativePath) {
  if (relativePath.includes(".stories.")) {
    return true;
  }
  return ignoredPathPrefixes.some((prefix) => relativePath.startsWith(prefix));
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
  const refs = collectLiteralColorUsages(source, relativePath);
  for (const ref of refs) {
    violations.push(`${ref.filePath}:${ref.line} [${ref.kind}] -> ${ref.value}`);
  }
}

if (violations.length > 0) {
  console.error("Found literal color values in source (use semantic tokens/classes instead):");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("No literal color values found in scanned source files.");
