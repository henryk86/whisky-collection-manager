import test from 'node:test';
import assert from 'node:assert/strict';
import {preserveManualComposition, suggestSingleDistilleryComposition} from '../../public/js/features/forms/composition.js';

function editor(type = 'single_malt', complete = 'false') {
  const controls = {whiskyType: {value: type}, compositionComplete: {value: complete}};
  const assigned = [{value: 'kilchoman'}];
  const form = {
    elements: {namedItem: name => controls[name]},
    querySelectorAll: () => assigned,
  };
  return {form, controls, assigned};
}

for (const type of ['single_malt', 'single_grain']) {
  test(`${type}: automatic completeness is reversible, including import changes`, () => {
    const {form, controls, assigned} = editor(type);
    const complete = controls.compositionComplete;
    suggestSingleDistilleryComposition(form, 'kilchoman');
    assert.equal(complete.value, 'true');
    assigned.push({value: 'ardbeg'});
    suggestSingleDistilleryComposition(form, null);
    assert.equal(complete.value, 'false');
    assigned.pop();
    suggestSingleDistilleryComposition(form, null);
    assert.equal(complete.value, 'false', 'unmatched import cannot infer completeness');
    suggestSingleDistilleryComposition(form);
    assert.equal(complete.value, 'true');
    controls.whiskyType.value = 'blended_malt';
    suggestSingleDistilleryComposition(form, null);
    assert.equal(complete.value, 'false');
    controls.whiskyType.value = type;
    suggestSingleDistilleryComposition(form);
    assert.equal(complete.value, 'true');
    assigned.pop();
    suggestSingleDistilleryComposition(form);
    assert.equal(complete.value, 'false');
  });
}

test('manual choices and pre-existing completeness are not reverted or overwritten', () => {
  const {form, controls, assigned} = editor();
  suggestSingleDistilleryComposition(form);
  controls.compositionComplete.value = 'false';
  preserveManualComposition(form);
  suggestSingleDistilleryComposition(form, 'kilchoman');
  assert.equal(controls.compositionComplete.value, 'false');
  controls.compositionComplete.value = 'true';
  preserveManualComposition(form);
  assigned.pop();
  suggestSingleDistilleryComposition(form);
  assert.equal(controls.compositionComplete.value, 'true');
  const saved = editor('single_malt', 'true');
  suggestSingleDistilleryComposition(saved.form);
  saved.assigned.pop();
  suggestSingleDistilleryComposition(saved.form);
  assert.equal(saved.controls.compositionComplete.value, 'true');
  const next = editor();
  suggestSingleDistilleryComposition(next.form);
  assert.equal(next.controls.compositionComplete.value, 'true', 'manual override does not leak into another editor');
});
