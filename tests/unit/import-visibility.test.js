import test from 'node:test';
import assert from 'node:assert/strict';
import {createBottlingForm} from '../../public/js/features/forms/bottling.js';


test('new and existing bottling forms do not advertise the private extension', () => {
  const form = createBottlingForm({
    state: {collection: {distilleries: []}},
    selectors: {distilleryIds: () => []},
  });
  for (const bottling of [{}, {id: 'existing', name: 'Example whisky'}]) {
    const html = form(bottling);
    assert.doesNotMatch(html, /import-search|import-panel|import-area/);
    assert.match(html, /name="whiskybaseId"/);
    assert.match(html, /name="whiskybaseUrl"/);
  }
});
