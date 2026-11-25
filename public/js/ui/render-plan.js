/**
 * @fileoverview Composable template data, independent of DOM or HTML output.
 */
import {t} from '../i18n/index.js';
import {decodeEscaped} from './bindings.js';

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
 * String-only sequences contain scalar text, never generated HTML.
 * @param {...*} parts Nested plans or already escaped text.
 * @return {(RenderPlan|string)} Sequence or scalar text.
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
