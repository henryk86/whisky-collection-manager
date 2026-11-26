/**
 * @fileoverview Composable template data, independent of DOM or HTML output.
 */
import {t} from '../i18n/index.js';

export const SLOT = /\{\{(content|attr|attrs|text|t|tag):([\w.]+)\}\}/g;

/**
 * A scalar template value. Null and undefined render as absent or empty text.
 * @typedef {string|number|boolean|null|undefined} BindingScalar
 */

/**
 * Named DOM attributes. False omits boolean HTML attributes but remains a
 * literal value for other attributes, including ARIA.
 * @typedef {Object<string, BindingScalar>} AttributeMap
 */

/**
 * Content accepted by native DOM materialization. Scalar values are converted
 * to text, never parsed as dynamic HTML; existing nodes are moved, not cloned.
 * @typedef {RenderPlan|Node|BindingScalar} RenderContent
 */

/**
 * Ordered inputs to composeMarkup. Nested arrays are flattened; scalar-only
 * sequences are joined as text, never parsed as HTML.
 * Deeper nesting is permitted; the element contract remains the same at each depth.
 * @typedef {RenderPlan|BindingScalar|Array<RenderPlan|BindingScalar|Array<*>>} PlanPart
 */

/**
 * Named values for a template fragment. Structural tag choices are strings;
 * content and attribute maps are validated according to their slot kinds.
 * @typedef {Object<string, RenderContent|AttributeMap>} TemplateBindings
 */

/**
 * Synchronous factory for an instance of a loaded, named template fragment.
 * @callback TemplateRenderer
 * @param {string} name Fragment name in the external template file.
 * @param {TemplateBindings=} values Named slot values.
 * @return {!RenderPlan} Plan to materialize in the target DOM context.
 */

/** Immutable description of a template instance or a sequence of instances. */
export class RenderPlan {
  /**
   * Creates a render plan for a static fragment or a sequence.
   * @param {string} source Static, application-owned template source.
   * @param {!TemplateBindings} values Named bindings for the static fragment.
   * @param {?Array<RenderContent>=} parts Flattened ordered children for a sequence, or null for a fragment.
   */
  constructor(source, values, parts = null) {
    this.source = source;
    this.values = Object.freeze({...values});
    this.parts = parts && Object.freeze([...parts]);
    Object.freeze(this);
  }

  /**
   * Rejects accidental HTML-string composition in browser renderers.
   * @return {never} Always throws; a plan cannot be coerced to HTML.
   * @throws {TypeError} Render plans must be composed as data.
   */
  toString() {
    throw new TypeError('Compose render plans with composeMarkup');
  }
}

/**
 * Composes ordered fragments without coercing native render plans to strings.
 * String-only sequences contain scalar text, never generated HTML.
 * @param {...PlanPart} parts Content or recursively nested sequences; empty and nullish entries are omitted.
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
 * @return {RenderContent|AttributeMap} Value supplied to the named slot.
 * @throws {Error} If the requested non-translation slot is absent.
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
 * @throws {TypeError} If the slot value is neither scalar nor nullish.
 */
export function scalarBinding(plan, mode, key) {
  const value = slotValue(plan, mode, key);
  if (value != null && !['string', 'number', 'boolean'].includes(typeof value)) {
    throw new TypeError(`Non-scalar binding: ${key}`);
  }
  return String(value ?? '');
}
