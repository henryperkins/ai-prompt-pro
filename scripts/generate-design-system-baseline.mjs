import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const outputPath = path.join(projectRoot, "docs", "design-system-baseline-inventory.md");

const canonicalComponents = [
  { label: "Button", specifier: "@/components/base/buttons/button" },
  { label: "Input", specifier: "@/components/base/input/input" },
  { label: "Textarea", specifier: "@/components/base/textarea" },
  { label: "Label", specifier: "@/components/base/label" },
  { label: "Select", specifier: "@/components/base/select/select" },
  { label: "Card", specifier: "@/components/base/card" },
  { label: "Badge", specifier: "@/components/base/badges/badges" },
  { label: "Dialog", specifier: "@/components/base/dialog" },
  { label: "Drawer", specifier: "@/components/base/drawer" },
];

const duplicatePairs = [
  {
    id: "Label entrypoint",
    canonical: "@/components/base/label",
    duplicate: "@/components/base/input/label",
    canonicalFile: "src/components/base/label.tsx",
    duplicateFile: "src/components/base/input/label.tsx",
  },
  {
    id: "Textarea entrypoint",
    canonical: "@/components/base/textarea",
    duplicate: "@/components/base/textarea/textarea",
    canonicalFile: "src/components/base/textarea.tsx",
    duplicateFile: "src/components/base/textarea/textarea.tsx",
  },
  {
    id: "Card facade",
    canonical: "@/components/base/card",
    duplicate: "@/components/base/primitives/card",
    canonicalFile: "src/components/base/card.tsx",
    duplicateFile: "src/components/base/primitives/card.tsx",
  },
  {
    id: "Drawer facade",
    canonical: "@/components/base/drawer",
    duplicate: "@/components/base/primitives/drawer",
    canonicalFile: "src/components/base/drawer.tsx",
    duplicateFile: "src/components/base/primitives/drawer.tsx",
  },
  {
    id: "Prompt-builder context hook",
    canonical: "@/hooks/useContextConfig",
    duplicate: "@/hooks/usePromptBuilderContext",
    canonicalFile: "src/hooks/useContextConfig.ts",
    duplicateFile: "src/hooks/usePromptBuilderContext.ts",
  },
  {
    id: "Class merge helper",
    canonical: "@/lib/utils/cx",
    duplicate: "@/lib/utils",
    canonicalFile: "src/lib/utils/cx.ts",
    duplicateFile: "src/lib/utils.ts",
  },
];

function resolveScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (filePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  return ts.ScriptKind.TS;
}

function collectModuleSpecifiers(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, resolveScriptKind(filePath));
  const specs = [];

  const isStringLiteralLike = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && isStringLiteralLike(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text);
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && isStringLiteralLike(node.moduleSpecifier)) {
      specs.push(node.moduleSpecifier.text);
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [firstArg] = node.arguments;
      if (firstArg && isStringLiteralLike(firstArg)) {
        specs.push(firstArg.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return specs;
}

async function* walk(dir, extensions) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(absPath, extensions);
      continue;
    }
    if (extensions.has(path.extname(entry.name))) {
      yield absPath;
    }
  }
}

function formatPathList(items, maxItems = 8) {
  if (items.length === 0) {
    return "_none_";
  }
  const shown = items.slice(0, maxItems).map((item) => `\`${item}\``);
  if (items.length > maxItems) {
    shown.push(`_+${items.length - maxItems} more_`);
  }
  return shown.join(", ");
}

function toMarkdownTableRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function isIncludedCodeFile(relativePath) {
  if (!relativePath.startsWith("src/")) {
    return false;
  }
  if (relativePath.startsWith("src/styles/")) {
    return false;
  }
  if (relativePath.startsWith("src/test/")) {
    return false;
  }
  return relativePath.endsWith(".ts") || relativePath.endsWith(".tsx");
}

function summarizePfUsage(pfUsageMap) {
  const entries = [...pfUsageMap.entries()]
    .map(([className, files]) => ({ className, files: [...files].sort(), count: files.size }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.className.localeCompare(b.className);
    });

  return entries;
}

