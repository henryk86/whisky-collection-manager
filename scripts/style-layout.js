/**
 * @fileoverview Syntax-aware function separation and trailing commas.
 *
 * No line-width wrapping or literal rewriting.
 */
import ts from 'typescript';

/**
 * Returns the zero-based offset of the start of the current line.
 *
 * @param {string} text JavaScript source.
 * @param {number} offset Source offset.
 * @return {number} Start of the containing line.
 */
function lineStart(text, offset) {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

/**
 * Inserts a blank line between adjacent top-level functions, arrow-function
 * declarations and class methods, keeping the next function's JSDoc attached.
 *
 * @param {string} filename Source file name for parser context.
 * @param {string} text JavaScript source.
 * @return {string} Source with consistent function separation.
 */
export function separateFunctions(filename, text) {
  const file = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const edits = [];
  /**
   * Checks whether function applies.
   *
   * @param {*} node Node to inspect or update.
   * @return {*} Whether the requested condition is met.
   */
  function isFunction(node) {
    return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      (ts.isVariableStatement(node) && node.declarationList.declarations.some(
        declaration => declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))));
  }

  /**
   * Finds missing blank lines between adjacent documented functions in a syntax-node list.
   * @param {import('typescript').NodeArray<import('typescript').Node>} nodes Sibling syntax nodes to inspect.
   */
  function examine(nodes) {
    for (let i = 1; i < nodes.length; i++) {
      const left = nodes[i - 1];
      const right = nodes[i];
      if (!isFunction(left) || !isFunction(right)) continue;
      const between = text.slice(left.end, right.getStart(file));
      const docStart = between.indexOf('/**');
      const nextStart = docStart >= 0 ? left.end + docStart : right.getStart(file);
      const preceding = text.slice(left.end, nextStart);
      if (/\n[ \t]*\n/.test(preceding)) continue;
      // After a JSDoc block begins, its own lines do not count as separation.
      const line = lineStart(text, nextStart);
      if (line > left.end && /^[ \t]*$/.test(text.slice(line, nextStart))) {
        edits.push(line);
      }
    }
  }

  /**
   * Updates the visit state for its caller.
   *
   * @param {*} node Node to inspect or update.
   */
  function visit(node) {
    if (ts.isSourceFile(node) || ts.isBlock(node)) examine([...node.statements]);
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      examine([...node.members]);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const offset of [...new Set(edits)].sort((a, b) => b - a)) {
    text = text.slice(0, offset) + '\n' + text.slice(offset);
  }
  return text;
}

/**
 * Adds Google's recommended trailing comma to multiline array/object literals.
 * Rest-binding patterns and elided array entries are deliberately excluded.
 *
 * @param {string} filename Source file name for syntax analysis.
 * @param {string} source JavaScript source.
 * @return {string} Source with safe trailing commas in multiline literals.
 */
export function insertTrailingCommas(filename, source) {
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const insertions = [];
  /**
   * Tests input text against the visit pattern.
   *
   * @param {*} node Node to inspect or update.
   */
  function visit(node) {
    ts.forEachChild(node, visit);
    const object = ts.isObjectLiteralExpression(node);
    const array = ts.isArrayLiteralExpression(node);
    if (!object && !array) return;
    const elements = [...(object ? node.properties : node.elements)];
    if (!elements.length) return;
    const last = elements.at(-1);
    if (ts.isOmittedExpression(last)) return;
    const closing = node.end - 1;
    const between = source.slice(last.end, closing);
    if (!between.includes('\n') || /^\s*,/.test(between) || source[closing] !== (object ? '}' : ']')) return;
    insertions.push(last.end);
  }
  visit(parsed);
  for (const position of [...new Set(insertions)].sort((a, b) => b - a)) {
    source = source.slice(0, position) + ',' + source.slice(position);
  }
  return source;
}
