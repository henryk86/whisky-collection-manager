import { t } from '../i18n/index.js';
import { escapeHtml, query } from './dom.js';
import { closeIcon } from './action-icons.js';
/** Modal lifecycle. Dialogs opened from another dialog are nested by default.
 * Closing returns to the exact parent DOM, preserving inputs, files and scroll.
 * Explicit nested=false replaces the stack; closeModal(true) clears it on navigation. */
export function createModal({ state, onClose }) {
    const suspended = [];
    let pendingConfirmation = null;
    let pendingChoice = null;
    let scrollLock = null;
    function lockBackground() {
        if (scrollLock || typeof document === 'undefined') return;
        const body = document.body, html = document.documentElement;
        if (!body || !html) return;
        const top = typeof window !== 'undefined' ? window.scrollY : 0;
        scrollLock = { top, bodyCss: body.getAttribute('style'), htmlCss: html.getAttribute('style') };
        body.style.position = 'fixed';
        body.style.top = `-${top}px`;
        body.style.left = '0'; body.style.right = '0'; body.style.width = '100%';
        // Keep the scrollbar track reserved while the fixed body locks page
        // scrolling. Hiding overflow on <html> removes the track and makes
        // centered content shift sideways on browsers with classic scrollbars.
        html.style.overflowY = 'scroll';
        html.style.overscrollBehavior = 'none';
    }
    function unlockBackground() {
        if (!scrollLock || typeof document === 'undefined') return;
        const { top, bodyCss, htmlCss } = scrollLock;
        scrollLock = null;
        if (bodyCss === null) document.body.removeAttribute('style'); else document.body.setAttribute('style', bodyCss);
        if (htmlCss === null) document.documentElement.removeAttribute('style'); else document.documentElement.setAttribute('style', htmlCss);
        // The default CSS used to animate this restoration, causing a visible
        // jump to the page top and a slow scroll back after confirmation.
        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            window.scrollTo({top, left: 0, behavior: 'instant'});
        }
    }
    function showModal(title, content, wide = false, nested = true, headingAction = '') {
        // Replacing a confirmation must cancel its awaiting caller.
        if (pendingChoice) { const callback = pendingChoice; pendingChoice = null; callback('cancel'); }
        if (pendingConfirmation) {
            const resolve = pendingConfirmation;
            pendingConfirmation = null;
            resolve(false);
        }
        const host = query('#modal-root');
        if (nested === 'replace') {
            // Swap sibling forms without piling up modal layers.
        } else if (nested && state.modal && host?.firstElementChild) {
            suspended.push({ modal: state.modal, overlay: host.firstElementChild });
        } else {
            suspended.length = 0;
        }
        lockBackground();
        state.modal = { title, content, wide, headingAction };
        renderModal();
    }
    function renderModal() {
        const host = query('#modal-root');
        if (!host || !state.modal) return;
        host.innerHTML = `<div class="overlay" data-overlay="1">
    <div class="dialog ${state.modal.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.modal.title)}">
    <div class="dialog-head">
    <h2${state.modal.headingAction ? ' class="dialog-title-with-action"' : ''}>${escapeHtml(state.modal.title)}${state.modal.headingAction || ''}</h2>
    <button class="btn small" type="button" data-act="close-modal" aria-label="${t("common.actions.close")}">${closeIcon}</button>
    </div>${state.modal.content}</div>
    </div>`;
        const overlay = host.querySelector('.overlay');
        overlay.addEventListener('click', ev => {
            if (ev.target === ev.currentTarget) closeModal();
        });
        // Avoid page rubber-band scrolling when touching the backdrop on iOS.
        // Do not suppress touchmove inside the dialog: its own scroll must work.
        overlay.addEventListener('touchmove', event => {
            if (!event.target.closest('.dialog')) event.preventDefault();
        }, { passive:false });
    }
    function closeModal(all = false) {
        if (pendingChoice) { const callback = pendingChoice; pendingChoice = null; callback('cancel'); }
        if (pendingConfirmation) {
            const resolve = pendingConfirmation;
            pendingConfirmation = null;
            resolve(false);
        }
        onClose();
        const host = query('#modal-root');
        if (!all && suspended.length) {
            const parent = suspended.pop();
            state.modal = parent.modal;
            if (host) host.replaceChildren(parent.overlay);
            return;
        }
        suspended.length = 0;
        state.modal = null;
        if (host) host.innerHTML = '';
        unlockBackground();
    }
    /** Asynchronous application-owned confirmation, preserving a parent form
     * and its unsaved DOM when launched from an already open modal. */
    function confirm(title, message, acceptLabel, cancelLabel = t('common.actions.cancel')) {
        return new Promise(resolve => {
            showModal(title, `<p>${escapeHtml(message)}</p><div class="actions warehouse-form-actions">
              <button type="button" class="btn" data-act="close-modal">${escapeHtml(cancelLabel)}</button>
              <button type="button" class="btn primary" data-act="modal-confirm-accept">${escapeHtml(acceptLabel)}</button>
            </div>`, false, Boolean(state.modal));
            pendingConfirmation = resolve;
            query('#modal-root [data-act="close-modal"]')?.focus?.();
        });
    }
    function acceptConfirmation() {
        if (!pendingConfirmation) return false;
        const resolve = pendingConfirmation;
        pendingConfirmation = null;
        closeModal();
        resolve(true);
        return true;
    }
    /** Three-way application modal for navigating away from dirty forms. */
    function choose(title, message, options) {
        return new Promise(resolve => {
            const buttons = options.map(({id,label,primary}) =>
                `<button type="button" class="btn${primary ? ' primary' : ''}" data-act="modal-choice" data-choice="${escapeHtml(id)}">${escapeHtml(label)}</button>`).join('');
            showModal(title, `<p>${escapeHtml(message)}</p><div class="actions warehouse-form-actions">${buttons}</div>`,false,Boolean(state.modal));
            pendingChoice = resolve;
            query('#modal-root [data-choice="cancel"]')?.focus?.();
        });
    }
    function acceptChoice(choice) {
        if (!pendingChoice || !['save','discard','cancel'].includes(choice)) return false;
        const resolve = pendingChoice;
        pendingChoice = null;
        closeModal();
        resolve(choice);
        return true;
    }
    /** Update content in the visible parent without losing the modal stack. */
    function updateContent(content) {
        if (!state.modal) return;
        state.modal.content = content;
        const host = query('#modal-root');
        const dialog = host?.querySelector('.dialog');
        if (!dialog) return;
        for (const element of [...dialog.children].filter(child => !child.classList.contains('dialog-head'))) element.remove();
        dialog.insertAdjacentHTML('beforeend', content);
    }
    return { showModal, renderModal, closeModal, confirm, acceptConfirmation, choose, acceptChoice, updateContent };
}
