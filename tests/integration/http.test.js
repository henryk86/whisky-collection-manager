import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { startTestServer, requestJson } from '../helpers/server.js';
test('all refactored browser entry points and styles are actually served', async () => {
    const context = await startTestServer();
    try {
        for (const file of ['/', '/app.js', '/js/features/scanner/controller.js', '/js/features/forms/bottle.js', '/js/views/warehouse.js', '/js/views/warehouse-presentation.js', '/style.css', '/styles/themes.css', '/assets/hero-header.jpg']) {
            const response = await fetch(context.base + file);
            assert.equal(response.status, 200, file);
            assert.ok((await response.arrayBuffer()).byteLength > 0, file);
        }
        assert.equal((await fetch(context.base + '/server/config.js')).status, 404);
        assert.equal((await fetch(context.base + '/.env')).status, 404);
        assert.equal((await fetch(context.base + '/js/missing.js')).status, 404);
    }
    finally {
        await context.stop();
    }
});

test('ONNX runtime .mjs modules are delivered with a JavaScript MIME type under nosniff', async () => {
    // The actual ONNX runtime is populated during the Docker build / cutout:prepare.
    // A temporary .mjs verifies the same static-file handler without downloading binaries.
    const directory = path.resolve('public/ai/vendor');
    const directoryExisted = fs.existsSync(directory);
    fs.mkdirSync(directory, { recursive: true });
    const name = `mime-check-${crypto.randomUUID()}.mjs`;
    const fixture = path.join(directory, name);
    const context = await startTestServer();
    try {
        fs.writeFileSync(fixture, 'export const runtimeReady = true;\n', { flag: 'wx' });
        const response = await fetch(`${context.base}/ai/vendor/${name}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type') || '', /^text\/javascript(?:;|$)/i);
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        assert.match(await response.text(), /runtimeReady/);
    } finally {
        fs.rmSync(fixture, { force: true });
        if (!directoryExisted) fs.rmdirSync(directory);
        await context.stop();
    }
});

test('invalid request bodies fail cleanly without altering collection.json', async () => {
    const context = await startTestServer();
    try {
        const file = path.join(context.dir, 'data', 'collection.json');
        const original = fs.readFileSync(file, 'utf8');
        for (const body of ['null', '[]', '123', '"text"', '{invalid']) {
            const response = await fetch(context.base + '/api/bottlings', {
                method: 'POST', headers: {
                    'Content-Type': 'application/json'
                }, body
            });
            assert.equal(response.status, 400, body);
            assert.ok((await response.json()).error);
            assert.equal(fs.readFileSync(file, 'utf8'), original);
        }
    }
    finally {
        await context.stop();
    }
});
test('a failed mutation does not corrupt the store or block subsequent writes', async () => {
    const context = await startTestServer();
    try {
        const created = await requestJson(context.base, '/api/bottlings', 'POST', {
            name: 'Atomic Test'
        });
        const id = created.data.bottling.id;
        const file = path.join(context.dir, 'data', 'collection.json');
        const original = fs.readFileSync(file, 'utf8');
        const failed = await requestJson(context.base, `/api/bottlings/${id}`, 'PATCH', {
            abv: 'not a number'
        });
        assert.equal(failed.status, 400);
        assert.equal(fs.readFileSync(file, 'utf8'), original);
        const success = await requestJson(context.base, `/api/bottlings/${id}`, 'PATCH', {
            abv: 46
        });
        assert.equal(success.status, 200);
        assert.equal(success.data.abv, 46);
        const entries = fs.readdirSync(path.dirname(file));
        assert.equal(entries.filter(name => name.endsWith('.tmp')).length, 0);
    }
    finally {
        await context.stop();
    }
});
test('historical inventory number still cannot be reassigned twice concurrently', async () => {
    const context = await startTestServer();
    try {
        const created = await requestJson(context.base, '/api/bottlings', 'POST', {
            name: 'Historical Concurrency', firstBottle: { inventoryNumber: '000078' }
        });
        assert.equal(created.status, 201);
        const oldBottleId = created.data.bottle.id;
        const bottlingId = created.data.bottling.id;
        assert.equal((await requestJson(context.base, `/api/bottles/${oldBottleId}`, 'DELETE')).status, 200);
        const payload = { bottlingId, inventoryNumber: '000078' };
        const results = await Promise.all([
            requestJson(context.base, '/api/bottles', 'POST', payload),
            requestJson(context.base, '/api/bottles', 'POST', payload)
        ]);
        assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
        const stored = await requestJson(context.base, '/api/collection');
        assert.equal(stored.data.bottlings[0].bottles.filter(b => b.inventoryNumber === '000078').length, 1);
        assert.equal(stored.data.reservedInventoryNumbers.filter(n => n === '000078').length, 1);
    } finally {
        await context.stop();
    }
});

test('overlapping requests cannot assign the same inventory number twice', async () => {
    const context = await startTestServer();
    try {
        const created = await requestJson(context.base, '/api/bottlings', 'POST', {
            name: 'Concurrency Test'
        });
        const payload = {
            bottlingId: created.data.bottling.id, inventoryNumber: '009900'
        };
        const results = await Promise.all([requestJson(context.base, '/api/bottles', 'POST', payload), requestJson(context.base, '/api/bottles', 'POST', payload)]);
        assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
        const stored = await requestJson(context.base, '/api/collection');
        assert.equal(stored.data.bottlings[0].bottles.filter(bottle => bottle.inventoryNumber === '009900').length, 1);
    }
    finally {
        await context.stop();
    }
});
