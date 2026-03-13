import ts from "typescript";

const COLOR_FUNCTION_PATTERN = /\b(?:rgb|rgba|hsl|hsla)\(\s*(?!var\()[^)]+\)/gi;
const HEX_COLOR_PATTERN = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RAW_TAILWIND_PALETTE_UTILITY_PATTERN =
  /\b(?:[a-z0-9_-]+:)*(?:accent|bg|border|caret|decoration|fill|from|outline|ring|shadow|stroke|text|to|via)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))(?:\/(?:\d{1,3}|\[[^\]]+\]))?\b/gi;

function resolveScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (filePath.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  return ts.ScriptKind.TS;
}

function collectFunctionMatches(text, node, sourceFile, filePath, kind, violations) {
  let match;
  while ((match = COLOR_FUNCTION_PATTERN.exec(text)) !== null) {
    const offset = node.getStart(sourceFile) + 1 + match.index;
    const { line } = sourceFile.getLineAndCharacterOfPosition(offset);
    violations.push({
      filePath,
      line: line + 1,
      kind,
      value: match[0],
    });
  }
  COLOR_FUNCTION_PATTERN.lastIndex = 0;
}

function shouldTreatHexMatchAsColor(text, matchIndex) {
  const lower = text.toLowerCase();
  const trimmed = text.trim();

  if (trimmed.startsWith("#")) {
    return true;
  }

  if (lower.includes("[#")) {
    return true;
  }

  if (lower.includes("fill=\"#") || lower.includes("stroke=\"#") || lower.includes("stopcolor=\"#")) {
    return true;
  }

  const prev = text[matchIndex - 1];
  return prev === ":" || prev === "=" || prev === "(" || prev === ",";
}

function collectHexMatches(text, node, sourceFile, filePath, kind, violations) {
  let match;
  while ((match = HEX_COLOR_PATTERN.exec(text)) !== null) {
    if (!shouldTreatHexMatchAsColor(text, match.index)) {
      continue;
    }
    const offset = node.getStart(sourceFile) + 1 + match.index;
    const { line } = sourceFile.getLineAndCharacterOfPosition(offset);
    violations.push({
      filePath,
      line: line + 1,
      kind,
      value: match[0],
    });
  }
  HEX_COLOR_PATTERN.lastIndex = 0;
}

function collectPaletteUtilityMatches(text, node, sourceFile, filePath, kind, violations) {
  let match;
  while ((match = RAW_TAILWIND_PALETTE_UTILITY_PATTERN.exec(text)) !== null) {
    const offset = node.getStart(sourceFile) + 1 + match.index;
    const { line } = sourceFile.getLineAndCharacterOfPosition(offset);
    violations.push({
      filePath,
      line: line + 1,
      kind,
      value: match[0],
    });
  }
  RAW_TAILWIND_PALETTE_UTILITY_PATTERN.lastIndex = 0;
}

function collectTextViolations(text, node, sourceFile, filePath, kind, violations) {
  collectFunctionMatches(text, node, sourceFile, filePath, kind, violations);
  collectHexMatches(text, node, sourceFile, filePath, kind, violations);
  collectPaletteUtilityMatches(text, node, sourceFile, filePath, kind, violations);
}

export function collectLiteralColorUsages(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, resolveScriptKind(filePath));
  const violations = [];

  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      collectTextViolations(node.text, node, sourceFile, filePath, "string", violations);
    }

    if (ts.isTemplateExpression(node)) {
      collectTextViolations(node.head.text, node.head, sourceFile, filePath, "template", violations);
      for (const span of node.templateSpans) {
        collectTextViolations(span.literal.text, span.literal, sourceFile, filePath, "template", violations);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}
