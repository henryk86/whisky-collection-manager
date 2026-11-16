import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startTestServer, requestJson} from '../helpers/server.js';
import {displayPhotoPath,activePhotoAdjustment} from '../../public/js/domain/photo-images.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
const webp = 'data:image/webp;base64,UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAMAAUAmJZgCdLoAA5gA/vDXA/8K1zD8w9rf9XYnwoLAAAA=';
const settings = {exposure:.6,contrast:12};

test('combined editing and cutout keeps both editable variants, backups and original', async () => {
    const ctx = await startTestServer();
    try {
        const bottle = (await requestJson(ctx.base,'/api/bottlings','POST',{name:'One preview photo editor'})).data.bottle;
        const photo = (await requestJson(ctx.base,`/api/bottles/${bottle.id}/photos`,'POST',{image:png})).data;
        const route = `/api/bottles/${bottle.id}/photos/${photo.id}`;
        const initial = fs.readFileSync(path.join(ctx.dir,photo.path));
        const originalEdit = (await requestJson(ctx.base,`${route}/adjustments`,'PUT',{image:webp,settings})).data;
        assert.equal(displayPhotoPath(originalEdit),originalEdit.adjustment.path);
        const rejected = await requestJson(ctx.base,`${route}/cutout`,'PUT',
            {image:png,adjustment:{image:png,settings}});
        assert.equal(rejected.status,400);
        const combined = await requestJson(ctx.base,`${route}/cutout`,'PUT',
            {image:png,adjustment:{image:webp,settings}});
        assert.equal(combined.status,200,JSON.stringify(combined.data));
        const cutout = combined.data.cutout;
        assert.equal(cutout.selected,true);
        assert.equal(cutout.adjustment.sourcePath,cutout.path);
        assert.deepEqual(cutout.adjustment.settings,{exposure:.6,contrast:12,shadows:0,highlights:0,temperature:0,tint:0,saturation:0,clarity:0,sharpen:0});
        assert.equal(displayPhotoPath(combined.data),cutout.adjustment.path);
        assert.equal(combined.data.adjustment.path,originalEdit.adjustment.path);
        assert.ok(fs.existsSync(path.join(ctx.dir,cutout.adjustment.path)));
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,photo.path)),initial);

        const reverted = (await requestJson(ctx.base,`${route}/cutout`,'PATCH',{selected:false})).data;
        assert.equal(displayPhotoPath(reverted),originalEdit.adjustment.path);
        assert.equal(activePhotoAdjustment(reverted).sourcePath,photo.path);
        const again = (await requestJson(ctx.base,`${route}/cutout`,'PATCH',{selected:true})).data;
        assert.equal(displayPhotoPath(again),cutout.adjustment.path);
        const adjusted = (await requestJson(ctx.base,`${route}/adjustments`,'PUT',
            {image:webp,settings:{temperature:15}})).data;
        assert.equal(adjusted.adjustment.path,originalEdit.adjustment.path);
        assert.equal(adjusted.cutout.adjustment.settings.temperature,15);
        assert.equal(fs.existsSync(path.join(ctx.dir,cutout.adjustment.path)),false);

        const cutRemoved = (await requestJson(ctx.base,`${route}/cutout`,'DELETE')).data;
        assert.equal(cutRemoved.ok,true);
        const surviving = (await requestJson(ctx.base,'/api/collection')).data.bottlings[0].bottles[0].photos[0];
        assert.equal(surviving.cutout,undefined);
        assert.equal(displayPhotoPath(surviving),originalEdit.adjustment.path);
        assert.ok(fs.existsSync(path.join(ctx.dir,originalEdit.adjustment.path)));
        assert.deepEqual(fs.readFileSync(path.join(ctx.dir,photo.path)),initial);
    } finally { await ctx.stop(); }
});
