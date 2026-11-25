import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createEditors} from '../../public/js/features/editor-controller.js';
import {runAction} from '../../public/js/ui/action-result.js';

/**
 * Builds a lookup map for the fake form data.
 *
 * @param {*} id Identifier of the affected record.
 * @return {!Array<*>} Resulting entries in their output order.
 */
function fakeForm(id) {
  const button = {disabled: false};
  return {
    id, dataset: id === 'bottle-form' ? {bottlingId: 'parent'} : {},
    elements: {},
    button,
    attributes: new Map(),
    /**
     * Updates attribute in the current state.
     *
     * @param {*} name Environment variable or setting name.
     * @param {*} value Value to process.
     */
    setAttribute(name, value) {this.attributes.set(name, value);},
    /**
     * Retrieves attribute from the available state.
     *
     * @param {*} name Environment variable or setting name.
     * @return {*} Result computed from the supplied inputs.
     */
    getAttribute(name) {return this.attributes.get(name);},
    /**
     * Removes or resets attribute.
     *
     * @param {*} name Environment variable or setting name.
     */
    removeAttribute(name) {this.attributes.delete(name);},
    /**
     * Derives the query selector all result from the supplied values.
     *
     * @param {function(...*): *} selector Selector used to obtain matching
     *     values.
     * @return {!Array<*>} Resulting entries in their output order.
     */
    querySelectorAll(selector) {
      return selector.includes('submit') ? [button] : [];
    },
    /**
     * Derives the query selector result from the supplied values.
     * @return {?*} Result or null when no value is available.
     */
    querySelector() {return null;},
  };
}

/**
 * Derives the editors result from the supplied values.
 * @return {*} Structured result assembled from the input data.
 */
function editors() {
  return createEditors({
    state: {collection: {bottlings: []}},
    selectors: {
      /**
       * Selects bottle matching the input.
       * @return {*} Result computed from the supplied inputs.
       */
      findBottle: () => null,
    },
    /**
     * Derives the bottling form result from the supplied values.
     * @return {string} Resulting text.
     */
    bottlingForm: () => '',
    /**
     * Derives the bottle form result from the supplied values.
     * @return {string} Resulting text.
     */
    bottleForm: () => '',
    /**
     * Renders modal in the current view.
     */
    showModal: () => {},
    /**
     * Performs the close modal lifecycle action.
     */
    closeModal: () => {},
    /**
     * Updates the navigate state for its caller.
     */
    navigate: () => {},
    /**
     * Derives the action result from the supplied values.
     *
     * @param {*} task Task to execute or examine.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    action: task => runAction(task, async () => {}, () => {}),
  });
}

for (const id of ['bottling-form', 'bottle-form']) {
  test(
    `editor: ${id} accepts one concurrent POST and unlocks after HTTP failure`,
    async () => {
      const documentBefore = globalThis.document;
      globalThis.document = {
        /**
         * Derives the query selector result from the supplied values.
         * @return {*} Result computed from the supplied inputs.
         */
        querySelector: () => null,
        /**
         * Constructs element from the supplied data.
         * @return {!Object} Result computed from the supplied inputs.
         */
        createElement: () => ({
          /**
           * Updates the remove state for its caller.
           */
          remove() {},
        }),
        body: {
          /**
           * Updates the append state for its caller.
           */
          append() {},
        },
      };
      const fetchBefore = globalThis.fetch;
      const formDataBefore = globalThis.FormData;
      globalThis.FormData =
        class {
          /**
           * Initializes the instance and its state.
           */
          constructor() {}

          /**
           * Derives the entries result from the supplied values.
           * @return {!Array<*>} Resulting entries in their output order.
           */
          entries() {
            return [['name', 'Saved once'], ['inventoryNumber', '000004']][Symbol.iterator]();
          }
        };
      let posts = 0, failNext = false;
      globalThis.fetch = async url => {
        posts++;
        await delay(35);
        if (failNext) {
          failNext = false; return Response.json({error: 'private'}, {status: 500});
        }
        return Response.json(id === 'bottling-form' ? {bottling: {id: 'created'}, bottle: {id: 'first'}} : {id: 'created'});
      };
      try {
        const editor = editors();
        const form = fakeForm(id);
        const event = {
          target: form,
          /**
           * Updates the prevent default state for its caller.
           */
          preventDefault() {},
        };
        const save = editor.handleForm(event);
        const doubleSubmit = editor.handleForm(event);
        assert.equal(form.dataset.saving, '1');
        assert.equal(form.getAttribute('aria-busy'), 'true');
        assert.equal(form.button.disabled, true);
        await Promise.all([save, doubleSubmit]);
        assert.equal(posts, 1);
        assert.equal(form.dataset.saving, undefined);
        assert.equal(form.button.disabled, false);
        failNext = true;
        await editor.handleForm(event);
        assert.equal(posts, 2);
        assert.equal(form.button.disabled, false);
        await editor.handleForm(event);
        assert.equal(posts, 3, 'a failed POST must allow another submission');
      } finally {
        globalThis.fetch = fetchBefore;
        globalThis.FormData = formDataBefore;
        if (documentBefore === undefined) delete globalThis.document;
        else globalThis.document = documentBefore;
      }
    }
  );
}
