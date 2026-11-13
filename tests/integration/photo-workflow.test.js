import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, requestJson } from '../helpers/server.js';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';

test('Whiskybase image is physically copied to an individual bottle only on approval', async () => {
    const ctx = await startTestServer();
    try {
        const created = await requestJson(ctx.base, '/api/bottlings', 'POST', { name:'Islay Release' });
        assert.equal(created.status, 201);
        const bottle = created.data.bottle;
        const staged = await requestJson(ctx.base, '/api/import-image/stage', 'POST', { image });
        assert.equal(staged.status, 201, JSON.stringify(staged.data));
        assert.match(staged.data.token, /^[0-9a-f-]{36}$/);
        const before = (await requestJson(ctx.base, '/api/collection')).data.bottlings[0].bottles[0];
        assert.deepEqual(before.photos, []);
        const preview = await fetch(`${ctx.base}/api/import-image/stage/${staged.data.token}`);
        assert.equal(preview.status, 200);
        assert.equal(preview.headers.get('content-type'), 'image/png');
        assert.ok((await preview.arrayBuffer()).byteLength > 0);
        const saved = await requestJson(ctx.base, `/api/bottles/${bottle.id}/photos/from-stage`, 'POST', { token: staged.data.token });
        assert.equal(saved.status, 201, JSON.stringify(saved.data));
        assert.equal(saved.data.source, 'whiskybase');
        assert.ok(saved.data.path.startsWith(`images/${bottle.id}/`));
        assert.ok(fs.existsSync(path.join(ctx.dir, saved.data.path)));
        const after = (await requestJson(ctx.base, '/api/collection')).data.bottlings[0].bottles[0];
        assert.equal(after.photos.length, 1);
        assert.equal(after.photos[0].path, saved.data.path);
        assert.equal(after.photos[0].source, 'whiskybase');
        assert.equal(JSON.stringify(after).includes('static.whiskybase.com'), false);
        const twice = await requestJson(ctx.base, `/api/bottles/${bottle.id}/photos/from-stage`, 'POST', { token: staged.data.token });
        assert.equal(twice.status, 404);
        const zipResponse = await fetch(ctx.base + '/api/export/zip', { headers: { 'X-Backup-Admin-Token': 'a'.repeat(64) } });
        assert.equal(zipResponse.status, 200);
        const zipBytes = Buffer.from(await zipResponse.arrayBuffer());
        assert.ok(zipBytes.includes(Buffer.from(saved.data.path)));
    } finally { await ctx.stop(); }
});

test('generic staged import does not falsely label a reference image as Whiskybase', async () => {
    const ctx = await startTestServer();
    try {
        const created = await requestJson(ctx.base, '/api/bottlings', 'POST', { name: 'Generic Import' });
        const id = created.data.bottle.id;
        const staged = await requestJson(ctx.base, '/api/import-image/stage', 'POST', { image, source: null });
        assert.equal(staged.status, 201);
        const attached = await requestJson(ctx.base, `/api/bottles/${id}/photos/from-stage`, 'POST', { token: staged.data.token });
        assert.equal(attached.status, 201);
        assert.equal(Object.hasOwn(attached.data, 'source'), false);
        const photos = (await requestJson(ctx.base, '/api/collection')).data.bottlings[0].bottles[0].photos;
        assert.equal(Object.hasOwn(photos[0], 'source'), false);
        const otherSource = await requestJson(ctx.base, '/api/import-image/stage', 'POST', { image, source: 'other-catalog' });
        assert.equal(otherSource.status, 201);
        const otherPhoto = await requestJson(ctx.base, `/api/bottles/${id}/photos/from-stage`, 'POST', { token: otherSource.data.token });
        assert.equal(otherPhoto.status, 201);
        assert.equal(Object.hasOwn(otherPhoto.data, 'source'), false);
    } finally { await ctx.stop(); }
});

