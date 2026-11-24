import {sectionHeader} from './headers.js';
import {escapeHtml} from './dom.js';
import {actionButton} from './buttons.js';
import {closeIcon} from './action-icons.js';

/**
 * Builds an accessible dialog around trusted application-rendered HTML.
 *
 * @param {!Object} options Modal content, title and layout.
 * @param {string} options.title Escaped title and accessible dialog name.
 * @param {string} options.content Trusted application-rendered body markup.
 * @param {boolean=} options.wide Legacy wide layout, unless variant is given.
 * @param {string=} options.variant Photo, editor, assignment or default.
 * @param {string=} options.headingAction Trusted title-area action markup.
 * @param {string} options.closeLabel Translated close-button accessible name.
 * @return {string} Dialog overlay and content HTML.
 * @throws {RangeError} If the modal variant is unsupported.
 */
export function modalFrame({title, content, wide = false, variant = '', headingAction = '', closeLabel}) {
  if (!['', 'photo', 'editor', 'assignment']
    .includes(variant)) throw new RangeError('Invalid modal variant');
  // Explicit size variants take precedence over the legacy wide flag; otherwise
  // .dialog.wide (higher specificity) overrides their width tokens.
  const classes = [
    'dialog',
    'ds-modal',
    wide && !variant ? 'wide ds-modal--wide' : '',
    variant ? `ds-modal--${variant}` : '',
  ].filter(Boolean).join(' ');
  return `<div class="overlay ds-modal-overlay" data-overlay="1">
    <div class="${classes}" role="dialog" aria-modal="true" aria-labelledby="ds-modal-title" aria-label="${escapeHtml(title)}" tabindex="-1">
    ${sectionHeader({
    layout: 'dialog-head',
    level: 2,
    title,
    titleId: 'ds-modal-title',
    trailingAction: headingAction,
    actionsBare: true,
    actions: actionButton({
      label: closeLabel,
      action: 'close-modal',
      size: 'small',
      icon: closeIcon,
      iconOnly: true,
      className: 'ds-modal-close',
    }),
  })}
    <div class="ds-modal-body">${content}</div></div></div>`;
}

/**
 * Places trusted action buttons inside the owning form footer.
 *
 * @param {string} actions Trusted application-generated button markup.
 * @param {{className: string}=} options Additional footer CSS class.
 * @return {string} Footer HTML without changing submit behavior.
 */
export function modalFooter(actions, {className = ''} = {}) {
  return `<div class="actions ds-modal-footer${className ?
    ` ${escapeHtml(className)}` : ''}">${actions}</div>`;
}

/**
 * Renders a cancel/confirm footer with a destructive action style.
 *
 * @param {!Object} options Translated labels and delegated confirm action.
 * @param {string} options.cancelLabel Cancel-button text.
 * @param {string} options.acceptLabel Destructive confirmation text.
 * @param {string} options.acceptAction Delegated data-act identifier.
 * @param {string=} options.className Additional footer CSS class.
 * @return {string} Trusted footer HTML.
 */
export function destructiveFooter({cancelLabel, acceptLabel, acceptAction, className = ''}) {
  return modalFooter(
    actionButton({label: cancelLabel, action: 'close-modal'}) +
    actionButton({label: acceptLabel, action: acceptAction, variant: 'destructive'}),
    {className}
  );
}
