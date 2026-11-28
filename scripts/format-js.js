/** @fileoverview Repository-specific JavaScript layout without a compiler dependency. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {listJavaScriptFiles} from './javascript-files.js';
import {parseJavaScript, forEachChild} from './javascript-ast.js';
import {insertTrailingCommas, separateFunctions} from './style-layout.js';

/**
 * Serializes a parsed tree without source positions, retaining literal values and template text.
 * @param {*} tree Parsed JavaScript module.
 * @return {string} Structural fingerprint for checking formatter safety.
 */
function fingerprint(tree) {
  return JSON.stringify(tree, (key, value) => ['start', 'end', 'loc', 'range'].includes(key) ? undefined :
    typeof value === 'bigint' ? `${value}n` : value);
}

/**
 * Adds mechanically safe whitespace and explicit ASI semicolons without reprinting source.
 * @param {string} filename File used for syntax diagnostics.
 * @param {string} source Original JavaScript.
 * @return {string} Source with normalized spacing and semicolons.
 */
function formatSpacing(filename, source) {
  const {program, comments, tokens, semicolons} = parseJavaScript(filename, source);
  const edits = new Map();
  const operators = new Set();
  const objectBraces = new Set();
  const propertyColons = new Set();
  const openingBlocks = new Set();
  const statementColons = new Set();
  const functionParens = new Set();
  const blockBraces = new Set();
  const forSemicolons = new Set();
  /**
   * Records the operator between two AST children without including literal content.
   * @param {*} left Left syntax child.
   * @param {*} right Right syntax child.
   * @param {string} operator Operator spelling to locate.
   */
  function operatorBetween(left, right, operator) {
    const token = tokens.find(item => item.start >= left.end && item.end <= right.start && source.slice(item.start, item.end) === operator);
    if (token) operators.add(token.start);
  }

  /**
   * Identifies spacing-sensitive syntax tokens and excludes destructuring from literal edits.
   * @param {*} node Current syntax node.
   */
  function visit(node) {
    if (['BinaryExpression', 'LogicalExpression', 'AssignmentExpression', 'AssignmentPattern'].includes(node.type)) operatorBetween(node.left, node.right, node.operator ?? '=');
    if (node.type === 'VariableDeclarator' && node.init) operatorBetween(node.id, node.init, '=');
    if (node.type === 'ConditionalExpression') {
      operatorBetween(node.test, node.consequent, '?');
      operatorBetween(node.consequent, node.alternate, ':');
    }
    if (node.type === 'Property' && !node.shorthand && !node.method && node.kind === 'init') {
      const colon = tokens.find(item => item.start >= node.key.end && item.end <= node.value.start && item.type.label === ':');
      if (colon) propertyColons.add(colon.start);
    }
    if (node.type === 'SwitchCase' || node.type === 'LabeledStatement') {
      const boundary = node.test?.end ?? node.label?.end ?? node.start;
      const end = node.consequent?.[0]?.start ?? node.body?.start ?? node.end;
      const colon = tokens.find(item => item.start >= boundary && item.end <= end && item.type.label === ':');
      if (colon) statementColons.add(colon.start);
    }
    if (['FunctionDeclaration', 'FunctionExpression'].includes(node.type)) {
      const end = node.params[0]?.start ?? node.body.start;
      const paren = tokens.find(item => item.start >= (node.id?.end ?? node.start) && item.end <= end && item.type.label === '(');
      if (paren) functionParens.add(paren.start);
    }
    if (node.type === 'ForStatement') {
      const end = node.body.start;
      // Header semicolons are outside nested expressions; the two separators follow init and test.
      for (const child of [node.init, node.test]) {
        if (!child) continue;
        const token = tokens.find(item => item.start >= child.end - 1 && item.end <= end && item.type.label === ';');
        if (token) forSemicolons.add(token.start);
      }
    }
    if (['ObjectExpression', 'ObjectPattern'].includes(node.type)) {
      objectBraces.add(node.start);
      objectBraces.add(node.end - 1);
    }
    if (['BlockStatement', 'ClassBody', 'StaticBlock', 'SwitchStatement'].includes(node.type)) {
      const start = ['StaticBlock', 'SwitchStatement'].includes(node.type) ? tokens.find(item => item.start >= (node.discriminant?.end ?? node.start) && item.end <= node.end && item.type.label === '{')?.start : node.start;
      if (start !== undefined) {
        blockBraces.add(start);
        openingBlocks.add(start);
      }
      blockBraces.add(node.end - 1);
    }
    forEachChild(node, visit);
  }
  visit(program);
  /**
   * Replaces only horizontal whitespace between two adjacent lexical tokens.
   * @param {*} left Left token.
   * @param {*} right Right token.
   * @param {string} spacing Required whitespace.
   */
  function gap(left, right, spacing) {
    if (!left || !right || left.end === left.start || right.end === right.start) return;
    const between = source.slice(left.end, right.start);
    if (/^[ \t]*$/.test(between) && between !== spacing) edits.set(`${left.end}:${right.start}`, {start: left.end, end: right.start, value: spacing});
  }
  for (let i = 1; i < tokens.length - 1; i++) {
    const token = tokens[i];
    const label = token.type.label;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (operators.has(token.start) || label === '=>') {
      gap(prev, token, ' ');
      gap(token, next, ' ');
    }
    if (propertyColons.has(token.start) || statementColons.has(token.start)) {
      gap(prev, token, '');
      gap(token, next, ' ');
    }
    if (openingBlocks.has(token.start) && [')', '=>', 'else', 'try', 'finally', 'catch', 'do', 'name', 'class'].includes(prev.type.label)) gap(prev, token, ' ');
    if (functionParens.has(token.start) && ['name', 'function'].includes(prev.type.label)) gap(prev, token, '');
    if (['else', 'catch', 'finally'].includes(label) && prev.type.label === '}') gap(prev, token, ' ');
    if (label === ',') {
      if (prev.type.label !== ',') gap(prev, token, '');
      if (![')', ']'].includes(next.type.label)) gap(token, next, ' ');
      else gap(token, next, '');
    }
    if (forSemicolons.has(token.start) && next.type.label !== ')') gap(token, next, ' ');
    if (label === '(' && ['if', 'for', 'while', 'switch', 'catch', 'with'].includes(prev.type.label)) gap(prev, token, ' ');
    if (label === '{' && (objectBraces.has(token.start) || blockBraces.has(token.start))) gap(token, next, '');
    if (label === '}' && (objectBraces.has(token.start) || blockBraces.has(token.start)) && prev.type.label !== ',') gap(prev, token, '');
  }
  // Indent block statements relative to the opening line, preserving continuation indentation and comments.
  /**
   * Locates the horizontal indentation before an AST statement or brace.
   * @param {number} offset Offset of the first token on a line.
   * @return {{start: number, text: string}|null} Existing indentation, or null for mid-line tokens.
   */
  function indentation(offset) {
    const start = source.lastIndexOf('\n', offset - 1) + 1;
    const text = source.slice(start, offset);
    return /^[ \t]*$/.test(text) ? {start, text} : null;
  }
  // Opening and closing brace positions can also identify indentation for a simple multiline block.

  /**
   * Normalizes direct block statement lines when the closing brace establishes a clear base.
   * @param {*} node Syntax node in the source tree.
   */
  function indentBlocks(node) {
    if (['BlockStatement', 'ClassBody'].includes(node.type) && node.loc.start.line < node.loc.end.line) {
      const base = indentation(node.end - 1);
      if (base) {
        const width = base.text.replaceAll('\t', '  ').length + 2;
        for (const child of node.body) {
          const existing = indentation(child.start);
          if (!existing || child.loc.start.line === node.loc.start.line) continue;
          const value = ' '.repeat(width);
          if (existing.text !== value) edits.set(`${existing.start}:${child.start}`, {start: existing.start, end: child.start, value});
        }
      }
    }
    forEachChild(node, indentBlocks);
  }
  indentBlocks(program);
  for (const start of semicolons) edits.set(`${start}:${start}`, {start, end: start, value: ';'});
  // Only strip trailing spaces on lines outside comments and literal tokens.
  const protectedRanges = [...comments, ...tokens.filter(token => ['string', 'template', 'invalidTemplate', 'regexp'].includes(token.type.label))];
  for (const match of source.matchAll(/[ \t]+(?=\r?$)/gm)) {
    if (!protectedRanges.some(range => range.start <= match.index && range.end > match.index)) {
      const start = match.index;
      const end = start + match[0].length;
      edits.set(`${start}:${end}`, {start, end, value: ''});
    }
  }
  let result = source;
  for (const edit of [...edits.values()].sort((a, b) => b.start - a.start || b.end - a.end)) result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  return result;
}

