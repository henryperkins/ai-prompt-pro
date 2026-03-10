import ts from "typescript";

const TEXTAREA_MODULE = "@/components/base/textarea";
const DEPRECATED_TEXTAREA_EXPORT = "Textarea";

function resolveScriptKind(filePath) {
    if (filePath.endsWith(".tsx")) {
        return ts.ScriptKind.TSX;
    }
    if (filePath.endsWith(".jsx")) {
        return ts.ScriptKind.JSX;
    }
    return ts.ScriptKind.TS;
}

function isStringLiteralLike(node) {
    return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

export function collectDeprecatedTextareaUsages(sourceText, filePath) {
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, resolveScriptKind(filePath));
    const violations = [];

    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement) && statement.moduleSpecifier && isStringLiteralLike(statement.moduleSpecifier)) {
            if (statement.moduleSpecifier.text !== TEXTAREA_MODULE) {
                continue;
            }

            const namedBindings = statement.importClause?.namedBindings;
            if (!namedBindings || !ts.isNamedImports(namedBindings)) {
                continue;
            }

            for (const element of namedBindings.elements) {
                const importedName = element.propertyName?.text ?? element.name.text;
                if (importedName !== DEPRECATED_TEXTAREA_EXPORT) {
                    continue;
                }

                const { line } = sourceFile.getLineAndCharacterOfPosition(element.getStart(sourceFile));
                violations.push({
                    filePath,
                    line: line + 1,
                    kind: "import",
                    specifier: TEXTAREA_MODULE,
                    importedName,
                    localName: element.name.text,
                });
            }

            continue;
        }

        if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && isStringLiteralLike(statement.moduleSpecifier)) {
            if (statement.moduleSpecifier.text !== TEXTAREA_MODULE || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
                continue;
            }

            for (const element of statement.exportClause.elements) {
                const exportedName = element.propertyName?.text ?? element.name.text;
                if (exportedName !== DEPRECATED_TEXTAREA_EXPORT) {
                    continue;
                }

                const { line } = sourceFile.getLineAndCharacterOfPosition(element.getStart(sourceFile));
                violations.push({
                    filePath,
                    line: line + 1,
                    kind: "export",
                    specifier: TEXTAREA_MODULE,
                    importedName: exportedName,
                    localName: element.name.text,
                });
            }
        }
    }

    return violations;
}