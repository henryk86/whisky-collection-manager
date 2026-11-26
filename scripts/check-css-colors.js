/**
 * @fileoverview Enforces design-system colour ownership in first-party CSS.
 * Raw palette values belong to tokens.css or palette-*.css, never views.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const STYLES = path.resolve('public/styles');
const ALLOWED = new Set(['tokens.css', 'palette-bottle.css',
  'palette-map.css', 'palette-warehouse.css']);

/**
 * Finds CSS declaration values containing a direct colour, not a token.
 * Comments and CSS property names are excluded from the check.
 *
 * @param {string} source CSS stylesheet contents.
 * @return {!Array<string>} Offending declaration values.
 */
export function directColors(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = /(?:(?<=^)|(?<=[\n{;]))\s*[\w-]+\s*:\s*([^;{}]*);/gm;
  const functional = new RegExp('#[a-f\\d]{3,8}\\b|\\b(?:rgba?|hsla?|oklch|oklab|' + 'lab|lch|hwb|color)\\s*\\(', 'i');
  const named = new RegExp(
    '(?<![\\w-])(?:white|black|red|green|blue|yellow|orange|' +
    'gray|grey|purple|teal|silver|maroon|olive|lime|aqua|fuchsia)' +
    '(?![\\w-])', 'i'
  );
  const result = [];
  for (const match of css.matchAll(declarations)) {
    const value = match[1];
    if (functional.test(value) || named.test(value)) {
      result.push(value.trim().replace(/\s+/g, ' '));
    }
  }
  return result;
}

/**
 * Finds design-system variables referenced without any CSS definition.
 *
 * @param {!Array<string>} sources Contents of the loaded CSS stylesheets.
 * @return {!Array<string>} Undefined design-system token names.
 */
export function missingDesignTokens(sources) {
  const css = sources.join('\n');
  const defined = new Set([...css.matchAll(/(--ds-[\w-]+)\s*:/g)].map(match => match[1]));
  const requested = new Set([...css.matchAll(/var\(\s*(--ds-[\w-]+)/g)].map(match => match[1]));
  return [...requested].filter(name => !defined.has(name)).sort();
}

/**
 * Validates that only approved palette stylesheets contain literal colours.
 *
 * @param {string} directory Directory with application CSS files.
 * @return {!Array<string>} Violations with file names and values.
 */
export function colorViolations(directory) {
  const errors = [];
  const sources = [];
  const entry = path.resolve(directory, '../style.css');
  if (fs.existsSync(entry)) {
    const css = fs.readFileSync(entry, 'utf8');
    sources.push(css);
    for (const value of directColors(css)) {
      errors.push(`style.css: ${value}`);
    }
  }
  for (const name of fs.readdirSync(directory).sort()) {
    if (!name.endsWith('.css')) continue;
    const css = fs.readFileSync(path.join(directory, name), 'utf8');
    sources.push(css);
    if (ALLOWED.has(name)) continue;
    for (const value of directColors(css)) {
      errors.push(`${name}: ${value}`);
    }
  }
  for (const token of missingDesignTokens(sources)) {
    errors.push(`Undefined design token: ${token}`);
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = colorViolations(STYLES);
  if (errors.length) {
    console.error(`Hard-coded CSS colours:\n${errors.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('CSS colour contract: shared and feature palettes only.');
  }
}
