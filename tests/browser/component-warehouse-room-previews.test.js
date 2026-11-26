import {domElements, domText, domMatches} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

const rooms = [
  {
    id: 'raum-a', name: 'Whiskyzimmer', width: 4, height: 3, furniture: [
      {
        id: 'regal-a',
        name: 'Regal A',
        type: 'regal',
        x: 0.2,
        y: 0.4,
        width: 1,
        depth: 0.5,
        rotation: 0,
        elevation: 0,
        itemHeight: 1.7,
        shelves: [],
      },
    ],
  },
  {id: 'raum-b', name: 'Nebenzimmer', width: 3, height: 3, furniture: []},
];

test(
  'each overview room card has one decorative snapshot slot and stays a single clickable card',
  async () => {
    const previous = globalThis.document;
    let html = '';
    const warehouse = {rooms, bottles: [], assignments: {}};
    globalThis.document = {
      /**
       * Simulates an element lookup that finds nothing.
       * @return {null} Null to represent a missing element.
       */
      querySelector: () =>
        null,
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state: {warehouse, selected: 'overview'},
        /**
         * Captures the rendered page in the fixture for later assertions.
         *
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} value Page content passed by the view.
         */
        shell: value => {html = value;},
        /**
         * Suppresses navigation so the scenario can inspect the current view.
         */
        navigate: () => {},
        modal: {},
        /**
         * Performs the refresh lifecycle action.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        refresh: async () => {},
      });
      view.render();
      assert.equal((await domElements(html, '[class="warehouse-room-card"]')).length, 2);
      assert.equal((await domElements(html, '[class="warehouse-room-preview"]')).length, 2);
      assert.equal((await domElements(html, '[class="warehouse-room-card-details"]')).length, 2);
      assert.ok((await domElements(html, '[data-preview-room-id="raum-a"][aria-hidden="true"]')).length > 0);
      assert.ok((await domElements(html, '[data-preview-room-id="raum-b"][aria-hidden="true"]')).length > 0);
      assert.ok((await domElements(html, '[data-act="warehouse-select-room"][data-id="raum-a"]')).length > 0);
      assert.ok((await domElements(html, '[data-act="warehouse-select-room"][data-id="raum-b"]')).length > 0);
      assert.equal((await domMatches(html, ".warehouse-three-viewport")) || (await domMatches(html, ".warehouse-three-canvas")), false);
    } finally {
      if (previous === undefined) delete globalThis.document;
      else globalThis.document = previous;
    }
  }
);
