import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import { spawn, spawnSync } from 'node:child_process';
async function freePort() {
    const server = net.createServer();
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    await new Promise(r => server.close(r));
    return port;
}
async function getHttps(port, rejectUnauthorized) {
    return await new Promise((resolve, reject) => {
        https.get({
            hostname: '127.0.0.1', port, path: '/api/collection', rejectUnauthorized
        }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({
                status: res.statusCode, body
            }));
        }).on('error', reject);
    });
}
const openssl = spawnSync('openssl', ['version'], {
    stdio: 'ignore'
});
test('TLS server serves collection, rejects untrusted cert by default, and disables HTTP', {
    skip: openssl.error ? 'OpenSSL fehlt' : false
}, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-https-test-'));
    const cert = path.join(dir, 'cert.pem'), key = path.join(dir, 'key.pem');
    const gen = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], {
        stdio: 'ignore'
    });
    assert.equal(gen.status, 0);
    const tlsPort = await freePort(), httpPort = await freePort();
    const child = spawn(process.execPath, ['server/index.js'], {
        cwd: process.cwd(), env: {
            ...process.env, WHISKY_DATA_DIR: dir, HTTPS_ENABLED: 'true', HTTP_ENABLED: 'false', HTTPS_PORT: String(tlsPort), PORT: String(httpPort), HOST: '127.0.0.1', HTTPS_CERT_FILE: cert, HTTPS_KEY_FILE: key
        }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', data => stderr += data);
    try {
        let result;
        for (let i = 0; i < 100; i++) {
            if (child.exitCode !== null) {
                throw Error('Server beendet: ' + stderr);
            }
            try {
                result = await getHttps(tlsPort, false);
                break;
            }
            catch {
                await new Promise(r => setTimeout(r, 35));
            }
        }
        assert.equal(result?.status, 200);
        assert.ok(Array.isArray(JSON.parse(result.body).bottlings));
        await assert.rejects(() => getHttps(tlsPort, true), /certificate|self.signed/i);
        await assert.rejects(() => new Promise((resolve, reject) => {
            const socket = net.createConnection({
                host: '127.0.0.1', port: httpPort
            }, () => {
                socket.destroy();
                resolve();
            });
            socket.on('error', reject);
        }), /ECONNREFUSED/);
    }
    finally {
        child.kill();
        fs.rmSync(dir, {
            recursive: true, force: true
        });
    }
});
