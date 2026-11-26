import {composeMarkup} from './render-plan.js';
import {sectionHeader} from './headers.js';
import {escapeHtml} from './dom.js';
import {actionButton} from './buttons.js';
import {closeIcon} from './action-icons.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('dialogs/modal-layout.html');


/**
 * Builds an accessible dialog around prepared render content.
 *
 * @param {!Object} options Modal content, title and layout.
 * @return {!import('./render-plan.js').RenderPlan} Accessible dialog overlay, heading and body.
 * @throws {RangeError} If the modal variant is unsupported.
 */
export function modalFrame({title, content, wide = false, variant = '',
  headingAction = '', closeLabel}) {
  if (!['', 'photo', 'editor', 'assignment'].includes(variant)) throw new RangeError('Invalid modal variant');
  // Explicit size variants take precedence over the legacy wide flag; otherwise
  // .dialog.wide (higher specificity) overrides their width tokens.
  const classes = [
    'dialog',
    'ds-modal',
    wide && !variant ? 'wide ds-modal--wide' : '',
    variant ? `ds-modal--${variant}` : '',
  ].filter(Boolean).join(' ');
  return renderTemplate('overlay', {
    classes: classes,
    title: title,
    sectionHeader: sectionHeader({
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
    }),
    content: content,
  });
}

/**
 * Places trusted action buttons inside the owning form footer.
 *
 * @param {import('./render-plan.js').RenderContent} actions Prepared button controls.
 * @param {{className?: string}=} options2 Additional footer CSS class.
 * @return {!import('./render-plan.js').RenderPlan} Dialog footer containing the supplied controls without changing submit behavior.
 */
export function modalFooter(actions, {className = ''} = {}) {
  return renderTemplate('actions', {
    className: className ? ` ${escapeHtml(className)}` : '',
    actions: actions,
  });
}

/**
 * Renders a cancel/confirm footer with a destructive action style.
 *
 * @param {!Object} options Translated labels and delegated confirm action.
 * @return {!import('./render-plan.js').RenderPlan} Cancel and destructive confirmation controls.
 */
export function destructiveFooter({cancelLabel, acceptLabel, acceptAction,
  className = ''}) {
  return modalFooter(
    composeMarkup(
      actionButton({label: cancelLabel, action: 'close-modal'}),
      actionButton({
        label: acceptLabel, action: acceptAction,
        variant: 'destructive',
      })
    ),
    {className}
  );
}
