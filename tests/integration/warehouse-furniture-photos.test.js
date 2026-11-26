import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startTestServer, requestJson as api} from '../helpers/server.js';
import {writeReadableZip, inspectReadableZip} from '../../shared/backup-zip.js';

const px =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOfb9AcAAAAASUVORK5CYII=';
test(
  'furniture photo API: upload, reorder, validate, preserve on furniture edit, remove and backup-covered storage',
  async () => {
    const ctx = await startTestServer();
    try {
      const room = (await api(ctx.base, '/api/warehouse/rooms', 'POST', {name: 'Photo room', width: 5, height: 5})).data;
      const furniture = (await api(
        ctx.base,
        `/api/warehouse/rooms/${room.id}/furniture`,
        'POST',
        {
          name: 'Photographed shelf',
          type: 'regal',
          x: 0,
          y: 0,
          width: 1,
          depth: 0.5,
          rotation: 0,
          itemHeight: 1.8,
        }
      )).data;
      const url = `/api/warehouse/furniture/${furniture.id}`;
      const photo1 = await api(ctx.base, url + '/photos', 'POST', {image: px});
      const photo2 = await api(ctx.base, url + '/photos', 'POST', {image: px});
      assert.equal(photo1.status, 201);
      assert.equal(photo2.status, 201);
      assert.match(photo1.data.path, /^images\//);
      assert.ok(fs.existsSync(path.join(ctx.dir, photo1.data.path)));
      assert.equal(
        (await api(ctx.base, url + '/photos/order', 'PUT', {photoIds: [photo2.data.id, photo1.data.id]})).status,
        200
      );
      assert.equal(
        (await api(ctx.base, url + '/photos/order', 'PUT', {photoIds: [photo1.data.id, photo1.data.id]})).status,
        400
      );
      const saved = (await api(ctx.base, url, 'PATCH', {
        ...furniture,
        name: 'Renamed shelf',
      })).data;
      assert.equal(saved.photos?.length, 2);
      assert.deepEqual(saved.photos.map(photo => photo.id), [photo2.data.id, photo1.data.id]);
      const archive = path.join(ctx.dir, 'furniture-photos-backup.zip');
      const password = 'Test-Backup-Passwort-2026';
      writeReadableZip(ctx.dir, archive, password);
      const restored = path.join(ctx.dir, 'restored-furniture-photos');
      const manifest = inspectReadableZip(archive, restored, password);
      assert.equal(manifest.encrypted, true);
      for (const photo of [photo1.data, photo2.data]) {
        assert.deepEqual(
          fs.readFileSync(path.join(restored, photo.path)),
          fs.readFileSync(path.join(ctx.dir, photo.path))
        );
      }
      const restoredWarehouse = JSON.parse(fs.readFileSync(path.join(restored, 'data', 'warehouse.json'), 'utf8'));
      assert.deepEqual(
        restoredWarehouse.rooms.flatMap(room => room.furniture).find(item => item.id === furniture.id).photos.map(photo => photo.id),
        [photo2.data.id, photo1.data.id]
      );
      assert.equal((await api(ctx.base, url + '/photos/' + photo1.data.id, 'DELETE')).status, 200);
      assert.equal(fs.existsSync(path.join(ctx.dir, photo1.data.path)), false);
      assert.equal((await api(ctx.base, url, 'DELETE')).status, 200);
      assert.equal(fs.existsSync(path.join(ctx.dir, photo2.data.path)), false);
    } finally {await ctx.stop();}
  }
);
