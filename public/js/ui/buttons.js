import {escapeHtml} from './dom.js';

/**
 * Renders a standard action button with delegated events and state.
 * @param {!Object=} options Button configuration; labels are escaped.
 * @param {string=} options.label Visible text or icon-only accessible name.
 * @param {string=} options.action Delegated data-act identifier.
 * @param {string=} options.variant Primary, secondary, destructive, text or icon.
 * @param {string=} options.size Default, small or large.
 * @param {string=} options.icon Trusted application-generated SVG markup.
 * @param {boolean=} options.loading Disables action and sets aria-busy.
 * @param {string=} options.attributes Trusted static HTML attributes only.
 * @return {string} Button markup.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function actionButton({label = '', action = '', variant = 'secondary', size = 'default',
  type = 'button', icon = '', iconOnly = false, disabled = false, loading = false,
  className = '', attributes = ''} = {}) {
  const variants = {primary: 'primary', secondary: '', destructive: 'danger', text: 'ds-button--text', icon: 'ds-button--icon'};
  if (!Object.hasOwn(variants, variant)) throw new RangeError('Invalid button variant');
  if (!['default', 'small', 'large'].includes(size)) throw new RangeError('Invalid button size');
  if (!['button', 'submit', 'reset'].includes(type)) throw new RangeError('Invalid button type');
  const safe = escapeHtml(String(label));
  const classes = ['btn', 'ds-button', variants[variant], size === 'small' ? 'small' : '',
    size === 'large' ? 'ds-button--large' : '', iconOnly || variant === 'icon' ? 'ds-button--icon' : '', className].filter(Boolean).join(' ');
  // attributes is app-owned static HTML only; never pass input/user data.
  return `<button class="${escapeHtml(classes)}" type="${type}"${action ? ` data-act="${escapeHtml(action)}"` : ''}${iconOnly ? ` aria-label="${safe}"` : ''}${disabled || loading ? ' disabled' : ''}${loading ? ' aria-busy="true"' : ''}${attributes ? ` ${attributes}` : ''}>${icon}${iconOnly ? '' : safe}</button>`;
}
