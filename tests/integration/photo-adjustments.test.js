import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startTestServer, requestJson} from '../helpers/server.js';
import {displayPhotoPath} from '../../public/js/domain/photo-images.js';
import {writeReadableZip, inspectReadableZip} from '../../shared/backup-zip.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
const webp = 'data:image/webp;base64,UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAMAAUAmJZgCdLoAA5gA/vDXA/8K1zD8w9rf9XYnwoLAAAA=';
const settings = {exposure:.5, contrast:12, shadows:20, highlights:-25, temperature:8, tint:2, saturation:5, clarity:9, sharpen:11};

async function fixture(base) {
    const bottle = (await requestJson(base, '/api/bottlings', 'POST', {name:'Photo Editor Test'})).data.bottle;
    const photo = (await requestJson(base, `/api/bottles/${bottle.id}/photos`, 'POST', {image:png})).data;
    return {bottle, photo, photoRoute:`/api/bottles/${bottle.id}/photos/${photo.id}`};
}

test('photo adjustments persist as an editable WebP derivative, preserve originals, and survive backup', async () => {
    const ctx = await startTestServer();
    try {
        const {bottle,photo,photoRoute} = await fixture(ctx.base);
        const original = fs.readFileSync(path.join(ctx.dir, photo.path));
        const route = `${photoRoute}/adjustments`;
        const invalids = [
            {image:webp,settings:{exposure:300}},
            {image:webp,settings:{shadows:'25'}},
            {image:webp,settings:{unknown:1}},
            {image:png,settings},
            {image:webp,settings:{}},
            {image:webp,settings:null}
        ];
        for (const payload of invalids) {
            const result = await requestJson(ctx.base,route,'PUT',payload);
            assert.equal(result.status,400,JSON.stringify(payload));
        }
        const edit = await requestJson(ctx.base,route,'PUT',{image:webp,settings});
        assert.equal(edit.status,200,JSON.stringify(edit.data));
        assert.equal(edit.data.adjustment.sourcePath,photo.path);
        assert.deepEqual(edit.data.adjustment.settings,settings);
        assert.match(edit.data.adjustment.path, /-edit-[\w-]+\.webp$/);
        const first = edit.data.adjustment.path;
        assert.equal(displayPhotoPath(edit.data),first);
        assert.equal((await fetch(ctx.base+'/'+first)).status,200);
        assert.ok(fs.existsSync(path.join(ctx.dir,first)));
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,photo.path)),original);
        const warehouse = (await requestJson(ctx.base,'/api/warehouse')).data;
        assert.equal(warehouse.bottles.find(entry => entry.id === bottle.id).photoPath,first);

        const updated = await requestJson(ctx.base,route,'PUT',{image:webp,settings:{exposure:-.3}});
        assert.equal(updated.status,200,JSON.stringify(updated.data));
        assert.notEqual(updated.data.adjustment.path,first);
        assert.equal(fs.existsSync(path.join(ctx.dir,first)),false,'replaced edit removed');
        assert.equal(updated.data.adjustment.settings.exposure,-.3);
        const second = updated.data.adjustment.path;

        const backup = path.join(ctx.dir,'editor-backup.zip');
        writeReadableZip(ctx.dir,backup,'SicheresTestpasswort-2026-mindestens-14!');
        const restored = path.join(ctx.dir,'unpacked');
        inspectReadableZip(backup,restored,'SicheresTestpasswort-2026-mindestens-14!');
        assert.ok(fs.existsSync(path.join(restored,second)));
        assert.deepEqual(fs.readFileSync(path.join(restored,photo.path)),original);

        const cutout = await requestJson(ctx.base,`${photoRoute}/cutout`,'PUT',{image:png});
        assert.equal(cutout.status,200);
        assert.equal(displayPhotoPath(cutout.data),cutout.data.cutout.path,'old original edit hidden on cutout');
        const editedCutout = await requestJson(ctx.base,route,'PUT',{image:webp,settings:{shadows:40}});
        assert.equal(editedCutout.status,200);
        assert.equal(editedCutout.data.cutout.adjustment.sourcePath,cutout.data.cutout.path);
        const cutoutEdit = editedCutout.data.cutout.adjustment.path;
        assert.equal(editedCutout.data.adjustment.path,second, 'original corrections survive cutting');
        assert.ok(fs.existsSync(path.join(ctx.dir,second)));
        const replacingCutout = await requestJson(ctx.base,`${photoRoute}/cutout`,'PUT',{image:png});
        assert.equal(replacingCutout.status,200);
        assert.equal(replacingCutout.data.adjustment.path,second,'original corrections remain');
        assert.equal(replacingCutout.data.cutout.adjustment,undefined,'outdated cutout edit removed');
        assert.equal(fs.existsSync(path.join(ctx.dir,cutoutEdit)),false);
        const third = await requestJson(ctx.base,route,'PUT',{image:webp,settings});
        assert.equal(third.status,200);
        assert.equal((await requestJson(ctx.base,route,'DELETE')).status,200);
        assert.equal(fs.existsSync(path.join(ctx.dir,third.data.cutout.adjustment.path)),false);
        assert.equal(fs.existsSync(path.join(ctx.dir,photo.path)),true);
        assert.equal((await requestJson(ctx.base,route,'PUT',{image:webp,settings})).status,200);
        const latest = (await requestJson(ctx.base, '/api/collection')).data.bottlings[0].bottles[0].photos[0];
        await requestJson(ctx.base,photoRoute,'DELETE');
        assert.equal(fs.existsSync(path.join(ctx.dir,latest.adjustment.path)),false);
        assert.equal(fs.existsSync(path.join(ctx.dir,latest.cutout.adjustment.path)),false);
        assert.equal(fs.existsSync(path.join(ctx.dir,latest.cutout.path)),false);
        assert.equal(fs.existsSync(path.join(ctx.dir,photo.path)),false);
    } finally { await ctx.stop(); }
});
