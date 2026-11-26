import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {writeReadableZip, inspectReadableZip} from '../../shared/backup-zip.js';

// This test file runs in its own Node test process. Import the app only after configuring its isolated storage.
test('the restore API acknowledges committed data and refreshes caches even when final cleanup fails', {skip: process.platform === 'win32'}, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-restore-outcome-'));
  const control = path.join(root, 'control');
  const journal = path.join(root, '.restore-transaction.json');
  const password = 'SicheresTestpasswort-2026-mindestens-14!';
  const token = 'a'.repeat(64);
  Object.assign(process.env, {
    WHISKY_DATA_DIR: root, BACKUP_CONTROL_DIR: control, BACKUP_ADMIN_TOKEN: token,
    HTTP_ENABLED: 'true', HTTPS_ENABLED: 'false',
  });
  delete process.env.BACKUP_ADMIN_TOKEN_FILE;
  let server;
  try {
    fs.mkdirSync(control);
    fs.writeFileSync(path.join(control, 'backup-zip-password'), password);
    const {createServer} = await import('../../server/app.js');
    const {recoverInterruptedRestore} = await import('../../server/storage/restore-transaction.js');
    server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (endpoint, options = {}) => fetch(base + endpoint, {
      ...options, headers: {'X-Backup-Admin-Token': token, ...options.headers},
    });

    const post = (endpoint, body) => request(endpoint, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
    });
    const archive = path.join(control, 'restore.zip');
    writeReadableZip(root, archive, password);
    const upload = async () => {
      const response = await request('/api/backups/import-zip', {
        method: 'POST', headers: {'Content-Type': 'application/zip', 'X-Backup-Zip-Password': encodeURIComponent(password)},
        body: fs.readFileSync(archive),
      });
      assert.equal(response.status, 201);
      return (await response.json()).id;
    };

    const apply = id => post(`/api/backups/import-zip/${id}/apply`, {acknowledge: true, password});

    const warmCaches = async () => {
      assert.equal((await post('/api/bottlings', {name: 'Current collection'})).status, 201);
      assert.equal((await post('/api/warehouse/rooms', {name: 'Current room', width: 5, height: 4})).status, 201);
      const collection = await request('/api/collection');
      const warehouse = await request('/api/warehouse');
      assert.equal((await collection.json()).bottlings.length, 1);
      assert.equal((await warehouse.json()).rooms.length, 1);
      return {collection: collection.headers.get('etag'), warehouse: warehouse.headers.get('etag')};
    };
    const before = await warmCaches();
    const id = await upload();
    const sync = fs.fsyncSync;
    const unlink = fs.unlinkSync;
    let removed = false;
    let failures = 0;
    const unlinkMock = t.mock.method(fs, 'unlinkSync', filename => {
      unlink(filename);
      if (filename === journal) removed = true;
    });
    const syncMock = t.mock.method(fs, 'fsyncSync', fd => {
      if (removed && fs.fstatSync(fd).isDirectory()) {
        failures++;
        throw Object.assign(Error('simulated final sync error'), {code: 'EIO'});
      }
      return sync(fd);
    });
    const warning = t.mock.method(console, 'warn', () => {});
    const applied = await apply(id);
    syncMock.mock.restore();
    unlinkMock.mock.restore();
    assert.equal(applied.status, 200);
    const result = await applied.json();
    assert.equal(result.applied, true);
    assert.equal(result.cleanupStatus, 'syncUnconfirmed');
    assert.equal(failures, 2);
    assert.equal(warning.mock.callCount(), 1);
    assert.equal(fs.existsSync(journal), false);
    assert.ok(inspectReadableZip(path.join(root, result.safetyBackup), null, password).files >= 3);
    for (const [resource, property] of [['collection', 'bottlings'], ['warehouse', 'rooms']]) {
      const response = await request(`/api/${resource}`, {headers: {'If-None-Match': before[resource]}});
      assert.equal(response.status, 200);
      assert.notEqual(response.headers.get('etag'), before[resource]);
      assert.equal((await response.json())[property].length, 0);
    }
    await warmCaches();
    const next = await upload();
    const remove = fs.rmSync;
    const removeMock = t.mock.method(fs, 'rmSync', (filename, ...args) => {
      if (path.dirname(filename) === root && path.basename(filename).startsWith('.restore-old-')) {
        throw Object.assign(Error('simulated cleanup error'), {code: 'EACCES'});
      }
      return remove(filename, ...args);
    });
    const pending = await apply(next);
    removeMock.mock.restore();
    assert.equal(pending.status, 200);
    const pendingResult = await pending.json();
    assert.equal(pendingResult.applied, true);
    assert.equal(pendingResult.cleanupStatus, 'pending');
    assert.equal(fs.existsSync(journal), true);
    const blocked = await request('/api/collection');
    assert.equal(blocked.status, 503);
    assert.equal((await blocked.json()).errorCode, 'api.errors.restoreRecoveryRequired');
    assert.equal(recoverInterruptedRestore(root), 'committed');
    assert.equal((await (await request('/api/collection')).json()).bottlings.length, 0);
    assert.equal((await (await request('/api/warehouse')).json()).rooms.length, 0);
  } finally {
    t.mock.restoreAll();
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, {recursive: true, force: true});
  }
});
