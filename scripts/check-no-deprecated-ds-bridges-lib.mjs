import ts from "typescript";

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

function isMockCallExpression(node) {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return false;
  }
  if (node.expression.name.text !== "mock") {
    return false;
  }
  return ts.isIdentifier(node.expression.expression) && (node.expression.expression.text === "vi" || node.expression.expression.text === "jest");
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

export function collectForbiddenBridgeImportUsages(sourceText, filePath, forbiddenImports = ["@/lib/utils"]) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, resolveScriptKind(filePath));
  const forbiddenSet = new Set(forbiddenImports);
  const violations = [];

  const recordViolation = (specifier, node, kind) => {
    if (!forbiddenSet.has(specifier)) {
      return;
    }
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push({
      filePath,
      line: line + 1,
      kind,
      specifier,
    });
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && isStringLiteralLike(node.moduleSpecifier)) {
      recordViolation(node.moduleSpecifier.text, node.moduleSpecifier, "import");
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && isStringLiteralLike(node.moduleSpecifier)) {
      recordViolation(node.moduleSpecifier.text, node.moduleSpecifier, "export");
    }

    if (ts.isCallExpression(node)) {
      const [firstArg] = node.arguments;
      if (firstArg && isStringLiteralLike(firstArg)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          recordViolation(firstArg.text, firstArg, "dynamic-import");
        }
        if (isMockCallExpression(node)) {
          recordViolation(firstArg.text, firstArg, "mock");
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

const LEGACY_THEME_CLASSLIST_PATTERN = /classList\.(?:add|remove|toggle)\s*\(\s*["'](dark|dark-mode)["']/g;

export function collectLegacyThemeClassCompatibilityUsages(sourceText, filePath) {
  const violations = [];
  let match;

  while ((match = LEGACY_THEME_CLASSLIST_PATTERN.exec(sourceText)) !== null) {
    violations.push({
      filePath,
      line: lineNumberAt(sourceText, match.index),
      kind: "class-list-compat",
      value: match[1],
    });
  }

  LEGACY_THEME_CLASSLIST_PATTERN.lastIndex = 0;
  return violations;
}

const LEGACY_THEME_SELECTOR_PATTERN = /\.dark-mode\b|\.dark\b(?!-)/g;

export function collectLegacyThemeSelectorUsages(sourceText, filePath) {
  const violations = [];
  let match;

  while ((match = LEGACY_THEME_SELECTOR_PATTERN.exec(sourceText)) !== null) {
    violations.push({
      filePath,
      line: lineNumberAt(sourceText, match.index),
      kind: "css-selector-compat",
      value: match[0],
    });
  }

  LEGACY_THEME_SELECTOR_PATTERN.lastIndex = 0;
  return violations;
}

const CSS_IMPORT_PATTERN = /(?:^|\n)\s*@import\s+(?:url\()?["']([^"']+)["']\)?\s*;/g;

function cssImportBaseName(specifier) {
  return specifier.split(/[\\/]/).pop() ?? specifier;
}

export function collectRestrictedStyleImportUsages(sourceText, filePath) {
  const violations = [];
  const normalizedPath = filePath.replaceAll("\\", "/");
  let match;

  while ((match = CSS_IMPORT_PATTERN.exec(sourceText)) !== null) {
    const specifier = match[1];
    const baseName = cssImportBaseName(specifier);
    const line = lineNumberAt(sourceText, match.index);

    if (baseName === "legacy-utility-tokens.css") {
      violations.push({
        filePath,
        line,
        kind: "style-import-bridge",
        rule: "no-legacy-utility-import",
        specifier,
      });
      continue;
    }

    if (baseName === "theme.css" && normalizedPath !== "src/styles/globals.css") {
      violations.push({
        filePath,
        line,
        kind: "style-import-bridge",
        rule: "theme-import-owner",
        specifier,
      });
      continue;
    }

    const untitledOwners = new Set(["src/styles/theme.css", "src/styles/legacy-utility-tokens.css"]);
    if (baseName === "untitled-compat.css" && !untitledOwners.has(normalizedPath)) {
      violations.push({
        filePath,
        line,
        kind: "style-import-bridge",
        rule: "untitled-compat-owner",
        specifier,
      });
    }
  }

  CSS_IMPORT_PATTERN.lastIndex = 0;
  return violations;
}
