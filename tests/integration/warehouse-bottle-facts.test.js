import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer, requestJson as api} from '../helpers/server.js';

test(
  'storage API exposes read-only age, release year and cask type from \
bottling data',
  async () => {
    const ctx = await startTestServer();
    try {
      const created = await api(ctx.base, '/api/bottlings', 'POST', {
        name: 'Aged malt', ageYears: 18, releaseYear: 2012, caskType: 'Oloroso',
        firstBottle: {inventoryNumber: '1001', status: 'closed'},
      });
      assert.equal(created.status, 201);
      const response = await api(ctx.base, '/api/warehouse');
      assert.equal(response.status, 200);
      const bottle = response.data.bottles.find(entry => entry.id ===
        created.data.bottle.id);
      assert.ok(bottle);
      assert.equal(bottle.ageYears, 18);
      assert.equal(bottle.releaseYear, 2012);
      assert.equal(bottle.caskType, 'Oloroso');
      const unknown = await api(
        ctx.base,
        '/api/bottlings',
        'POST',
        {name: 'No facts', firstBottle: {inventoryNumber: '1002'}}
      );
      assert.equal(unknown.status, 201);
      const response2 = await api(ctx.base, '/api/warehouse');
      const plain = response2.data.bottles.find(entry => entry.id ===
        unknown.data.bottle.id);
      assert.equal(plain.ageYears, null);
      assert.equal(plain.releaseYear, null);
      assert.equal(plain.caskType, null);
    } finally {await ctx.stop();}
  }
);
