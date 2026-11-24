import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer} from '../helpers/server.js';
import {applyResourceDelta} from '../../shared/resource-delta.js';

const json = async (base, path, method = 'GET', data, headers = {}) => {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(data ? {'Content-Type': 'application/json'} :
        {}), ...headers,
    },
    ...(data ? {body: JSON.stringify(data)} : {}),
  });
  return {response, body: await response.json()};
};

test(
  'mutation envelopes contain keyed changes and retain the unmodified API result',
  async () => {
    const ctx = await startTestServer();
    try {
      const original = await json(ctx.base, '/api/collection');
      const before = original.response.headers.get('etag');
      const created = await json(ctx.base, '/api/bottlings', 'POST',
        {
          name: 'Delta Whisky',
          abv: 46,
          firstBottle: {inventoryNumber: '000899'},
        },
        {'X-WCM-State-Delta': '1'});
      assert.equal(created.response.status, 201);
      assert.equal(created.body.__wcmStateDelta, 1);
      assert.equal(created.body.result.bottling.name, 'Delta Whisky');
      assert.equal(created.body.updates.length, 1);
      const update = created.body.updates[0];
      assert.equal(update.before, before);
      assert.equal(update.delta.kind, 'collection');
      assert.equal(update.delta.arrays.bottlings.upsert.length, 1);
      const patched = applyResourceDelta(original.body, update.delta);
      const after = await json(ctx.base, '/api/collection');
      assert.deepEqual(
        patched,
        after.body,
        'patch must reconstruct the committed server state'
      );
      assert.equal(update.after, after.response.headers.get('etag'));
      assert.notEqual(update.before, update.after);
      // Standard API clients remain fully backward compatible.
      const oldApi = await json(
        ctx.base,
        `/api/bottlings/${created.body.result.bottling.id}`,
        'PATCH',
        {name: 'Renamed'}
      );
      assert.equal(oldApi.response.status, 200);
      assert.equal(oldApi.body.name, 'Renamed');
      assert.equal(oldApi.body.__wcmStateDelta, undefined);
    } finally {await ctx.stop();}
  }
);

test(
  'warehouse mutations can be applied independently, without replacing rooms or changing the collection',
  async () => {
    const ctx = await startTestServer();
    try {
      const beforeCollection = await json(ctx.base, '/api/collection');
      const before = await json(ctx.base, '/api/warehouse');
      const storeTag = before.response.headers.get('x-wcm-store-etag');
      assert.match(storeTag, /warehouse-/);
      const created = await json(ctx.base, '/api/warehouse/rooms', 'POST',
        {name: 'Room 1', width: 4, height: 5}, {'X-WCM-State-Delta': '1'});
      assert.equal(created.response.status, 201);
      const [update] = created.body.updates;
      assert.equal(update.before, storeTag);
      assert.equal(update.delta.kind, 'warehouse');
      const patched = applyResourceDelta(before.body, update.delta);
      const after = await json(ctx.base, '/api/warehouse');
      assert.deepEqual(patched, after.body);
      assert.equal(
        update.after,
        after.response.headers.get('x-wcm-store-etag')
      );
      assert.equal(
        (await json(ctx.base, '/api/collection')).response.headers.get('etag'),
        beforeCollection.response.headers.get('etag')
      );
    } finally {await ctx.stop();}
  }
);

test('delta validation rejects malformed arrays and unsafe fields', () => {
  const source = {
    schemaVersion: 6,
    bottlings: [],
    distilleries: [],
    externalTastings: [],
    tastingFlights: [],
  };
  assert.throws(
    () => applyResourceDelta(
      source,
      {kind: 'collection', values: {__protoPollute: 'evil'}}
    ),
    /Invalid resource property/
  );
  assert.throws(
    () => applyResourceDelta(
      source,
      {
        kind: 'collection',
        arrays: {bottlings: {upsert: [{id: 'one'}], remove: [], order: ['missing']}},
      }
    ),
    /Invalid delta entity order/
  );
  assert.equal(Object.hasOwn(source, '__protoPollute'), false);
});
