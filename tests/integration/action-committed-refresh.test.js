import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer, requestJson} from '../helpers/server.js';
import {request} from '../../public/js/api.js';
import {loadResources} from '../../public/js/ui/refresh-resources.js';
import {runAction} from '../../public/js/ui/action-result.js';

test(
  'N-3: an accepted POST remains successful when the next warehouse refresh \
fails',
  async () => {
    const server = await startTestServer();
    try {
      const state = {
        collection: (await requestJson(server.base, '/api/collection')).data,
        warehouse: (await requestJson(server.base, '/api/warehouse')).data,
      };
      let refreshWarning;
      const name = 'Committed mutation survives a simulated 503';
      const result = await runAction(
        () => request(`${server.base}/api/bottlings`, {
          method: 'POST', body: JSON.stringify({
            name, whiskyType: 'blended_malt', abv: 46, volumeMl: 700,
            firstBottle: {inventoryNumber: '007711', status: 'closed'},
          }),
        }),
        () => loadResources(state, async url => {
          if (url === '/api/warehouse') {
            const failure =
              new Error('The request could not be completed (HTTP 503)');
            failure.status = 503;
            throw failure;
          }
          const response = await fetch(server.base + url);
          assert.equal(response.status, 200);
          return response.json();
        }),
        error => assert.fail(`Mutation was committed: ${error.message}`),
        error => {refreshWarning = error;}
      );
      assert.equal(result.ok, true);
      assert.equal(result.refreshError, refreshWarning);
      assert.equal(result.refreshError.status, 503);
      assert.equal(
        state.collection.bottlings.filter(item => item.name === name).length,
        1
      );
      const actual = (await requestJson(server.base, '/api/collection')).data;
      assert.equal(
        actual.bottlings.filter(item => item.name === name).length,
        1,
        'no duplicate create operation was sent following the refresh failure'
      );
    } finally {
      await server.stop();
    }
  }
);
