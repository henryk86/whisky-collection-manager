import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import {spawnSync} from 'node:child_process';
import {once} from 'node:events';
/**
 * Requests the collection endpoint through a real TLS socket, with explicit
 * certificate verification behavior and no connection pooling.
 *
 * @param {number} port TCP port assigned to the HTTPS listener.
 * @param {boolean} rejectUnauthorized Whether to reject untrusted certificates.
 * @return {!Promise<{status: number, body: string}>} HTTP status and response
 *     body; rejects on a TLS or network error.
 */
async function getHttps(port, rejectUnauthorized) {
  return await new Promise((resolve, reject) => {
    https.get({
      hostname: '127.0.0.1', port, path: '/api/collection', rejectUnauthorized,
      agent: false,
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({
        status: res.statusCode, body,
      }));
    }).on('error', reject);
  });
}
const openssl = spawnSync('openssl', ['version'], {stdio: 'ignore', });
test(
  'TLS server serves collection, rejects untrusted cert by default, and disables HTTP',
  {
    skip: openssl.error ? 'OpenSSL fehlt' : false,
  },
  async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-https-test-'));
    t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
    const cert = path.join(dir, 'cert.pem'), key = path.join(dir, 'key.pem');
    const gen = spawnSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-keyout',
        key,
        '-out',
        cert,
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=IP:127.0.0.1,DNS:localhost',
      ],
      {
        stdio: 'ignore',
      }
    );
    assert.equal(gen.status, 0);
    // This test file runs in its own Node test process. Configure the real
    // startup before importing its configuration-dependent modules.
    Object.assign(process.env, {
      WHISKY_DATA_DIR: dir,
      HTTPS_ENABLED: 'true',
      HTTP_ENABLED: 'false',
      HTTPS_PORT: '3543',
      PORT: '3100',
      HOST: '127.0.0.1',
      HTTPS_CERT_FILE: cert,
      HTTPS_KEY_FILE: key,
    });
    const {startServers} = await import('../../server/index.js');
    const originalListen = net.Server.prototype.listen;
    const listeners = [];
    // Replace only port allocation: the real HTTP/TLS sockets still listen,
    // but the OS assigns unique ports atomically, even with parallel workers.
    const listen = t.mock.method(net.Server.prototype, 'listen', function(
      port, ...args
    ) {
      listeners.push(this);
      return originalListen.call(this, 0, ...args);
    });
    try {
      const servers = startServers();
      await Promise.all(listeners.map(server => once(server, 'listening')));
      assert.equal(servers.length, 1, 'only one server may be started');
      assert.equal(listen.mock.callCount(), 1, 'HTTP must not bind a socket');
      assert.deepEqual(listen.mock.calls[0].arguments.slice(0, 2), [3543, '127.0.0.1',]);
      assert.ok(servers[0] instanceof https.Server);
      assert.equal(listeners[0], servers[0]);
      const tlsPort = servers[0].address().port;
      const result = await getHttps(tlsPort, false);
      assert.equal(result.status, 200);
      assert.ok(Array.isArray(JSON.parse(result.body).bottlings));
      await assert.rejects(() => getHttps(tlsPort, true), /certificate|self.signed/i);
    }
    finally {
      await Promise.all(listeners.map(server => new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      })));
    }
  }
);
