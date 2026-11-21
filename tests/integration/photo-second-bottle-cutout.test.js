import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startTestServer,requestJson} from '../helpers/server.js';

const png = 'data:image/png;base64,' + fs.readFileSync(new URL('../fixtures/photo-import-reference.png', import.meta.url)).toString('base64');
const webp = 'data:image/webp;base64,UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAMAAUAmJZgCdLoAA5gA/vDXA/8K1zD8w9rf9XYnwoLAAAA=';

test('first photo on a second physical bottle can save cutout and automatic adjustments independently', async () => {
    const server = await startTestServer();
    try {
        const bottling = (await requestJson(server.base,'/api/bottlings','POST',{name:'Same bottling, two bottles'})).data;
        const second = (await requestJson(server.base,'/api/bottles','POST',{
            bottlingId:bottling.bottling.id, inventoryNumber:'SECOND-0002'
        })).data;
        const firstPhoto = (await requestJson(server.base,`/api/bottles/${bottling.bottle.id}/photos`,'POST',{image:png})).data;
        const secondPhoto = (await requestJson(server.base,`/api/bottles/${second.id}/photos`,'POST',{image:png})).data;
        const autoSettings = {exposure:.3,contrast:12,highlights:-8,shadows:22,temperature:0,
            tint:0,saturation:0,clarity:9,sharpen:12};
        const response = await requestJson(server.base,
            `/api/bottles/${second.id}/photos/${secondPhoto.id}/cutout`,'PUT',{
                image:png,adjustment:{image:webp,settings:autoSettings}
            });
        assert.equal(response.status,200,JSON.stringify(response.data));
        assert.equal(response.data.cutout.selected,true);
        assert.deepEqual(response.data.cutout.adjustment.settings,autoSettings);
        assert.equal(response.data.cutout.adjustment.sourcePath,response.data.cutout.path);
        const saved = (await requestJson(server.base,'/api/collection')).data.bottlings[0].bottles;
        assert.equal(saved.length,2);
        assert.equal(saved.find(b=>b.id===bottling.bottle.id).photos[0].id,firstPhoto.id);
        assert.equal(saved.find(b=>b.id===bottling.bottle.id).photos[0].cutout,undefined);
        assert.equal(saved.find(b=>b.id===second.id).photos[0].cutout.adjustment.settings.exposure,.3);
    } finally {await server.stop();}
});
