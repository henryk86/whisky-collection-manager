import {renderedText} from '../helpers/rendering.js';
import {createBottleForm} from '../../public/js/features/forms/bottle.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createExternalImport}
  from '../../public/js/features/import/controller.js';

/**
 * A different source can feed the import UI without Whiskybase fields or
 * selectors.
 */
test(
  'generic import preview applies fields and matches distilleries without provider coupling',
  () => {
    const previous = {
      document: globalThis.document, setTimeout: globalThis.setTimeout,
    };
    const state = {
      collection: {
        bottlings: [], distilleries: [{
          id: 'local-d',
          name: 'Test Distillery',
        }],
      },
    };
    let panel = null;
    const choices = [{dataset: {importField: 'name'}}, {dataset: {importField: 'abv'}},];
    const form = {
      dataset: {},
      elements: {name: {value: ''}, abv: {value: ''}},
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector(selector) {
        return selector === '.forms' ?
          {
            /**
             * Updates the prepend state for its caller.
             *
             * @param {*} element DOM element involved in the operation.
             */
            prepend(element) {panel = element;},
          } : selector === '#import-panel' ? panel : null;
      },
      /**
       * Derives the query selector all result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll(selector) {
        return selector === 'input[name=distilleryIds]:checked' ? [] : selector === 'input[name=distilleryIds]' ? [{value: 'local-d', checked: false}] : [];
      },
    };
    const calls = [];
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector(selector) {
        return selector === '#bottling-form' ? form : selector === '#import-panel' ? panel : null;
      },
      /**
       * Constructs element from the supplied data.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      createElement() {
        return {
          /**
           * Updates attribute in the current state.
           */
          setAttribute() {},
          /**
           * Updates the remove state for its caller.
           */
          remove() {},
          /**
           * Derives the query selector result from the supplied values.
           * @return {?*} Result or null when no value is available.
           */
          querySelector() {return null;},
          /**
           * Updates the insert adjacent html state for its caller.
           */
          insertAdjacentHTML() {},
          /**
           * Derives the query selector all result from the supplied values.
           *
           * @param {function(...*): *} selector Selector input for this
           * operation.
           * @return {!Array<*>} Resulting entries in their output order.
           */
          querySelectorAll(selector) {
            if (selector === '[data-import-field]:checked') return choices;
            if (selector === '[name=import-distillery]:checked') return [{value: 'local-d'}];
            return [];
          },
        };
      },
      body: {
        /**
         * Updates the append state for its caller.
         *
         * @param {*} el Value used by this operation.
         */
        append(el) {calls.push(el.textContent);},
      },
    };
    globalThis.setTimeout = () => 0;
    try {
      const controller = createExternalImport({
        state, sourceName: 'Local Catalog',
        /**
         * Validates payload against its constraints.
         *
         * @param {*} data Input data to process.
         * @return {*} Result computed from the supplied inputs.
         */
        validatePayload: data => data,
        /**
         * Selects existing bottling matching the input.
         * @return {*} Result computed from the supplied inputs.
         */
        findExistingBottling: () => null,
      });
      controller.previewImport({
        referenceId: 'LC-12',
        distilleryName: 'Test Distillery',
        imageToken: null,
        fields: {name: 'Example', abv: 48},
      });
      assert.equal(renderedText(panel.id), 'import-panel');
      assert.match(renderedText(panel.innerHTML), /data-import-field="name"/);
      assert.match(renderedText(panel.innerHTML), /name="import-distillery" value="local-d"/);
      controller.applyImport();
      assert.equal(renderedText(form.elements.name.value), 'Example');
      assert.equal(renderedText(form.elements.abv.value), 48);
      assert.ok(calls.some(message => /Importdaten/.test(renderedText(message))));
    } finally {
      if (previous.document === undefined) delete globalThis.document;
      else globalThis.document = previous.document;
      globalThis.setTimeout = previous.setTimeout;
    }
  }
);

test(
  'new physical bottle uses a source-independent photo opt-in only for pending imports',
  async () => {
    const {createEditors} = await import('../../public/js/features/editor-controller.js');
    const modals = [];
    const editor = createEditors({
      state: {
        selected: 'bottling-1',
        collection: {bottlings: [{id: 'bottling-1', name: 'Test'}]},
      },
      selectors: {
        /**
         * Selects bottle matching the input.
         * @return {*} Result computed from the supplied inputs.
         */
        findBottle: () => null,
      },
      /**
       * Derives the bottle form result from the supplied values.
       * @return {string} Resulting text.
       */
      bottleForm: createBottleForm({
        state: {collection: {bottlings: [{id: 'bottling-1', name: 'Test'}]}},
        selectors: {
          /**
           * Returns the test bottling's distillery label.
           * @return {string} Empty label for this fixture.
           */
          distilleryNames: () => '',
        },
      }),
      /**
       * Renders modal in the current view.
       *
       * @param {*} title Title displayed or stored by this operation.
       * @param {*} html HTML markup to render or inspect.
       * @return {number} Calculated numeric value.
       */
      showModal: (title, html) => modals.push({title, html}),
      /**
       * Retrieves pending image token from the available state.
       * @return {string} Resulting text.
       */
      getPendingImageToken: () => 'valid-pending-token',
    });
    editor.newBottle(true);
    assert.match(renderedText(modals[0].html), /name="importReferencePhoto" checked/);
    assert.match(renderedText(modals[0].html), /class="import-photo form-field full"/);
    editor.newBottle(false);
    assert.doesNotMatch(renderedText(modals[1].html), /importReferencePhoto/);
  }
);
