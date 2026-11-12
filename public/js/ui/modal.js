import { t } from '../i18n/index.js';
import { escapeHtml, query } from './dom.js';
/** Modal lifecycle. A nested dialog can temporarily cover a form without losing
 * its unsaved inputs or selected files (the original DOM node is restored). */
export function createModal({ state, onClose }) {
    const suspended = [];
    function showModal(title, content, wide = false, nested = false) {
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
    return { showModal, renderModal, closeModal };
}
