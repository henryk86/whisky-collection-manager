/**
 * @fileoverview Dependency-free formatting of the repository's CSS stylesheets.
 *
 * The formatter changes layout whitespace, not the order of selectors, rules,
 * declarations or property values. The tokenizer respects strings, comments,
 * parentheses and attribute selectors to avoid splitting embedded punctuation.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve('public');
const write = process.argv.includes('--write');

/**
 * Lists the first-party CSS assets that participate in the UI cascade.
 *
 * @return {!Array<string>} CSS file paths in a stable order.
 */
function cssFiles() {
  const files = [path.join(root, 'style.css')];
  const styles = path.join(root, 'styles');
  for (const entry of fs.readdirSync(styles).sort()) {
    if (entry.endsWith('.css')) files.push(path.join(styles, entry));
  }
  return files;
}

/**
 * Splits a CSS stylesheet at structural punctuation outside protected values.
 *
 * String and comment contents are copied literally. Delimiters inside function
 * calls or attribute selectors never terminate a CSS declaration or block.
 *
 * @param {string} source Unformatted CSS source.
 * @return {!Array<!Object>} Ordered lexical statement and block tokens.
 */
export function tokenizeCss(source) {
  const tokens = [];
  let buffer = '';
  let quote = '';
  let parens = 0;
  let brackets = 0;
  let comment = false;

  /**
   * Appends a statement token unless it contains only whitespace.
   *
   * @param {string} type Kind of CSS token.
   */
  function flush(type) {
    if (buffer.trim()) tokens.push({type, text: buffer.trim()});
    buffer = '';
  }

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (comment) {
      buffer += char;
      if (char === '*' && source[i + 1] === '/') {
        buffer += '/';
        i++;
        comment = false;
      }
      continue;
    }
    if (quote) {
      buffer += char;
      if (char === '\\') {
        if (i + 1 < source.length) buffer += source[++i];
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      if (!buffer.trim()) {
        let end = source.indexOf('*/', i + 2);
        if (end === -1) throw new Error('Unclosed CSS comment');
        tokens.push({type: 'comment', text: source.slice(i, end + 2)});
        i = end + 1;
        buffer = '';
      } else {
        buffer += '/*';
        i++;
        comment = true;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === '(') parens++;
    if (char === ')') parens--;
    if (char === '[') brackets++;
    if (char === ']') brackets--;
    if (parens === 0 && brackets === 0) {
      if (char === '{') {
        flush('open');
        continue;
      }
      if (char === '}') {
        flush('statement');
        tokens.push({type: 'close'});
        continue;
      }
      if (char === ';') {
        flush('statement');
        continue;
      }
    }
    buffer += char;
  }
  if (quote || parens !== 0 || brackets !== 0 || comment) {
    throw new Error('Unclosed CSS string, function, comment or attribute');
  }
  flush('statement');
  return tokens;
}

/**
 * Finds the declaration property/value separator outside CSS function calls.
 *
 * @param {string} text CSS declaration.
 * @return {number} Colon position, or -1 if none exists.
 */
function declarationColon(text) {
  let quote = '';
  let parentheses = 0;
  let comment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (comment) {
      if (c === '*' && text[i + 1] === '/') {
        comment = false;
        i++;
      }
    } else if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '/' && text[i + 1] === '*') {
      comment = true;
      i++;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') parentheses++;
    else if (c === ')') parentheses--;
    else if (c === ':' && parentheses === 0) return i;
  }
  return -1;
}

/**
 * Separates comma-delimited selectors, preserving commas inside :is() and
 * other functional or attribute selectors.
 *
 * @param {string} selector Selector list preceding an opening brace.
 * @return {string} Selector list with one selector per line.
 */
function splitSelectors(selector) {
  if (selector.startsWith('@')) return selector;
  let result = '';
  let quote = '';
  let parens = 0;
  let brackets = 0;
  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];
    if (quote) {
      result += char;
      if (char === '\\' && i + 1 < selector.length) result += selector[++i];
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
      result += char;
    } else {
      if (char === '(') parens++;
      if (char === ')') parens--;
      if (char === '[') brackets++;
      if (char === ']') brackets--;
      if (char === ',' && parens === 0 && brackets === 0) {
        result += ',\n';
        while (/\s/.test(selector[i + 1] || '') && i + 1 < selector.length) i++;
      } else result += char;
    }
  }
  return result;
}

