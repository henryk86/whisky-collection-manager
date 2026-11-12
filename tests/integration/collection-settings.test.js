import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, requestJson } from '../helpers/server.js';

test('founding year persists in collection.json, is included in API data and can be cleared', async () => {
    const server = await startTestServer();
    try {
        const initial = await requestJson(server.base, '/api/collection');
        assert.equal(initial.data.settings.establishedYear, null);
        const response = await requestJson(server.base, '/api/settings', 'PATCH', { establishedYear: 1996 });
        assert.equal(response.status, 200);
        assert.equal(response.data.establishedYear, 1996);
        const current = await requestJson(server.base, '/api/collection');
        assert.equal(current.data.settings.establishedYear, 1996);
        const stored = JSON.parse(fs.readFileSync(path.join(server.dir, 'data/collection.json'), 'utf8'));
        assert.equal(stored.settings.establishedYear, 1996);
        for (const year of ['1997', 1599, 2100, 2010.5, false, {}, undefined]) {
            const invalid = await requestJson(server.base, '/api/settings', 'PATCH', { establishedYear: year });
            assert.equal(invalid.status, 400, `Rejected invalid value ${year}`);
        }
        const afterInvalid = await requestJson(server.base, '/api/collection');
        assert.equal(afterInvalid.data.settings.establishedYear, 1996);
        const cleared = await requestJson(server.base, '/api/settings', 'PATCH', { establishedYear: null });
        assert.equal(cleared.status, 200);
        assert.equal((await requestJson(server.base, '/api/collection')).data.settings.establishedYear, null);
        // Older pre-settings backups remain valid in the same schema version.
        const legacy = { ...stored };
        delete legacy.settings;
        const imported = await requestJson(server.base, '/api/import/json', 'POST', legacy);
        assert.equal(imported.status, 200);
        const updated = await requestJson(server.base, '/api/settings', 'PATCH', { establishedYear: 1988 });
        assert.equal(updated.status, 200);
        assert.equal((await requestJson(server.base, '/api/collection')).data.settings.establishedYear, 1988);
    } finally {
        await server.stop();
    }
});
