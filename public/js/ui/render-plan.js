/**
 * @fileoverview Composable template data, independent of DOM or HTML output.
 */
import {t} from '../i18n/index.js';
import {escapeHtml} from './dom.js';
import {attributeEntries, checkedTag, decodeEscaped} from './bindings.js';

export const SLOT = /\{\{(content|attr|attrs|text|t|tag):([\w.]+)\}\}/g;

/** Immutable description of a template instance or a sequence of instances. */
export class RenderPlan {
  /**
   * Creates a render plan for a static fragment or a sequence.
   * @param {string} source Static, application-owned template source.
   * @param {!Object} values Slot values.
   * @param {?Array<*>=} parts Ordered children for a sequence, or null.
   */
  constructor(source, values, parts = null) {
    this.source = source;
    this.values = Object.freeze({...values});
    this.parts = parts && Object.freeze([...parts]);
    Object.freeze(this);
  }

  /**
   * Rejects accidental HTML-string composition in browser renderers.
   * @return {string} Never returns normally.
   * @throws {TypeError} Render plans must be composed as data.
   */
  toString() {
    throw new TypeError('Compose render plans with composeMarkup');
  }
}

/**
 * Composes ordered fragments without coercing native render plans to strings.
 * String-only sequences support the DOM-free serialization adapter in tests.
 * @param {...*} parts Nested plans or already escaped text.
 * @return {(RenderPlan|string)} Sequence, or empty/serialized text.
 */
export function composeMarkup(...parts) {
  const items = parts.flat(Infinity).filter(item => item != null && item !== '');
  if (items.every(item => !(item instanceof RenderPlan))) {
    return items.join('');
  }
  return new RenderPlan('', {}, items);
}

/**
 * Resolves a named binding, including language-dependent static labels.
 * @param {!RenderPlan} plan Template instance.
 * @param {string} mode Slot kind.
 * @param {string} key Slot name or translation key.
 * @return {*} Binding value.
 */
export function slotValue(plan, mode, key) {
  if (mode === 't') return t(key);
  if (!Object.hasOwn(plan.values, key)) {
    throw new Error(`Missing slot ${key} in template`);
  }
  return plan.values[key];
}

/**
 * Compacts structural whitespace for DOM-free markup assertions, preserving
 * quoted attributes, user data, and inline spacing.
 * @param {string} source Static template source.
 * @return {string} Canonical markup for the test adapter.
 */
function compactTemplate(source) {
  return source.replace(/<\/?(?:[^>"']|"[^"]*"|'[^']*')+>/g, tag =>
    tag.replace(/"[^"]*"|'[^']*'|\s+/g, part => /^\s/.test(part) ? ' ' : part))
    .replace(/>\n[ \t]*</g, '><');
}

/**
 * Resolves a scalar binding using the same rules as the browser renderer.
 * @param {!RenderPlan} plan Template instance.
 * @param {string} mode Binding type.
 * @param {string} key Slot name.
 * @return {string} Literal scalar text.
 */
export function scalarBinding(plan, mode, key) {
  const value = slotValue(plan, mode, key);
  if (value != null && !['string', 'number', 'boolean'].includes(typeof value)) {
    throw new TypeError(`Non-scalar binding: ${key}`);
  }
  return mode === 'attr' || mode === 'content' ? decodeEscaped(value) : String(value ?? '');
}

/**
 * Serializes a render plan for diagnostic/test assertions. Shares binding
 * normalization and structural validation with native DOM materialization.
 * @param {*} value Render plan or scalar content.
 * @return {string} Escaped markup representation.
 */
export function serializeMarkup(value) {
  if (!(value instanceof RenderPlan)) return escapeHtml(decodeEscaped(value));
  if (value.parts) return value.parts.map(serializeMarkup).join('');
  const source = compactTemplate(value.source);
  return source.replace(SLOT, (_, mode, key, offset) => {
    const binding = slotValue(value, mode, key);
    if (mode === 'tag') return checkedTag(binding);
    if (mode === 'attrs') {
      const attributes = attributeEntries(binding).map(([name, text, flag]) =>
        flag ? name : `${name}="${escapeHtml(text)}"`).join(' ');
      return attributes && (/\s/.test(source[offset - 1]) ? '' : ' ') + attributes;
    }
    if (mode === 'content' && binding instanceof RenderPlan) return serializeMarkup(binding);
    return escapeHtml(scalarBinding(value, mode, key));
  });
}
