/** @fileoverview Syntax-aware function separation and trailing commas. */
import {parseJavaScript, forEachChild, declarationOf, isFunction} from './javascript-ast.js';

/**
 * Identifies declarations and class members that define a named function.
 * @param {*} statement Statement or class member.
 * @return {boolean} Whether this item is a function declaration or method.
 */
function namedFunction(statement) {
  const node = declarationOf(statement);
  return node?.type === 'FunctionDeclaration' || node?.type === 'MethodDefinition' ||
    node?.type === 'VariableDeclaration' && node.declarations.some(item => isFunction(item.init));
}

/**
 * Inserts a blank line between adjacent function definitions without moving their comments.
 * @param {string} filename File used for parser diagnostics.
 * @param {string} text JavaScript source.
 * @return {string} Source with separated declarations and methods.
 */
export function separateFunctions(filename, text) {
  const {program} = parseJavaScript(filename, text);
  const edits = [];
  /**
   * Collects missing separators in a sibling declaration list.
   * @param {!Array<*>} nodes Statements or class members in source order.
   */
  function examine(nodes) {
    for (let i = 1; i < nodes.length; i++) {
      const left = nodes[i - 1];
      const right = nodes[i];
      if (!namedFunction(left) || !namedFunction(right)) continue;
      const between = text.slice(left.end, right.start);
      const docStart = between.indexOf('/**');
      const next = docStart >= 0 ? left.end + docStart : right.start;
      if (/\n[ \t]*\n/.test(text.slice(left.end, next))) continue;
      const line = text.lastIndexOf('\n', next - 1) + 1;
      if (line > left.end && /^[ \t]*$/.test(text.slice(line, next))) edits.push(line);
    }
  }

  /**
   * Finds statement and class-member lists.
   * @param {*} node Current syntax node.
   */
  function visit(node) {
    if (['Program', 'BlockStatement', 'ClassBody'].includes(node.type)) examine(node.body);
    forEachChild(node, visit);
  }
  visit(program);
  for (const offset of [...new Set(edits)].sort((a, b) => b - a)) text = text.slice(0, offset) + '\n' + text.slice(offset);
  return text;
}

/**
 * Adds trailing commas to multiline object and array literals, never to binding patterns or array holes.
 * @param {string} filename File used for parser diagnostics.
 * @param {string} source Original JavaScript text.
 * @return {string} Source with commas inserted at element boundaries.
 */
export function insertTrailingCommas(filename, source) {
  const {program, tokens} = parseJavaScript(filename, source);
  const insertions = [];
  const commaOffsets = new Set(tokens.filter(token => token.type.label === ',').map(token => token.start));
  /**
   * Collects insertions only for literal expressions.
   * @param {*} node Current syntax node.
   */
  function visit(node) {
    forEachChild(node, visit);
    if (!['ObjectExpression', 'ArrayExpression'].includes(node.type)) return;
    const last = (node.properties ?? node.elements).at(-1);
    if (!last) return;
    const closing = node.end - 1;
    const between = source.slice(last.end, closing);
    if (!between.includes('\n') || [...commaOffsets].some(offset => offset >= last.end && offset < closing)) return;
    insertions.push(last.end);
  }
  visit(program);
  for (const offset of [...new Set(insertions)].sort((a, b) => b - a)) source = source.slice(0, offset) + ',' + source.slice(offset);
  return source;
}
