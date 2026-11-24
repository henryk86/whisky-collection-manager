/**
 * @fileoverview Validates public JavaScript contracts against Google JSDoc.
 *
 * Exported functions and classes need typed JSDoc without legacy exemptions.
 * Named internal functions and methods are checked by
 * check-jsdoc-complete.js, including functions without prior comments.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {listJavaScriptFiles} from './javascript-files.js';

const isMain = process.argv[1] && path.resolve(process.argv[1]) ===
  fileURLToPath(import.meta.url);

/**
 * Determines whether a function returns a meaningful value. Nested callbacks
 * and local function declarations have separate contracts.
 *
 * @param {!ts.Node} func Function declaration or expression.
 * @return {boolean} Whether the return contract needs a type.
 */
function returnsValue(func) {
  if (ts.isArrowFunction(func) && !ts.isBlock(func.body)) return true;
  let result = false;
  /**
   * Derives the visit result from the supplied values.
   *
   * @param {*} node Node to inspect or update.
   */
  function visit(node) {
    if (node !== func && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) result = true;
    ts.forEachChild(node, visit);
  }
  visit(func);
  return result;
}

/**
 * Verifies the presence of a meaningful summary and typed function tags.
 * Destructured parameters count once; their dotted property tags are optional.
 *
 * @param {!ts.Node} owner Statement holding the JSDoc comment.
 * @param {!ts.Node} func Function/class described by the comment.
 * @return {boolean} Whether the public API has a complete typed contract.
 */
function hasTypedJSDoc(owner, func) {
  const comment = owner.jsDoc?.find(doc =>
    typeof doc.comment === 'string' && doc.comment.trim().length >= 12);
  if (!comment) return false;
  if (ts.isClassDeclaration(func)) {
    return func.members.filter(ts.isConstructorDeclaration).every(ctor =>
      !ctor.parameters.length || hasTypedJSDoc(ctor, ctor));
  }
  const tags = ts.getJSDocTags(owner);
  const params = tags.filter(tag => tag.tagName.text === 'param' &&
    tag.typeExpression && tag.name && !tag.name.getText().includes('.'));
  const names = new Set(params.map(tag => tag.name.getText()));
  const declarations = func.parameters ?? [];
  if (names.size !== declarations.length) return false;
  for (const [index, parameter] of declarations.entries()) {
    if (ts.isIdentifier(parameter.name) &&
      !names.has(parameter.name.text)) return false;
    // Destructured options can be documented under their semantic parameter
    // name, which is not available as a JavaScript AST identifier.
    if (!ts.isIdentifier(parameter.name) && !params[index]) return false;
  }
  const returns = tags.filter(tag => tag.tagName.text === 'return');
  if (returnsValue(func)) return returns.some(tag => tag.typeExpression);
  return returns.length === 0 || returns.some(tag => tag.typeExpression);
}

/**
 * Inspects all direct exported functions and classes in one ES module.
 *
 * @param {string} file Relative file path used in stable export identifiers.
 * @param {string} source JavaScript module source.
 * @return {!Array<{key: string, documented: boolean}>} Exported APIs and
 *     their documentation status.
 */
export function inspectExports(file, source) {
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.JS);
  const entries = [];
  /**
   * Updates the add state for its caller.
   *
   * @param {*} name Environment variable or setting name.
   * @param {*} statement Value used by this operation.
   * @param {*} func Value used by this operation.
   */
  function add(name, statement, func) {
    const key = `${file}#${name}`;
    entries.push({key, documented: hasTypedJSDoc(statement, func)});
  }
  for (const statement of syntax.statements) {
    if (!statement.modifiers?.some(mod =>
      mod.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement)) {
      if (statement.name) add(statement.name.text, statement, statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const value = declaration.initializer;
        if (!value || (!ts.isArrowFunction(value) &&
          !ts.isFunctionExpression(value))) continue;
        add(declaration.name.getText(syntax), statement, value);
      }
    }
  }
  return entries;
}

/**
 * Lists exported APIs without complete typed documentation.
 *
 * @param {string} file Relative JavaScript filename.
 * @param {string} source ES module contents.
 * @return {!Array<string>} Stable undocumented export identifiers.
 */
export function undocumentedExports(file, source) {
  return inspectExports(file, source).filter(item => !item.documented)
    .map(item => item.key);
}

/**
 * Checks all first-party public functions for typed JSDoc contracts.
 *
 * @param {string=} directory Repository root, defaulting to cwd.
 * @return {{checked: number, incomplete: !Array<string>}} Source count and
 *     exported APIs missing a complete documentation contract.
 */
export function checkJSDoc(directory = process.cwd()) {
  const files = listJavaScriptFiles(directory,
    ['public', 'server', 'shared', 'scripts', 'worker', 'docker',
      'extension']).map(file => path.join(directory, file));
  const incomplete = files.flatMap(file => undocumentedExports(
    path.relative(directory, file).replaceAll(path.sep, '/'),
    fs.readFileSync(file, 'utf8')));
  return {checked: files.length, incomplete};
}

if (isMain) {
  const result = checkJSDoc();
  if (result.incomplete.length) {
    for (const key of result.incomplete) {
      console.error(`Missing typed JSDoc on exported API: ${key}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`JSDoc exports OK: ${result.checked} sources; ` +
      'no legacy exemptions.');
  }
}