test('malformed / oversized / non-image stage rejects without writing collection', async () => {
    const ctx = await startTestServer();
    try {
        for (const bad of ['data:image/png;base64,PGh0bWw+', 'data:text/html;base64,PGh0bWw+', 'https://static.whiskybase.com/a.png']) {
            const response = await requestJson(ctx.base, '/api/import-image/stage', 'POST', {image:bad});
            assert.equal(response.status, 400);
        }
        const stage = await requestJson(ctx.base, '/api/import-image/stage', 'POST', {image});
        assert.equal(stage.status, 201);
        const invalid = await requestJson(ctx.base, '/api/bottles/nonexistent/photos/from-stage', 'POST', {token:stage.data.token});
        assert.equal(invalid.status, 404);
        // Failed association must not consume the staged image.
        const preview = await fetch(ctx.base + `/api/import-image/stage/${stage.data.token}`);
        assert.equal(preview.status, 200);
    } finally { await ctx.stop(); }
});

test('photo reorder preserves originals, cover order, and rejects ID injection', async () => {
    const ctx = await startTestServer();
    try {
        const created = await requestJson(ctx.base, '/api/bottlings', 'POST', {name:'Photo Order'});
        const id = created.data.bottle.id;
        const first = await requestJson(ctx.base, `/api/bottles/${id}/photos`, 'POST', {image});
        const second = await requestJson(ctx.base, `/api/bottles/${id}/photos`, 'POST', {image});
        const third = await requestJson(ctx.base, `/api/bottles/${id}/photos`, 'POST', {image});
        const order = [third.data.id, first.data.id, second.data.id];
        const res = await requestJson(ctx.base, `/api/bottles/${id}/photos/order`, 'PUT', {photoIds:order});
        assert.equal(res.status, 200, JSON.stringify(res.data));
        assert.deepEqual(res.data.map(photo=>photo.id), order);
        assert.equal(res.data[0].path, third.data.path);
        const duplicate = await requestJson(ctx.base, `/api/bottles/${id}/photos/order`, 'PUT', {photoIds:[third.data.id,third.data.id,second.data.id]});
        assert.equal(duplicate.status, 409);
        const missing = await requestJson(ctx.base, `/api/bottles/${id}/photos/order`, 'PUT', {photoIds:[third.data.id,first.data.id]});
        assert.equal(missing.status, 409);
        const injection = await requestJson(ctx.base, `/api/bottles/${id}/photos/order`, 'PUT', {photoIds:[third.data.id,first.data.id,'evil-photo']});
        assert.equal(injection.status, 409);
        const collection = (await requestJson(ctx.base,'/api/collection')).data;
        assert.deepEqual(collection.bottlings[0].bottles[0].photos.map(p=>p.id),order);
        assert.equal(fs.existsSync(path.join(ctx.dir, first.data.path)), true);
    } finally { await ctx.stop(); }
});

test('the image stage grants CORS only to Chrome/Edge extensions, never to random pages', async () => {
    const ctx=await startTestServer();
    try {
        const ext='chrome-extension://'+'a'.repeat(32);
        const preflight=await fetch(ctx.base+'/api/import-image/stage',{method:'OPTIONS',headers:{Origin:ext,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
        assert.equal(preflight.status,204);
        assert.equal(preflight.headers.get('access-control-allow-origin'),ext);
        const denied=await fetch(ctx.base+'/api/import-image/stage',{method:'OPTIONS',headers:{Origin:'https://untrusted.invalid','Access-Control-Request-Method':'POST'}});
        assert.equal(denied.status,405);
        assert.equal(denied.headers.get('access-control-allow-origin'),null);
        const stage=await fetch(ctx.base+'/api/import-image/stage',{method:'POST',headers:{Origin:ext,'Content-Type':'application/json'},body:JSON.stringify({image})});
        assert.equal(stage.status,201);
        assert.equal(stage.headers.get('access-control-allow-origin'),ext);
    } finally { await ctx.stop(); }
});
