import {domElements, domText, domMatches} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBottlingForm} from '../../public/js/features/forms/bottling.js';

test(
  'new and existing bottling forms do not advertise the private extension',
  async () => {
    const form = createBottlingForm({
      state: {collection: {distilleries: []}},
      selectors: {
        /**
         * Derives the distillery ids result from the supplied values.
         * @return {!Array<*>} Resulting entries in their output order.
         */
        distilleryIds: () => [],
      },
    });
    for (const bottling of [{}, {id: 'existing', name: 'Example whisky'}]) {
      const html = form(bottling);
      assert.equal((await domMatches(html, "#import-search, .import-search, #import-panel, .import-panel, #import-area, .import-area")), false);
      assert.ok((await domElements(html, '[name="whiskybaseId"]')).length > 0);
      assert.ok((await domElements(html, '[name="whiskybaseUrl"]')).length > 0);
    }
  }
);
