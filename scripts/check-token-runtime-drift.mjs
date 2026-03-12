import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  collectTokenRuntimeClasses,
  findMissingTokenRuntimeClasses,
  shouldScanTokenRuntimeFile,
} from "./check-token-runtime-drift-lib.mjs";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const distAssetsRoot = path.join(projectRoot, "dist", "assets");

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(absolutePath);
      continue;
    }
    yield absolutePath;
  }
}

const tokenRuntimeClasses = new Set();
for await (const filePath of walk(srcRoot)) {
  const relativePath = path.relative(projectRoot, filePath).split(path.sep).join("/");
  if (!shouldScanTokenRuntimeFile(relativePath)) {
    continue;
  }

  const source = await readFile(filePath, "utf8");
  for (const className of collectTokenRuntimeClasses(source, relativePath)) {
    tokenRuntimeClasses.add(className);
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
const missing = findMissingTokenRuntimeClasses([...tokenRuntimeClasses], builtCss);

if (missing.length > 0) {
  console.error("Token/runtime drift detected: token-backed design-system classes referenced in source but missing from built CSS.");
  for (const cls of missing) {
    console.error(`- ${cls}`);
  }
  process.exit(1);
}

console.log(`Token/runtime drift check passed (${tokenRuntimeClasses.size} classes validated).`);
