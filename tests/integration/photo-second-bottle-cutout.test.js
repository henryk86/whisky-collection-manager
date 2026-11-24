import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startTestServer, requestJson} from '../helpers/server.js';

const png = 'data:image/png;base64,' +
  fs.readFileSync(new URL('../fixtures/photo-import-reference.png', import.meta.url)).toString('base64');
const webp = 'data:image/webp;base64,UklGRjYAAABXRUJQVlA4ICoAAACQAQCdASoCAAMAAUAmJZgCdLoAA5gA/vDXA/8K1zD8w9rf9XYnwoLAAAA=';

test(
  'first photo on a second physical bottle can save cutout and automatic adjustments independently',
  async () => {
    const server = await startTestServer();
    try {
      const bottling = (await requestJson(
        server.base,
        '/api/bottlings',
        'POST',
        {name: 'Same bottling, two bottles'}
      )).data;
      const second = (await requestJson(server.base, '/api/bottles', 'POST', {
        bottlingId: bottling.bottling.id, inventoryNumber: 'SECOND-0002',
      })).data;
      const firstPhoto = (await requestJson(
        server.base,
        `/api/bottles/${bottling.bottle.id}/photos`,
        'POST',
        {image: png}
      )).data;
      const secondPhoto = (await requestJson(
        server.base,
        `/api/bottles/${second.id}/photos`,
        'POST',
        {image: png}
      )).data;
      const autoSettings = {
        exposure: .3, contrast: 12, highlights: -8, shadows: 22, temperature: 0,
        tint: 0, saturation: 0, clarity: 9, sharpen: 12,
      };
      const response = await requestJson(server.base,
        `/api/bottles/${second.id}/photos/${secondPhoto.id}/cutout`, 'PUT', {
        image: png, adjustment: {image: webp, settings: autoSettings},
      });
      assert.equal(response.status, 200, JSON.stringify(response.data));
      assert.equal(response.data.cutout.selected, true);
      assert.deepEqual(response.data.cutout.adjustment.settings, autoSettings);
      assert.equal(
        response.data.cutout.adjustment.sourcePath,
        response.data.cutout.path
      );
      const saved = (await requestJson(server.base, '/api/collection')).data
        .bottlings[0].bottles;
      assert.equal(saved.length, 2);
      assert.equal(
        saved.find(b => b.id === bottling.bottle.id).photos[0].id,
        firstPhoto.id
      );
      assert.equal(
        saved.find(b => b.id === bottling.bottle.id).photos[0].cutout,
        undefined
      );
      assert.equal(
        saved.find(b => b.id === second.id).photos[0].cutout.adjustment
          .settings.exposure,
        .3
      );
    } finally {await server.stop();}
  }
);


test(
  'camera workflow: first photo on an opened second bottle saves PNG correction fallback after cutout and auto',
  async () => {
    const server = await startTestServer();
    try {
      const openedAt = new Date().toISOString().slice(0, 10);
      const bottling = (await requestJson(server.base, '/api/bottlings', 'POST',
        {name: 'Existing bottling with opened second bottle'})).data;
      const secondResponse = await requestJson(
        server.base,
        '/api/bottles',
        'POST',
        {
          bottlingId: bottling.bottling.id,
          inventoryNumber: 'SECOND-OPEN',
          status: 'open',
          openedAt,
        }
      );
      assert.equal(
        secondResponse.status,
        201,
        JSON.stringify(secondResponse.data)
      );
      const second = secondResponse.data;
      const photo = (await requestJson(
        server.base,
        `/api/bottles/${second.id}/photos`,
        'POST',
        {image: png}
      )).data;
      const url = `/api/bottles/${second.id}/photos/${photo.id}`;
      const settings = {
        exposure: .3, contrast: 12, highlights: -8, shadows: 22,
        temperature: 0, tint: 0, saturation: 0, clarity: 9, sharpen: 12,
      };
      // The browser may return PNG when the editor requests canvas.toBlob(...,
      // 'image/webp').
      // The old server rejected this with "Invalid adjusted background
      // removal".
      const response = await requestJson(server.base, `${url}/cutout`, 'PUT', {
        image: png, adjustment: {image: png, settings},
      });
      assert.equal(response.status, 200, JSON.stringify(response.data));
      assert.equal(response.data.cutout.selected, true);
      assert.deepEqual(response.data.cutout.adjustment.settings, settings);
      assert.equal(
        response.data.cutout.adjustment.sourcePath,
        response.data.cutout.path
      );
      assert.match(response.data.cutout.adjustment.path, /\.png$/);
      assert.equal(
        fs.existsSync(new URL(`file://${server.dir}/${response.data.cutout
          .adjustment.path}`)),
        true
      );
      const collection =
        (await requestJson(server.base, '/api/collection')).data;
      const bottles = collection.bottlings.find(b => b.id ===
        bottling.bottling.id).bottles;
      assert.equal(bottles.length, 2);
      assert.equal(bottles.find(b => b.id === second.id).openedAt, openedAt);
      assert.equal(
        bottles.find(b => b.id === second.id).photos[0].cutout.adjustment.path,
        response.data.cutout.adjustment.path
      );
      assert.equal(
        bottles.find(b => b.id === bottling.bottle.id).photos.length,
        0
      );
      // The original-photo correction endpoint must also support the same
      // fallback.
      const original = await requestJson(server.base, `${url}/cutout`, 'PATCH', {selected: false});
      assert.equal(original.status, 200);
      const originalEdit = await requestJson(
        server.base,
        `${url}/adjustments`,
        'PUT',
        {
          image: png, settings,
        }
      );
      assert.equal(originalEdit.status, 200, JSON.stringify(originalEdit.data));
      assert.match(originalEdit.data.adjustment.path, /\.png$/);
      assert.ok(originalEdit.data.cutout.adjustment.path.endsWith('.png'));
      // Do not accept other formats or MIME labels that disagree with their
      // bytes.
      const spoofed = await requestJson(
        server.base,
        `${url}/adjustments`,
        'PUT',
        {
          image: png.replace('data:image/png;', 'data:image/jpeg;'), settings,
        }
      );
      assert.equal(spoofed.status, 400);
    } finally {await server.stop();}
  }
);
