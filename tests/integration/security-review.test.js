import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { startTestServer } from '../helpers/server.js';

test('security: plain-text JSON import cannot overwrite collection', async () => {
    const context = await startTestServer();
    try {
        const file = path.join(context.dir, 'data', 'collection.json');
        const before = fs.readFileSync(file, 'utf8');
        const response = await fetch(context.base + '/api/import/json', {
            method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ schemaVersion: 4, bottlings: [] }),
        });
        assert.equal(response.status, 415);
        assert.equal(fs.readFileSync(file, 'utf8'), before);
        const withCharset = await fetch(context.base + '/api/bottlings', {
            method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ name: 'Valid' }),
        });
        assert.equal(withCharset.status, 201);
    } finally { await context.stop(); }
});

test('security: cross-site Origin and fetch metadata cannot mutate the collection', async () => {
    const context = await startTestServer();
    try {
        const file = path.join(context.dir, 'data', 'collection.json');
        const original = fs.readFileSync(file, 'utf8');
        for (const extraHeaders of [
            { Origin: 'https://evil.example' },
            { 'Sec-Fetch-Site': 'cross-site' },
            { Origin: 'null' },
            { Origin: 'http://evil.example', 'Sec-Fetch-Site': 'same-origin' },
        ]) {
            const response = await fetch(context.base + '/api/import/json', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders },
                body: JSON.stringify({ schemaVersion: 4, bottlings: [] }),
            });
            assert.equal(response.status, 403, JSON.stringify(extraHeaders));
            assert.equal(fs.readFileSync(file, 'utf8'), original);
        }
        const sameOrigin = await fetch(context.base + '/api/bottlings', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Origin: context.base },
            body: JSON.stringify({ name: 'Same origin' }),
        });
        assert.equal(sameOrigin.status, 201);
    } finally { await context.stop(); }
});

test('security: Host allowlist prevents DNS rebinding without blocking loopback', async () => {
    const context = await startTestServer();
    try {
        // Raw http.request guarantees that the Host header is not silently
        // replaced by fetch/undici with the URL authority.
        const statusWithHost = host => new Promise((resolve, reject) => {
            http.get(context.base + '/api/collection', { headers: { Host: host } }, response => {
                response.resume(); response.on('end', () => resolve(response.statusCode));
            }).on('error', reject);
        });
        assert.equal(await statusWithHost('attacker.example'), 421);
        assert.equal(await statusWithHost('localhost:3543'), 200);
        const health = await fetch(context.base + '/api/version');
        assert.equal(health.status, 200);
    } finally { await context.stop(); }
});

test('security: served HTML has CSP, referrer and framing protections with valid inline hashes', async () => {
    const context = await startTestServer();
    try {
        const response = await fetch(context.base + '/');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-frame-options'), 'DENY');
        assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
        const csp = response.headers.get('content-security-policy');
        assert.match(csp, /frame-ancestors 'none'/);
        assert.match(csp, /script-src 'self'/);
        assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"));
        const html = await response.text();
        const inlines = [...html.matchAll(/<script\b(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi)];
        assert.equal(inlines.length, 2);
        for (const [, body] of inlines) {
            const hash = crypto.createHash('sha256').update(body).digest('base64');
            assert.ok(csp.includes(`'sha256-${hash}'`));
        }
    } finally { await context.stop(); }
});

test('security: malformed percent-encoded paths are client errors, not server crashes', async () => {
    const context = await startTestServer();
    try {
        const errors = [];
        context.child.stderr.on('data', chunk => errors.push(String(chunk)));
        const response = await fetch(context.base + '/%E0');
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /Invalid path/);
        assert.equal((await fetch(context.base + '/images/%E0')).status, 400);
        assert.equal((await fetch(context.base + '/api/version')).status, 200);
        assert.ok(!errors.some(message => /URIError|stacktrace/i.test(message)), errors.join(''));

    } finally { await context.stop(); }
});

test('security: rejected Host is diagnosed once even after repeated requests', async () => {
    const context = await startTestServer();
    const warnings = [];
    context.child.stderr.on('data', chunk => warnings.push(String(chunk)));
    try {
        const requestWithHost = host => new Promise((resolve, reject) => {
            http.get(context.base + '/api/version', { headers: { Host: host } }, response => {
                let body = '';
                response.on('data', chunk => body += chunk);
                response.on('end', () => resolve({ status: response.statusCode, body }));
            }).on('error', reject);
        });
        for (let i = 0; i < 3; i++) {
            const result = await requestWithHost('attacker.example');
            assert.equal(result.status, 421);
            assert.match(JSON.parse(result.body).error, /ALLOWED_HOSTS/);
            assert.ok(!result.body.includes('attacker.example'), 'rejected value must not be reflected to client');
        }
        assert.equal((await requestWithHost('localhost:3543')).status, 200);
        // stderr is streamed from a separate process; allow the last event to arrive.
        for (let i = 0; i < 20 && !warnings.join('').includes('Abgelehnter HTTP-Host:'); i++) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        const matches = warnings.join('').match(/Abgelehnter HTTP-Host: attacker\.example/g) || [];
        assert.equal(matches.length, 1, warnings.join(''));
        assert.match(warnings.join(''), /ALLOWED_HOSTS/);
    } finally { await context.stop(); }
});

