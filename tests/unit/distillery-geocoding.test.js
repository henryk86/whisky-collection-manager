import test from 'node:test';
import assert from 'node:assert/strict';
import {findDistilleryLocations}
  from '../../server/services/distillery-geocoding.js';

test(
  'Nominatim lookup is human-triggered, limited, sanitized and cached by name',
  async () => {
    const calls = [];
    /**
     * Derives the mock result from the supplied values.
     *
     * @param {*} url URL of the resource being processed.
     * @param {*} options Options controlling the operation.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    const mock = async (url, options) => {
      calls.push({url, options});
      return {
        ok: true,
        /**
         * Derives the json result from the supplied values.
         * @return {!Promise<*>} Promise for the asynchronous operation.
         */
        json: async () => [
          {
            display_name: 'Kilchoman Distillery, Isle of Islay',
            lat: '55.7869',
            lon: '-6.4308',
          },
          {display_name: 'Invalid', lat: '999', lon: '-6'},
        ],
      };
    };
    const one = await findDistilleryLocations(
      {name: 'Unique Test Kilchoman'},
      {
        /**
         * Derives the now result from the supplied values.
         * @return {number} Calculated numeric value.
         */
        now: () => 100000, fetchImpl: mock,
      }
    );
    assert.equal(one.length, 1);
    assert.equal(one[0].latitude, 55.7869);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.toString()
      .includes('Unique+Test+Kilchoman+distillery'));
    assert.ok(calls[0].options.headers['User-Agent']
      .includes('WhiskyCollectionManager'));
    const cached = await findDistilleryLocations(
      {name: 'unique test kilchoman'},
      {
        /**
         * Derives the now result from the supplied values.
         * @return {number} Calculated numeric value.
         */
        now: () => 100500, fetchImpl: mock,
      }
    );
    assert.deepEqual(cached, one);
    assert.equal(calls.length, 1);
    await assert.rejects(
      findDistilleryLocations(
        {name: 'Other Unique Test Place'},
        {
          /**
           * Derives the now result from the supplied values.
           * @return {number} Calculated numeric value.
           */
          now: () => 100500, fetchImpl: mock,
        }
      ),
      /warten/
    );
    assert.equal(calls.length, 1);
    await assert.rejects(
      findDistilleryLocations(
        {name: 'a'},
        {
          /**
           * Derives the now result from the supplied values.
           * @return {number} Calculated numeric value.
           */
          now: () => 102000, fetchImpl: mock,
        }
      ),
      /Destillerienamen/
    );
  }
);
