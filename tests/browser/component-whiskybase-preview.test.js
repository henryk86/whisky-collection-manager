import {domElements, domText, assertDom} from './component-dom.js';
import {captureContent, captureAppend} from '../helpers/capture-rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {importChoice} from '../../public/js/features/import/choice-template.js';

test(
  'Whiskybase preview option keeps one checkbox, field name and value in a clickable label',
  async () => {
    const html = importChoice({
      field: 'abv', label: 'Alkoholgehalt (%)',
      value: 46, checked: true,
    });
    await assertDom(html, "label.import-choice");
    assert.ok((await domElements(html, 'input[type="checkbox"][data-import-field="abv"][checked]')).length > 0);
    assert.ok((await domElements(html, '[class="import-choice-copy"]')).length > 0);
    await assertDom(html, "[class=\"import-choice-label\"]", {"text": new RegExp("^Alkoholgehalt \\(%\\)$")});
    await assertDom(html, "[class=\"import-choice-value\"]", {"text": new RegExp("^46$")});
    assert.equal((await domElements(html, '[type="checkbox"]')).length, 1);
  }
);

test(
  'Whiskybase preview options escape incoming fields and show current values',
  async () => {
    const html = importChoice({
      field: 'name',
      label: 'Whiskyname',
      value: '<script>alert(1)</script>',
      currentValue: 'ALT & Neu',
      checked: false,
    });
    await assertDom(html, 'script', {}, true);
    assert.ok((await domText(html)).includes('<script>alert(1)</script>'));
    assert.ok((await domText(html)).includes('Aktuell: ALT & Neu'));
    await assertDom(html, 'input:checked', {}, true);
  }
);

test(
  'unknown distillery is unselectable but still visible with a clear explanation',
  async () => {
    const html = importChoice({
      distillery: true,
      label: 'Destillerie',
      value: 'Neue Brennerei',
      disabled: true,
    });
    assert.ok((await domElements(html, '[name="import-distillery"][disabled]')).length > 0);
    assert.match(await domText(html), /Nicht gefunden/);
  }
);

test(
  'actual Whiskybase controller renders aligned selection cards without changing import defaults',
  async () => {
    const {createWhiskybase} = await import('../../public/js/features/whiskybase/controller.js');
    const oldDocument = globalThis.document;
    let panel = null;
    const fields = {
      /**
       * Updates the insert before state for its caller.
       *
       * @param {*} element DOM element involved in the operation.
       */
      insertBefore: element => {panel = element;},
      /**
       * Updates the prepend state for its caller.
       *
       * @param {*} element DOM element involved in the operation.
       */
      prepend: element => {panel = element;},
    };
    const form = {
      elements: {name: {value: ''}, abv: {value: '43'}, bottler: {value: ''}},
      dataset: {},
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: selector =>
        ({'.forms': fields, '#import-panel': panel}[selector] ?? null),
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
    };
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelector: selector => selector === '#bottling-form' ? form : null,
      /**
       * Constructs element from the supplied data.
       * @return {!Object} Result computed from the supplied inputs.
       */
      createElement: () => ({
        renderedContent: '',
        /**
         * Updates attribute in the current state.
         */
        setAttribute: () => {},
      }),
    };
    try {
      const controller = createWhiskybase({mountContent: captureContent, mountAppend: captureAppend, state: {collection: {distilleries: [{id: 'd-1', name: 'Kilchoman'}]}}, });
      controller.previewImport({
        version: 2, source: 'external', distilleryName: 'Kilchoman',
        fields: {
          whiskybaseId: '15555',
          whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/15555/test',
          name: 'Kilchoman Inaugural Release',
          abv: 46,
          bottler: 'Distillery Bottling',
        },
      });
      assert.equal(panel.id, 'import-panel', 'preview holder created only after payload arrives');
      assert.match(panel.className, /import-area/);
      assert.ok((await domElements(panel.renderedContent, '[class="import-choice-list"][role="group"]')).length > 0);
      assert.ok((await domElements(panel.renderedContent, '[name="import-distillery"][value="d-1"][checked]')).length > 0);
      assert.ok((await domElements(panel.renderedContent, '[data-import-field="name"][checked]')).length > 0);
      assert.ok((await domElements(panel.renderedContent, '[data-import-field="abv"]')).length > 0); // Existing value: unchecked by default
      assert.match(await domText(panel.renderedContent), /Aktuell: 43/);
      assert.ok((await domElements(panel.renderedContent, '[data-act="import-apply"]')).length > 0);
      assert.equal((await domElements(panel.renderedContent, 'label.import-choice')).length, 6);
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
  }
);
