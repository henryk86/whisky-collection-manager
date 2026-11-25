import {escapeHtml} from './dom.js';

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
  attributes = ''
} = {}) {
  const variants = {
    primary: 'primary',
    secondary: '',
    destructive: 'danger',
    text: 'ds-button--text',
    icon: 'ds-button--icon',
  };
  if (!Object.hasOwn(variants, variant)) throw new RangeError(
    'Invalid button variant');
  if (!['default', 'small', 'large']
    .includes(size)) throw new RangeError('Invalid button size');
  if (!['button', 'submit', 'reset']
    .includes(type)) throw new RangeError('Invalid button type');
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
  const dataAttributes = Object.entries(data).map(([key, value]) => {
    if (!/^[a-z][a-z0-9-]*$/.test(key)) {
      throw new RangeError('Invalid button data attribute');
    }
    return ` data-${key}="${escapeHtml(String(value))}"`;
  }).join('');
  // attributes is app-owned static HTML only; never pass input/user data.
  return `<button class="${escapeHtml(classes)}" type="${type}"${action ?
    ` data-act="${escapeHtml(action)}"` : ''}${ariaLabel || iconOnly ?
      ` aria-label="${escapeHtml(String(ariaLabel || label))}"` :
      ''}${disabled || loading ? ' disabled' :
        ''}${loading ? ' aria-busy="true"' : ''}${dataAttributes}${title ?
          ` title="${escapeHtml(String(title))}"` : ''}${attributes ?
            ` ${attributes}` : ''}>${trustedContent || icon}${trustedContent ?
              '' : iconOnly ? '' : wrapLabel ? `<span>${safe}</span>` :
                safe}</button>`;
}
