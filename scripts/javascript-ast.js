/** @fileoverview Shared ECMAScript parser and syntax traversal for quality gates. */
import {parse} from 'acorn';

/**
 * Parses an ES module without invoking a type checker or modifying its text.
 * @param {string} filename File used in syntax error messages.
 * @param {string} source Original JavaScript text.
 * @return {{program: *, comments: !Array<*>, tokens: !Array<*>, semicolons: !Array<number>}} Parsed tree, comments and tokens with source offsets.
 */
export function parseJavaScript(filename, source) {
  const comments = [];
  const tokens = [];
  const semicolons = [];
  try {
    const program = parse(source, {ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true, onComment: comments, onToken: tokens,
      /**
       * Records an automatic semicolon at the preceding token boundary.
       * @param {number} position Offset reported by Acorn.
       */
      onInsertedSemicolon: position => {semicolons.push(position);}});
    return {program, comments, tokens, semicolons};
  } catch (error) {
    throw new Error(`${filename}: ${error.message}`, {cause: error});
  }
}

/**
 * Visits each direct ESTree child, ignoring location data and scalar properties.
 * @param {*} node Parent syntax node.
 * @param {(node: *) => void} visit Callback for each child.
 */
export function forEachChild(node, visit) {
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child.type === 'string') visit(child);
    }
  }
}

/**
 * Checks whether a node introduces its own function scope.
 * @param {*} node Syntax node or absent child.
 * @return {boolean} True for declarations, expressions and arrows.
 */
export function isFunction(node) {
  return ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node?.type);
}

/**
 * Removes the export wrapper around a declaration, when present.
 * @param {*} node Module statement.
 * @return {*} Inner declaration or original statement.
 */
export function declarationOf(node) {
  return ['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(node.type) ? node.declaration : node;
}

/**
 * Finds a return value without traversing into nested function scopes.
 * @param {*} fn Function whose return contract is checked.
 * @param {((node: *) => boolean)=} matches Predicate for the returned expression.
 * @return {boolean} Whether the function returns a matching expression.
 */
export function returnsValue(fn, matches = () => true) {
  if (fn.type === 'ArrowFunctionExpression' && fn.expression) return matches(fn.body);
  let result = false;
  /**
   * Visits the current function body, excluding nested scopes.
   * @param {*} node Current syntax node.
   */
  function visit(node) {
    if (node !== fn && isFunction(node)) return;
    if (node.type === 'ReturnStatement' && node.argument && matches(node.argument)) result = true;
    if (!result) forEachChild(node, visit);
  }
  visit(fn);
  return result;
}

/**
 * Extracts a parameter's binding, unwrapping default and rest parameters.
 * @param {*} param ESTree parameter pattern.
 * @return {*} Identifier or destructuring pattern.
 */
export function parameterBinding(param) {
  return param.type === 'AssignmentPattern' ? param.left : param.type === 'RestElement' ? param.argument : param;
}
