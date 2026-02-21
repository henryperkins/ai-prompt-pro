import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const forbiddenImportPrefixes = ["@/components/ui/", "@/components/base/compat/"];
const importSpecifierPatterns = [
  /(?:^|\n)\s*import\s+[^'"\n]*from\s*["']([^"']+)["']/g,
  /(?:^|\n)\s*import\s*["']([^"']+)["']/g,
  /(?:^|\n)\s*export\s+[^'"\n]*from\s*["']([^"']+)["']/g,
  /import\(\s*["']([^"']+)["']\s*\)/g,
];

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

function lineNumberAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function collectImportSpecifiers(source) {
  const specifiers = [];
  for (const pattern of importSpecifierPatterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.push({
        specifier: match[1],
        line: lineNumberAt(source, match.index),
      });
    }
    pattern.lastIndex = 0;
  }
  return specifiers;
}

const violations = [];
for await (const filePath of walk(srcRoot)) {
  const source = await readFile(filePath, "utf8");
  const specifiers = collectImportSpecifiers(source);
  for (const { specifier, line } of specifiers) {
    if (forbiddenImportPrefixes.some((prefix) => specifier.startsWith(prefix))) {
      const relativePath = path.relative(projectRoot, filePath);
      violations.push(`${relativePath}:${line} -> ${specifier}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Found forbidden legacy component imports:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("No forbidden legacy component imports found.");
