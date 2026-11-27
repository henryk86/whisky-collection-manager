import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer} from '../helpers/server.js';
import {applyResourceDelta} from '../../shared/resource-delta.js';

/**
 * Serializes json data to JSON.
 *
 * @param {*} base Base value or reference for the calculation.
 * @param {*} path Path to the target resource.
 * @param {string=} method Value used by this operation.
 * @param {*} data Input data to process.
 * @param {!Object=} headers Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const json = async (base, path, method = 'GET', data, headers = {}) => {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(data ? {'Content-Type': 'application/json'} : {}), ...headers,
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
      assert.deepEqual(patched, after.body, 'patch must reconstruct the committed server state');
      assert.equal(update.after, after.response.headers.get('etag'));
      assert.notEqual(update.before, update.after);
      // Standard API clients remain fully backward compatible.
      const oldApi = await json(ctx.base, `/api/bottlings/${created.body.result.bottling.id}`, 'PATCH', {name: 'Renamed'});
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
      const created = await json(ctx.base, '/api/warehouse/rooms', 'POST', {name: 'Room 1', width: 4, height: 5}, {'X-WCM-State-Delta': '1'});
      assert.equal(created.response.status, 201);
      const [update] = created.body.updates;
      assert.equal(update.before, storeTag);
      assert.equal(update.delta.kind, 'warehouse');
      const patched = applyResourceDelta(before.body, update.delta);
      const after = await json(ctx.base, '/api/warehouse');
      assert.deepEqual(patched, after.body);
      assert.equal(update.after, after.response.headers.get('x-wcm-store-etag'));
      assert.equal(
        (await json(ctx.base, '/api/collection')).response.headers.get('etag'),
        beforeCollection.response.headers.get('etag')
      );
    } finally {await ctx.stop();}
  }
);

test('delta validation rejects malformed arrays and unsafe fields', () => {
  const source = {
    schemaVersion: 10,
    bottlings: [],
    distilleries: [],
    externalTastings: [],
    tastingFlights: [],
  };
  assert.throws(
    () => applyResourceDelta(source, {kind: 'collection', values: {__protoPollute: 'evil'}}),
    /Invalid resource property/
  );
  assert.throws(
    () => applyResourceDelta(
      source,
      {
        kind: 'collection',
        arrays: {
          bottlings: {
            upsert: [{id: 'one'}], remove: [],
            order: ['missing'],
          },
        },
      }
    ),
    /Invalid delta entity order/
  );
  assert.equal(Object.hasOwn(source, '__protoPollute'), false);
});


test('release fullName is derived in API results and state deltas, never stored or trusted on import', async () => {
  const ctx = await startTestServer();
  try {
    const initial = await json(ctx.base, '/api/collection');
    const created = await json(ctx.base, '/api/bottlings', 'POST', {name: 'Kilchoman Genesis', subtitle: 'Fermenting – Stage 5', fullName: 'wrong'}, {'X-WCM-State-Delta': '1'});
    assert.equal(created.response.status, 201);
    assert.equal(created.body.result.bottling.fullName, 'Kilchoman Genesis · Fermenting – Stage 5');
    let snapshot = applyResourceDelta(initial.body, created.body.updates[0].delta);
    const id = created.body.result.bottling.id;
    const rename = await json(ctx.base, `/api/bottlings/${id}`, 'PATCH', {name: 'Genesis'}, {'X-WCM-State-Delta': '1'});
    assert.equal(rename.body.result.fullName, 'Genesis · Fermenting – Stage 5');
    snapshot = applyResourceDelta(snapshot, rename.body.updates[0].delta);
    const external = await json(ctx.base, '/api/external-tastings', 'POST', {bottling: {name: 'External', subtitle: 'Special release'}, tastedOn: '2026-11-15'}, {'X-WCM-State-Delta': '1'});
    assert.equal(external.response.status, 201);
    assert.equal(external.body.result.bottling.fullName, 'External · Special release');
    snapshot = applyResourceDelta(snapshot, external.body.updates[0].delta);
    const cleared = await json(ctx.base, `/api/external-tastings/${external.body.result.id}`, 'PATCH', {bottling: {subtitle: ''}}, {'X-WCM-State-Delta': '1'});
    assert.equal(cleared.body.result.bottling.fullName, 'External');
    snapshot = applyResourceDelta(snapshot, cleared.body.updates[0].delta);
    assert.deepEqual(snapshot, (await json(ctx.base, '/api/collection')).body);
    assert.equal((await json(ctx.base, '/api/warehouse')).body.bottles[0].name, 'Genesis · Fermenting – Stage 5');
    snapshot.bottlings[0].fullName = 'wrong';
    snapshot.externalTastings[0].bottling.fullName = 'wrong';
    assert.equal((await json(ctx.base, '/api/import/json', 'POST', snapshot)).response.status, 200);
    const exported = (await json(ctx.base, '/api/export/json')).body;
    assert.equal(Object.hasOwn(exported.bottlings[0], 'fullName'), false);
    assert.equal(Object.hasOwn(exported.externalTastings[0].bottling, 'fullName'), false);
    const response = (await json(ctx.base, '/api/collection')).body;
    assert.equal(response.bottlings[0].fullName, 'Genesis · Fermenting – Stage 5');
    assert.equal(response.externalTastings[0].bottling.fullName, 'External');
  } finally {await ctx.stop();}
});
