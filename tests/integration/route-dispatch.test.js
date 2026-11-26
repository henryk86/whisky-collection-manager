import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer} from '../helpers/server.js';

test('API dispatch matches both method and exact pathname before reading JSON', async () => {
  const context = await startTestServer();
  try {
    for (const [method, pathname] of [
      ['GET', '/api/version/'],
      ['POST', '/api/version'],
      ['GET', '/api/collection/extra'],
      ['POST', '/api/unknown'],
    ]) {
      const response = await fetch(context.base + pathname, {
        method,
        ...(method === 'POST' ? {body: 'not JSON'} : {}),
      });
      assert.equal(response.status, 404, `${method} ${pathname}`);
      assert.equal((await response.json()).errorCode, 'api.errors.apiEndpointNotFound');
    }
    const version = await fetch(context.base + '/api/version?healthcheck=1');
    assert.equal(version.status, 200);
    assert.match((await version.json()).version, /^\d+\.\d+\.\d+/);
    const invalid = await fetch(context.base + '/api/warehouse/rooms', {
      method: 'POST', body: 'not JSON',
    });
    assert.equal(invalid.status, 415);
    assert.equal((await invalid.json()).errorCode, 'api.errors.contentTypeMustBeApplicationJson');
  } finally {
    await context.stop();
  }
});

test('API dispatch preserves bodyless logout, raw ZIP upload and worker authorization', async () => {
  const context = await startTestServer();
  try {
    const logout = await fetch(context.base + '/api/auth/logout', {method: 'POST'});
    assert.equal(logout.status, 200);
    assert.equal((await logout.json()).user, null);
    assert.ok(logout.headers.has('set-cookie'));

    const upload = await fetch(context.base + '/api/backups/import-zip', {
      method: 'POST', headers: {'Content-Type': 'application/zip', 'X-Backup-Admin-Token': 'invalid'},
      body: Buffer.from('not an archive'),
    });
    assert.equal(upload.status, 401);
    assert.equal((await upload.json()).errorCode, 'api.errors.backupManagementIsLockedAdministratorKeyRequired');

    const worker = await fetch(context.base + '/internal/backup/snapshot/test-job', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}',
    });
    assert.equal(worker.status, 403);
    assert.equal((await worker.json()).errorCode, 'api.errors.backupWorkerIsNotAuthorized');
  } finally {
    await context.stop();
  }
});
