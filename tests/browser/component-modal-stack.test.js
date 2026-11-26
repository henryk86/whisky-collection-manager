import {assertDom, domElements, domText, domEqual} from './component-dom.js';
import {fixtureMarkup, captureContent, captureAppend} from '../helpers/capture-rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createModal} from '../../public/js/ui/modal.js';

/**
 * Derives the fake modal host result from the supplied values.
 * @return {!Object} Structured result assembled from the input data.
 */
function fakeModalHost() {
  let overlay = null;
  return {
    /**
     * Reads the first element child property from the current state.
     * @return {*} Result computed from the supplied inputs.
     */
    get firstElementChild() {return overlay;},
    /**
     * Captures the rendered modal overlay and its simulated form state.
     *
     * @param {import('../../public/js/ui/render-plan.js').RenderContent} text Content supplied by the modal renderer.
     */
    set renderedContent(text) {
      overlay = text ? {
        html: text, form: {name: '', files: []},
        /**
         * Ignores listener registration in this DOM-free test double.
         */
        addEventListener() {},
      } : null;
    },
    /**
     * Derives the query selector result from the supplied values.
     * @return {*} Result computed from the supplied inputs.
     */
    querySelector() {return overlay;},
    /**
     * The fake host has no parsed DOM controls.
     * @return {!Array<!Object>} Matching nodes in this test host.
     */
    querySelectorAll() {return [];},
    /**
     * Updates the replace children state for its caller.
     *
     * @param {*} element DOM element involved in the operation.
     */
    replaceChildren(element) {overlay = element;},
  };
}

test(
  'in-app confirmation restores the original edit form after acceptance, never using browser confirm',
  async () => {
    const host = fakeModalHost();
    const oldDocument = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: () => host,
    };
    try {
      const state = {modal: null};
      const modal = createModal({
        mountContent: captureContent,
        state,
        /**
         * Handles the close interaction.
         */
        onClose() {},
      });
      modal.showModal('Assign bottles', fixtureMarkup('<form id="warehouse-form"></form>'));
      const original = host.firstElementChild;
      original.form.name = 'Selected destination';
      const answer = modal.confirm('Increase capacity', 'Increase from 3 to 5?', 'Increase and assign');
      assert.equal(state.modal.title, 'Increase capacity');
      assert.ok((await domElements(host.firstElementChild.html, '[data-act="modal-confirm-accept"]')).length > 0);
      assert.ok((await domElements(host.firstElementChild.html, '[data-act="close-modal"]')).length > 0);
      assert.equal(modal.acceptConfirmation(), true);
      assert.equal(await answer, true);
      assert.equal(host.firstElementChild, original);
      assert.equal(original.form.name, 'Selected destination');
      modal.closeModal();
    } finally {
      if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    }
  }
);

test(
  'flight planner help opens as a child dialog and closing restores its live form, preview and heading action',
  async () => {
    const host = fakeModalHost();
    // The real modal renderer uses the overlay as a DOM element. For this test
    // only the overlay lookup is needed; planner option lookup can return null.
    host.querySelector = selector => selector === '.overlay' ? host.firstElementChild : null;
    const previous = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: () => host,
    };
    try {
      const state = {modal: null};
      const modal = createModal({
        mountContent: captureContent,
        state,
        /**
         * Handles the close interaction.
         */
        onClose() {},
      });
      const plannerHelpButton = fixtureMarkup('<button type="button" data-act="flight-plan-help">?</button>');
      modal.showModal('Flight planen', fixtureMarkup('<form id="flight-plan"></form>'), true, false, plannerHelpButton);
      const planner = host.firstElementChild;
      planner.form.name = 'Not yet saved flight';
      planner.form.files = ['draft-proposal'];
      await assertDom(planner.html, '.ds-heading-with-action');
      assert.ok((await domElements(planner.html, '[data-act="flight-plan-help"]')).length > 0);
      modal.showModal('So wird ein Flight geplant', fixtureMarkup('<section>Formeln</section>'), true, true);
      assert.equal(state.modal.title, 'So wird ein Flight geplant');
      assert.notEqual(host.firstElementChild, planner);
      modal.closeModal();
      assert.equal(state.modal.title, 'Flight planen');
      assert.ok(await domEqual(state.modal.headingAction, plannerHelpButton));
      assert.equal(host.firstElementChild, planner, 'the exact original DOM must return');
      assert.equal(planner.form.name, 'Not yet saved flight');
      assert.deepEqual(planner.form.files, ['draft-proposal']);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
    }
  }
);

test(
  'tasting view returns from flight planning help to the original unsaved planner dialog',
  async () => {
    const {createTastingsView} = await import('../../public/js/views/tastings.js');
    const host = fakeModalHost();
    host.querySelector = selector => selector === '.overlay' ? host.firstElementChild : null;
    const previous = globalThis.document;
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: () => host,
    };
    try {
      const state = {
        modal: null,
        collection: {bottlings: [], tastingFlights: []},
        flightCandidateIds: null,
      };
      const modal = createModal({
        mountContent: captureContent,
        state,
        /**
         * Handles the close interaction.
         */
        onClose() {},
      });
      const view = createTastingsView({
        mountContent: captureContent, mountAppend: captureAppend,
        state, selectors: {},
        /**
         * Discards page content in this scenario; no real DOM is mounted.
         */
        shell() {},
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate() {},
        /**
         * Performs the refresh lifecycle action.
         */
        refresh() {},
        showModal: modal.showModal, closeModal: modal.closeModal,
      });
      view.startPlannedFlight();
      const planner = host.firstElementChild;
      assert.equal(state.modal.title, 'Flight planen');
      assert.ok((await domElements(planner.html, '[data-act="flight-plan-help"]')).length > 0);
      planner.form.name = 'Kept draft';
      planner.form.files = ['kept-proposal'];
      view.showFlightPlanningHelp();
      assert.equal(state.modal.title, 'So wird ein Flight geplant');
      modal.closeModal();
      assert.equal(state.modal.title, 'Flight planen');
      assert.equal(host.firstElementChild, planner);
      assert.equal(planner.form.name, 'Kept draft');
      assert.deepEqual(planner.form.files, ['kept-proposal']);
    } finally {
      if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
    }
  }
);
