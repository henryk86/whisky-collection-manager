import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

test('credential and session revocations take effect across asynchronous authentication boundaries', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcm-auth-race-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  process.env.WHISKY_DATA_DIR = root;
  const file = path.join(root, 'data', 'user.json');
  fs.mkdirSync(path.dirname(file));
  const user = {
    id: 'admin-id', username: 'admin', role: 'admin', mustChangePassword: false,
    salt: '0'.repeat(32), passwordHash: '1'.repeat(128),
  };
  const replace = () => {
    fs.writeFileSync(file + '.new', JSON.stringify({schemaVersion: 1, loginRequired: true, users: [user]}));
    fs.renameSync(file + '.new', file);
  };
  replace();
  const callbacks = [];
  // Hold the KDF completion at the real service's asynchronous boundary.
  t.mock.method(crypto, 'scrypt', (...args) => callbacks.push(args.at(-1)));
  const {initializeAuth, login, sessionUser, createUser, authorizeRequest} = await import('../../server/services/auth.js');
  initializeAuth();
  const request = {headers: {}, socket: {remoteAddress: '192.0.2.14'}};
  const cookies = [];
  const response = {setHeader: (name, value) => cookies.push([name, value])};
  const pending = login(request, {username: 'admin', password: 'old-password'}, response);
  assert.equal(callbacks.length, 1);
  const oldHash = user.passwordHash;
  user.passwordHash = '2'.repeat(128);
  replace();
  callbacks.shift()(null, Buffer.from(oldHash, 'hex'));
  await assert.rejects(pending, {status: 401, code: 'api.errors.invalidCredentials'});
  assert.deepEqual(cookies, []);
  const fresh = login(request, {username: 'admin', password: 'new-password'}, response);
  callbacks.shift()(null, Buffer.from(user.passwordHash, 'hex'));
  assert.equal((await fresh).user.id, user.id);
  request.headers.cookie = cookies[0][1].split(';')[0];
  assert.equal(sessionUser(request).id, user.id);

  await t.test('first lookup after external replacement cannot reuse a cached session', async () => {
    const oldCookie = request.headers.cookie;
    user.passwordHash = '6'.repeat(128);
    replace();
    assert.equal(sessionUser(request), null);
    assert.equal(sessionUser(request), null);
    const active = login(request, {username: 'admin', password: 'new-password'}, response);
    callbacks.shift()(null, Buffer.from(user.passwordHash, 'hex'));
    await active;
    request.headers.cookie = cookies.at(-1)[1].split(';')[0];
    assert.notEqual(request.headers.cookie, oldCookie);
  });

  await t.test('revoked administrator cannot finish a queued account mutation', async () => {
    const creating = createUser(request, {username: 'collector', password: 'TemporaryPassword-2026'});
    // Account changes are serialized, so give the queued mutation its turn.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(callbacks.length, 1);
    user.passwordHash = '3'.repeat(128);
    replace();
    const replaced = fs.readFileSync(file, 'utf8');
    callbacks.shift()(null, Buffer.from('4'.repeat(128), 'hex'));
    await assert.rejects(creating, {status: 401, code: 'api.errors.loginRequired'});
    assert.equal(fs.readFileSync(file, 'utf8'), replaced, 'revoked mutation must not overwrite restored account data');
  });

  await t.test('revoked session cannot finish a JSON mutation after its body was read', async () => {
    const {initialize, read} = await import('../../server/storage/collection-store.js');
    const {handleApi} = await import('../../server/routes/index.js');
    initialize();
    const active = login(request, {username: 'admin', password: 'new-password'}, response);
    callbacks.shift()(null, Buffer.from(user.passwordHash, 'hex'));
    await active;
    request.headers.cookie = cookies.at(-1)[1].split(';')[0];
    request.headers['content-type'] = 'application/json';
    request.method = 'POST';
    const url = new URL('http://localhost/api/bottlings');
    let releaseBody;
    let signalBodyRead;
    const bodyGate = new Promise(resolve => {releaseBody = resolve;});
    const bodyRead = new Promise(resolve => {signalBodyRead = resolve;});
    request[Symbol.asyncIterator] = async function*() {
      yield Buffer.from('{"name":');
      signalBodyRead();
      await bodyGate;
      yield Buffer.from('"Not committed"}');
    };
    authorizeRequest(request, url);
    const mutation = handleApi(request, response, url);
    await bodyRead;
    user.passwordHash = '5'.repeat(128);
    replace();
    releaseBody();
    await assert.rejects(mutation, {status: 401, code: 'api.errors.loginRequired'});
    assert.deepEqual(read().bottlings, []);
  });
});
