import { t } from '../i18n/index.js';
import { escapeHtml, query } from './dom.js';
/** Modal lifecycle. Dialogs opened from another dialog are nested by default.
 * Closing returns to the exact parent DOM, preserving inputs, files and scroll.
 * Explicit nested=false replaces the stack; closeModal(true) clears it on navigation. */
export function createModal({ state, onClose }) {
    const suspended = [];
    let pendingConfirmation = null;
    function showModal(title, content, wide = false, nested = true) {
        // Replacing a confirmation must cancel its awaiting caller.
        if (pendingConfirmation) {
            const resolve = pendingConfirmation;
            pendingConfirmation = null;
            resolve(false);
        }
        const host = query('#modal-root');
        if (nested && state.modal && host?.firstElementChild) {
            suspended.push({ modal: state.modal, overlay: host.firstElementChild });
        } else {
            suspended.length = 0;
        }
        state.modal = { title, content, wide };
        renderModal();
    }
    function renderModal() {
        const host = query('#modal-root');
        if (!host || !state.modal) return;
        host.innerHTML = `<div class="overlay" data-overlay="1">
    <div class="dialog ${state.modal.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.modal.title)}">
    <div class="dialog-head">
    <h2>${escapeHtml(state.modal.title)}</h2>
    <button class="btn small" type="button" data-act="close-modal" aria-label="${t("common.actions.close")}">✕</button>
    </div>${state.modal.content}</div>
    </div>`;
        host.querySelector('.overlay').addEventListener('click', ev => {
            if (ev.target === ev.currentTarget) closeModal();
        });
    }
    function closeModal(all = false) {
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
    return { showModal, renderModal, closeModal, confirm, acceptConfirmation };
}
