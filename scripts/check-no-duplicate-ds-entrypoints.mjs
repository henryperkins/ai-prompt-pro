import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { collectForbiddenDesignSystemEntrypointUsages } from "./check-no-duplicate-ds-entrypoints-lib.mjs";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const allowedEntrypointBridges = new Map([
  ["src/components/base/card.tsx", new Set(["@/components/base/primitives/card"])],
  ["src/components/base/drawer.tsx", new Set(["@/components/base/primitives/drawer"])],
  ["src/components/base/textarea.tsx", new Set(["@/components/base/textarea/textarea"])],
]);

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
  const fileViolations = collectForbiddenDesignSystemEntrypointUsages(source, relativePath);
  const allowedSpecifiers = allowedEntrypointBridges.get(relativePath);
  const filteredViolations = fileViolations.filter(
    (violation) => !allowedSpecifiers || !allowedSpecifiers.has(violation.specifier),
  );
  violations.push(...filteredViolations);
}

if (violations.length > 0) {
  console.error("Found duplicate/deprecated design-system entrypoint imports:");
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.line} [${violation.kind}] -> ${violation.specifier}`);
  }
  process.exit(1);
}

console.log("No duplicate/deprecated design-system entrypoint imports found.");
