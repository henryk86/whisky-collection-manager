import {escapeHtml} from './dom.js';

/** Existing field APIs are kept. Labels, names and values are escaped;
 * description/error nodes use stable ids for accessible control associations. */
const e = value => escapeHtml(String(value ?? ''));

/**
 * Builds accessible input attributes with stable hint and error references.
 *
 * @param {string} name Form field name, escaped before interpolation.
 * @param {!Object=} options Validation state and hint/error text.
 * @return {string} Trusted HTML attributes.
 */
function props(name, options = {}) {
  const messages = [
    options.description ? `ds-${e(name)}-hint` : '',
    options.error ? `ds-${e(name)}-error` : '',
  ].filter(Boolean);
  return `name="${e(name)}"${options.required ? ' required' :
    ''}${options.disabled ? ' disabled' : ''}${options.error ?
      ' aria-invalid="true"' : ''}${messages.length ?
        ` aria-describedby="${messages.join(' ')}"` : ''}`;
}

/**
 * Renders optional hint and error elements referenced by the input.
 *
 * @param {string} name Field name used for unique element identifiers.
 * @param {!Object=} options Description and optional validation error.
 * @return {string} Escaped inline help markup.
 */
function help(name, options = {}) {
  return `${options.description ?
    `<span class="ds-field-description" id="ds-${e(name)}-hint">${e(options.description)}</span>` : ''}${options.error ? `<span class="ds-field-error" id="ds-${e(name)}-error" role="alert">${e(options.error)}</span>` : ''}`;
}

/**
 * Groups a trusted control and its escaped label and accessible messages.
 *
 * @param {string} label User-facing field label.
 * @param {string} name Field name used by the associated help elements.
 * @param {string} control Trusted application-generated input markup.
 * @param {!Object=} options Layout and message settings.
 * @return {string} Complete labeled form-field HTML.
 */
function wrapper(label, name, control, options = {}) {
  return `<label class="form-field ds-form-field${options.full ? ' full' :
    ''}">${e(label)}${control}${help(name, options)}</label>`;
}

/**
 * Renders a labeled text input with accessible hints and errors.
 *
 * @param {string} label HTML-escaped control label.
 * @param {string} name Form input name.
 * @param {string=} value Initial input value.
 * @param {!Object=} options Validation, type, hint and layout settings.
 * @return {string} Labeled input HTML.
 */
export const textInput = (label, name, value = '', options = {}) => wrapper(
  label,
  name,
  `<input ${props(name, options)} type="${e(options.type ||
    'text')}"${options.step != null ? ` step="${e(options.step)}"` :
      ''} value="${e(value)}"${options.placeholder ?
        ` placeholder="${e(options.placeholder)}"` : ''}>`,
  options
);

/**
 * Renders a labeled select with escaped option values and captions.
 *
 * @param {string} label HTML-escaped control label.
 * @param {string} name Form input name.
 * @param {!Array<!Array<(string|number)>>} options Value/caption option pairs.
 * @param {string=} value Initially selected option value.
 * @param {!Object=} config Validation, hint and layout settings.
 * @return {string} Labeled select HTML.
 */
export const selectInput =
  (label, name, options, value = '', config = {}) => wrapper(
    label,
    name,
    `<select ${props(name, config)}>${options.map(([v, t]) =>
      `<option value="${e(v)}"${String(v) === String(value ?? '') ?
        ' selected' : ''}>${e(t)}</option>`).join('')}</select>`,
    config
  );

/**
 * Renders a multiline input with linked hints and error text.
 *
 * @param {string} label HTML-escaped control label.
 * @param {string} name Form field name.
 * @param {string=} value Initial textarea text.
 * @param {!Object=} options Validation and layout settings.
 * @return {string} Labeled textarea HTML.
 */
export const areaInput = (label, name, value = '', options = {}) => wrapper(
  label,
  name,
  `<textarea ${props(name, options)}>${e(value)}</textarea>`,
  {...options, full: options.full !== false}
);

/**
 * Renders a checkbox with accessible description and error state.
 *
 * @param {string} label HTML-escaped control label.
 * @param {string} name Form input name.
 * @param {boolean=} checked Initial checkbox state.
 * @param {!Object=} options Validation, hint and layout settings.
 * @return {string} Labeled checkbox HTML.
 */
export const checkboxInput = (label, name, checked = false, options = {}) =>
  `<label class="form-field ds-checkbox-field${options.full ? ' full' :
    ''}"><input type="checkbox" ${props(name, options)}${checked ?
      ' checked' : ''}><span>${e(label)}</span>${help(name, options)}</label>`;
