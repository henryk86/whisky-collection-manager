import test from 'node:test';
import assert from 'node:assert/strict';
import {reorderFlightIds} from '../../public/js/features/flight-order.js';

const original = ['a', 'b', 'c', 'd'];

test(
  'flight drag insertion works forward, backward, and skips no-op drops',
  () => {
    assert.deepEqual(reorderFlightIds(original, 'a', 'c', false), ['b', 'a', 'c', 'd']);
    assert.deepEqual(reorderFlightIds(original, 'a', 'c', true), ['b', 'c', 'a', 'd']);
    assert.deepEqual(reorderFlightIds(original, 'd', 'b', false), ['a', 'd', 'b', 'c']);
    assert.deepEqual(reorderFlightIds(original, 'd', 'b', true), ['a', 'b', 'd', 'c']);
    assert.equal(reorderFlightIds(original, 'a', 'b', false), null);
    assert.equal(reorderFlightIds(original, 'd', 'c', true), null);
    assert.equal(reorderFlightIds(original, 'a', 'a', true), null);
    assert.equal(reorderFlightIds(original, 'unknown', 'b', false), null);
    assert.deepEqual(original, ['a', 'b', 'c', 'd'], 'input array is never mutated');
  }
);
