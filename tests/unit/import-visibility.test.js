import {renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBottlingForm} from '../../public/js/features/forms/bottling.js';


test(
  'new and existing bottling forms do not advertise the private extension',
  () => {
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
      assert.doesNotMatch(renderedText(html), /import-search|import-panel|import-area/);
      assert.ok(domElements(html, '[name="whiskybaseId"]').length > 0);
      assert.ok(domElements(html, '[name="whiskybaseUrl"]').length > 0);
    }
  }
);