/**
 * Wraps a long single-line comment without changing its wording.
 *
 * @param {string} text Complete CSS comment including delimiters.
 * @param {string} indentation Indentation at the comment location.
 * @return {!Array<string>} One or more comment lines.
 */
function formatComment(text, indentation) {
  const raw = text.trim();
  if (raw.includes('\n') || raw.length + indentation.length <= 80) {
    return raw.split('\n').map((line, index) => indentation +
      (index === 0 ? line : '   ' + line.trimStart()));
  }
  const words = raw.slice(2, -2).trim().split(/\s+/);
  const rows = [];
  let line = '';
  const max = 80 - indentation.length - 6;
  for (const word of words) {
    if (line && line.length + word.length + 1 > max) {
      rows.push(line);
      line = '';
    }
    line += (line ? ' ' : '') + word;
  }
  if (line) rows.push(line);
  if (rows.length === 1) return [indentation + raw];
  return rows.map((row, i) => indentation + (i === 0 ? '/* ' : '   ') +
    row + (i === rows.length - 1 ? ' */' : ''));
}

/**
 * Formats one CSS stylesheet without changing the cascade or CSS values.
 *
 * @param {string} source CSS text to format.
 * @return {string} Canonical, consistently indented stylesheet.
 */
export function formatCss(source) {
  const tokens = tokenizeCss(source.replaceAll('\r\n', '\n'));
  const lines = [];
  let depth = 0;
  let prev = null;
  /**
   * Returns indentation for the currently open CSS rule depth.
   *
   * @return {string} Current indentation.
   */
  const indent = () => '  '.repeat(depth);
  for (const token of tokens) {
    if (token.type === 'close') {
      depth--;
      if (depth < 0) throw new Error('Unexpected CSS closing brace');
      lines.push(`${indent()}}`);
    } else if (token.type === 'open') {
      if (!token.text) throw new Error('Missing CSS rule selector');
      if (prev?.type === 'close' || (depth === 0 && prev?.type ===
        'statement')) {
        lines.push('');
      }
      const header = token.text.replace(/^@(media|supports|container)\(/,
        '@$1 (');
      const selectors = splitSelectors(header);
      for (const part of selectors.split('\n')) {
        lines.push(`${indent()}${part.trim()}`);
      }
      lines[lines.length - 1] += ' {';
      depth++;
    } else if (token.type === 'comment') {
      if (prev?.type === 'close') lines.push('');
      lines.push(...formatComment(token.text, indent()));
    } else {
      const colon = declarationColon(token.text);
      const property = colon === -1 ? '' : token.text.slice(0, colon).trim();
      const value = colon === -1 ? '' : token.text.slice(colon + 1).trim();
      const declaration = depth > 0 && /^[-_a-zA-Z][\w-]*$/.test(property);
      if (depth === 0 && prev?.type === 'close') lines.push('');
      lines.push(indent() + (declaration ? `${property}: ${value}` :
        token.text) + ';');
    }
    prev = token;
  }
  if (depth !== 0) throw new Error('Unclosed CSS rule block');
  const output = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) ===
  fileURLToPath(import.meta.url)) {
  const changed = [];
  for (const file of cssFiles()) {
    const source = fs.readFileSync(file, 'utf8');
    const formatted = formatCss(source);
    if (source === formatted) continue;
    changed.push(path.relative('.', file));
    if (write) fs.writeFileSync(file, formatted);
  }
  if (changed.length) {
    console.log(`${write ? 'Formatted' :
      'Not formatted'}: ${changed.length} CSS files`);
    for (const file of changed) console.log(`  ${file}`);
    if (!write) {
      console.error('Run `npm run format:css` to apply canonical formatting.');
      process.exitCode = 1;
    }
  } else {
    console.log(`CSS formatting OK: ${cssFiles().length} files.`);
  }
}
