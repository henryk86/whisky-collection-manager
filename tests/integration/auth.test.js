import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fork, execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('optional login protects collection, images and API while only admin can manage accounts', async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-auth-'));
  let child;
  try {
    child = fork(path.join(root, 'tests/helpers/isolated-server.js'), [], {
      cwd: root, silent: true, env: {...process.env, WHISKY_DATA_DIR: data, HTTP_ENABLED: 'true', HTTPS_ENABLED: 'false'}
    });
    let output = '';
    child.stdout.on('data', chunk => {output += chunk.toString('utf8');});
    child.stderr.on('data', chunk => {output += chunk.toString('utf8');});
    const [ready] = await once(child, 'message');
    assert.equal(ready.type, 'test-server-ready', output);
    const base = `http://127.0.0.1:${ready.port}`;
    const call = async (url, method = 'GET', body, cookie = '') => {
      const response = await fetch(base + url, {
        method, headers: {
          ...(cookie ? {Cookie: cookie} : {}), ...(body ? {'Content-Type': 'application/json'} : {})
        }, ...(body ? {body: JSON.stringify(body)} : {})
      });
      const value = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text();
      return {status: response.status, value, cookie: response.headers.get('set-cookie')?.split(';')[0]};
    };
    const seed = JSON.parse(fs.readFileSync(path.join(data, 'data/user.json'), 'utf8'));
    assert.equal(seed.loginRequired, false);
    assert.equal(seed.users.length, 1);
    assert.equal(seed.users[0].role, 'admin');
    assert.equal(seed.users[0].mustChangePassword, true);
    assert.equal(fs.statSync(path.join(data, 'data/user.json')).mode & 0o777, 0o600);
    assert.equal((await call('/api/collection')).status, 200);
    assert.equal((await call('/data/user.json')).status, 404, 'account database must not be served as a static resource');
    assert.equal((await call('/api/auth/users')).status, 401);
    assert.equal((await call('/api/auth/login', 'POST', {username: 'admin', password: 'wrong'})).status, 401);
    const initialPassword = output.match(/Startpasswort: ([A-Za-z0-9_-]+)/)?.[1];
    assert.ok(initialPassword, `Initial password was not emitted to operator log: ${output}`);
    assert.equal(JSON.stringify(seed).includes(initialPassword), false);
    const first = await call('/api/auth/login', 'POST', {username: 'admin', password: initialPassword});
    assert.equal(first.status, 200);
    assert.equal(first.value.user.mustChangePassword, true);
    assert.equal((await call('/api/auth/users', 'GET', undefined, first.cookie)).status, 403);
    const adminChanged = await call('/api/auth/password', 'POST', {
      currentPassword: initialPassword, newPassword: 'VerySecurePassword-Admin-2026'
    }, first.cookie);
    assert.equal(adminChanged.status, 200);
    assert.equal(adminChanged.value.user.mustChangePassword, false);
    assert.notEqual(adminChanged.cookie, first.cookie, 'password change rotates the session cookie');
    const adminCookie = adminChanged.cookie;
    assert.equal((await call('/api/auth/config', 'PATCH', {required: true}, adminCookie)).status, 200);
    assert.equal((await call('/api/collection')).status, 401);
    assert.equal((await call('/api/warehouse')).status, 401);
    assert.equal((await call('/api/export/json')).status, 401);
    fs.writeFileSync(path.join(data, 'images', 'secret.png'), 'PRIVATE');
    assert.equal((await call('/images/secret.png')).status, 401);
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
    assert.equal((await call('/api/import-image/stage', 'POST', {image: png})).status, 401,
      'extension image uploads without a session must remain blocked');
    const staged = await call('/api/import-image/stage', 'POST', {image: png}, adminCookie);
    assert.equal(staged.status, 201, 'same-origin image uploads with an authenticated session work');
    assert.match(staged.value.token, /^[0-9a-f-]{36}$/);
    assert.equal((await call(`/api/import-image/stage/${staged.value.token}`)).status, 401,
      'staged preview is not anonymously readable');
    assert.equal((await call(`/api/import-image/stage/${staged.value.token}`, 'GET', undefined, adminCookie)).status, 200);
    assert.equal((await call('/api/version')).status, 200, 'healthcheck still works');
    assert.equal((await call('/index.html')).status, 200, 'login shell still loads');
    const listing = await call('/api/auth/users', 'GET', undefined, adminCookie);
    assert.equal(listing.status, 200);
    assert.equal(listing.value.users[0].passwordHash, undefined);
    const added = await call('/api/auth/users', 'POST', {username: 'collector', password: 'VerySecureTemp-2026'}, adminCookie);
    assert.equal(added.status, 201);
    assert.equal(added.value.role, 'user');
    assert.equal(added.value.mustChangePassword, true);
    const userLogin = await call('/api/auth/login', 'POST', {username: 'collector', password: 'VerySecureTemp-2026'});
    assert.equal(userLogin.status, 200);
    assert.equal((await call('/api/collection', 'GET', undefined, userLogin.cookie)).status, 403);
    const userChanged = await call('/api/auth/password', 'POST', {
      currentPassword: 'VerySecureTemp-2026', newPassword: 'CollectorPassword-2026'
    }, userLogin.cookie);
    assert.equal(userChanged.status, 200);
    const userCookie = userChanged.cookie;
    assert.equal((await call('/api/collection', 'GET', undefined, userCookie)).status, 200);
    assert.equal((await call('/images/secret.png', 'GET', undefined, userCookie)).status, 200);
    assert.equal((await call('/api/auth/users', 'GET', undefined, userCookie)).status, 403);
    assert.equal((await call('/api/auth/config', 'PATCH', {required: false}, userCookie)).status, 403);
    const reset = await call(`/api/auth/users/${added.value.id}/reset-password`, 'POST', {password: 'NewTempPassword-2026'}, adminCookie);
    assert.equal(reset.status, 200);
    assert.equal((await call('/api/collection', 'GET', undefined, userCookie)).status, 401, 'reset invalidates existing sessions');
    assert.equal((await call('/api/auth/logout', 'POST', undefined, adminCookie)).status, 200);
    assert.equal((await call('/api/collection', 'GET', undefined, adminCookie)).status, 401);
    const adminLogin = await call('/api/auth/login', 'POST', {username: 'admin', password: 'VerySecurePassword-Admin-2026'});
    assert.equal(adminLogin.status, 200);
    assert.equal((await call('/api/auth/config', 'PATCH', {required: false}, adminLogin.cookie)).status, 200);
    assert.equal((await call('/api/collection')).status, 200);
    assert.equal((await call('/api/auth/users')).status, 401, 'management still protected when app login is optional');
    const finalStore = fs.readFileSync(path.join(data, 'data/user.json'), 'utf8');
    for (const password of [initialPassword, 'VerySecurePassword-Admin-2026', 'CollectorPassword-2026', 'NewTempPassword-2026']) {
      assert.equal(finalStore.includes(password), false, 'plaintext password in user.json');
    }
  } finally {
    if (child && child.exitCode === null) {child.kill(); await once(child, 'exit');}
    fs.rmSync(data, {recursive: true, force: true});
  }
});

