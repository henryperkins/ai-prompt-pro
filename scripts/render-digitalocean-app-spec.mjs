#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const [sourcePath = ".do/app.yaml", outputPath] = process.argv.slice(2);
const absoluteSourcePath = path.resolve(process.cwd(), sourcePath);
const source = fs.readFileSync(absoluteSourcePath, "utf8");
const missing = new Set();

const rendered = source.replace(/\$\{([A-Z0-9_]+)(:-)?\}/g, (_match, envName, optionalMarker) => {
  const value = process.env[envName];
  if (typeof value !== "string" || value.length === 0) {
    if (optionalMarker) {
      return "\"\"";
    }
    missing.add(envName);
    return "\"\"";
  }

  return JSON.stringify(value);
});

if (missing.size > 0) {
  console.error(`Missing required env for app spec render: ${[...missing].sort().join(", ")}`);
  process.exit(1);
}

if (outputPath) {
  fs.writeFileSync(path.resolve(process.cwd(), outputPath), rendered);
} else {
  process.stdout.write(rendered);
}
