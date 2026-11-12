import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from '../helpers/server.js';

test('local language resources are served as JSON and path traversal is rejected', async () => {
    const server = await startTestServer();
    try {
        for (const file of ['de.json','index.json']) {
            const response = await fetch(`${server.base}/locales/${file}`);
            assert.equal(response.status, 200);
            assert.match(response.headers.get('content-type'), /application\/json/);
            assert.equal(typeof await response.json(), 'object');
        }
        const missing = await fetch(`${server.base}/locales/../private.json`);
        assert.equal(missing.status, 404);
    } finally {
        await server.stop();
    }
});
