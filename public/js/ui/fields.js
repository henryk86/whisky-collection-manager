import {escapeHtml} from './dom.js';

/** Existing field APIs are kept. Labels, names and values are escaped;
 * description/error nodes use stable ids for accessible control associations. */
const e = value => escapeHtml(String(value ?? ''));
function props(name, options = {}) {
  const messages = [options.description ? `ds-${e(name)}-hint` : '', options.error ? `ds-${e(name)}-error` : ''].filter(Boolean);
  return `name="${e(name)}"${options.required ? ' required' : ''}${options.disabled ? ' disabled' : ''}${options.error ? ' aria-invalid="true"' : ''}${messages.length ? ` aria-describedby="${messages.join(' ')}"` : ''}`;
}
function help(name, options = {}) {
  return `${options.description ? `<span class="ds-field-description" id="ds-${e(name)}-hint">${e(options.description)}</span>` : ''}${options.error ? `<span class="ds-field-error" id="ds-${e(name)}-error" role="alert">${e(options.error)}</span>` : ''}`;
}
function wrapper(label, name, control, options = {}) {
  return `<label class="form-field ds-form-field${options.full ? ' full' : ''}">${e(label)}${control}${help(name, options)}</label>`;
}
/**
 * Renders a labeled input with accessible hint and error references.
 * @param {string} label Escaped field caption.
 * @param {string} name Form field name.
 * @param {string=} value Initial value.
 * @param {!Object=} options Optional type, hint, validation and layout flags.
 * @return {string} Labeled input HTML.
 */
export const textInput = (label, name, value = '', options = {}) => wrapper(label, name,
  `<input ${props(name, options)} type="${e(options.type || 'text')}"${options.step != null ? ` step="${e(options.step)}"` : ''} value="${e(value)}"${options.placeholder ? ` placeholder="${e(options.placeholder)}"` : ''}>`, options);
/**
 * Renders a labeled select with escaped values and option text.
 * @param {string} label Escaped field caption.
 * @param {string} name Form field name.
 * @param {!Array<!Array<(string|number)>>} options Select value/text pairs.
 * @param {string=} value Selected value.
 * @param {!Object=} config Optional hint, validation and layout flags.
 * @return {string} Labeled select HTML.
 */
export const selectInput = (label, name, options, value = '', config = {}) => wrapper(label, name,
  `<select ${props(name, config)}>${options.map(([v, t]) => `<option value="${e(v)}"${String(v) === String(value ?? '') ? ' selected' : ''}>${e(t)}</option>`).join('')}</select>`, config);
/**
 * Renders a multiline field with associated help and error text.
 * @param {string} label Escaped field caption.
 * @param {string} name Form field name.
 * @param {string=} value Initial text.
 * @param {!Object=} options Optional validation and layout flags.
 * @return {string} Labeled textarea HTML.
 */
export const areaInput = (label, name, value = '', options = {}) => wrapper(label, name,
  `<textarea ${props(name, options)}>${e(value)}</textarea>`, {...options, full: options.full !== false});
/**
 * Renders an accessible checkbox with optional description and error.
 * @param {string} label Escaped field caption.
 * @param {string} name Form field name.
 * @param {boolean=} checked Initial checked state.
 * @param {!Object=} options Optional hint, validation and layout flags.
 * @return {string} Labeled checkbox HTML.
 */
export const checkboxInput = (label, name, checked = false, options = {}) => `<label class="form-field ds-checkbox-field${options.full ? ' full' : ''}"><input type="checkbox" ${props(name, options)}${checked ? ' checked' : ''}><span>${e(label)}</span>${help(name, options)}</label>`;
