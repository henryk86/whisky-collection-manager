import test from 'node:test';
import assert from 'node:assert/strict';
import {routeUrl, parseRoute} from '../../public/js/navigation/routes.js';
import {storagePath} from '../../public/js/views/warehouse.js';

test(
  'warehouse routes survive reloads and links from bottle details resolve individual shelves',
  () => {
    const target = routeUrl('warehouse', 'rooms', {roomId: 'room-123', furnitureId: 'furniture-123'});
    assert.deepEqual(
      parseRoute(new URL(target, 'http://example.test').search),
      {
        page: 'warehouse',
        selected: 'rooms',
        roomId: 'room-123',
        furnitureId: 'furniture-123',
      }
    );
    assert.equal(parseRoute('?view=warehouse&section=bad').selected, 'overview');
    const w = {
      rooms: [{
        id: 'r',
        name: 'Room',
        furniture: [{
          id: 'f', name: 'Regal', shelves: [{
            id: 's',
            name: 'Fach',
          }],
        }],
      }],
    };
    assert.equal(storagePath(w, 's').label, 'Room / Regal / Fach');
    assert.equal(storagePath(w, 'missing'), null);
  }
);
