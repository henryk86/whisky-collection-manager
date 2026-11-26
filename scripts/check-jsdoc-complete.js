/**
 * @fileoverview Enforces typed JSDoc on all named functions in JavaScript.
 *
 * Includes internal declarations, named arrow functions, class methods,
 * accessors, constructors and named object callbacks. Anonymous inline
 * callbacks remain implementation details of their enclosing function.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {listJavaScriptFiles} from './javascript-files.js';

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

/**
 * Checks whether a function body returns an expression of its own.
 *
 * Returns inside nested functions are not part of the enclosing signature.
 *
 * @param {!ts.FunctionLikeDeclaration} fn Function under inspection.
 * @return {boolean} Whether the function returns a meaningful value.
 */
function returnsValue(fn) {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return true;
  let result = false;
  /**
   * Searches the enclosing body without counting returns in nested functions.
   *
   * @param {!ts.Node} node Syntax node in the current traversal.
   */
  function visit(node) {
    if (node !== fn && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) result = true;
    ts.forEachChild(node, visit);
  }
  visit(fn);
  return result;
}

/**
 * Finds module-level renderer bindings initialized with the shared loader.
 * Only directly recognizable factories are checked, not inferred aliases.
 *
 * @param {!ts.SourceFile} file Parsed JavaScript module.
 * @return {Set<string>} Names of locally bound template factories.
 */
function templateRenderers(file) {
  const loaders = new Set();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
      !/(?:^|\/)templates\.js$/.test(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const specifier of bindings.elements) {
      if ((specifier.propertyName ?? specifier.name).text === 'loadTemplates') loaders.add(specifier.name.text);
    }
  }
  const renderers = new Set();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (ts.isIdentifier(declaration.name) && initializer && ts.isAwaitExpression(initializer) &&
        ts.isCallExpression(initializer.expression) && ts.isIdentifier(initializer.expression.expression) &&
        loaders.has(initializer.expression.expression.text)) renderers.add(declaration.name.text);
    }
  }
  return renderers;
}

/**
 * Detects direct calls to a known factory in return expressions. Indirect calls
 * and nested functions are deliberately left to semantic review.
 *
 * @param {!ts.FunctionLikeDeclaration} fn Function under inspection.
 * @param {Set<string>} renderers Known module-level template factory names.
 * @return {boolean} True if a direct factory call is returned.
 */
function directlyReturnsPlan(fn, renderers) {
  if (!renderers.size) return false;
  const candidates = new Set(renderers);
  /**
   * Excludes names shadowed by declarations within the function or its enclosing scopes.
   *
   * @param {!ts.Node} node Syntax subtree being checked.
   */
  function excludeShadowed(node) {
    if ((ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) ||
      ts.isBindingElement(node)) && node.name && ts.isIdentifier(node.name)) candidates.delete(node.name.text);
    ts.forEachChild(node, excludeShadowed);
  }
  // Restrict the check to module-level declarations or variable initializers,
  // so outer local bindings cannot be mistaken for the imported factory.
  let owner = fn;
  if (ts.isVariableDeclaration(owner.parent)) owner = owner.parent.parent.parent;
  if (!ts.isSourceFile(owner.parent)) return false;
  excludeShadowed(fn);
  /**
   * Recognizes direct calls, including conditional return branches.
   *
   * @param {!ts.Expression} expression Returned expression.
   * @return {boolean} Whether a factory is called directly.
   */
  function isPlan(expression) {
    if (ts.isParenthesizedExpression(expression)) return isPlan(expression.expression);
    if (ts.isConditionalExpression(expression)) return isPlan(expression.whenTrue) || isPlan(expression.whenFalse);
    return ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && candidates.has(expression.expression.text);
  }
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return isPlan(fn.body);
  let found = false;
  /**
   * Visits return statements of this function only.
   *
   * @param {!ts.Node} node Syntax node in the function body.
   */
  function visit(node) {
    if (node !== fn && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression && isPlan(node.expression)) found = true;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(fn);
  return found;
}

/**
 * Validates JSDoc existence, parameter types, and returns on every named
 * function. Anonymous inline callbacks do not create new named interfaces.
 *
 * @param {string} filename Name reported alongside violations.
 * @param {string} source JavaScript source to inspect.
 * @return {!Array<string>} Violations with source-line locations.
 */
