import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';

// The application is imported only after this process has its own data root.
test('collection API acknowledges durable commits, distinguishes unresolved publication and blocks subsequent writes until recovery', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-collection-outcome-'));
  const directory = path.join(root, 'data');
  const journal = path.join(directory, '.collection-transaction.json');
  Object.assign(process.env, {
    WHISKY_DATA_DIR: root, BACKUP_CONTROL_DIR: path.join(root, 'control'),
    HTTP_ENABLED: 'true', HTTPS_ENABLED: 'false',
  });
  let server;
  try {
    const {createServer} = await import('../../server/app.js');
    server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (endpoint, method = 'GET', body, headers = {}) => fetch(base + endpoint, {
      method, headers: {...(body ? {'Content-Type': 'application/json'} : {}), ...headers},
      body: body ? JSON.stringify(body) : undefined,
    });

    const setup = async () => {
      const tasting = await request('/api/external-tastings', 'POST', {bottling: {name: 'External'}, tastedOn: '2026-11-15', rating: 88});
      assert.equal(tasting.status, 201);
      const {id} = await tasting.json();
      const flight = await request('/api/tasting-flights', 'POST', {name: 'Session', date: '2026-11-15'});
      assert.equal(flight.status, 201);
      const {id: flightId} = await flight.json();
      assert.equal((await request(`/api/tasting-flights/${flightId}/tastings`, 'PUT', {tastingIds: [id]})).status, 200);
      return {id, flightId};
    };
    const first = await setup();
    const before = (await request('/api/collection')).headers.get('etag');
    const unlink = fs.unlinkSync;
    const cleanup = t.mock.method(fs, 'unlinkSync', filename => {
      if (filename === journal) throw Object.assign(Error('journal cleanup denied'), {code: 'EACCES'});
      return unlink(filename);
    });
    t.mock.method(console, 'warn', () => {});
    const applied = await request(`/api/external-tastings/${first.id}`, 'DELETE', undefined, {'X-WCM-State-Delta': '1'});
    assert.equal(applied.status, 200);
    const result = await applied.json();
    assert.equal(result.__wcmStateDelta, 1);
    assert.equal(result.updates[0].before, before);
    assert.notEqual(result.updates[0].after, before);
    assert.equal(fs.existsSync(journal), true);
    const blocked = await request('/api/collection');
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).errorCode, 'api.errors.collectionRecoveryRequired');
    cleanup.mock.restore();
    const recovered = await request('/api/collection', 'GET', undefined, {'If-None-Match': before});
    assert.equal(recovered.status, 200);
    const collection = await recovered.json();
    assert.equal(collection.externalTastings.length, 0);
    assert.deepEqual(collection.tastingFlights.find(item => item.id === first.flightId).tastingIds, []);
    assert.equal(fs.existsSync(journal), false);

    const second = await setup();
    const rename = fs.renameSync;
    const replay = t.mock.method(fs, 'renameSync', (from, to) => {
      if (to === path.join(directory, 'tastingFlights.json')) throw Object.assign(Error('replay denied'), {code: 'ENOSPC'});
      return rename(from, to);
    });
    const pending = await request(`/api/external-tastings/${second.id}`, 'DELETE');
    assert.equal(pending.status, 503);
    assert.equal((await pending.json()).errorCode, 'api.errors.collectionCommitPending');
    const unrelated = await request('/api/settings', 'PATCH', {establishedYear: 1999});
    assert.equal(unrelated.status, 503);
    assert.equal((await unrelated.json()).errorCode, 'api.errors.collectionRecoveryRequired');
    replay.mock.restore();
    const final = await (await request('/api/collection')).json();
    assert.equal(final.externalTastings.length, 0);
    assert.deepEqual(final.tastingFlights.find(item => item.id === second.flightId).tastingIds, []);
    assert.notEqual(final.settings.establishedYear, 1999);
    assert.equal(fs.existsSync(journal), false);
  } finally {
    t.mock.restoreAll();
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, {recursive: true, force: true});
  }
});
