import ts from "typescript";

export const FORBIDDEN_PRIMITIVE_IMPORTS = [
  "@/components/base/primitives/button",
  "@/components/base/primitives/input",
  "@/components/base/primitives/badge",
  "@/components/base/primitives/select",
  "@/components/base/primitives/dialog",
  "@/components/base/primitives/drawer",
  "@/components/base/primitives/tabs",
  "@/components/base/primitives/label",
  "@/components/base/primitives/textarea",
];

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

export function collectForbiddenModulePathUsages(sourceText, filePath, forbiddenImports = FORBIDDEN_PRIMITIVE_IMPORTS) {
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
