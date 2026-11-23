import {sectionHeader} from './headers.js';
import {escapeHtml} from './dom.js';
import {actionButton} from './buttons.js';
import {closeIcon} from './action-icons.js';

/**
 * Builds an accessible modal shell around its trusted content.
 * @param {!Object} options Modal title, trusted HTML content and layout.
 * @param {string} options.title Escaped modal heading and accessible name.
 * @param {string} options.content Trusted application-rendered modal HTML.
 * @param {boolean=} options.wide Legacy wide layout used without a variant.
 * @param {string=} options.variant Photo, editor or assignment. Explicit variants
 *     take priority over the legacy wide flag.
 * @param {string=} options.headingAction Trusted header-action markup.
 * @param {string} options.closeLabel Translated close-button label.
 * @return {string} Modal overlay and dialog HTML.
 * @throws {RangeError} For an unsupported variant or heading level.
 */
export function modalFrame({title, content, wide = false, variant = '', headingAction = '', closeLabel}) {
  if (!['', 'photo', 'editor', 'assignment'].includes(variant)) throw new RangeError('Invalid modal variant');
  // Explicit size variants take precedence over the legacy wide flag; otherwise
  // .dialog.wide (higher specificity) overrides their width tokens.
  const classes = ['dialog', 'ds-modal', wide && !variant ? 'wide ds-modal--wide' : '', variant ? `ds-modal--${variant}` : ''].filter(Boolean).join(' ');
  return `<div class="overlay ds-modal-overlay" data-overlay="1">
    <div class="${classes}" role="dialog" aria-modal="true" aria-labelledby="ds-modal-title" aria-label="${escapeHtml(title)}" tabindex="-1">
    ${sectionHeader({
    layout: 'dialog-head', level: 2, title, titleId: 'ds-modal-title', trailingAction: headingAction,
    actionsBare: true, actions: actionButton({label: closeLabel, action: 'close-modal', size: 'small', icon: closeIcon, iconOnly: true, className: 'ds-modal-close'})
  })}
    <div class="ds-modal-body">${content}</div></div></div>`;
}

/**
 * Keeps actions within their owning form for native submit semantics.
 * @param {string} actions Trusted application-rendered buttons.
 * @param {{className: (string|undefined)}=} options Optional footer class.
 * @return {string} Footer markup.
 */
export function modalFooter(actions, {className = ''} = {}) {
  return `<div class="actions ds-modal-footer${className ? ` ${escapeHtml(className)}` : ''}">${actions}</div>`;
}

/**
 * Builds the shared cancel/confirm footer for destructive actions.
 * @param {!Object} options Translated button labels and delegated action.
 * @param {string} options.cancelLabel Label of the cancel button.
 * @param {string} options.acceptLabel Label of the destructive button.
 * @param {string} options.acceptAction Delegated confirmation action.
 * @return {string} Destructive footer HTML.
 */
export function destructiveFooter({cancelLabel, acceptLabel, acceptAction, className = ''}) {
  return modalFooter(actionButton({label: cancelLabel, action: 'close-modal'}) +
    actionButton({label: acceptLabel, action: acceptAction, variant: 'destructive'}), {className});
}
