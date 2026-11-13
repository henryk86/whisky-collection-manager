import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from '../helpers/server.js';

test('HTTP error payloads use English with stable translatable codes', async () => {
    const server = await startTestServer();
    try {
        const response = await fetch(server.base + '/api/bottlings', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': 'de' },
            body: JSON.stringify([])
        });
        assert.equal(response.status, 400);
        const payload = await response.json();
        assert.equal(payload.error, 'JSON request must be an object.');
        assert.equal(payload.errorCode, 'api.errors.jsonRequestMustBeAnObject');
        assert.doesNotMatch(payload.error, /Ungültig|muss|Anfrage/);

        const badPath = await fetch(server.base + '/%E0');
        assert.equal(badPath.status, 400);
        assert.deepEqual(await badPath.json(), {
            error: 'Invalid path.', errorCode: 'api.errors.invalidPath'
        });
    } finally {
        await server.stop();
    }
});
