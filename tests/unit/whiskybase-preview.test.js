import {renderedText, captureContent, captureAppend, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {importChoice} from '../../public/js/features/import/choice-template.js';

test(
  'Whiskybase preview option keeps one checkbox, field name and value in a clickable label',
  () => {
    const html = importChoice({
      field: 'abv', label: 'Alkoholgehalt (%)',
      value: 46, checked: true,
    });
    assert.match(renderedText(html), /^<label class="import-choice">/);
    assert.ok(domElements(html, 'input[type="checkbox"][data-import-field="abv"][checked]').length > 0);
    assert.ok(domElements(html, '[class="import-choice-copy"]').length > 0);
    assert.match(renderedText(html), /class="import-choice-label">Alkoholgehalt \(%\)<\/span>/);
    assert.match(renderedText(html), /class="import-choice-value">46<\/span>/);
    assert.equal(domElements(html, '[type="checkbox"]').length, 1);
  }
);

test(
  'Whiskybase preview options escape incoming fields and show current values',
  () => {
    const html = importChoice({
      field: 'name',
      label: 'Whiskyname',
      value: '<script>alert(1)</script>',
      currentValue: 'ALT & Neu',
      checked: false,
    });
    assert.ok(!renderedText(html).includes('<script>'));
    assert.ok(renderedText(html).includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(renderedText(html).includes('Aktuell: ALT &amp; Neu'));
    assert.ok(!renderedText(html).includes(' checked'));
  }
);

test(
  'unknown distillery is unselectable but still visible with a clear explanation',
  () => {
    const html = importChoice({
      distillery: true,
      label: 'Destillerie',
      value: 'Neue Brennerei',
      disabled: true,
    });
    assert.ok(domElements(html, '[name="import-distillery"][disabled]').length > 0);
    assert.match(renderedText(html), /Nicht gefunden/);
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
        innerHTML: '',
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
      assert.equal(renderedText(panel.id), 'import-panel', 'preview holder created only after payload arrives');
      assert.match(renderedText(panel.className), /import-area/);
      assert.ok(domElements(panel.innerHTML, '[class="import-choice-list"][role="group"]').length > 0);
      assert.ok(domElements(panel.innerHTML, '[name="import-distillery"][value="d-1"][checked]').length > 0);
      assert.ok(domElements(panel.innerHTML, '[data-import-field="name"][checked]').length > 0);
      assert.ok(domElements(panel.innerHTML, '[data-import-field="abv"]').length > 0); // Existing value: unchecked by default
      assert.match(renderedText(panel.innerHTML), /Aktuell: 43/);
      assert.ok(domElements(panel.innerHTML, '[data-act="import-apply"]').length > 0);
      assert.equal((renderedText(panel.innerHTML).match(/<label class="import-choice">/g) ?? []).length, 6);
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
  }
);
