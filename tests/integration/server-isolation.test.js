import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer, requestJson} from '../helpers/server.js';

test(
  'parallel integration servers bind unique ports and cannot mix collections',
  async () => {
    // Other test files also launch isolated servers in parallel in CI.
    const servers = await Promise.all(Array.from({length: 4}, () =>
      startTestServer()));
    try {
      assert.equal(
        new Set(servers.map(server => server.base)).size,
        servers.length,
        'each child must own a unique listening socket'
      );
      const writes = await Promise.all(servers.map((server, index) =>
        requestJson(
          server.base,
          '/api/bottlings',
          'POST',
          {
            name: `Independent integration server ${index}`,
          }
        )));
      for (const write of writes) assert.equal(write.status, 201);
      const collections = await Promise.all(servers.map(server =>
        requestJson(server.base, '/api/collection')));
      collections.forEach((response, index) => {
        assert.equal(response.status, 200);
        assert.deepEqual(
          response.data.bottlings.map(bottling => bottling.name),
          [
            `Independent integration server ${index}`,
          ]
        );
      });
    }
    finally {
      await Promise.all(servers.map(server => server.stop()));
    }
  }
);
