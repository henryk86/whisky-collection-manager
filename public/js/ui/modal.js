import {composeMarkup} from './render-plan.js';
import {replaceContent} from './dom-renderer.js';
import {t} from '../i18n/index.js';
import {query} from './dom.js';
import {actionButton} from './buttons.js';
import {modalFrame, modalFooter} from './modal-layout.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('dialogs/modal.html');


/**
 * Manages the active dialog and suspended parent dialogs without recreating
 * their DOM or losing entered values.
 *
 * @param {!Object} options Shared application state and close callback.
 * @return {!Object} Methods for opening, updating, closing and confirming
 *     dialogs.
 */
export function createModal({state, onClose, mountContent = replaceContent}) {
  const suspended = [];
  let pendingConfirmation = null;
  let pendingChoice = null;
  let scrollLock = null;
  let originFocus = null;
  let pageSiblings = [];
  /**
   * Freezes page scrolling and marks the siblings of the modal host inert while
   * saving their previous states.
   *
   * @param {?Element} host Container that holds the active modal.
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
    pageSiblings = [...(host?.parentElement?.children || [])].filter(element => element !== host).map((/** @type {HTMLElement} */ element) => ({element, wasInert: element.inert}));
    for (const {element} of pageSiblings) /** @type {HTMLElement} */ (element).inert = true;
  }

  /**
   * Restores the original page styles, inert flags and scroll position after
   * the final dialog closes.
   */
  function unlockBackground() {
    if (!scrollLock || typeof document === 'undefined') return;
    const {top, bodyCss, htmlCss} = scrollLock;
    scrollLock = null;
    for (const {element, wasInert} of pageSiblings) element.inert = wasInert;
    pageSiblings = [];
    if (bodyCss === null) document.body.removeAttribute('style'); else document.body.setAttribute('style', bodyCss);
    if (htmlCss === null) document.documentElement.removeAttribute('style'); else document.documentElement.setAttribute('style', htmlCss);
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function')
      window.scrollTo({top, left: 0, behavior: 'instant'});
  }

  /**
   * Focuses a connected element without scrolling the page or dialog.
   *
   * @param {?Element} element Candidate to focus; absent elements are
   *     ignored.
   */
  function focusElement(element) {
    const control = /** @type {HTMLElement|SVGElement} */ (element);
    if (control?.isConnected !== false && typeof control?.focus === 'function')
      control.focus({preventScroll: true});
  }

  /**
   * Finds visible, enabled controls in the active dialog that can receive
   * keyboard focus.
   *
   * @param {?Element} dialog Dialog whose descendants are inspected.
   * @return {!Array<!HTMLElement>} Focusable controls in DOM order.
   */
  function focusable(dialog) {
    if (!dialog?.querySelectorAll) return [];
    return [.../** @type {NodeListOf<HTMLElement>} */ (dialog.querySelectorAll(
      'a[href],button:not(:disabled),input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'))]
      .filter((/** @type {HTMLElement} */ element) => !element.inert && element.getClientRects?.().length !== 0 && element.getAttribute('aria-hidden') !== 'true' &&
        element.closest('[hidden]') === null && getComputedStyle(element).visibility !== 'hidden');
  }

  /**
   * Focuses the autofocus control, first form field, first focusable control or
   * the dialog itself, in that order.
   *
   * @param {?Element} dialog Newly rendered or restored dialog.
   */
  function focusFirst(dialog) {
    if (!dialog) return;
    const controls = focusable(dialog);
    const auto = controls.find(element => element.hasAttribute('autofocus'));
    const field = controls.find(element => element.matches('input,select,textarea'));
    focusElement(auto || field || controls[0] || dialog);
  }

  /**
   * Closes the active dialog on Escape and cycles Tab focus within it rather
   * than allowing focus into the background.
   *
   * @param {!KeyboardEvent} event Key event dispatched from the active overlay.
   */
  function trapKeys(event) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeModal(); return;
    }
    if (event.key !== 'Tab') return;
    const dialog = /** @type {Element} */ (event.currentTarget).querySelector?.('.dialog');
    const controls = focusable(dialog);
    if (!controls.length) {
      event.preventDefault(); focusElement(dialog);
      return;
    }
    const active = document.activeElement;
    const i = controls.indexOf(/** @type {HTMLElement} */(active));
    if (event.shiftKey && (i <= 0)) {event.preventDefault(); focusElement(controls.at(-1));}
    else if (!event.shiftKey && (i < 0 || i === controls.length - 1)) {event.preventDefault(); focusElement(controls[0]);}
  }

  /**
   * Opens a dialog, suspending the previous dialog by default or replacing it
   * when requested. Cancels an unresolved confirmation or choice.
   *
   * @param {string} title Visible dialog heading.
   * @param {import('./render-plan.js').RenderContent} content Prepared dialog body.
   * @param {boolean=} wide Enables the wide layout when no explicit variant
   *     overrides it.
   * @param {(boolean|string)=} nested Whether to suspend the parent; 'replace'
   *     swaps the active dialog without adding a stack entry.
   * @param {import('./render-plan.js').RenderContent=} headingAction Optional heading action.
   * @param {string=} variant Explicit dialog size or layout variant.
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
      const callback = pendingChoice; pendingChoice = null; callback('cancel');
    }
    if (pendingConfirmation) {
      const resolve = pendingConfirmation; pendingConfirmation = null; resolve(false);
    }
    const host = query('#modal-root');
    if (!state.modal && typeof document !== 'undefined') originFocus = document.activeElement;
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
   * Mounts the current dialog only when its state object has changed. Registers
   * focus trapping and backdrop dismissal without resetting an existing edit
   * form.
   */
  function renderModal() {
    const host = query('#modal-root');
    if (!host || !state.modal) return;
    // Refreshes of the background view must never reset an open edit form.
    if (/** @type {Element & {__dsModalState?: Object}} */ (host.firstElementChild)?.__dsModalState === state.modal) return;
    mountContent(host, modalFrame({
      ...state.modal, closeLabel: t('common.actions.close'),
    }));
    const overlay = /** @type {HTMLElement & {__dsModalState?: Object}} */ (host.querySelector('.overlay'));
    if (!overlay) return;
    overlay.__dsModalState = state.modal;
    // A drag from a form field can dispatch click on the common ancestor.
    // Dismiss only when the primary pointer starts and ends on the backdrop.
    let backdropPressed = false;
    overlay.addEventListener('pointerdown', (/** @type {PointerEvent} */ event) => {
      backdropPressed = event.isPrimary && event.button === 0 && event.target === overlay;
    }, true);
    overlay.addEventListener('pointerup', (/** @type {PointerEvent} */ event) => {
      backdropPressed = backdropPressed && event.isPrimary && event.target === overlay;
    }, true);
    overlay.addEventListener('pointercancel', () => {
      backdropPressed = false;
    }, true);
    overlay.addEventListener('click', event => {
      const dismiss = backdropPressed && event.target === overlay;
      backdropPressed = false;
      if (dismiss) closeModal();
    });
    overlay.addEventListener('keydown', trapKeys);
    overlay.addEventListener('touchmove', event => {
      if (!/** @type {Element} */ (event.target).closest('.dialog')) event.preventDefault();
    }, {passive: false});
    focusFirst(host.querySelector('.dialog'));
  }

  /**
   * Cancels outstanding choices, then restores the suspended parent or clears
   * the entire modal stack and unlocks the background.
   *
   * @param {boolean=} all Close every layer instead of restoring the parent.
   */
  function closeModal(all = false) {
    if (pendingChoice) {
      const callback = pendingChoice; pendingChoice = null; callback('cancel');
    }
    if (pendingConfirmation) {
      const resolve = pendingConfirmation; pendingConfirmation = null; resolve(false);
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
    if (host) mountContent(host, '');
    unlockBackground();
    // Restore focus without a hidden scroll-to-element action.
    focusElement(originFocus);
    originFocus = null;
  }

  /**
   * Shows an application confirmation dialog and resolves after acceptance or
   * dismissal. The default focus is on the cancel action.
   *
   * @param {string} title Dialog heading.
   * @param {string} message Literal text, never interpreted as markup.
   * @param {string} acceptLabel Label of the primary confirmation button.
   * @param {string=} cancelLabel Label of the dismissal button.
   * @return {!Promise<boolean>} True on acceptance; false on dismissal.
   */
  function confirm(title, message, acceptLabel, cancelLabel =
    t('common.actions.cancel')) {
    return new Promise(resolve => {
      const buttons = composeMarkup(
        actionButton({label: cancelLabel, action: 'close-modal'}),
        actionButton({
          label: acceptLabel,
          action: 'modal-confirm-accept',
          variant: 'primary',
        })
      );
      showModal(
        title,
        renderTemplate('confirmP', {
          message: message,
          modalFooter: modalFooter(buttons),
        }),
        false,
        Boolean(state.modal)
      );
      pendingConfirmation = resolve;
      focusElement(query('#modal-root .ds-modal-footer [data-act="close-modal"]'));
    });
  }

  /**
   * Resolves the pending confirmation as accepted and restores the parent
   * dialog if present.
   *
   * @return {boolean} True when a confirmation was pending.
   */
  function acceptConfirmation() {
    if (!pendingConfirmation) return false;
    const resolve = pendingConfirmation; pendingConfirmation = null;
    closeModal(); resolve(true); return true;
  }

  /**
   * Shows a choice dialog and resolves with the selected action ID or 'cancel'
   * on dismissal.
   *
   * @param {string} title Dialog heading.
   * @param {string} message Literal text, never interpreted as markup.
   * @param {!Array<{id: string, label: string, primary: boolean}>} options
   *     Buttons to display; accepted action IDs are save, discard and cancel.
   * @return {!Promise<string>} Selected action ID or cancel.
   */
  function choose(title, message, options) {
    return new Promise(resolve => {
      const buttons = composeMarkup(options.map(({id, label, primary}) =>
        actionButton({
          label,
          variant: primary ? 'primary' : 'secondary',
          action: 'modal-choice',
          attributes: {'data-choice': id},
        })));
      showModal(
        title,
        renderTemplate('chooseP', {
          message: message,
          modalFooter: modalFooter(buttons),
        }),
        false,
        Boolean(state.modal)
      );
      pendingChoice = resolve;
      focusElement(query('#modal-root [data-choice="cancel"]'));
    });
  }

  /**
   * Resolves a pending choice only for one of the supported action IDs and
   * restores the parent dialog if present.
   *
   * @param {string} choice Requested save, discard or cancel action.
   * @return {boolean} True when the pending choice was resolved.
   */
  function acceptChoice(choice) {
    if (!pendingChoice || !['save', 'discard', 'cancel'].includes(choice)) return false;
    const resolve = pendingChoice; pendingChoice = null;
    closeModal(); resolve(choice); return true;
  }

  /**
   * Replaces the active dialog body in both application state and DOM, leaving
   * its header and stack intact.
   *
   * @param {import('./render-plan.js').RenderContent} content Replacement dialog body.
   */
  function updateContent(content) {
    if (!state.modal) return;
    state.modal.content = content;
    const host = query('#modal-root');
    const body = host?.querySelector('.ds-modal-body');
    if (body) mountContent(body, content);
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
