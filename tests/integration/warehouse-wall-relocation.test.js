import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer, requestJson as api} from '../helpers/server.js';

test(
  'moving a physical bottle between opposite racks uses the same assignment \
endpoint and enforces target capacity',
  async () => {
    const ctx = await startTestServer();
    try {
      const room = (await api(
        ctx.base,
        '/api/warehouse/rooms',
        'POST',
        {name: 'Bottle room', width: 6, height: 4}
      )).data;
      assert.ok(room.id);
      const first = (await api(
        ctx.base,
        `/api/warehouse/rooms/${room.id}/furniture`,
        'POST',
        {
          name: 'Regal 1',
          type: 'regal',
          x: 0,
          y: 0,
          width: 1,
          depth: .5,
          rotation: 0,
        }
      )).data;
      const last = (await api(
        ctx.base,
        `/api/warehouse/rooms/${room.id}/furniture`,
        'POST',
        {
          name: 'Regal 4',
          type: 'regal',
          x: 4,
          y: 3,
          width: 1,
          depth: .5,
          rotation: 180,
        }
      )).data;
      const source = (await api(
        ctx.base,
        `/api/warehouse/furniture/${first.id}/shelves`,
        'POST',
        {name: 'Fach A', capacity: 2}
      )).data;
      const target = (await api(
        ctx.base,
        `/api/warehouse/furniture/${last.id}/shelves`,
        'POST',
        {name: 'Fach B', capacity: 1}
      )).data;
      const bottled = (await api(ctx.base, '/api/bottlings', 'POST',
        {
          name: 'Whisky',
          firstBottle: {inventoryNumber: '1001', status: 'closed'},
        })).data;
      const another = (await api(ctx.base, '/api/bottles', 'POST',
        {bottlingId: bottled.bottling.id, inventoryNumber: '1002'})).data;
      const bottleId = bottled.bottle.id;
      assert.equal(
        (await api(
          ctx.base,
          `/api/warehouse/bottles/${bottleId}`,
          'PUT',
          {shelfId: source.id}
        )).status,
        200
      );
      assert.equal(
        (await api(
          ctx.base,
          `/api/warehouse/bottles/${another.id}`,
          'PUT',
          {shelfId: target.id}
        )).status,
        200
      );
      assert.equal(
        (await api(
          ctx.base,
          `/api/warehouse/bottles/${bottleId}`,
          'PUT',
          {shelfId: target.id}
        )).status,
        409
      );
      assert.equal(
        (await api(
          ctx.base,
          `/api/warehouse/bottles/${another.id}`,
          'PUT',
          {shelfId: source.id}
        )).status,
        200
      );
      assert.equal(
        (await api(
          ctx.base,
          `/api/warehouse/bottles/${bottleId}`,
          'PUT',
          {shelfId: target.id}
        )).status,
        200
      );
      const updated = (await api(ctx.base, '/api/warehouse')).data;
      assert.equal(updated.assignments[bottleId], target.id);
      assert.equal(updated.assignments[another.id], source.id);
      assert.equal(updated.rooms[0].furniture.length, 2);
    } finally {await ctx.stop();}
  }
);
