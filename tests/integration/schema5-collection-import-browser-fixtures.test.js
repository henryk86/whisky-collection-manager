import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer, requestJson} from '../helpers/server.js';

test(
  'schema 6 bulk-import fixtures preserve valid bottling and bottle structures',
  async () => {
    const server = await startTestServer();
    try {
      for (const count of [6, 75, 450]) {
        const collection =
          (await requestJson(server.base, '/api/collection')).data;
        collection.bottlings = Array.from({length: count}, (_, index) => ({
          id: `browser-fixture-${index + 1}`,
          name: `Fixture Malt ${index + 1}`,
          distilleryIds: [],
          tastings: [],
          bottles: count === 75 ? [{
            id: `fixture-bottle-${index + 1}`,
            inventoryNumber: String(index + 1),
            status: 'closed',
            volumeType: 'standard',
          }] : [],
          createdAt: '2026-11-06T08:00:00.000Z',
        }));
        const imported =
          await requestJson(server.base, '/api/import/json', 'POST',
            collection);
        assert.equal(
          imported.status,
          200,
          `${count} bottlings must import: ${JSON.stringify(imported.data)}`
        );
        const stored = (await requestJson(server.base, '/api/collection')).data;
        assert.equal(stored.bottlings.length, count);
        assert.equal(
          stored.bottlings.every(b => Array.isArray(b.tastings)),
          true
        );
      }
    } finally {
      await server.stop();
    }
  }
);
