import {t} from '../i18n/index.js';
import {escapeHtml, query} from './dom.js';
import {actionButton} from './buttons.js';
import {modalFrame, modalFooter} from './modal-layout.js';

/**
 * Single modal host; nested dialogs suspend their parent DOM (including
 * FileList, field values, scroll and event listeners), and only the top layer
 * is active.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createModal({state, onClose}) {
  const suspended = [];
  let pendingConfirmation = null;
  let pendingChoice = null;
  let scrollLock = null;
  let originFocus = null;
  let pageSiblings = [];
  /**
   * Selects and transforms the lock background records.
   *
   * @param {*} host Network host or host configuration.
   */
  function lockBackground(host) {
    if (scrollLock || typeof document === 'undefined') return;
    const body = document.body, html = document.documentElement;
    if (!body || !html) return;
    const top = typeof window !== 'undefined' ? window.scrollY : 0;
    scrollLock = {
      top,
      bodyCss: body.getAttribute('style'),
      htmlCss: html.getAttribute('style'),
    };
    body.style.position = 'fixed';
    body.style.top = `-${top}px`;
    body.style.left = '0'; body.style.right = '0'; body.style.width = '100%';
    // Do not remove the classic scrollbar track or the page jumps sideways.
    html.style.overflowY = 'scroll';
    html.style.overscrollBehavior = 'none';
    // Keep application content out of the keyboard and accessibility tree.
    pageSiblings = [...(host?.parentElement?.children || [])]
      .filter(element => element !== host)
      .map(element => ({element, wasInert: element.inert}));
    for (const {element} of pageSiblings) element.inert = true;
  }

  /**
   * Updates element attributes used by unlock background.
   */
  function unlockBackground() {
    if (!scrollLock || typeof document === 'undefined') return;
    const {top, bodyCss, htmlCss} = scrollLock;
    scrollLock = null;
    for (const {element, wasInert} of pageSiblings) element.inert = wasInert;
    pageSiblings = [];
    if (bodyCss === null) document.body
      .removeAttribute('style'); else document.body
        .setAttribute('style', bodyCss);
    if (htmlCss === null) document.documentElement
      .removeAttribute('style'); else document.documentElement
        .setAttribute('style', htmlCss);
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function')
      window.scrollTo({top, left: 0, behavior: 'instant'});
  }

  /**
   * Updates the focus element state for its caller.
   *
   * @param {*} element DOM element involved in the operation.
   */
  function focusElement(element) {
    if (element?.isConnected !== false && typeof element?.focus === 'function')
      element.focus({preventScroll: true});
  }

  /**
   * Filters records according to the focusable selection rules.
   *
   * @param {*} dialog Value used by this operation.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  function focusable(dialog) {
    if (!dialog?.querySelectorAll) return [];
    return [...dialog.querySelectorAll('a[href],button:not(:disabled),input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.inert && element.getClientRects?.()
        .length !== 0 &&
        element.getAttribute('aria-hidden') !== 'true' &&
        element.closest('[hidden]') === null && getComputedStyle(element)
          .visibility !== 'hidden');
  }

  /**
   * Derives the focus first result from the supplied values.
   *
   * @param {*} dialog Value used by this operation.
   */
  function focusFirst(dialog) {
    if (!dialog) return;
    const controls = focusable(dialog);
    const auto = controls.find(element => element.hasAttribute('autofocus'));
    const field = controls.find(element =>
      element.matches('input,select,textarea'));
    focusElement(auto || field || controls[0] || dialog);
  }

  /**
   * Derives the trap keys result from the supplied values.
   *
   * @param {!Event} event Event that triggered this operation.
   */
  function trapKeys(event) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeModal(); return;
    }
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget.querySelector?.('.dialog');
    const controls = focusable(dialog);
    if (!controls.length) {event.preventDefault(); focusElement(dialog); return;}
    const active = document.activeElement;
    const i = controls.indexOf(active);
    if (event.shiftKey && (i <=
      0)) {event.preventDefault(); focusElement(controls.at(-1));}
    else if (!event.shiftKey && (i < 0 || i === controls.length -
      1)) {event.preventDefault(); focusElement(controls[0]);}
  }

  /**
   * Renders modal for modal.
   *
   * @param {string} title Title shown to the user.
   * @param {*} content Content used by this operation.
   * @param {boolean=} wide Wide used by this operation.
   * @param {boolean=} nested Nested used by this operation.
   * @param {string=} headingAction Heading action used by this operation.
   * @param {string=} variant Variant used by this operation.
   */
  function showModal(
    title,
    content,
    wide = false,
    nested = true,
    headingAction = '',
    variant = ''
  ) {
    if (pendingChoice) {
      const callback = pendingChoice; pendingChoice =
        null; callback('cancel');
    }
    if (pendingConfirmation) {
      const resolve =
        pendingConfirmation; pendingConfirmation = null; resolve(false);
    }
    const host = query('#modal-root');
    if (!state.modal && typeof document !== 'undefined') originFocus =
      document.activeElement;
    if (nested === 'replace') {
      // Swap sibling forms without pushing another history entry.
    } else if (nested && state.modal && host?.firstElementChild) {
      suspended.push({
        modal: state.modal,
        overlay: host.firstElementChild,
        focus: document.activeElement,
      });
    } else {
      suspended.length = 0;
    }
    lockBackground(host);
    state.modal = {title, content, wide, headingAction, variant};
    renderModal();
  }

  /**
   * Renders modal in the current view.
   */
  function renderModal() {
    const host = query('#modal-root');
    if (!host || !state.modal) return;
    // Refreshes of the background view must never reset an open edit form.
    if (host.firstElementChild?.__dsModalState === state.modal) return;
    host.innerHTML = modalFrame({...state.modal, closeLabel: t('common.actions.close')});
    const overlay = host.querySelector('.overlay');
    if (!overlay) return;
    overlay.__dsModalState = state.modal;
    overlay.addEventListener('click', event => {
      if (event.target === event.currentTarget) closeModal();
    });
    overlay.addEventListener('keydown', trapKeys);
    overlay.addEventListener('touchmove', event => {
      if (!event.target.closest('.dialog')) event.preventDefault();
    }, {passive: false});
    focusFirst(host.querySelector('.dialog'));
  }

  /**
   * Controls modal for modal.
   *
   * @param {boolean=} all All used by this operation.
   */
  function closeModal(all = false) {
    if (pendingChoice) {
      const callback = pendingChoice; pendingChoice =
        null; callback('cancel');
    }
    if (pendingConfirmation) {
      const resolve =
        pendingConfirmation; pendingConfirmation = null; resolve(false);
    }
    onClose();
    const host = query('#modal-root');
    if (!all && suspended.length) {
      const parent = suspended.pop();
      state.modal = parent.modal;
      if (host) host.replaceChildren(parent.overlay);
      if (parent.focus?.isConnected) focusElement(parent.focus);
      else focusFirst(parent.overlay.querySelector?.('.dialog'));
      return;
    }
    suspended.length = 0;
    state.modal = null;
    if (host) host.innerHTML = '';
    unlockBackground();
    // Restore focus without a hidden scroll-to-element action.
    focusElement(originFocus);
    originFocus = null;
  }

  /**
 * Confirmation and choice dialogs never invoke window.confirm/alert/prompt.
 * Their actions use the same central footer and button contracts as forms.
 *
 * @param {string} title Title shown to the user.
 * @param {*} message Message used by this operation.
 * @param {*} acceptLabel Accept label used by this operation.
 * @param {*=} cancelLabel Cancel label used by this operation.
 * @return {!Promise<*>} Promise fulfilled when the operation completes.
 */
  function confirm(title, message, acceptLabel, cancelLabel = t('common.actions.cancel')) {
    return new Promise(resolve => {
      const buttons = actionButton({label: cancelLabel, action: 'close-modal'}) +
        actionButton({
          label: acceptLabel,
          action: 'modal-confirm-accept',
          variant: 'primary',
        });
      showModal(
        title,
        `<p>${escapeHtml(message)}</p>${modalFooter(buttons)}`,
        false,
        Boolean(state.modal)
      );
      pendingConfirmation = resolve;
      focusElement(query('#modal-root .ds-modal-footer [data-act="close-modal"]'));
    });
  }

  /**
   * Derives the accept confirmation result from the supplied values.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  function acceptConfirmation() {
    if (!pendingConfirmation) return false;
    const resolve = pendingConfirmation; pendingConfirmation = null;
    closeModal(); resolve(true); return true;
  }

  /**
   * Transforms the entries used by choose.
   *
   * @param {*} title Title displayed or stored by this operation.
   * @param {*} message Message to display or use for diagnostics.
   * @param {*} options Options controlling the operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  function choose(title, message, options) {
    return new Promise(resolve => {
      const buttons = options.map(({id, label, primary}) => actionButton({
        label,
        variant: primary ? 'primary' : 'secondary',
        action: 'modal-choice',
        attributes: `data-choice="${escapeHtml(id)}"`,
      })).join('');
      showModal(
        title,
        `<p>${escapeHtml(message)}</p>${modalFooter(buttons)}`,
        false,
        Boolean(state.modal)
      );
      pendingChoice = resolve;
      focusElement(query('#modal-root [data-choice="cancel"]'));
    });
  }

  /**
   * Derives the accept choice result from the supplied values.
   *
   * @param {*} choice Value used by this operation.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  function acceptChoice(choice) {
    if (!pendingChoice || !['save', 'discard', 'cancel']
      .includes(choice)) return false;
    const resolve = pendingChoice; pendingChoice = null;
    closeModal(); resolve(choice); return true;
  }

  /**
   * Updates content in the current state.
   *
   * @param {*} content Content to render, store or examine.
   */
  function updateContent(content) {
    if (!state.modal) return;
    state.modal.content = content;
    const host = query('#modal-root');
    const body = host?.querySelector('.ds-modal-body');
    if (body) body.innerHTML = content;
  }
  return {
    showModal,
    renderModal,
    closeModal,
    confirm,
    acceptConfirmation,
    choose,
    acceptChoice,
    updateContent,
  };
}
