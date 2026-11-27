import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingBottlings} from '../../public/js/features/forms/bottling-choice.js';

test('existing bottling search accepts the full displayed name and its individual fields', () => {
  const first = {id: 'a', name: 'Kilchoman Genesis', subtitle: 'Fermenting – Stage 5', fullName: 'Kilchoman Genesis · Fermenting – Stage 5'};
  const second = {id: 'b', name: 'Kilchoman Genesis', subtitle: 'Distilling – Stage 6', fullName: 'Kilchoman Genesis · Distilling – Stage 6'};
  const legacy = {id: 'c', name: 'Ardbeg Uigeadail'};
  const collection = {bottlings: [first, second, legacy]};
  for (const value of [first.fullName, first.fullName.toUpperCase(), 'Fermenting', 'Stage 5']) {
    assert.deepEqual(matchingBottlings(collection, value), [first]);
  }
  assert.deepEqual(matchingBottlings(collection, 'Kilchoman Genesis'), [second, first]);
  assert.deepEqual(matchingBottlings(collection, legacy.name), [legacy]);
});
