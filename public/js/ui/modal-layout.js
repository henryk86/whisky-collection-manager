import { sectionHeader } from './headers.js';
import { escapeHtml } from './dom.js';
import { actionButton } from './buttons.js';
import { closeIcon } from './action-icons.js';

/** Modal width is explicit. The content and header action slots contain trusted
 * UI HTML; untrusted text must be escaped by the call site. */
export function modalFrame({ title, content, wide = false, variant = '', headingAction = '', closeLabel }) {
    if (!['','photo','editor','assignment'].includes(variant)) throw new RangeError('Invalid modal variant');
    // Explicit size variants take precedence over the legacy wide flag; otherwise
    // .dialog.wide (higher specificity) overrides their width tokens.
    const classes = ['dialog','ds-modal',wide && !variant ? 'wide ds-modal--wide' : '',variant ? `ds-modal--${variant}` : ''].filter(Boolean).join(' ');
    return `<div class="overlay ds-modal-overlay" data-overlay="1">
    <div class="${classes}" role="dialog" aria-modal="true" aria-labelledby="ds-modal-title" aria-label="${escapeHtml(title)}" tabindex="-1">
    ${sectionHeader({layout:'dialog-head',level:2,title,titleId:'ds-modal-title',trailingAction:headingAction,
      actionsBare:true,actions:actionButton({label:closeLabel,action:'close-modal',size:'small',icon:closeIcon,iconOnly:true,className:'ds-modal-close'})})}
    <div class="ds-modal-body">${content}</div></div></div>`;
}

/** Footer renderer: actions remain inside their owner's form when applicable,
 * so browser-native submit validation and the delegated submit handler work. */
export function modalFooter(actions, {className = ''} = {}) {
    return `<div class="actions ds-modal-footer${className ? ` ${escapeHtml(className)}` : ''}">${actions}</div>`;
}

/** Canonical in-app cancel + destructive confirmation actions. */
export function destructiveFooter({cancelLabel,acceptLabel,acceptAction,className=''}) {
    return modalFooter(actionButton({label:cancelLabel,action:'close-modal'})+
        actionButton({label:acceptLabel,action:acceptAction,variant:'destructive'}),{className});
}
