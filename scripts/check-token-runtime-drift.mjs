import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const distAssetsRoot = path.join(projectRoot, "dist", "assets");
const sourceExtensions = new Set([".ts", ".tsx"]);
const classPattern = /\b(?:bg|text|ring|border|outline|shadow)-[a-z0-9_/-]+\b/g;
const legacyMarkers = [
  "brand",
  "utility",
  "tertiary",
  "quaternary",
  "disabled",
  "error_",
  "fg-",
  "primary_hover",
  "secondary_hover",
  "placeholder",
  "focus-ring",
  "skeumorphic",
  "tooltip-supporting-text",
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

const sourceByFile = new Map();
for await (const filePath of walk(srcRoot)) {
  sourceByFile.set(filePath, await readFile(filePath, "utf8"));
}

const candidateClasses = new Set();
for (const source of sourceByFile.values()) {
  for (const match of source.matchAll(classPattern)) {
    const cls = match[0];
    if (legacyMarkers.some((marker) => cls.includes(marker))) {
      candidateClasses.add(cls);
    }
  }
  if (source.includes("text-md")) {
    candidateClasses.add("text-md");
  }
}

let cssChunks;
try {
  const entries = await readdir(distAssetsRoot, { withFileTypes: true });
  cssChunks = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
      .map((entry) => readFile(path.join(distAssetsRoot, entry.name), "utf8")),
  );
} catch {
  console.error("Build assets not found. Run `npm run build` before `check:token-runtime`.");
  process.exit(1);
}

if (cssChunks.length === 0) {
  console.error("No built CSS assets found in dist/assets. Run `npm run build` first.");
  process.exit(1);
}

const builtCss = cssChunks.join("\n");
const missing = [...candidateClasses].filter((cls) => !builtCss.includes(cls)).sort();

if (missing.length > 0) {
  console.error("Token/runtime drift detected: classes referenced in source but missing from built CSS.");
  for (const cls of missing) {
    console.error(`- ${cls}`);
  }
  process.exit(1);
}

console.log(`Token/runtime drift check passed (${candidateClasses.size} classes validated).`);