test('offline admin recovery sets a temporary password without clearing users or login requirement', async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-auth-reset-'));
  try {
    fs.mkdirSync(path.join(data, 'data'));
    const {scryptSync, randomBytes, randomUUID} = await import('node:crypto');
    const salt = randomBytes(16).toString('hex');
    const originalHash = scryptSync('OriginalAdminPassword', Buffer.from(salt, 'hex'), 64, {N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024}).toString('hex');
    fs.writeFileSync(path.join(data, 'data/user.json'), JSON.stringify({
      schemaVersion: 1, loginRequired: true, users: [
        {id: randomUUID(), username: 'admin', role: 'admin', salt, passwordHash: originalHash, mustChangePassword: false}
      ]
    }));
    const result = execFileSync(process.execPath, ['scripts/reset-admin-password.js'], {cwd: root, env: {...process.env, WHISKY_DATA_DIR: data}, encoding: 'utf8'});
    assert.match(result, /Neues Startpasswort fuer admin: [A-Za-z0-9_-]+/);
    const after = JSON.parse(fs.readFileSync(path.join(data, 'data/user.json'), 'utf8'));
    assert.equal(after.loginRequired, true);
    assert.equal(after.users[0].username, 'admin');
    assert.equal(after.users[0].mustChangePassword, true);
    assert.notEqual(after.users[0].passwordHash, originalHash);
  } finally {fs.rmSync(data, {recursive: true, force: true});}
});
