import test from 'node:test';
import assert from 'node:assert/strict';
import {mountWarehouseRoomPreviews} from '../../public/js/ui/warehouse-room-previews.js';

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
  'overview thumbnails reuse actual 3D scene construction and only allocate a shared temporary renderer',
  () => {
    const previous = globalThis.document;
    try {
      delete globalThis.document;
      assert.doesNotThrow(() => mountWarehouseRoomPreviews({rooms, warehouse: {rooms}}).dispose());
    } finally {
      if (previous !== undefined) globalThis.document = previous;
    }
  }
);
