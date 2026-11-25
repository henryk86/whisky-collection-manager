import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer, requestJson} from '../helpers/server.js';

test(
  'bottle emptying date is persisted, validated and exported without \
requiring a schema migration',
  async () => {
    const ctx = await startTestServer();
    try {
      const created = await requestJson(ctx.base, '/api/bottlings', 'POST', {
        name: 'Consumption Test',
        firstBottle: {inventoryNumber: '000775', status: 'closed'},
      });
      assert.equal(created.status, 201);
      const bottlingId = created.data.bottling.id;
      const added = await requestJson(ctx.base, '/api/bottles', 'POST', {
        bottlingId,
        inventoryNumber: '000776',
        volumeType: 'standard',
        status: 'empty',
        openedAt: '2024-02-28',
        emptiedAt: '2024-03-01',
      });
      assert.equal(added.status, 201);
      assert.equal(added.data.emptiedAt, '2024-03-01');
      const bottleId = added.data.id;
      const loaded = await requestJson(ctx.base, '/api/collection');
      assert.equal(loaded.data.schemaVersion, 6);
      assert.equal(loaded.data.bottlings.find(b => b.id === bottlingId)
        .bottles.find(b => b.id === bottleId).emptiedAt, '2024-03-01');
      const csv = await fetch(ctx.base + '/api/export/csv');
      assert.equal(csv.status, 200);
      const csvText = await csv.text();
      assert.match(csvText, /"Öffnungsdatum";"Leerdatum"/);
      assert.match(csvText, /"2024-02-28";"2024-03-01"/);
      const invalidDay = await requestJson(
        ctx.base,
        `/api/bottles/${bottleId}`,
        'PATCH',
        {
          emptiedAt: '2026-02-30',
        }
      );
      assert.equal(invalidDay.status, 400);
      const invalidOrder = await requestJson(
        ctx.base,
        `/api/bottles/${bottleId}`,
        'PATCH',
        {
          emptiedAt: '2024-02-27',
        }
      );
      assert.equal(invalidOrder.status, 400);
      const invalidOpenedDate = await requestJson(
        ctx.base,
        `/api/bottles/${bottleId}`,
        'PATCH',
        {
          openedAt: '2024-03-02',
        }
      );
      assert.equal(invalidOpenedDate.status, 400);
      const stillSaved = await requestJson(ctx.base, '/api/collection');
      assert.equal(stillSaved.data.bottlings.find(b => b.id === bottlingId)
        .bottles.find(b => b.id === bottleId).emptiedAt, '2024-03-01',
        'rejected updates must not mutate persisted data');
      const cleared = await requestJson(
        ctx.base,
        `/api/bottles/${bottleId}`,
        'PATCH',
        {
          emptiedAt: '',
        }
      );
      assert.equal(cleared.status, 200);
      assert.equal(cleared.data.emptiedAt, null);
      const noDate = await requestJson(ctx.base, '/api/bottles', 'POST', {
        bottlingId, inventoryNumber: '000777', status: 'empty',
      });
      assert.equal(
        noDate.status,
        201,
        'legacy bottles can be empty without a recorded emptying date'
      );
    } finally {
      await ctx.stop();
    }
  }
);