/**
 * Formats JavaScript to a fixed point and refuses changes to its parsed meaning.
 * @param {string} filename Source path for diagnostics.
 * @param {string} original Unformatted source.
 * @return {string} Deterministically formatted JavaScript.
 */
export function formatJavaScript(filename, original) {
  let source = original.replace(/\r\n/g, '\n');
  const initial = fingerprint(parseJavaScript(filename, source).program);
  for (let pass = 0; pass < 16; pass++) {
    const next = formatSpacing(filename, insertTrailingCommas(filename, separateFunctions(filename, source))).replace(/\n*$/, '\n');
    if (fingerprint(parseJavaScript(filename, next).program) !== initial) throw new Error(`Formatter would change syntax tree: ${filename}`);
    if (next === source) return next;
    source = next;
  }
  throw new Error(`Formatter did not stabilize for ${filename}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write');
  const files = listJavaScriptFiles();
  const invalid = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const formatted = formatJavaScript(file, source);
    if (source === formatted) continue;
    invalid.push(file);
    if (write) fs.writeFileSync(file, formatted);
  }
  if (invalid.length) {
    console.log(`${write ? 'Formatted' : 'Needs formatting'}: ${invalid.length}/${files.length} JavaScript files`);
    for (const file of invalid.slice(0, 30)) console.log(`  ${file}`);
    if (invalid.length > 30) console.log(`  ... and ${invalid.length - 30} more`);
    if (!write) {
      console.error('Run `npm run format:js` before committing.');
      process.exitCode = 1;
    }
  } else console.log(`JavaScript formatting OK: ${files.length} files.`);
}
