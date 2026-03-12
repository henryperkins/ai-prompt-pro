import ts from "typescript";

const ARBITRARY_TYPOGRAPHY_PATTERN = /\b(?:[a-z0-9_-]+:)*(?:text|leading|tracking)-\[[^\]]+\]/gi;
const COLOR_TEXT_PREFIX_PATTERN = /^text-\[(?:#|rgba?\(|hsla?\(|oklch\(|lab\(|lch\(|color(?:-mix)?\()/i;

function resolveScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (filePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  return ts.ScriptKind.TS;
}

function collectMatches(text, node, sourceFile, filePath, violations) {
  let match;
  while ((match = ARBITRARY_TYPOGRAPHY_PATTERN.exec(text)) !== null) {
    const value = match[0];
    if (COLOR_TEXT_PREFIX_PATTERN.test(value)) {
      continue;
    }

    const offset = node.getStart(sourceFile) + 1 + match.index;
    const { line } = sourceFile.getLineAndCharacterOfPosition(offset);
    violations.push({
      filePath,
      line: line + 1,
      value,
    });
  }

  ARBITRARY_TYPOGRAPHY_PATTERN.lastIndex = 0;
}

export function collectArbitraryTypographyUsages(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, resolveScriptKind(filePath));
  const violations = [];

  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      collectMatches(node.text, node, sourceFile, filePath, violations);
    }

    if (ts.isTemplateExpression(node)) {
      collectMatches(node.head.text, node.head, sourceFile, filePath, violations);
      for (const span of node.templateSpans) {
        collectMatches(span.literal.text, span.literal, sourceFile, filePath, violations);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}
