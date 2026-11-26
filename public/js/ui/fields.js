import {composeMarkup} from './render-plan.js';
import {escapeHtml} from './dom.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/fields.html');

/**
 * Shared input accessibility and presentation options. The field builders
 * link description and validation messages using IDs derived from the name.
 * @typedef {Object} FieldOptions
 * @property {boolean} [required] Native required constraint.
 * @property {boolean} [disabled] Native disabled state.
 * @property {string} [description] Accessible hint text.
 * @property {string} [error] Validation message; sets aria-invalid.
 * @property {boolean} [full] Use the full-width field layout.
 * @property {string} [type] Native input type for textInput.
 * @property {string|number} [step] Native numeric input increment.
 * @property {string} [placeholder] Optional text input placeholder.
 */


/**
 * Encodes a field value for a legacy scalar template binding.
 *
 * @param {*} value Initial field value; nullish values become empty text.
 * @return {string} Encoded scalar value.
 */
const e = value => escapeHtml(String(value ?? ''));

/**
 * Builds accessible input attributes with stable hint and error references.
 *
 * @param {string} name Form field name, escaped before interpolation.
 * @param {FieldOptions=} options Validation state and hint/error text.
 * @return {!Object} Accessible control attributes.
 */
function props(name, options = {}) {
  const messages = [options.description ? `ds-${name}-hint` : '', options.error ? `ds-${name}-error` : '',].filter(Boolean);
  return {
    name,
    required: options.required || null,
    disabled: options.disabled || null,
    'aria-invalid': options.error ? 'true' : null,
    'aria-describedby': messages.length ? messages.join(' ') : null,
  };
}

/**
 * Renders optional hint and error elements referenced by the input.
 *
 * @param {string} name Field name used for unique element identifiers.
 * @param {FieldOptions=} options Description and optional validation error.
 * @return {import('./render-plan.js').RenderPlan|string} Help and error content, or empty text if neither is set.
 */
function help(name, options = {}) {
  return composeMarkup(options.description ?
    renderTemplate('dsFieldDescription', {
      name: e(name),
      description: e(options.description),
    }) : '', options.error ?
    renderTemplate('dsFieldError', {
      name: e(name),
      error: e(options.error),
    }) : '');
}

/**
 * Groups a trusted control and its escaped label and accessible messages.
 *
 * @param {string} label User-facing field label.
 * @param {string} name Field name used by the associated help elements.
 * @param {!import('./render-plan.js').RenderPlan} control Prepared input control.
 * @param {FieldOptions=} options Layout and message settings.
 * @return {!import('./render-plan.js').RenderPlan} Labeled field with optional accessible messages.
 */
function wrapper(label, name, control, options = {}) {
  return renderTemplate('formField', {
    full: options.full ? ' full' : '',
    label: e(label),
    control: control,
    help: help(name, options),
  });
}

/**
 * Renders a labeled text input with accessible hints and errors.
 *
 * @param {string} label User-facing control label.
 * @param {string} name Form input name.
 * @param {string|number|null=} value Initial input value; nullish values render empty.
 * @param {FieldOptions=} options Validation, type, hint and layout settings.
 * @return {!import('./render-plan.js').RenderPlan} Labeled input control.
 */
export const textInput = (label, name, value = '', options = {}) => wrapper(
  label,
  name,
  renderTemplate('textInputInput', {
    props: props(name, options),
    type: e(options.type || 'text'),
    stepAttributes: options.step != null ? {"step": options.step} : {},
    value: e(value),
    placeholderAttributes: options.placeholder ? {"placeholder": options.placeholder} : {},
  }),
  options
);

/**
 * Renders a labeled select with escaped option values and captions.
 *
 * @param {string} label User-facing control label.
 * @param {string} name Form input name.
 * @param {!Array<!Array<(string|number)>>} options Value/caption option
 * pairs.
 * @param {string|number|null=} value Initially selected value, compared as text.
 * @param {FieldOptions=} config Validation, hint and layout settings.
 * @return {!import('./render-plan.js').RenderPlan} Labeled select control.
 */
export const selectInput =
  (label, name, options, value = '', config = {}) => wrapper(
    label,
    name,
    renderTemplate('select', {
      props: props(name, config),
      options: composeMarkup(options.map(([v, t]) =>
        renderTemplate('selectInputOption', {
          v: e(v),
          selectedAttributes: String(v) === String(value ?? '') ? {"selected": true} : {},
          t: e(t),
        }))),
    }),
    config
  );

/**
 * Renders a multiline input with linked hints and error text.
 *
 * @param {string} label User-facing control label.
 * @param {string} name Form field name.
 * @param {string=} value Initial textarea text.
 * @param {FieldOptions=} options Validation and layout settings.
 * @return {!import('./render-plan.js').RenderPlan} Labeled textarea control.
 */
export const areaInput = (label, name, value = '', options = {}) => wrapper(
  label,
  name,
  renderTemplate('textarea', {
    props: props(name, options),
    value: e(value),
  }),
  {...options, full: options.full !== false}
);

/**
 * Renders a checkbox with accessible description and error state.
 *
 * @param {string} label User-facing control label.
 * @param {string} name Form input name.
 * @param {boolean=} checked Initial checkbox state.
 * @param {!Object=} options Validation, hint and layout settings.
 * @return {!import('./render-plan.js').RenderPlan} Labeled checkbox control.
 */
export const checkboxInput = (label, name, checked = false, options = {}) =>
  renderTemplate('formField2', {
    full: options.full ? ' full' : '',
    props: props(name, options),
    checkedAttributes: checked ? {"checked": true} : {},
    label: e(label),
    help: help(name, options),
  });
