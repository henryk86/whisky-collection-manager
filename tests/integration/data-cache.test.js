import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startTestServer, requestJson} from '../helpers/server.js';

/**
 * Requests get data from the configured remote endpoint.
 *
 * @param {*} base Base value or reference for the calculation.
 * @param {*} endpoint Value used by this operation.
 * @param {*} etag Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function get(base, endpoint, etag) {
  return fetch(base + endpoint, {headers: etag ? {'If-None-Match': etag} : {}});
}

test(
  'collection and warehouse ETags return empty 304 on unchanged data and change after a bottling mutation',
  async () => {
    const ctx = await startTestServer();
    try {
      const initialCollection = await get(ctx.base, '/api/collection');
      const colTag = initialCollection.headers.get('etag');
      assert.match(colTag, /^W\/"collection-[\w-]+"$/);
      assert.equal(initialCollection.headers.get('cache-control'), 'private, no-cache');
      assert.equal((await initialCollection.json()).schemaVersion, 9);
      const initialWarehouse = await get(ctx.base, '/api/warehouse');
      const whTag = initialWarehouse.headers.get('etag');
      assert.ok(whTag);
      await initialWarehouse.json();
      for (const [url, tag] of [['/api/collection', colTag], ['/api/warehouse',
        whTag]]) {
        const response = await get(ctx.base, url, tag);
        assert.equal(response.status, 304);
        assert.equal(await response.text(), '');
        assert.equal(response.headers.get('etag'), tag);
      }
      assert.equal(
        (await requestJson(ctx.base, '/api/bottlings', 'POST', {name: 'Cache Whisky', firstBottle: {inventoryNumber: '000901'}})).status,
        201
      );
      const nextCollection = await get(ctx.base, '/api/collection', colTag);
      assert.equal(nextCollection.status, 200);
      assert.notEqual(nextCollection.headers.get('etag'), colTag);
      assert.equal((await nextCollection.json()).bottlings.length, 1);
      const nextWarehouse = await get(ctx.base, '/api/warehouse', whTag);
      assert.equal(nextWarehouse.status, 200, 'warehouse validator must include collection revision');
      assert.notEqual(nextWarehouse.headers.get('etag'), whTag);
      await nextWarehouse.json();
    } finally {await ctx.stop();}
  }
);

test(
  'warehouse revisions are independent of collection; replacing collection file bypasses in-memory cache',
  async () => {
    const ctx = await startTestServer();
    try {
      const collection = await get(ctx.base, '/api/collection');
      const colTag = collection.headers.get('etag');
      const snapshot = await collection.json();
      const warehouse = await get(ctx.base, '/api/warehouse');
      const whTag = warehouse.headers.get('etag');
      await warehouse.json();
      assert.equal(
        (await requestJson(ctx.base, '/api/warehouse/rooms', 'POST', {name: 'Zimmer', width: 3, height: 4})).status,
        201
      );
      const newWarehouse = await get(ctx.base, '/api/warehouse', whTag);
      assert.equal(newWarehouse.status, 200);
      assert.notEqual(newWarehouse.headers.get('etag'), whTag);
      assert.equal((await newWarehouse.json()).rooms.length, 1);
      assert.equal((await get(ctx.base, '/api/collection', colTag)).status, 304);
      // Same-process cache must observe an atomic replacement by a restore or
      // another writer.
      const core = path.join(ctx.dir, 'data', 'collection.json');
      const coreData = JSON.parse(fs.readFileSync(core));
      coreData.nextInventoryNumber++;
      fs.writeFileSync(core + '.replacement', JSON.stringify(coreData));
      fs.renameSync(core + '.replacement', core);
      const changedCore = await get(ctx.base, '/api/collection', colTag);
      assert.equal(changedCore.status, 200);
      const changedCoreTag = changedCore.headers.get('etag');
      assert.notEqual(changedCoreTag, colTag);
      assert.equal((await changedCore.json()).nextInventoryNumber, coreData.nextInventoryNumber);
      snapshot.settings = {...snapshot.settings, establishedYear: 2020};
      const originalFile = path.join(ctx.dir, 'data', 'settings.json');
      const replacement = originalFile + '.replacement';
      fs.writeFileSync(replacement, JSON.stringify({schemaVersion: 1, settings: snapshot.settings}));
      fs.renameSync(replacement, originalFile);
      const changed = await get(ctx.base, '/api/collection', changedCoreTag);
      assert.equal(changed.status, 200);
      assert.notEqual(changed.headers.get('etag'), changedCoreTag);
      assert.equal((await changed.json()).settings.establishedYear, 2020);
    } finally {await ctx.stop();}
  }
);

test(
  'browser-safe shared modules are public but server-only shared modules remain private',
  async () => {
    const ctx = await startTestServer();
    try {
      const safe = await fetch(ctx.base + '/shared/tasting-records.js');
      assert.equal(safe.status, 200);
      assert.match(safe.headers.get('content-type'), /javascript/);
      assert.match(await safe.text(), /latestTasting|tasting/i);
      for (const file of ['/shared/backup-zip.js', '/shared/secret.js']) {
        const response = await fetch(ctx.base + file);
        assert.equal(response.status, 404);
        await response.text();
      }
    } finally {await ctx.stop();}
  }
);
