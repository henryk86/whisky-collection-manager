/** @fileoverview Structural validation for application-owned HTML fragments. */
export const tagPattern = /<!--[\s\S]*?-->|<\/?(?:[^>"']|"[^"]*"|'[^']*')+>/g;
export const voidElement = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
const namePattern = /^<\/?([\w:-]+|\{\{tag:[\w.]+\}\})/;
const binding = /\{\{([\w]+):([\w.]+)\}\}/g;

/**
 * Checks balanced tags and binding placement before a fragment reaches the browser.
 * Dynamic tag variants share a structural name; the renderer validates their values.
 * @param {string} markup Static template fragment.
 * @param {string} context Filename and fragment name for diagnostics.
 */
export function validateTemplateStructure(markup, context) {
  const stack = [];
  let cursor = 0;
  /**
   * Reports a structural error with the owning template name.
   * @param {string} message Description of the invalid construct.
   */
  const fail = message => {throw new Error(`${context}: ${message}`);};

  /**
   * Validates bindings between elements.
   * @param {string} text Text between tags.
   */
  const checkContent = text => {
    for (const [, mode, name] of text.matchAll(binding)) {
      if (!['content', 'text', 't'].includes(mode)) fail(`Invalid ${mode} binding ${name} in element content`);
    }
  };
  for (const match of markup.matchAll(tagPattern)) {
    checkContent(markup.slice(cursor, match.index));
    const token = match[0];
    cursor = match.index + token.length;
    if (token.startsWith('<!--') || /^<!doctype\s/i.test(token)) continue;
    const rawName = token.match(namePattern)?.[1];
    if (!rawName) fail(`Invalid tag ${token}`);
    const name = rawName.startsWith('{{') ? 'dynamic-tag' : rawName.toLowerCase();
    const closing = token.startsWith('</');
    // Quoted values can contain scalar or translated text, not a group of attributes.
    const rest = token.slice(rawName.length + (closing ? 2 : 1), -1);
    for (const part of rest.matchAll(/"[^"]*"|'[^']*'|\{\{[\w]+:[\w.]+\}\}/g)) {
      const quoted = part[0][0] === '"' || part[0][0] === "'";
      for (const [, mode, key] of part[0].matchAll(binding)) {
        if (closing || (quoted ? !['attr', 'text', 't'].includes(mode) : mode !== 'attrs')) {
          fail(`Invalid ${mode} binding ${key} in tag attributes`);
        }
      }
    }
    if (closing) {
      if (stack.pop() !== name) fail(`Unbalanced closing tag ${rawName}`);
    } else if (!voidElement.test(name) && !token.endsWith('/>')) {
      stack.push(name);
    }
  }
  checkContent(markup.slice(cursor));
  if (stack.length) fail(`Unclosed tag ${stack.at(-1)}`);
}
