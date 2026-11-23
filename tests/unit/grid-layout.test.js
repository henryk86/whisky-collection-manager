import test from 'node:test';
import assert from 'node:assert/strict';
import {paginate} from '../../public/js/domain/pagination.js';

// Visual grid properties are tested in Chromium in collection.test.js.
// Here we test the actual pagination behavior independent of CSS layout.
test('six results and final pages preserve the selected page size', () => {
  const entries = Array.from({length: 450}, (_, i) => ({id: String(i)}));
  const filtered = entries.slice(0, 6);
  assert.equal(paginate(filtered, 1, 24).items.length, 6);
  assert.equal(paginate(filtered, 1, 24).pageSize, 24);
  assert.equal(paginate(entries, 1, 24).items.length, 24);
  assert.equal(paginate(entries, 19, 24).items.length, 18);
});
