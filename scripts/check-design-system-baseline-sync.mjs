#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const baselinePath = path.join(projectRoot, "docs", "design-system-baseline-inventory.md");
const generatorPath = path.join(projectRoot, "scripts", "generate-design-system-baseline.mjs");

async function main() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "promptforge-ds-baseline-"));
  const generatedPath = path.join(tempDir, "design-system-baseline-inventory.generated.md");

  try {
    await execFileAsync(process.execPath, [generatorPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        DESIGN_SYSTEM_BASELINE_OUTPUT_PATH: generatedPath,
      },
      maxBuffer: 10 * 1024 * 1024,
    });

    const [currentContent, generatedContent] = await Promise.all([
      readFile(baselinePath, "utf8"),
      readFile(generatedPath, "utf8"),
    ]);

    if (currentContent !== generatedContent) {
      console.error("Design-system baseline inventory is out of sync.");
      console.error("Run `npm run report:design-system-baseline` and commit the updated docs/design-system-baseline-inventory.md.");
      process.exit(1);
    }

    console.log("Design-system baseline inventory is synchronized.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
