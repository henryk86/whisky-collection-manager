import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, requestJson } from '../helpers/server.js';

test('API saves editable distillery locations without changing associated bottlings or collection schema', async () => {
    const server = await startTestServer();
    try {
        const coll = (await requestJson(server.base, '/api/collection')).data;
        const kilchoman = coll.distilleries.find(d => d.name === 'Kilchoman');
        assert.ok(kilchoman);
        const added = await requestJson(server.base, '/api/bottlings', 'POST', {
            name: 'Test Kilchoman', distilleryIds: [kilchoman.id],
            firstBottle: { inventoryNumber: '000911', status: 'closed' },
        });
        assert.equal(added.status, 201);
        const coords = await requestJson(server.base, `/api/distilleries/${kilchoman.id}`, 'PATCH', { name: kilchoman.name, latitude: 55.7869, longitude: -6.4308 });
        assert.equal(coords.status, 200);
        assert.equal(coords.data.latitude, 55.7869);
        const updated = (await requestJson(server.base, '/api/collection')).data;
        assert.equal(updated.schemaVersion, 4);
        assert.equal(updated.bottlings.length, 1);
        assert.equal(updated.bottlings[0].distilleryIds[0], kilchoman.id);
        const stored = JSON.parse(fs.readFileSync(path.join(server.dir, 'data', 'collection.json')));
        assert.equal(stored.distilleries.find(d => d.id === kilchoman.id).longitude, -6.4308);
        for (const invalid of [{ latitude: 92, longitude: 0 }, { latitude: '55', longitude: '-6' }, { latitude: 54, longitude: null }]) {
            const response = await requestJson(server.base, `/api/distilleries/${kilchoman.id}`, 'PATCH', { name: kilchoman.name, ...invalid });
            assert.equal(response.status, 400);
        }
        const cleared = await requestJson(server.base, `/api/distilleries/${kilchoman.id}`, 'PATCH', { name: kilchoman.name, latitude: null, longitude: null });
        assert.equal(cleared.status, 200);
        assert.equal(cleared.data.latitude, null);
        const created = await requestJson(server.base, '/api/distilleries', 'POST', { name: 'Bespoke Distillery', latitude: 50.23, longitude: 7.17 });
        assert.equal(created.status, 201);
        assert.equal(created.data.longitude, 7.17);
        const existing = await requestJson(server.base, '/api/distilleries', 'POST', { name: 'No Coordinate Distillery' });
        assert.equal(existing.status, 201);
        assert.equal(existing.data.latitude, null);
    } finally { await server.stop(); }
});
