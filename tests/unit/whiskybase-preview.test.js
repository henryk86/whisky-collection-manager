import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {importChoice} from '../../public/js/features/import/choice-template.js';

test(
  'Whiskybase preview option keeps one checkbox, field name and value in a clickable label',
  () => {
    const html = importChoice({field: 'abv', label: 'Alkoholgehalt (%)', value: 46, checked: true});
    assert.match(html, /^<label class="import-choice">/);
    assert.match(
      html,
      /<input type="checkbox" data-import-field="abv" checked>/
    );
    assert.match(html, /class="import-choice-copy"/);
    assert.match(
      html,
      /class="import-choice-label">Alkoholgehalt \(%\)<\/span>/
    );
    assert.match(html, /class="import-choice-value">46<\/span>/);
    assert.equal((html.match(/type="checkbox"/g) || []).length, 1);
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
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('Aktuell: ALT &amp; Neu'));
    assert.ok(!html.includes(' checked'));
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
    assert.match(html, /name="import-distillery" disabled/);
    assert.match(html, /Nicht gefunden/);
  }
);

test(
  'actual Whiskybase controller renders aligned selection cards without changing import defaults',
  async () => {
    const {createWhiskybase} =
      await import('../../public/js/features/whiskybase/controller.js');
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
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
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
      const controller = createWhiskybase({
        state: {collection: {distilleries: [{id: 'd-1', name: 'Kilchoman'}]}},
      });
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
      assert.equal(
        panel.id,
        'import-panel',
        'preview holder created only after payload arrives'
      );
      assert.match(panel.className, /import-area/);
      assert.match(panel.innerHTML, /class="import-choice-list" role="group"/);
      assert.match(
        panel.innerHTML,
        /name="import-distillery" value="d-1" checked/
      );
      assert.match(panel.innerHTML, /data-import-field="name" checked/);
      assert.match(panel.innerHTML, /data-import-field="abv">/); // Existing value: unchecked by default
      assert.match(panel.innerHTML, /Aktuell: 43/);
      assert.match(panel.innerHTML, /data-act="import-apply"/);
      assert.equal(
        (panel.innerHTML.match(/<label class="import-choice">/g) ?? []).length,
        6
      );
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
  }
);
