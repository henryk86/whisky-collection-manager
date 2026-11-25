import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWarehouseView} from '../../public/js/views/warehouse.js';
import {mountWarehouseRoomPreviews}
  from '../../public/js/ui/warehouse-room-previews.js';

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
  'each overview room card has one decorative snapshot slot and stays a \
single clickable card',
  () => {
    const previous = globalThis.document;
    let html = '';
    const warehouse = {rooms, bottles: [], assignments: {}};
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      querySelector: () =>
        null,
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    try {
      const view = createWarehouseView({
        state: {warehouse, selected: 'overview'},
        /**
         * Updates the shell state for its caller.
         *
         * @param {*} value Value to process.
         */
        shell: value => {html = value;},
        /**
         * Updates the navigate state for its caller.
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
      assert.equal(
        (html.match(/class="warehouse-room-card"/g) || []).length,
        2
      );
      assert.equal(
        (html.match(/class="warehouse-room-preview"/g) || []).length,
        2
      );
      assert.equal(
        (html.match(/class="warehouse-room-card-details"/g) || []).length,
        2
      );
      assert.match(html, /data-preview-room-id="raum-a" aria-hidden="true"/);
      assert.match(html, /data-preview-room-id="raum-b" aria-hidden="true"/);
      assert.match(html, /data-act="warehouse-select-room" data-id="raum-a"/);
      assert.match(html, /data-act="warehouse-select-room" data-id="raum-b"/);
      assert.doesNotMatch(
        html,
        /warehouse-three-canvas|warehouse-three-viewport/
      );
    } finally {
      if (previous === undefined) delete globalThis.document;
      else globalThis.document = previous;
    }
  }
);

test(
  'overview thumbnails reuse actual 3D scene construction and only allocate \
a shared temporary renderer',
  () => {
    const previous = globalThis.document;
    try {
      delete globalThis.document;
      assert.doesNotThrow(() =>
        mountWarehouseRoomPreviews({rooms, warehouse: {rooms}}).dispose());
    } finally {
      if (previous !== undefined) globalThis.document = previous;
    }
  }
);