test('security: aborted static downloads do not log expected broken-pipe stack traces', async () => {
    const context = await startTestServer();
    const errors = [];
    context.child.stderr.on('data', chunk => errors.push(String(chunk)));
    try {
        const imageDir = path.join(context.dir, 'images');
        fs.mkdirSync(imageDir, { recursive: true });
        const file = path.join(imageDir, 'abort-stream.jpg');
        const fd = fs.openSync(file, 'w');
        try { fs.ftruncateSync(fd, 16 * 1024 * 1024); } finally { fs.closeSync(fd); }
        await new Promise((resolve, reject) => {
            const req = http.get(context.base + '/images/abort-stream.jpg', response => {
                assert.equal(response.statusCode, 200);
                response.once('data', () => response.destroy());
                response.once('close', resolve);
                response.on('error', error => {
                    if (!['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE'].includes(error.code)) reject(error);
                });
            });
            req.on('error', reject);
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.doesNotMatch(errors.join(''), /ERR_STREAM_PREMATURE_CLOSE|Premature close|ECONNRESET|EPIPE/);
        assert.equal((await fetch(context.base + '/api/version')).status, 200);
    } finally { await context.stop(); }
});

test('security: HTTPS Origin over an HTTP upstream is rejected without proxy trust', async () => {
    const context = await startTestServer();
    try {
        const httpsOrigin = context.base.replace(/^http:/, 'https:');
        const response = await fetch(context.base + '/api/bottlings', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Origin: httpsOrigin, 'Sec-Fetch-Site': 'same-origin' },
            body: JSON.stringify({ name: 'Not written' }),
        });
        assert.equal(response.status, 403);
        const collection = await (await fetch(context.base + '/api/collection')).json();
        assert.ok(!collection.bottlings.some(item => item.name === 'Not written'));
    } finally { await context.stop(); }
});

test('security: Host warning limit produces one explicit suppression notice', async () => {
    const context = await startTestServer();
    const warnings = [];
    context.child.stderr.on('data', chunk => warnings.push(String(chunk)));
    try {
        const statusWithHost = host => new Promise((resolve, reject) => {
            http.get(context.base + '/api/version', { headers: { Host: host } }, response => {
                response.resume();
                response.on('end', () => resolve(response.statusCode));
            }).on('error', reject);
        });
        for (let i = 0; i < 24; i++) {
            assert.equal(await statusWithHost(`untrusted-${i}.example`), 421);
        }
        assert.equal(await statusWithHost('untrusted-23.example'), 421);
        // Collect any last stderr event from the child before checking the log.
        for (let i = 0; i < 30 && !warnings.join('').includes('Weitere abgelehnte Hosts'); i++) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        const output = warnings.join('');
        assert.equal((output.match(/Abgelehnter HTTP-Host:/g) || []).length, 20, output);
        assert.equal((output.match(/Weitere abgelehnte Hosts werden nicht mehr einzeln protokolliert/g) || []).length, 1, output);
        assert.doesNotMatch(output, /untrusted-2[0-3]\.example/);
        assert.equal((await fetch(context.base + '/api/version')).status, 200);
    } finally { await context.stop(); }
});

test('security: disconnect during incoming JSON upload is not an internal server error', async () => {
    const context = await startTestServer();
    const stderr = [];
    context.child.stderr.on('data', chunk => stderr.push(String(chunk)));
    try {
        const file = path.join(context.dir, 'data', 'collection.json');
        const before = fs.readFileSync(file, 'utf8');
        await new Promise((resolve, reject) => {
            const request = http.request(context.base + '/api/import/json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': String(1024 * 1024) },
            });
            request.on('error', error => {
                if (error.code !== 'ECONNRESET') reject(error);
            });
            request.once('close', resolve);
            // Send an incomplete body, then drop the socket while readJson is waiting.
            request.write('{"schemaVersion":4,"bottlings":[');
            setTimeout(() => request.destroy(), 70);
        });
        await new Promise(resolve => setTimeout(resolve, 110));
        assert.doesNotMatch(stderr.join(''), /Interner Serverfehler|Error: aborted|ECONNRESET|ERR_STREAM_PREMATURE_CLOSE|EPIPE/);
        assert.equal(fs.readFileSync(file, 'utf8'), before, 'aborted import must not write partial data');
        assert.equal((await fetch(context.base + '/api/version')).status, 200);
    } finally { await context.stop(); }
});
