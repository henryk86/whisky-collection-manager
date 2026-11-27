import test from 'node:test';
import assert from 'node:assert/strict';
import {createExternalImport} from '../../public/js/features/import/controller.js';

/**
 * Runs the real import controller with a simulated form and selected import fields.
 * @param {!Object} options Test scenario.
 * @return {string} Resulting completeness selection.
 */
function applyComposition({type = 'single_malt', source = 'Kilchoman', selected = ['kilchoman'], existing = [],
  existingType = '', importType = true, complete = 'false'} = {}) {
  const previous = {document: globalThis.document, setTimeout: globalThis.setTimeout};
  const elements = {
    whiskyType: {value: existingType}, compositionComplete: {value: complete},
    /** @param {string} name Form control name. @return {*} Named control. */
    namedItem(name) {return this[name] || null;},
  };
  const distilleries = [{id: 'kilchoman', name: 'Kilchoman'}, {id: 'ardbeg', name: 'Ardbeg'}];
  const choices = distilleries.map(({id}) => ({value: id, checked: existing.includes(id)}));
  const panel = {
    /** @return {null} No previous status. */
    querySelector: () => null,
    /** @param {string} selector CSS selector. @return {!Array<!Object>} Selected preview fields. */
    querySelectorAll: selector => selector === '[data-import-field]:checked' ?
      (importType ? [{dataset: {importField: 'whiskyType'}}] : []) : selected.map(value => ({value})),
  };
  const form = {
    elements, dataset: {},
    /** @return {!Object} Existing import panel. */
    querySelector: () => panel,
    /** @param {string} selector CSS selector. @return {!Array<!Object>} Local distillery controls. */
    querySelectorAll: selector => selector.endsWith(':checked') ? choices.filter(choice => choice.checked) : choices,
  };
  globalThis.document = {
    /** @param {string} selector CSS selector. @return {?Object} Simulated form or panel. */
    querySelector: selector => selector === '#bottling-form' ? form : selector === '#import-panel' ? panel : null,
    /** @return {!Object} Notification element. */
    createElement: () => ({}),
    body: {/** Ignores notifications. */ append() {} },
  };
  globalThis.setTimeout = () => 0;
  try {
    const controller = createExternalImport({
      state: {collection: {distilleries}}, sourceName: 'Test',
      /** @param {!Object} data Import payload. @return {!Object} Validated fixture. */
      validatePayload: data => data,
      /** @return {null} No existing record. */
      findExistingBottling: () => null,
      /** Ignores preview rendering. */
      mountContent() {},
      /** Ignores status rendering. */
      mountAppend() {},
    });
    controller.previewImport({referenceId: 'WB1', distilleryName: source, fields: {whiskyType: type}});
    controller.applyImport();
    return elements.compositionComplete.value;
  } finally {
    if (previous.document === undefined) delete globalThis.document;
    else globalThis.document = previous.document;
    globalThis.setTimeout = previous.setTimeout;
  }
}

test('single malt import marks composition complete when its distillery is assigned', () => {
  assert.equal(applyComposition(), 'true');
  assert.equal(applyComposition({existing: ['kilchoman'], selected: [], existingType: 'single_malt', importType: false}), 'true');
});

test('single malt import does not infer completeness from unknown, missing or rejected distilleries', () => {
  assert.equal(applyComposition({source: 'Unknown', selected: []}), 'false');
  assert.equal(applyComposition({source: '', selected: []}), 'false');
  assert.equal(applyComposition({selected: []}), 'false');
  assert.equal(applyComposition({source: 'Kilchoman, Unknown'}), 'false');
  assert.equal(applyComposition({source: 'Kilchoman, Ardbeg'}), 'false');
  assert.equal(applyComposition({existing: ['ardbeg']}), 'false');
  assert.equal(applyComposition({existing: ['ardbeg'], selected: []}), 'false');
});

test('other categories and rejected category changes preserve the composition setting', () => {
  for (const type of ['blended_malt', 'blended_scotch', 'single_grain', 'blended_grain', null]) {
    assert.equal(applyComposition({type}), 'false');
    assert.equal(applyComposition({type, complete: 'true'}), 'true');
  }
  assert.equal(applyComposition({existingType: 'blended_malt', importType: false}), 'false');
  assert.equal(applyComposition({source: 'Unknown', selected: [], complete: 'true'}), 'true');
});
