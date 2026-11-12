import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, requestJson } from '../helpers/server.js';
import { writeReadableZip, inspectReadableZip } from '../../shared/backup-zip.js';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
const zipPassword = 'SicheresTestpasswort-2026-mindestens-14!';

async function fixture(base) {
    const bottle = (await requestJson(base, '/api/bottlings', 'POST', {name:'Cutout Test'})).data.bottle;
    const photo = (await requestJson(base, `/api/bottles/${bottle.id}/photos`, 'POST', {image:png})).data;
    return { bottle, photo, endpoint: `/api/bottles/${bottle.id}/photos/${photo.id}/cutout` };
}

test('cutout is an optional version of an unchanged original; selection and removal work', async () => {
    const ctx = await startTestServer();
    try {
        const {bottle, photo, endpoint} = await fixture(ctx.base);
        const original = fs.readFileSync(path.join(ctx.dir, photo.path));
        const initial = (await requestJson(ctx.base,'/api/collection')).data.bottlings[0].bottles[0].photos[0];
        assert.equal(initial.cutout, undefined);
        assert.equal((await requestJson(ctx.base, endpoint, 'PUT', {image:'data:image/jpeg;base64,AAAA'})).status, 400);
        assert.equal((await requestJson(ctx.base, endpoint, 'PUT', {image:'data:image/png;base64,AAAA'})).status, 400);
        let result = await requestJson(ctx.base, endpoint, 'PUT', {image:png});
        assert.equal(result.status, 200, JSON.stringify(result.data));
        assert.equal(result.data.path, photo.path);
        assert.deepEqual({model:result.data.cutout.model,selected:result.data.cutout.selected}, {model:'u2netp-v1',selected:true});
        const derivative = result.data.cutout.path;
        assert.match(derivative, /-cutout-[\w-]+\.png$/);
        assert.notEqual(derivative, photo.path);
        assert.ok(fs.existsSync(path.join(ctx.dir, derivative)));
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir, photo.path)), original);
        result = await requestJson(ctx.base, endpoint, 'PATCH', {selected:false});
        assert.equal(result.status, 200);
        assert.equal(result.data.cutout.selected, false);
        assert.equal((await requestJson(ctx.base, endpoint, 'PATCH', {selected:'false'})).status, 400);
        assert.equal((await requestJson(ctx.base, endpoint, 'PATCH', {selected:true})).data.cutout.selected, true);
        const replacement = await requestJson(ctx.base, endpoint, 'PUT', {image:png});
        assert.equal(replacement.status, 200);
        assert.notEqual(replacement.data.cutout.path, derivative);
        assert.equal(fs.existsSync(path.join(ctx.dir, derivative)), false, 'old derivative removed after replacement');
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir, photo.path)), original);
        const zip = path.join(ctx.dir, 'cutout-backup.zip');
        writeReadableZip(ctx.dir, zip, zipPassword);
        const extracted = path.join(ctx.dir, 'unpacked');
        inspectReadableZip(zip, extracted, zipPassword);
        assert.ok(fs.existsSync(path.join(extracted, replacement.data.cutout.path)));
        assert.deepEqual(fs.readFileSync(path.join(extracted, photo.path)), original);
        assert.equal((await requestJson(ctx.base, endpoint, 'DELETE')).status, 200);
        assert.equal(fs.existsSync(path.join(ctx.dir, replacement.data.cutout.path)), false);
        assert.ok(fs.existsSync(path.join(ctx.dir, photo.path)));
        assert.equal((await requestJson(ctx.base, endpoint, 'DELETE')).status, 404);
        const after = (await requestJson(ctx.base,'/api/collection')).data.bottlings[0].bottles[0].photos[0];
        assert.equal(after.cutout, undefined);
        assert.equal(after.path, photo.path);
    } finally { await ctx.stop(); }
});

test('deleting an original photo removes its derivative and no other photo', async () => {
    const ctx = await startTestServer();
    try {
        const {bottle,photo,endpoint} = await fixture(ctx.base);
        const extra = (await requestJson(ctx.base, `/api/bottles/${bottle.id}/photos`, 'POST', {image:png})).data;
        const derivative = (await requestJson(ctx.base, endpoint, 'PUT', {image:png})).data.cutout.path;
        const deleted = await requestJson(ctx.base, `/api/bottles/${bottle.id}/photos/${photo.id}`, 'DELETE');
        assert.equal(deleted.status, 200);
        assert.ok(!fs.existsSync(path.join(ctx.dir,photo.path)));
        assert.ok(!fs.existsSync(path.join(ctx.dir,derivative)));
        assert.ok(fs.existsSync(path.join(ctx.dir,extra.path)));
        assert.equal((await requestJson(ctx.base, endpoint, 'PUT', {image:png})).status, 404);
    } finally { await ctx.stop(); }
});
