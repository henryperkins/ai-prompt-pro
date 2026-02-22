import ts from "typescript";

const BUTTON_MODULE = "@/components/base/buttons/button";
const BADGE_MODULE = "@/components/base/badges/badges";

function resolveScriptKind(filePath) {
    if (filePath.endsWith(".tsx")) {
        return ts.ScriptKind.TSX;
    }
    if (filePath.endsWith(".jsx")) {
        return ts.ScriptKind.JSX;
    }
    return ts.ScriptKind.TS;
}

function readStringAttributeValue(initializer) {
    if (!initializer) return null;
    if (ts.isStringLiteral(initializer)) {
        return initializer.text;
    }
    if (ts.isJsxExpression(initializer) && initializer.expression) {
        if (ts.isStringLiteral(initializer.expression) || ts.isNoSubstitutionTemplateLiteral(initializer.expression)) {
            return initializer.expression.text;
        }
    }
    return null;
}

function collectImportedComponentNames(sourceFile) {
    const buttonNames = new Set();
    const badgeNames = new Set();

    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        if (!statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) continue;
        if (!statement.moduleSpecifier || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;

        const modulePath = statement.moduleSpecifier.text;
        const isButtonImport = modulePath === BUTTON_MODULE;
        const isBadgeImport = modulePath === BADGE_MODULE;
        if (!isButtonImport && !isBadgeImport) continue;

        for (const element of statement.importClause.namedBindings.elements) {
            const importedName = element.propertyName?.text ?? element.name.text;
            const localName = element.name.text;
            if (isButtonImport && importedName === "Button") {
                buttonNames.add(localName);
            }
            if (isBadgeImport && importedName === "Badge") {
                badgeNames.add(localName);
            }
        }
    }

    return { buttonNames, badgeNames };
}

function getJsxTagName(node) {
    if (ts.isIdentifier(node.tagName)) {
        return node.tagName.text;
    }
    return null;
}

function collectLegacyAttributesForComponent({ attributes, component, sourceFile, filePath }) {
    const violations = [];

    for (const property of attributes.properties) {
        if (!ts.isJsxAttribute(property)) continue;

        const propName = property.name.text;
        const { line } = sourceFile.getLineAndCharacterOfPosition(property.name.getStart(sourceFile));

        if (component === "Button") {
            if (propName === "variant" || propName === "asChild") {
                violations.push({
                    filePath,
                    line: line + 1,
                    component,
                    prop: propName,
                    value: readStringAttributeValue(property.initializer),
                });
                continue;
            }

            if (propName === "size") {
                const value = readStringAttributeValue(property.initializer);
                if (value === "default" || value === "icon") {
                    violations.push({
                        filePath,
                        line: line + 1,
                        component,
                        prop: propName,
                        value,
                    });
                }
            }
        }

        if (component === "Badge" && propName === "variant") {
            violations.push({
                filePath,
                line: line + 1,
                component,
                prop: propName,
                value: readStringAttributeValue(property.initializer),
            });
        }
    }

    return violations;
}

export function collectLegacyDesignSystemPropUsages(sourceText, filePath) {
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, resolveScriptKind(filePath));
    const { buttonNames, badgeNames } = collectImportedComponentNames(sourceFile);
    if (buttonNames.size === 0 && badgeNames.size === 0) {
        return [];
    }

    const violations = [];

    const visit = (node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const tagName = getJsxTagName(node);
            if (tagName && buttonNames.has(tagName)) {
                violations.push(
                    ...collectLegacyAttributesForComponent({
                        attributes: node.attributes,
                        component: "Button",
                        sourceFile,
                        filePath,
                    }),
                );
            }
            if (tagName && badgeNames.has(tagName)) {
                violations.push(
                    ...collectLegacyAttributesForComponent({
                        attributes: node.attributes,
                        component: "Badge",
                        sourceFile,
                        filePath,
                    }),
                );
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return violations;
}