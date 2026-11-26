import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/buttons.html');

/**
 * Design-system action button configuration. Icons and custom content are
 * structured render plans, not HTML strings; scalar labels render as text.
 * @typedef {Object} ButtonOptions
 * @property {string} [label] User-facing action label.
 * @property {import('./render-plan.js').RenderContent} [trustedContent] Optional replacement for the icon and label.
 * @property {string} [action] Delegated data-act identifier.
 * @property {'primary'|'secondary'|'destructive'|'text'|'icon'} [variant] Visual emphasis.
 * @property {'default'|'small'|'large'} [size] Button size.
 * @property {'button'|'submit'|'reset'} [type] Native form behavior.
 * @property {import('./render-plan.js').RenderContent} [icon] Optional icon.
 * @property {boolean} [iconOnly] Hide visible label while retaining the accessible name.
 * @property {boolean} [wrapLabel] Wrap the visible label for styling.
 * @property {Object<string, import('./render-plan.js').BindingScalar>} [data] Additional data attributes, without the data- prefix.
 * @property {string} [title] Optional tooltip.
 * @property {string} [ariaLabel] Explicit accessible name.
 * @property {boolean} [disabled] Disable activation.
 * @property {boolean} [loading] Disable activation and mark the button busy.
 * @property {string} [className] Additional CSS class names.
 * @property {import('./render-plan.js').AttributeMap} [attributes] Additional validated attributes.
 */


/**
 * Renders a shared button with text and delegated actions.
 *
 * @param {!ButtonOptions=} options Button label, content, delegated action and visual state.
 * @return {!import('./render-plan.js').RenderPlan} Accessible action button in the requested design-system variant.
 * @throws {RangeError} If a variant, size, button type or data attribute name is unsupported.
 */
export function actionButton({
  label = '',
  trustedContent = '',
  action = '',
  variant = 'secondary',
  size = 'default',
  type = 'button',
  icon = '',
  iconOnly = false,
  wrapLabel = false,
  data = {},
  title = '',
  ariaLabel = '',
  disabled = false,
  loading = false,
  className = '',
  attributes = {}
} = {}) {
  const variants = {
    primary: 'primary',
    secondary: '',
    destructive: 'danger',
    text: 'ds-button--text',
    icon: 'ds-button--icon',
  };
  if (!Object.hasOwn(variants, variant)) throw new RangeError('Invalid button variant');
  if (!['default', 'small', 'large'].includes(size)) throw new RangeError('Invalid button size');
  if (!['button', 'submit', 'reset'].includes(type)) throw new RangeError('Invalid button type');
  const safe = String(label);
  const classes = [
    'btn',
    'ds-button',
    variants[variant],
    size === 'small' ? 'small' : '',
    size === 'large' ? 'ds-button--large' : '',
    iconOnly || variant === 'icon' ? 'ds-button--icon' : '',
    className,
  ].filter(Boolean).join(' ');
  const dataAttributes = Object.fromEntries(Object.entries(data).map(([key, value]) => {
    if (!/^[a-z][a-z0-9-]*$/.test(key)) {
      throw new RangeError('Invalid button data attribute');
    }
    return [`data-${key}`, String(value)];
  }));
  // Additional attributes are validated by the shared binding contract.
  return renderTemplate('actionButtonButton', {
    classes: classes,
    type: type,
    dataActAttributes: action ? {"data-act": action} : {},
    ariaLabelAttributes: ariaLabel || iconOnly ? {"aria-label": String(ariaLabel || label)} : {},
    disabledAttributes: disabled || loading ? {"disabled": true} : {},
    ariaBusyAttributes: loading ? {"aria-busy": "true"} : {},
    dataAttributes: dataAttributes,
    titleAttributes: title ? {"title": String(title)} : {},
    attributes: attributes,
    trustedContent: trustedContent || icon,
    buttonLabel: trustedContent ? '' : iconOnly ? '' : wrapLabel ? renderTemplate('actionButtonSpan', {label: safe, }) : safe,
  });
}
