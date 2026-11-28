import {chevronDownIcon} from './action-icons.js';
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
 * @property {Record<string, import('./render-plan.js').BindingScalar>} [data] Additional data attributes, without the data- prefix.
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

/**
 * Combines a primary action with an independently opened secondary-action disclosure.
 * The menu content consists of ordinary action buttons in the normal tab order.
 * @param {{id: string, label: string, primary: !ButtonOptions, menu: import('./render-plan.js').RenderContent}} options Unique menu ID, accessible disclosure label and actions.
 * @return {!import('./render-plan.js').RenderPlan} Shared split-button render plan.
 */
export function splitActionButton({id, label, primary, menu}) {
  return renderTemplate('splitActionButton', {
    primary: actionButton(primary),
    toggle: actionButton({
      label, icon: chevronDownIcon(), iconOnly: true, className: 'ds-split-toggle',
      attributes: {'aria-expanded': 'false', 'aria-controls': id, 'data-split-toggle': ''},
    }),
    id, menu,
  });
}

/**
 * Opens or closes the secondary-action disclosure without changing its primary action.
 * @param {!Element} group Split-button container.
 * @param {boolean} open Whether the disclosure should be visible.
 * @param {boolean=} restoreFocus Return keyboard focus to the disclosure button on close.
 */
function setSplitOpen(group, open, restoreFocus = false) {
  const toggle = /** @type {HTMLButtonElement} */ (group.querySelector('[data-split-toggle]'));
  const menu = /** @type {HTMLElement} */ (group.querySelector('.ds-split-menu'));
  if (!toggle || !menu) return;
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  if (restoreFocus) toggle.focus();
}

/**
 * Delegates disclosure interactions so split buttons also work after a view rerender.
 * @param {!Element} root Application root containing the split buttons.
 */
export function bindSplitButtons(root) {
  root.addEventListener('click', event => {
    const target = /** @type {Element} */ (event.target);
    const toggle = target.closest?.('[data-split-toggle]');
    const group = target.closest?.('.ds-split-button');
    for (const open of root.querySelectorAll('.ds-split-button:has([aria-expanded="true"][data-split-toggle])')) {
      if (open !== group) setSplitOpen(open, false);
    }
    if (!group) return;
    if (toggle) setSplitOpen(group, toggle.getAttribute('aria-expanded') !== 'true');
    else if (target.closest?.('.ds-split-menu button:not(:disabled)')) setSplitOpen(group, false, true);
    else if (!target.closest?.('.ds-split-menu')) setSplitOpen(group, false);
  });
  root.addEventListener('focusout', (/** @type {FocusEvent} */ event) => {
    const group = /** @type {Element} */ (event.target).closest?.('.ds-split-button');
    if (group && event.relatedTarget instanceof Node && !group.contains(event.relatedTarget)) setSplitOpen(group, false);
  });
  root.addEventListener('keydown', (/** @type {KeyboardEvent} */ event) => {
    if (event.key !== 'Escape') return;
    const group = /** @type {Element} */ (event.target).closest?.('.ds-split-button');
    if (group?.querySelector('[data-split-toggle][aria-expanded="true"]')) {
      event.preventDefault();
      event.stopPropagation();
      setSplitOpen(group, false, true);
    }
  });
}
