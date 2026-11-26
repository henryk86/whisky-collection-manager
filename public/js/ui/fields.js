import {composeMarkup} from './render-plan.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/fields.html');

/**
 * Builds accessible input attributes with stable hint and error references.
 *
 * @param {string} name Form field name, used literally for binding.
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
      name: String(name ?? ''),
      description: String(options.description ?? ''),
    }) : '', options.error ?
    renderTemplate('dsFieldError', {
      name: String(name ?? ''),
      error: String(options.error ?? ''),
    }) : '');
}

/**
 * Groups a trusted control and its text label and accessible messages.
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
    label: String(label ?? ''),
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
    type: String((options.type || 'text') ?? ''),
    stepAttributes: options.step != null ? {"step": options.step} : {},
    value: String(value ?? ''),
    placeholderAttributes: options.placeholder ? {"placeholder": options.placeholder} : {},
  }),
  options
);

/**
 * Renders a labeled select with literal option values and captions.
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
          v: String(v ?? ''),
          selectedAttributes: String(v) === String(value ?? '') ? {"selected": true} : {},
          t: String(t ?? ''),
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
    value: String(value ?? ''),
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
    label: String(label ?? ''),
    help: help(name, options),
  });