export function jsdocViolations(filename, source) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const issues = [];
  for (const diagnostic of file.jsDocDiagnostics ?? []) {
    const {line} = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    issues.push(`${filename}:${line + 1}: invalid JSDoc syntax: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
  }
  const renderers = templateRenderers(file);
  /**
   * Checks the declared interface against the function syntax.
   *
   * @param {!ts.Node} owner Syntax node carrying the documentation.
   * @param {!ts.FunctionLikeDeclaration} fn Function or method being documented.
   */
  function inspect(owner, fn) {
    const docs = owner.jsDoc ?? [];
    const position = file.getLineAndCharacterOfPosition(owner.getStart(file));
    const prefix = `${filename}:${position.line + 1}`;
    if (!docs.length) {
      issues.push(`${prefix}: missing JSDoc on named function`);
      return;
    }
    const tags = ts.getJSDocTags(owner);
    if (tags.some(tag => ['typedef', 'type', 'enum', 'fileoverview'].includes(tag.tagName.text))) return;
    const description = docs.map(doc => typeof doc.comment === 'string' ? doc.comment.trim() : '').find(Boolean);
    if (!description) {
      issues.push(`${prefix}: missing meaningful JSDoc description`);
    }
    const params = fn.parameters ?? [];
    const documented = tags.filter(tag => tag.tagName.text === 'param' && tag.name && !tag.name.getText(file).includes('.'));
    const allParams = tags.filter(tag => tag.tagName.text === 'param' && tag.name);
    // The TypeScript parser nests dotted property tags under object parameters.
    // Walk that representation as well as standalone dotted tags.
    for (const tag of allParams) {
      const type = tag.typeExpression?.type;
      if (type && ts.isJSDocTypeLiteral(type)) allParams.push(...type.jsDocPropertyTags);
    }
    const seen = new Set();
    for (const tag of allParams) {
      const name = tag.name.getText(file);
      if (seen.has(name)) issues.push(`${prefix}: duplicate @param ${name}`);
      seen.add(name);
    }
    if (documented.length !== params.length) {
      issues.push(`${prefix}: expected ${params.length} @param tags, ` + `found ${documented.length}`);
    }
    for (const [index, param] of params.entries()) {
      const named = ts.isIdentifier(param.name);
      const name = named ? param.name.text : null;
      const tag = (name ? documented.find(tag => tag.name.getText(file) === name) : documented[index]);
      if (!tag) {
        issues.push(`${prefix}: undocumented parameter ` + (name ?? `#${index + 1}`));
        continue;
      }
      const type = tag.typeExpression?.type;
      if (!type) {
        issues.push(`${prefix}: @param ${tag.name.getText(file)} has no valid type`);
      } else if (param.initializer && !tag.isBracketed && !ts.isJSDocOptionalType(type)) {
        issues.push(`${prefix}: defaulted @param ${tag.name.getText(file)} must be optional`);
      }
      if (typeof tag.comment !== 'string' || !tag.comment.trim()) {
        issues.push(`${prefix}: @param ${tag.name.getText(file)} ` + 'has no explanation');
      }
    }
    if (tags.some(tag => tag.tagName.text === 'returns')) {
      issues.push(`${prefix}: use Google JSDoc @return, not @returns`);
    }
    const result = tags.filter(tag => tag.tagName.text === 'return');
    if (returnsValue(fn) && (result.length !== 1 || !result[0].typeExpression?.type)) {
      issues.push(`${prefix}: non-void function requires typed @return`);
    }
    const declared = result[0]?.typeExpression?.type;
    if (declared?.kind === ts.SyntaxKind.StringKeyword && directlyReturnsPlan(fn, renderers)) {
      issues.push(`${prefix}: @return {string} contradicts a direct template RenderPlan return`);
    }
    if (result.length > 1) {
      issues.push(`${prefix}: duplicate @return`);
    }
    if (result.length && (typeof result[0].comment !== 'string' || !result[0].comment.trim())) {
      issues.push(`${prefix}: @return has no explanation`);
    } else if (result[0]?.comment === 'Resulting text.') {
      issues.push(`${prefix}: @return uses a known placeholder instead of explaining the result`);
    }
  }

  /**
   * Locates each named function and its documentation owner.
   *
   * @param {!ts.Node} node Current source syntax node.
   */
  function visit(node) {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
      inspect(node, node);
    } else if (ts.isVariableDeclaration(node) && node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      inspect(node.parent.parent, node.initializer);
    } else if (ts.isPropertyAssignment(node) && node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      inspect(node, node.initializer);
    } else if (ts.isPropertyDeclaration(node) && node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      inspect(node, node.initializer);
    } else if (ts.isFunctionExpression(node) && node.name && !ts.isVariableDeclaration(node.parent) &&
      !ts.isPropertyAssignment(node.parent)) {
      const assignment = node.parent;
      if (ts.isBinaryExpression(assignment) && assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isExpressionStatement(assignment.parent)) {
        inspect(assignment.parent, node);
      } else {
        inspect(node, node);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return issues;
}

/**
 * Checks all first-party JavaScript sources, including scripts and tests.
 *
 * @param {string=} directory Project root; defaults to the working directory.
 * @return {{checked: number, issues: !Array<string>}} Coverage and failures.
 */
export function checkCompleteJSDoc(directory = process.cwd()) {
  const files = listJavaScriptFiles(directory);
  return {
    checked: files.length,
    issues: files.flatMap(name => jsdocViolations(name, fs.readFileSync(path.resolve(directory, name), 'utf8'))),
  };
}

if (isMain) {
  const result = checkCompleteJSDoc();
  if (result.issues.length) {
    for (const issue of result.issues.slice(0, 80)) console.error(issue);
    if (result.issues.length > 80) console.error(`... and ${result.issues.length - 80} further JSDoc violations`);
    process.exitCode = 1;
  } else {
    console.log(`JSDoc completeness OK: ${result.checked} JS files.`);
  }
}
