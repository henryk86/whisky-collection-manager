import {domElements, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarehouseView} from '../../public/js/views/warehouse.js';

test(
  'physical bottle multi-selection remains in the storage wall, not in the finder',
  async () => {
    const warehouse = {
      rooms: [{
        id: 'room', name: 'Raum', width: 5, height: 4, furniture: [
          {
            id: 'f',
            name: 'Regal 1',
            type: 'regal',
            width: 1,
            itemHeight: 2,
            elevation: 0,
            shelves: [{id: 's', name: 'Fach 1', capacity: 3}],
          }],
      }],
      bottles: [{id: 'b1', name: 'Whisky 1'}, {id: 'b2', name: 'Whisky 2'}],
      assignments: {b1: 's', b2: 's'},
    };
    const state = {
      warehouse,
      selected: 'find',
      warehouseUnassigned: false,
      warehouseSearch: '',
      warehouseRoomId: 'room',
      warehousePlanMode: 'wall',
      warehouseSelectedBottleIds: ['b1', 'b2'],
    };
    let html = '', dialog = '';
    const view = createWarehouseView({
      state,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} source Page content passed by the view.
       */
      shell: source => {html = source;},
      /**
       * Suppresses navigation so the scenario can inspect the current view.
       */
      navigate: () => {},
      modal: {
        /**
         * Captures the dialog body without mounting the modal overlay.
         *
         * @param {string} _title Dialog title ignored by this fixture.
         * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Dialog content captured for assertions.
         */
        showModal: (_title, content) => {dialog = content;},
      },
      /**
       * Performs the refresh lifecycle action.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      refresh: async () => {},
    });
    const oldDocument = globalThis.document;
    globalThis.document = {
      /**
       * Simulates an element lookup that finds nothing.
       * @return {null} Null to represent a missing element.
       */
      querySelector: () => null,
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
      /**
       * Retrieves element by id from the available state.
       * @return {*} Result computed from the supplied inputs.
       */
      getElementById: () => null,
    };
    try {
      view.render();
      assert.equal((await domElements(html, '[class="warehouse-bottle-check"]')).length, 0);
      assert.equal((await domElements(html, '[data-act="warehouse-bottles-assign-selected"]')).length, 0);
      await assertDom(html, ".warehouse-finder-card");
      assert.ok((await domElements(html, '[data-act="warehouse-find-location"]')).length > 0);
      state.selected = 'shelves';
      view.render();
      view.assignSelectedBottles();
      assert.ok((await domElements(dialog, '[data-endpoint="/api/warehouse/bottles/bulk"]')).length > 0);
      assert.ok((await domElements(dialog, '[data-bottle-bulk="true"]')).length > 0);
      assert.ok((await domElements(html, '[class="warehouse-room-wall"]')).length > 0);
      assert.equal((await domElements(html, '[class="warehouse-wall-bottle is-selected"]')).length, 2);
      await assertDom(html, ".warehouse-bottle-bulk-tools");
    } finally {
      if (oldDocument === undefined) delete globalThis.document;
      else globalThis.document = oldDocument;
    }
  }
);
