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

const isMain = process.argv[1] && path.resolve(process.argv[1]) ===
  fileURLToPath(import.meta.url);

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
   * Derives the visit result from the supplied values.
   *
   * @param {*} node Node to inspect or update.
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
 * Validates JSDoc existence, parameter types, and returns on every named
 * function. Anonymous inline callbacks do not create new named interfaces.
 *
 * @param {string} filename Name reported alongside violations.
 * @param {string} source JavaScript source to inspect.
 * @return {!Array<string>} Violations with source-line locations.
 */
export function jsdocViolations(filename, source) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  const issues = [];
  /**
   * Selects and transforms the inspect records.
   *
   * @param {*} owner Value used by this operation.
   * @param {*} fn Function called during this operation.
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
    if (tags.some(tag => ['typedef', 'type', 'enum', 'fileoverview',
      'template'].includes(tag.tagName.text))) return;
    const description = docs.map(doc => typeof doc.comment === 'string' ?
      doc.comment.trim() : '').find(Boolean);
    if (!description || description.length < 12) {
      issues.push(`${prefix}: missing meaningful JSDoc description`);
    }
    const params = fn.parameters ?? [];
    const documented = tags.filter(tag => tag.tagName.text === 'param' &&
      tag.name && !tag.name.getText(file).includes('.'));
    if (documented.length !== params.length) {
      issues.push(`${prefix}: expected ${params.length} @param tags, ` +
        `found ${documented.length}`);
    }
    const seen = new Set();
    for (const [index, param] of params.entries()) {
      const named = ts.isIdentifier(param.name);
      const name = named ? param.name.text : null;
      const tag = (name ? documented.find(tag => tag.name.getText(file) ===
        name) : documented[index]);
      if (!tag) {
        issues.push(`${prefix}: undocumented parameter ` +
          (name ?? `#${index + 1}`));
        continue;
      }
      if (seen.has(tag.name.getText(file))) {
        issues.push(`${prefix}: duplicate @param ${tag.name.getText(file)}`);
      }
      seen.add(tag.name.getText(file));
      if (!tag.typeExpression?.type) {
        issues.push(`${prefix}: @param ${tag.name.getText(file)} ` +
          'has no valid type');
      }
      if (typeof tag.comment !== 'string' || !tag.comment.trim()) {
        issues.push(`${prefix}: @param ${tag.name.getText(file)} ` +
          'has no explanation');
      }
    }
    if (tags.some(tag => tag.tagName.text === 'returns')) {
      issues.push(`${prefix}: use Google JSDoc @return, not @returns`);
    }
    const result = tags.filter(tag => tag.tagName.text === 'return');
    if (returnsValue(fn) && (result.length !== 1 ||
      !result[0].typeExpression?.type)) {
      issues.push(`${prefix}: non-void function requires typed @return`);
    }
    if (result.length > 1) {
      issues.push(`${prefix}: duplicate @return`);
    }
    if (result.length && (typeof result[0].comment !== 'string' ||
      !result[0].comment.trim())) {
      issues.push(`${prefix}: @return has no explanation`);
    }
  }

  /**
   * Updates the visit state for its caller.
   *
   * @param {*} node Node to inspect or update.
   */
  function visit(node) {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
      inspect(node, node);
    } else if (ts.isVariableDeclaration(node) && node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))) {
      inspect(node.parent.parent, node.initializer);
    } else if (ts.isPropertyAssignment(node) && node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))) {
      inspect(node, node.initializer);
    } else if (ts.isPropertyDeclaration(node) && node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))) {
      inspect(node, node.initializer);
    } else if (ts.isFunctionExpression(node) && node.name &&
      !ts.isVariableDeclaration(node.parent) &&
      !ts.isPropertyAssignment(node.parent)) {
      const assignment = node.parent;
      if (ts.isBinaryExpression(assignment) &&
        assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
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
    issues: files.flatMap(name => jsdocViolations(name,
      fs.readFileSync(path.resolve(directory, name), 'utf8'))),
  };
}

if (isMain) {
  const result = checkCompleteJSDoc();
  if (result.issues.length) {
    for (const issue of result.issues.slice(0, 80)) console.error(issue);
    if (result.issues.length > 80) console.error(
      `... and ${result.issues.length - 80} further JSDoc violations`);
    process.exitCode = 1;
  } else {
    console.log(`JSDoc completeness OK: ${result.checked} JS files.`);
  }
}
