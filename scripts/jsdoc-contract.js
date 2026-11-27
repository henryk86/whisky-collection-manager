/** @fileoverview Extracts documentation contracts independently of the compiler. */
import {parameterBinding, returnsValue} from './javascript-ast.js';

/**
 * Finds the end of a balanced braced type, accounting for nested object types and quoted keys.
 * @param {string} text Tag contents beginning with an opening brace.
 * @return {number} Offset immediately following the closing brace, or -1 for an incomplete type.
 */
function typeEnd(text) {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
    } else if (['\'', '"', '`'].includes(char)) quote = char;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

/**
 * Parses the tags and summary of a single JSDoc block. Type meaning is checked by tsc.
 * @param {*} comment Acorn block comment, including its source location.
 * @return {{description: string, tags: !Array<*>, issues: !Array<string>}} Documentation and structural diagnostics.
 */
export function parseJSDoc(comment) {
  const text = comment.value.slice(1).split(/\r?\n/).map(line => line.replace(/^\s*\* ?/, '').trim()).join('\n').trim();
  const matches = [...text.matchAll(/(?:^|\s)@([\w]+)\b/g)];
  const description = text.slice(0, matches[0]?.index ?? text.length).trim();
  const issues = [];
  const tags = matches.map((match, i) => {
    const kind = match[1];
    let body = text.slice(match.index + match[0].length, matches[i + 1]?.index ?? text.length).trim();
    let type = '';
    let name = '';
    let optional = false;
    if (body.startsWith('{')) {
      const end = typeEnd(body);
      if (end < 0) issues.push(`unclosed type in @${kind}`);
      else {
        type = body.slice(1, end - 1).trim();
        body = body.slice(end).trim();
        if (!type) issues.push(`empty type in @${kind}`);
      }
    }
    if (['param', 'arg', 'argument'].includes(kind)) {
      const parameter = body.match(/^(\[[^\]]+\]|[^\s]+)(?:\s+|$)/);
      if (parameter) {
        optional = parameter[1].startsWith('[') && parameter[1].endsWith(']');
        name = optional ? parameter[1].slice(1, -1).split('=')[0].trim() : parameter[1];
        body = body.slice(parameter[0].length).trim();
      } else issues.push(`missing name in @${kind}`);
      if (type.endsWith('=')) optional = true;
    }
    return {kind, type, name, optional, description: body.replace(/^-\s+/, '')};
  });
  return {description, tags, issues};
}

/**
 * Collects directly preceding JSDoc blocks; intervening code cannot donate documentation.
 * @param {*} owner Syntax node carrying the documentation.
 * @param {string} source Original JavaScript text.
 * @param {!Array<*>} comments Parsed JavaScript comments in source order.
 * @return {!Array<*>} Parsed adjacent JSDoc blocks.
 */
export function docsFor(owner, source, comments) {
  const docs = [];
  let position = owner.start;
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];
    if (comment.end > position) continue;
    if (!/^\s*$/.test(source.slice(comment.end, position))) break;
    if (comment.type === 'Block' && comment.value.startsWith('*')) docs.unshift(parseJSDoc(comment));
    position = comment.start;
  }
  return docs;
}

/**
 * Selects documented parameters, including nested property names.
 * @param {!Array<*>} tags Documentation tags.
 * @return {!Array<*>} Parameter tags with names.
 */
export function parameterTags(tags) {
  return tags.filter(tag => ['param', 'arg', 'argument'].includes(tag.kind) && tag.name);
}

/**
 * Verifies the summary, argument names and return type of an exported function.
 * @param {*} fn Function declaration or expression.
 * @param {!Array<*>} docs Adjacent documentation blocks.
 * @return {boolean} Whether every parameter and required return has a typed contract.
 */
export function hasTypedContract(fn, docs) {
  if (!docs.some(doc => doc.description) || docs.some(doc => doc.issues.length)) return false;
  const tags = docs.flatMap(doc => doc.tags);
  const params = parameterTags(tags).filter(tag => tag.type && !tag.name.includes('.'));
  const names = new Set(params.map(tag => tag.name));
  if (names.size !== fn.params.length) return false;
  for (const [index, param] of fn.params.entries()) {
    const binding = parameterBinding(param);
    if (binding.type === 'Identifier' ? !names.has(binding.name) : !params[index]) return false;
  }
  const returns = tags.filter(tag => tag.kind === 'return');
  return returnsValue(fn) ? returns.some(tag => tag.type) : !returns.length || returns.some(tag => tag.type);
}