async function main() {
  const pagesDir = path.join(projectRoot, "src", "pages");
  const srcDir = path.join(projectRoot, "src");

  const pageImports = new Map();
  const canonicalUsage = new Map(canonicalComponents.map((item) => [item.specifier, new Set()]));

  for await (const filePath of walk(pagesDir, new Set([".ts", ".tsx"]))) {
    const source = await readFile(filePath, "utf8");
    const relativePath = path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
    const moduleSpecifiers = collectModuleSpecifiers(source, relativePath);

    for (const specifier of moduleSpecifiers) {
      if (!specifier.startsWith("@/components/base/")) {
        continue;
      }
      if (!pageImports.has(specifier)) {
        pageImports.set(specifier, new Set());
      }
      pageImports.get(specifier).add(relativePath);

      if (canonicalUsage.has(specifier)) {
        canonicalUsage.get(specifier).add(relativePath);
      }
    }
  }

  const mainSource = await readFile(path.join(projectRoot, "src", "main.tsx"), "utf8");
  const mainImports = collectModuleSpecifiers(mainSource, "src/main.tsx");
  const runtimeStyleEntrypoints = mainImports.filter((item) => item.endsWith(".css"));

  const globalsCss = await readFile(path.join(projectRoot, "src", "styles", "globals.css"), "utf8");
  const globalsImports = [...globalsCss.matchAll(/@import\s+"([^"]+)";/g)].map((match) => match[1]);

  const pfUsage = new Map();
  for await (const filePath of walk(srcDir, new Set([".ts", ".tsx"]))) {
    const relativePath = path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
    if (!isIncludedCodeFile(relativePath)) {
      continue;
    }

    const source = await readFile(filePath, "utf8");
    const classes = [...source.matchAll(/\bpf-[a-zA-Z0-9_-]+\b/g)];

    for (const classMatch of classes) {
      const className = classMatch[0];
      const index = classMatch.index ?? -1;
      if (index < 0) {
        continue;
      }
      if (className.endsWith("-")) {
        continue;
      }
      const nextChar = source[index + className.length];
      if (nextChar === "-") {
        continue;
      }
      if (!pfUsage.has(className)) {
        pfUsage.set(className, new Set());
      }
      pfUsage.get(className).add(relativePath);
    }
  }

  const sourceImportUsage = new Map();
  for await (const filePath of walk(srcDir, new Set([".ts", ".tsx"]))) {
    const source = await readFile(filePath, "utf8");
    const relativePath = path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
    const specifiers = collectModuleSpecifiers(source, relativePath);
    sourceImportUsage.set(relativePath, specifiers);
  }

  const duplicateRows = [];
  for (const pair of duplicatePairs) {
    const duplicateImportCallsites = [];
    for (const [relativePath, specifiers] of sourceImportUsage.entries()) {
      if (specifiers.includes(pair.duplicate)) {
        duplicateImportCallsites.push(relativePath);
      }
    }

    const canonicalImportCallsites = [];
    for (const [relativePath, specifiers] of sourceImportUsage.entries()) {
      if (specifiers.includes(pair.canonical)) {
        canonicalImportCallsites.push(relativePath);
      }
    }

    const bridgeCallsites = [pair.canonicalFile].filter(Boolean);

    let status = "in-use";
    if (duplicateImportCallsites.length === 0) {
      status = "frozen";
    } else if (
      duplicateImportCallsites.length > 0 &&
      duplicateImportCallsites.every((callsite) => bridgeCallsites.includes(callsite))
    ) {
      status = "bridge-only";
    }
    if (pair.id === "Prompt-builder context hook" && duplicateImportCallsites.length === 0) {
      status = "removed";
    }

    duplicateRows.push({
      ...pair,
      status,
      canonicalImportCallsites: canonicalImportCallsites.sort(),
      duplicateImportCallsites: duplicateImportCallsites.sort(),
    });
  }

  const baseImportsSummary = [...pageImports.entries()]
    .map(([specifier, files]) => ({ specifier, count: files.size, files: [...files].sort() }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.specifier.localeCompare(b.specifier);
    });

  const canonicalRows = canonicalComponents.map((component) => {
    const files = [...(canonicalUsage.get(component.specifier) ?? new Set())].sort();
    return {
      label: component.label,
      specifier: component.specifier,
      files,
      count: files.length,
    };
  });

  const pfRows = summarizePfUsage(pfUsage);

  const today = new Date().toISOString().slice(0, 10);
  const markdown = [
    "# Design System Baseline Inventory",
    "",
    `Last updated: ${today}`,
    "",
    "This file captures the pre-normalization baseline requested in the design-system refactor checklist (section 1.3).",
    "",
    "## Core design-system components used by product screens",
    "",
    "Product screens are `src/pages/*.tsx` route-level files.",
    "",
    "| Component | Canonical import | Pages using canonical import | Page count |",
    "| --- | --- | --- | --- |",
    ...canonicalRows.map((row) => toMarkdownTableRow([row.label, `\`${row.specifier}\``, formatPathList(row.files), String(row.count)])),
    "",
    "### All `@/components/base/*` imports currently used in product screens",
    "",
    "| Import specifier | Page count | Pages |",
    "| --- | --- | --- |",
    ...baseImportsSummary.map((row) => toMarkdownTableRow([`\`${row.specifier}\``, String(row.count), formatPathList(row.files)])),
    "",
    "## Style entrypoints imported globally",
    "",
    "Runtime CSS import chain:",
    "",
    "1. `src/main.tsx`",
    ...runtimeStyleEntrypoints.map((item) => `1. \`${item}\``),
    "1. `src/styles/globals.css` `@import` order",
    ...globalsImports.map((item) => `1. \`${item}\``),
    "",
    "## `pf-*` class usage map in code",
    "",
    "Scope: `src/**/*.ts(x)` excluding `src/styles/**` and `src/test/**`.",
    "",
    "| pf class | File count | Files |",
    "| --- | --- | --- |",
    ...pfRows.map((row) => toMarkdownTableRow([`\`${row.className}\``, String(row.count), formatPathList(row.files)])),
    "",
    "## Duplicate component/hook/utility pairs",
    "",
    "| Pair | Canonical | Duplicate or legacy | Status | Canonical import callsites | Duplicate import callsites |",
    "| --- | --- | --- | --- | --- | --- |",
    ...duplicateRows.map((row) =>
      toMarkdownTableRow([
        row.id,
        `\`${row.canonical}\``,
        `\`${row.duplicate}\``,
        row.status,
        formatPathList(row.canonicalImportCallsites),
        formatPathList(row.duplicateImportCallsites),
      ])
    ),
    "",
    "## Baseline screenshot/state capture",
    "",
    "No screenshot artifacts are committed in this baseline file.",
    "Use `src/pages/ComponentsShowcase.tsx` and Storybook stories as visual checkpoints before API-normalization passes.",
    "",
    "## Repro command",
    "",
    "```bash",
    "npm run report:design-system-baseline",
    "```",
    "",
  ].join("\n");

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, "utf8");
  console.log(`Wrote ${path.relative(projectRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
