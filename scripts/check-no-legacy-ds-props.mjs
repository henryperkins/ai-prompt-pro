import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { collectLegacyDesignSystemPropUsages } from "./check-no-legacy-ds-props-lib.mjs";

const projectRoot = process.cwd();
const pagesRoot = path.join(projectRoot, "src", "pages");
const sourceExtensions = new Set([".ts", ".tsx"]);

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

for await (const filePath of walk(pagesRoot)) {
    const source = await readFile(filePath, "utf8");
    const relativePath = path.relative(projectRoot, filePath);
    const refs = collectLegacyDesignSystemPropUsages(source, relativePath);
    for (const ref of refs) {
        const valuePart = typeof ref.value === "string" ? `=\"${ref.value}\"` : "";
        violations.push(`${ref.filePath}:${ref.line} -> <${ref.component} ${ref.prop}${valuePart}>`);
    }
}

if (violations.length > 0) {
    console.error("Found legacy design-system compatibility props in route files:");
    for (const violation of violations) {
        console.error(`- ${violation}`);
    }
    process.exit(1);
}

console.log("No legacy design-system compatibility props found in route files.");