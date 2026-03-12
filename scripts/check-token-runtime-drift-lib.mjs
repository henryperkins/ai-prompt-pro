import path from "node:path";
import ts from "typescript";

export const DESIGN_SYSTEM_CLASS_PREFIXES = [
  "bg",
  "text",
  "ring",
  "border",
  "outline",
  "shadow",
  "from",
  "via",
  "to",
  "fill",
  "stroke",
];

export const DESIGN_SYSTEM_VALUE_PREFIXES = [
  "background",
  "foreground",
  "border",
  "input",
  "ring",
  "primary",
  "secondary",
  "destructive",
  "muted",
  "accent",
  "popover",
  "card",
  "sidebar",
  "chart",
  "delight",
  "brand",
  "success",
  "warning",
  "error",
  "utility",
  "tertiary",
  "quaternary",
  "disabled",
  "placeholder",
  "focus-ring",
  "skeumorphic",
  "tooltip-supporting-text",
  "fg-",
  "pf-",
];

function resolveScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function trimBoundaryPunctuation(value) {
  return value
    .replace(/^[`"'({,;]+/g, "")
    .replace(/[`"',;]+$/g, "");
}

function getPropertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  return null;
}

function collectStaticTextFragments(node, fragments) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    fragments.push(node.text);
    return;
  }

  if (ts.isTemplateExpression(node)) {
    fragments.push(node.head.text);
    for (const span of node.templateSpans) {
      fragments.push(span.literal.text);
    }
  }
}

export function stripVariantPrefixes(className) {
  let bracketDepth = 0;
  let parenDepth = 0;
  let lastVariantColon = -1;

  for (let index = 0; index < className.length; index += 1) {
    const char = className[index];
    if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (char === ":" && bracketDepth === 0 && parenDepth === 0) lastVariantColon = index;
  }

  return className.slice(lastVariantColon + 1);
}

export function isTokenRuntimeClass(candidate) {
  const className = trimBoundaryPunctuation(candidate);
  if (!className || className.includes("=")) return false;

  const coreClass = stripVariantPrefixes(className);
  if (coreClass === "text-md") return true;

  const utilityPattern = new RegExp(`^(?:${DESIGN_SYSTEM_CLASS_PREFIXES.join("|")})-(.+)$`);
  const match = coreClass.match(utilityPattern);
  if (!match) return false;

  const value = match[1];
  if (!value) return false;

  if (value.startsWith("[") && value.includes("var(--")) {
    return true;
  }

  return DESIGN_SYSTEM_VALUE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function collectTokenRuntimeClasses(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, resolveScriptKind(filePath));
  const classes = new Set();

  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const propertyName = getPropertyNameText(node.name);
      if (propertyName === "code") {
        return;
      }
    }

    const fragments = [];
    collectStaticTextFragments(node, fragments);
    for (const fragment of fragments) {
      for (const rawToken of fragment.split(/\s+/)) {
        const token = trimBoundaryPunctuation(rawToken);
        if (isTokenRuntimeClass(token)) {
          classes.add(token);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return [...classes].sort();
}

export function escapeCssClassSelector(className) {
  return className
    .replace(/\\/g, "\\\\")
    .replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

export function hasClassSelectorInCss(className, builtCss) {
  return builtCss.includes(`.${escapeCssClassSelector(className)}`);
}

export function findMissingTokenRuntimeClasses(classNames, builtCss) {
  return [...new Set(classNames)].filter((className) => !hasClassSelectorInCss(className, builtCss)).sort();
}

export function shouldScanTokenRuntimeFile(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  if (!normalized.startsWith("src/")) return false;
  if (!/\.(ts|tsx)$/.test(normalized)) return false;
  if (normalized.includes("/test/")) return false;
  if (normalized.endsWith(".test.ts") || normalized.endsWith(".test.tsx")) return false;
  if (normalized.endsWith(".spec.ts") || normalized.endsWith(".spec.tsx")) return false;
  return true;
}
