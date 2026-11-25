import {escapeHtml} from './dom.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/buttons.html');


/**
 * Renders a shared button with escaped text and delegated actions.
 *
 * @param {!Object=} options Button configuration; never pass user HTML to
 * slots. `trustedContent` accepts only application-generated, escaped HTML;
 * never pass user content directly.
 * @return {string} HTML button markup.
 * @throws {RangeError} If a variant, size or button type is unsupported.
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
  const safe = escapeHtml(String(label));
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
