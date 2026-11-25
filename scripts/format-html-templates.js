/** @fileoverview Formats external HTML templates without rewriting bindings. */
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {listTemplateFiles} from './template-files.js';

const block = 'article|aside|div|fieldset|form|h[1-6]|header|footer|' +
  'legend|li|main|nav|ol|p|section|table|tbody|td|th|thead|tr|ul';
const blockTag = new RegExp(`^</?(?:${block})(?:[\\s>])`, 'i');
const tokenPattern = /<!--[\s\S]*?-->|<\/?(?:[^>"']|"[^"]*"|'[^']*')+>/g;
const attributeToken = /(?:[^\s"']|"[^"]*"|'[^']*')+/g;
const voidElement = new RegExp('^(?:area|base|br|col|embed|hr|img|input|link|meta|' + 'param|source|track|wbr)$', 'i');

/**
 * Formats structural markup and long attribute lists. Inline text, quoted
 * attribute values, binding names and SVG content are left unchanged.
 * @param {string} source Contents of an external template file.
 * @return {string} Formatted LF source.
 */
export function formatTemplateFile(source) {
  const protectedParts = [];
  const normalized = source.replace(/\r\n?/g, '\n').replace(
    /<(pre|textarea|svg|code)\b[^>]*>[\s\S]*?<\/\1>/gi,
    value => `\u0000${protectedParts.push(value) - 1}\u0000`);
  let depth = 0;
  let cursor = 0;
  let previous = '';
  let result = '';
  for (const match of normalized.matchAll(tokenPattern)) {
    const tag = match[0];
    const between = normalized.slice(cursor, match.index);
    if (tag.startsWith('<!--')) {
      depth = 0;
      result += between + tag;
    } else {
      const closing = tag.startsWith('</');
      const name = tag.match(/^<\/?([\w:-]+|\{\{tag:[\w.]+\}\})/)?.[1];
      if (closing) depth = Math.max(0, depth - 1);
      const indent = '  '.repeat(depth);
      if ((!between && blockTag.test(previous) && blockTag.test(tag)) || /^\n[ \t]*$/.test(between)) {
        result += '\n' + indent;
      } else result += between;
      const parts = tag.slice(1, -1).match(attributeToken) || [];
      const compact = '<' + parts.join(' ') + '>';
      if (!closing && parts.length > 1 && compact.length + indent.length > 100) {
        result += `<${parts[0]}\n${parts.slice(1).map(part => indent + '  ' + part).join('\n')}>`;
      } else result += compact;
      if (!closing && !tag.endsWith('/>') && !voidElement.test(name || '')) {
        depth++;
      }
    }
    cursor = match.index + tag.length;
    previous = tag;
  }
  return (result + normalized.slice(cursor)).replace(/\u0000(\d+)\u0000/g, (_, index) => protectedParts[Number(index)]);
}

/**
 * Writes formatted templates or reports violations for CI.
 * @param {boolean} write Whether to update the files.
 */
function main(write) {
  const files = listTemplateFiles();
  const changed = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const formatted = formatTemplateFile(source);
    if (source !== formatted) {
      changed.push(file);
      if (write) writeFileSync(file, formatted);
    }
  }
  if (changed.length && !write) {
    throw new Error('Run `npm run format:html` before committing.\n' + changed.join('\n'));
  }
  console.log(`${files.length} external HTML template files: format OK.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.includes('--write'));
}
