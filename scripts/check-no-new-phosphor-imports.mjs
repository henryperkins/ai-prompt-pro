import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const phosphorModulePath = "@phosphor-icons/react";

const approvedPhosphorImportFiles = new Set([
  "src/components/application/activity-feeds/activity-feeds.tsx",
  "src/components/application/code-snippet/code-snippet.tsx",
  "src/components/application/lists/feed-list.tsx",
  "src/components/application/progress-steps/progress-steps.tsx",
  "src/components/application/tables/team-members-table.tsx",
  "src/components/AuthDialog.tsx",
  "src/components/base/avatar/avatar-profile-photo.tsx",
  "src/components/base/avatar/avatar.tsx",
  "src/components/base/avatar/base-components/avatar-add-button.tsx",
  "src/components/base/badges/badge-groups.tsx",
  "src/components/base/badges/badges.stories.tsx",
  "src/components/base/buttons/button.stories.tsx",
  "src/components/base/input/input.stories.tsx",
  "src/components/base/input/input.tsx",
  "src/components/base/input/label.tsx",
  "src/components/base/primitives/accordion.tsx",
  "src/components/base/primitives/breadcrumb.tsx",
  "src/components/base/primitives/calendar.tsx",
  "src/components/base/primitives/carousel.tsx",
  "src/components/base/primitives/command.tsx",
  "src/components/base/primitives/context-menu.tsx",
  "src/components/base/primitives/dialog.tsx",
  "src/components/base/primitives/dropdown-menu.tsx",
  "src/components/base/primitives/input-otp.tsx",
  "src/components/base/primitives/menubar.tsx",
  "src/components/base/primitives/navigation-menu.tsx",
  "src/components/base/primitives/pagination.tsx",
  "src/components/base/primitives/radio-group.tsx",
  "src/components/base/primitives/resizable.tsx",
  "src/components/base/primitives/select.tsx",
  "src/components/base/primitives/sheet.tsx",
  "src/components/base/primitives/sidebar.tsx",
  "src/components/base/primitives/state-card.tsx",
  "src/components/base/primitives/toast.tsx",
  "src/components/base/select/combobox.tsx",
  "src/components/base/select/multi-select.tsx",
  "src/components/base/select/select-item.tsx",
  "src/components/base/select/select-native.tsx",
  "src/components/base/select/select.tsx",
  "src/components/base/tags/base-components/tag-close-x.tsx",
  "src/components/BuilderAdjustDetails.tsx",
  "src/components/BuilderHeroInput.tsx",
  "src/components/BuilderSourcesAdvanced.tsx",
  "src/components/BuilderTabs.tsx",
  "src/components/community/CommunityComments.tsx",
  "src/components/community/CommunityFeed.tsx",
  "src/components/community/CommunityPostCard.tsx",
  "src/components/community/CommunityPostDetail.tsx",
  "src/components/community/ProfileHero.tsx",
  "src/components/community/PromptPreviewPanel.tsx",
  "src/components/ContextIntegrations.tsx",
  "src/components/ContextInterview.tsx",
  "src/components/ContextPanel.tsx",
  "src/components/ContextQualityMeter.tsx",
  "src/components/ContextSourceChips.tsx",
  "src/components/Header.tsx",
  "src/components/NotificationPanel.tsx",
  "src/components/OutputPanel.tsx",
  "src/components/ProjectNotes.tsx",
  "src/components/PromptInput.tsx",
  "src/components/PromptLibrary.tsx",
  "src/components/QualityScore.tsx",
  "src/components/StructuredContextForm.tsx",
  "src/components/VersionHistory.tsx",
  "src/lib/navigation.ts",
  "src/pages/CommunityPost.tsx",
  "src/pages/Community.tsx",
  "src/pages/ComponentsShowcase.tsx",
  "src/pages/Index.tsx",
  "src/pages/Library.tsx",
  "src/pages/Presets.tsx",
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

function isStringLiteralLike(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function resolveScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (filePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  return ts.ScriptKind.TS;
}

function collectPhosphorImports(source, filePath) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, resolveScriptKind(filePath));
  const matches = [];

  const recordImport = (specifier, node, kind) => {
    if (specifier !== phosphorModulePath) {
      return;
    }

    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    matches.push({
      specifier,
      kind,
      line: line + 1,
    });
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && isStringLiteralLike(node.moduleSpecifier)) {
      recordImport(node.moduleSpecifier.text, node.moduleSpecifier, "import");
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && isStringLiteralLike(node.moduleSpecifier)) {
      recordImport(node.moduleSpecifier.text, node.moduleSpecifier, "export");
    }

    if (ts.isCallExpression(node)) {
      const [firstArg] = node.arguments;
      if (firstArg && isStringLiteralLike(firstArg) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        recordImport(firstArg.text, firstArg, "dynamic-import");
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return matches;
}

const violations = [];
const observedPhosphorImportFiles = new Set();

for await (const filePath of walk(srcRoot)) {
  const source = await readFile(filePath, "utf8");
  const relativePath = path.relative(projectRoot, filePath);
  const imports = collectPhosphorImports(source, relativePath);
  if (imports.length === 0) {
    continue;
  }

  observedPhosphorImportFiles.add(relativePath);

  if (!approvedPhosphorImportFiles.has(relativePath)) {
    for (const reference of imports) {
      violations.push(`${relativePath}:${reference.line} -> ${reference.specifier}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Found unapproved direct @phosphor-icons/react imports:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error("Route new icons through approved files (or update the allowlist intentionally).");
  process.exit(1);
}

const staleAllowlistEntries = [...approvedPhosphorImportFiles].filter((filePath) => !observedPhosphorImportFiles.has(filePath));
if (staleAllowlistEntries.length > 0) {
  console.warn("Allowlist includes files that no longer import @phosphor-icons/react:");
  for (const filePath of staleAllowlistEntries) {
    console.warn(`- ${filePath}`);
  }
  console.warn("You can remove stale entries from scripts/check-no-new-phosphor-imports.mjs.");
}

console.log("No new unapproved @phosphor-icons/react imports found.");
